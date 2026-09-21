import * as Cesium from "cesium";
import { NOTABLE_SITES } from "./data/notableSites.js";

// import.meta.env.BASE_URL (Vite's configured `base`, e.g. "/" locally or
// "/repo-name/" on GitHub Pages) -- an absolute "/data/..." path would 404
// under a subpath deployment.
const WAYPOINTS_URL = `${import.meta.env.BASE_URL}data/m20_waypoints.json`;

// Trimmed down, same-origin copy of NASA's live feed
// (mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json). That
// endpoint doesn't send Access-Control-Allow-Origin, so a browser fetch()
// from this app is blocked by CORS -- see memory/project_data_sources.md.
export async function loadWaypoints() {
  const response = await fetch(WAYPOINTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to load waypoints: ${response.status}`);
  }
  const { waypoints } = await response.json();
  return waypoints;
}

// Cyan -> magenta gradient (reads clearly against the rusty Mars basemap,
// unlike a yellow/red ramp which blends in). t is 0 (earliest sol) to 1 (latest).
function colorForT(t) {
  const hue = Cesium.Math.lerp(0.5, 0.83, t); // cyan (0.5) to magenta/purple (0.83)
  return Cesium.Color.fromHsl(hue, 0.85, 0.55);
}

const PIN_BUILDER = new Cesium.PinBuilder();

const PIN_STYLES = {
  landing: { text: "L", color: Cesium.Color.LIME, size: 48 },
  sample: { text: "S", color: Cesium.Color.ORANGE, size: 42 },
  milestone: { text: "M", color: Cesium.Color.CORNFLOWERBLUE, size: 42 },
  current: { text: "R", color: Cesium.Color.CYAN, size: 46 },
};

function pinDataUrl(type) {
  const style = PIN_STYLES[type] ?? PIN_STYLES.sample;
  return PIN_BUILDER.fromText(style.text, style.color, style.size).toDataURL();
}

/**
 * Draws the sol-colored traverse polyline and the notable-site billboards.
 * Returns { minSol, maxSol } for reuse by the Step 4 sol scrubber.
 */
export function renderTraverse(viewer, waypoints, ellipsoid) {
  const sols = waypoints.map((w) => w.sol);
  const minSol = Math.min(...sols);
  const maxSol = Math.max(...sols);
  const solRange = Math.max(maxSol - minSol, 1);

  const instances = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const t = (a.sol - minSol) / solRange;

    instances.push(
      new Cesium.GeometryInstance({
        geometry: new Cesium.GroundPolylineGeometry({
          positions: Cesium.Cartesian3.fromDegreesArray(
            [a.lon, a.lat, b.lon, b.lat],
            ellipsoid,
          ),
          width: 4.0,
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(colorForT(t)),
        },
      }),
    );
  }

  if (Cesium.GroundPolylinePrimitive.isSupported(viewer.scene)) {
    viewer.scene.groundPrimitives.add(
      new Cesium.GroundPolylinePrimitive({
        geometryInstances: instances,
        appearance: new Cesium.PolylineColorAppearance(),
      }),
    );
  } else {
    // Rare (older GPUs without depth-texture support): fall back to a flat
    // polyline per segment. Fine here since the terrain is flat anyway.
    console.warn("GroundPolylinePrimitive unsupported; falling back to flat polylines.");
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const t = (a.sol - minSol) / solRange;
      viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(
            [a.lon, a.lat, b.lon, b.lat],
            ellipsoid,
          ),
          width: 4.0,
          material: colorForT(t),
        },
      });
    }
  }

  for (const site of NOTABLE_SITES) {
    viewer.entities.add({
      name: site.name,
      position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, 0, ellipsoid),
      billboard: {
        image: pinDataUrl(site.type),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      description: `
        <p><strong>Sol ${site.sol}</strong></p>
        <p>${site.description}</p>
        <p>${site.lat.toFixed(4)}°N, ${site.lon.toFixed(4)}°E</p>
      `,
    });
  }

  return { minSol, maxSol };
}

/**
 * Latest waypoint at or before targetSol -- i.e. where the rover actually
 * was on that sol, given drives don't happen every sol. Assumes waypoints
 * is sorted ascending by sol (true for the loaded feed).
 */
export function findWaypointAtSol(waypoints, targetSol) {
  let result = waypoints[0];
  for (const w of waypoints) {
    if (w.sol > targetSol) break;
    result = w;
  }
  return result;
}
