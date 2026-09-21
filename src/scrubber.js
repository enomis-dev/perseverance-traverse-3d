import * as Cesium from "cesium";
import { findWaypointAtSol } from "./traverse.js";
import { formatSolDate } from "./solDate.js";

/**
 * Builds the bottom sol slider and a marker entity that snaps to wherever
 * the rover actually was on the selected sol (no fabricated in-between
 * positions -- it holds at the last known waypoint until the next drive).
 */
export function createSolScrubber({ viewer, waypoints, minSol, maxSol, ellipsoid }) {
  const roverMarker = viewer.entities.add({
    name: "Rover position",
    position: Cesium.Cartesian3.fromDegrees(0, 0, 0, ellipsoid),
    point: {
      pixelSize: 12,
      color: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.fromCssColorString("#2fe6ff"),
      outlineWidth: 3,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  const container = document.createElement("div");
  container.id = "sol-scrubber";
  container.innerHTML = `
    <div id="sol-scrubber-label">Sol ${maxSol}</div>
    <input type="range" id="sol-scrubber-input" min="${minSol}" max="${maxSol}" step="1" value="${maxSol}" />
  `;
  document.body.appendChild(container);

  const label = document.getElementById("sol-scrubber-label");
  const input = document.getElementById("sol-scrubber-input");

  function update(sol) {
    const waypoint = findWaypointAtSol(waypoints, sol);
    roverMarker.position = Cesium.Cartesian3.fromDegrees(
      waypoint.lon,
      waypoint.lat,
      0,
      ellipsoid,
    );
    label.textContent = `Sol ${sol} — ${formatSolDate(sol)} (at Sol ${waypoint.sol})`;
  }

  input.addEventListener("input", (event) => update(Number(event.target.value)));
  update(maxSol);

  return roverMarker;
}
