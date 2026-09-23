import * as Cesium from "cesium";
import "./style.css";
import {
  createVikingColorMosaicProvider,
  createMolaColorizedElevationProvider,
} from "./marsImagery.js";
import { loadWaypoints, renderTraverse } from "./traverse.js";
import { createSolScrubber } from "./scrubber.js";
// vite-plugin-cesium injects the Cesium widgets.css link tag and the
// static Assets/Widgets/Workers/ThirdParty folders automatically.

// Not currently required -- imagery comes from Mars Trek, terrain from
// self-hosted static tiles -- but harmless to set in case ion-hosted
// assets are added later.
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

// Mars biaxial ellipsoid (equatorial 3396190 m, polar 3376200 m). This is
// Cesium's own built-in Ellipsoid.MARS constant, confirmed to match those
// exact radii in the Cesium source (packages/engine/Source/Core/Ellipsoid.js).
const MARS_ELLIPSOID = Cesium.Ellipsoid.MARS;
Cesium.Ellipsoid.default = MARS_ELLIPSOID;

// Centroid of the actual rover traverse (landing site ~77.45,18.44 through
// the most recent tracked position ~77.23,18.44), not the crater's
// geometric center -- this is what we want the camera centered on.
const ROVER_PATH_LON = 77.34;
const ROVER_PATH_LAT = 18.46;

/**
 * Cesium's camera.flyTo/setView `destination` is the CAMERA EYE position,
 * not the ground point being looked at -- with a non-vertical pitch those
 * are different points, offset by roughly `range / tan(|pitch|)`. Framing
 * a target this way silently looks off-center. flyToBoundingSphere (and
 * camera.lookAt for an instant, non-animated version) correctly center on
 * the target itself.
 */
function boundingSphereFor(lon, lat, ellipsoid) {
  return new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(lon, lat, 0, ellipsoid), 1);
}

/**
 * HeadingPitchRange.range is the slant distance from camera to target, not
 * altitude -- at a non-vertical pitch those differ by sin(|pitch|). This
 * converts a desired altitude into the range value that actually produces it.
 */
function rangeForAltitude(altitude, pitch) {
  return altitude / Math.abs(Math.sin(pitch));
}

const viewer = new Cesium.Viewer("cesiumContainer", {
  ellipsoid: MARS_ELLIPSOID,

  // No Earth basemap/terrain/geocoder.
  baseLayerPicker: false,
  baseLayer: false,
  geocoder: false,
  terrainProvider: new Cesium.EllipsoidTerrainProvider({
    ellipsoid: MARS_ELLIPSOID,
  }), // flat fallback outside the HiRISE DTM's coverage; replaced below

  // Timeline/animation come back in Step 4 for the sol scrubber.
  animation: false,
  timeline: false,

  sceneModePicker: false,
  navigationHelpButton: false,
  homeButton: false,
});

// Cesium only auto-creates scene.skyAtmosphere when the ellipsoid is WGS84,
// so on Mars it's already undefined/absent here — no Earth-blue glow to
// disable, which is exactly the look we want.
viewer.scene.globe.showGroundAtmosphere = false;
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#a97155"); // shows through while tiles are still loading
viewer.scene.backgroundColor = Cesium.Color.BLACK;
viewer.scene.globe.enableLighting = true;

// Vertical exaggeration: Mars relief is real but subtle at regional scale
// (the crater rim is only ~200-600m above the floor over tens of km). A
// mild 2.5x exaggeration is an honest, commonly-used visualization
// technique (clearly not claiming true-to-scale) that makes the rim and
// delta actually read as terrain instead of a near-flat bump.
viewer.scene.verticalExaggeration = 1.5;

