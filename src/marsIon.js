// Dev-only comparison page: Cesium's official "Cesium Mars" 3D Tiles
// dataset streamed from Cesium ion, instead of our self-built static
// terrain. Not part of the production build (vite only builds index.html),
// so the deployed site stays token-free.
import * as Cesium from "cesium";
import "./style.css";
import { loadWaypoints, renderTraverse } from "./traverse.js";
import { createVikingColorMosaicProvider } from "./marsImagery.js";

const CESIUM_MARS_ASSET_ID = 3644333;
const ROVER_PATH_LON = 77.34;
const ROVER_PATH_LAT = 18.46;

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
Cesium.Ellipsoid.default = Cesium.Ellipsoid.MARS;

// Cesium Mars is a whole-planet 3D Tiles tileset, so it replaces the globe
// entirely rather than draping onto it.
const viewer = new Cesium.Viewer("cesiumContainer", {
  ellipsoid: Cesium.Ellipsoid.MARS,
  globe: false,
  baseLayerPicker: false,
  geocoder: false,
  sceneModePicker: false,
  animation: false,
  timeline: false,
  navigationHelpButton: false,
  homeButton: false,
});
viewer.scene.skyBox = Cesium.SkyBox.createEarthSkyBox();
Object.assign(window, { viewer, Cesium }); // dev page: handy for poking at it from DevTools

const status = document.createElement("div");
status.id = "coord-readout";
status.textContent = "Loading Cesium Mars from ion...";
document.body.appendChild(status);

try {
  const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(CESIUM_MARS_ASSET_ID);
  // Cesium Mars' own texture has a single high-res image strip pasted over
  // Jezero whose colour doesn't match its surroundings. Drape the same NASA
  // Viking mosaic the main app uses so the surface reads uniformly. Left at
  // default brightness/contrast: the tileset's own shading already darkens
  // it, and the main app's boost crushes the shadows to black here.
  tileset.imageryLayers.add(
    new Cesium.ImageryLayer(createVikingColorMosaicProvider(Cesium.Ellipsoid.MARS)),
  );
  viewer.scene.primitives.add(tileset);
  status.textContent = "Cesium Mars (ion asset 3644333)";

  const pitch = Cesium.Math.toRadians(-35);
  viewer.camera.flyToBoundingSphere(
    new Cesium.BoundingSphere(
      Cesium.Cartesian3.fromDegrees(ROVER_PATH_LON, ROVER_PATH_LAT, 0, Cesium.Ellipsoid.MARS),
      1,
    ),
    {
      offset: new Cesium.HeadingPitchRange(0, pitch, 45000 / Math.abs(Math.sin(pitch))),
      duration: 0,
    },
  );

  const waypoints = await loadWaypoints();
  renderTraverse(viewer, waypoints, Cesium.Ellipsoid.MARS);

  // With globe: false, CLAMP_TO_GROUND has no globe to clamp to, so the pins
  // sit at height 0 while the crater floor is ~2.6 km lower, which reads as a
  // sideways shift from an oblique camera. Sample the tileset surface instead.
  const pins = viewer.entities.values.filter((e) => e.billboard);
  const cartographics = pins.map((e) =>
    Cesium.Cartographic.fromCartesian(e.position.getValue(), Cesium.Ellipsoid.MARS),
  );
  await viewer.scene.sampleHeightMostDetailed(cartographics);
  pins.forEach((entity, i) => {
    const c = cartographics[i];
    entity.position = Cesium.Cartesian3.fromRadians(
      c.longitude,
      c.latitude,
      c.height ?? 0,
      Cesium.Ellipsoid.MARS,
    );
    entity.billboard.heightReference = Cesium.HeightReference.NONE;
  });
} catch (error) {
  // Most likely cause: the asset hasn't been added to this ion account yet
  // (ion Asset Depot -> "Cesium Mars" -> Add to my assets).
  status.textContent = `Could not load Cesium Mars: ${error.message ?? error}`;
  console.error(error);
}