// Cesium's default light (SunLight) computes direction from Earth's real
// orbital/rotation ephemeris -- meaningless for a Mars scene, and it makes
// the page's apparent brightness depend on whatever real-world moment
// someone happens to load it. Use a fixed DirectionalLight instead, angled
// as low-angle raking light over Jezero specifically -- the same technique
// HiRISE imagery itself uses for relief clarity -- so lighting is both
// flattering and independent of real-world time.
const lightOrigin = Cesium.Cartesian3.fromDegrees(ROVER_PATH_LON, ROVER_PATH_LAT, 0, MARS_ELLIPSOID);
const enuAtJezero = Cesium.Transforms.eastNorthUpToFixedFrame(lightOrigin, MARS_ELLIPSOID);
const sunAzimuth = Cesium.Math.toRadians(225); // from the southwest
const sunElevation = Cesium.Math.toRadians(35); // low angle, raking light
const localDirectionToSun = new Cesium.Cartesian3(
  Math.cos(sunElevation) * Math.sin(sunAzimuth),
  Math.cos(sunElevation) * Math.cos(sunAzimuth),
  Math.sin(sunElevation),
);
const localLightTravelDirection = Cesium.Cartesian3.negate(localDirectionToSun, new Cesium.Cartesian3());
const fixedLightDirection = Cesium.Matrix4.multiplyByPointAsVector(
  enuAtJezero,
  localLightTravelDirection,
  new Cesium.Cartesian3(),
);
Cesium.Cartesian3.normalize(fixedLightDirection, fixedLightDirection);
viewer.scene.light = new Cesium.DirectionalLight({
  direction: fixedLightDirection,
  intensity: 2.2,
});

// Cesium still creates scene.sun for non-WGS84 ellipsoids, but skips the
// default starfield skybox. Add it back explicitly -- it's Cesium's bundled
// Tycho star-catalog imagery, not Earth-specific, so it reads fine as a
// generic space backdrop here too.
viewer.scene.skyBox = Cesium.SkyBox.createEarthSkyBox();

// camera.lookAt centers instantly on the target point (no fly animation),
// unlike setView's destination-as-eye-position behavior.
const INITIAL_PITCH = Cesium.Math.toRadians(-40);
viewer.camera.lookAt(
  Cesium.Cartesian3.fromDegrees(ROVER_PATH_LON, ROVER_PATH_LAT, 0, MARS_ELLIPSOID),
  new Cesium.HeadingPitchRange(0, INITIAL_PITCH, rangeForAltitude(100000, INITIAL_PITCH)),
);
// Release the fixed look-at transform so normal mouse navigation afterward
// behaves like usual, rather than staying locked to this target.
viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

// Terrain covering the whole crater (~77.05-78.11E, 17.87-18.89N, ~60x60km):
// a coarse global MOLA elevation base (~463m/px native) with the fine HiRISE
// landing-ellipse/delta DTM (1m/px, resampled to ~10m to fit one merged grid)
// composited on top wherever it's available. Pre-tiled to a static
// quantized-mesh pyramid (zoom 0-13, ~3200 tiles, ~25MB), plain static files,
// no backend server needed at runtime. See memory/terrain_pipeline_howto.md
// for how these were generated (the pipeline fixes a real bug where the
// underlying quantized-mesh-encoder library hardcodes Earth's WGS84 radius).
Cesium.CesiumTerrainProvider.fromUrl(`${import.meta.env.BASE_URL}terrain`, {
  requestVertexNormals: true,
  credit:
    "NASA / JPL-Caltech / USGS / University of Arizona (HiRISE) / MGS MOLA — merged crater DTM",
}).then((terrainProvider) => {
  viewer.terrainProvider = terrainProvider;
  const terrainPitch = Cesium.Math.toRadians(-35);
  viewer.camera.flyToBoundingSphere(boundingSphereFor(ROVER_PATH_LON, ROVER_PATH_LAT, MARS_ELLIPSOID), {
    offset: new Cesium.HeadingPitchRange(0, terrainPitch, rangeForAltitude(45000, terrainPitch)),
  });
});

// --- Imagery: Viking color mosaic basemap + toggle-able MOLA elevation overlay ---
const vikingLayer = viewer.imageryLayers.addImageryProvider(
  createVikingColorMosaicProvider(MARS_ELLIPSOID),
);
// The raw Viking mosaic is genuinely muted/grayish at this resolution.
// This is presentation polish on top of real data, not altering it.
vikingLayer.brightness = 1.15;
vikingLayer.contrast = 1.2;
vikingLayer.saturation = 1.3;

const molaLayer = viewer.imageryLayers.addImageryProvider(
  createMolaColorizedElevationProvider(MARS_ELLIPSOID),
);
molaLayer.show = false;

const layerToggle = document.createElement("div");
layerToggle.id = "layer-toggle";
layerToggle.innerHTML = `
  <button type="button" id="basemap-mosaic-btn" class="active">Color mosaic</button>
  <button type="button" id="basemap-mola-btn">MOLA elevation</button>
`;
document.body.appendChild(layerToggle);

const mosaicBtn = document.getElementById("basemap-mosaic-btn");
const molaBtn = document.getElementById("basemap-mola-btn");

// MOLA legend. The colorized layer is a NASA/USGS-rendered image, not raw
// data we control, so we can't read its exact color stops -- but its
// direction and global range are documented (JPL: "purple is low, white is
// high"; global range -8200m to +21229m, Hellas Basin to Olympus Mons).
// The gradient below approximates the well-known MOLA hypsometric scheme
// for that documented range.
const MOLA_MIN_M = -8200;
const MOLA_MAX_M = 21229;

const molaLegend = document.createElement("div");
molaLegend.id = "mola-legend";
molaLegend.className = "hidden";
molaLegend.innerHTML = `
  <div class="legend-title">MOLA Elevation</div>
  <div class="legend-bar"></div>
  <div class="legend-endpoints">
    <span>${MOLA_MIN_M.toLocaleString()} m</span>
    <span>${MOLA_MAX_M.toLocaleString()} m</span>
  </div>
  <div class="legend-note">
    Global range (Hellas Basin to Olympus Mons). Jezero sits low on this
    scale, so local relief here reads as subtle color variation.
  </div>
`;
document.body.appendChild(molaLegend);

// Live lat/lon (and terrain height where available) under the mouse cursor.
const coordReadout = document.createElement("div");
coordReadout.id = "coord-readout";
coordReadout.textContent = "Move over the globe...";
document.body.appendChild(coordReadout);

// A dedicated handler (rather than the viewer's shared screenSpaceEventHandler,
// which also drives default entity-selection behavior) keeps this listener
// isolated and independently disposable.
const coordHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

// pickPosition does a depth-buffer readback -- cheap, but not free on every
// raw mouse-move event, so throttle it rather than run it unthrottled.
let lastCoordUpdate = 0;
const COORD_UPDATE_INTERVAL_MS = 75;

coordHandler.setInputAction((movement) => {
  const now = performance.now();
  if (now - lastCoordUpdate < COORD_UPDATE_INTERVAL_MS) {
    return;
  }
  lastCoordUpdate = now;

  // pickPosition reads the actual rendered depth (terrain-accurate where we
  // have real terrain); pickEllipsoid is a fallback for empty sky/space.
  const cartesian =
    viewer.scene.pickPosition(movement.endPosition) ??
    viewer.camera.pickEllipsoid(movement.endPosition, MARS_ELLIPSOID);

  if (!Cesium.defined(cartesian)) {
    coordReadout.textContent = "Move over the globe...";
    return;
  }

  const cartographic = Cesium.Cartographic.fromCartesian(cartesian, MARS_ELLIPSOID);
  const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
  const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
  const height = cartographic.height.toFixed(0);
  coordReadout.textContent = `${lat}°N, ${lon}°E  (${height} m)`;
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

function setBasemap(showMola) {
  molaLayer.show = showMola;
  mosaicBtn.classList.toggle("active", !showMola);
  molaBtn.classList.toggle("active", showMola);
  molaLegend.classList.toggle("hidden", !showMola);
}
mosaicBtn.addEventListener("click", () => setBasemap(false));
molaBtn.addEventListener("click", () => setBasemap(true));

// Entities (traverse path, markers) don't carry their own credit like
// imagery/terrain providers do, so add one explicitly.
viewer.creditDisplay.addStaticCredit(
  new Cesium.Credit("NASA / JPL-Caltech — Mars 2020 Perseverance traverse data", true),
);

// --- Rover traverse path + notable-site markers + sol scrubber ---
loadWaypoints()
  .then((waypoints) => {
    const { minSol, maxSol } = renderTraverse(viewer, waypoints, MARS_ELLIPSOID);
    createSolScrubber({ viewer, waypoints, minSol, maxSol, ellipsoid: MARS_ELLIPSOID });
  })
  .catch((error) => {
    console.error("Failed to load Perseverance traverse data:", error);
  });
