// vite-plugin-cesium has a bug when `base` is a non-root subpath (e.g. for
// a GitHub Pages project site): it correctly embeds "/repo-name/cesium/" as
// the URL the browser will request (right, since dist/ itself is deployed
// AS the /repo-name/ subpath), but then ALSO uses that same prefixed path
// as the physical output folder inside dist/, nesting it one level too
// deep -- dist/repo-name/cesium/... instead of dist/cesium/... . Moving it
// back reconciles the physical files with what the built HTML/JS actually
// request. See https://github.com/vite-plugin/vite-plugin-cesium (closeBundle).
import { existsSync, renameSync, rmdirSync } from "node:fs";
import { join } from "node:path";

const base = process.env.VITE_BASE_PATH ?? "/perseverance-traverse-3d/";
const basePathSegment = base.replace(/^\/|\/$/g, ""); // "/perseverance-traverse-3d/" -> "perseverance-traverse-3d"

if (!basePathSegment) {
  process.exit(0); // root base ("/") -- vite-plugin-cesium doesn't double-nest in this case
}

const dist = "dist";
const nested = join(dist, basePathSegment, "cesium");
const correct = join(dist, "cesium");

if (existsSync(nested)) {
  renameSync(nested, correct);
  const emptyParent = join(dist, basePathSegment);
  if (existsSync(emptyParent)) {
    rmdirSync(emptyParent); // only removes if now empty
  }
  console.log(`Fixed vite-plugin-cesium output path: ${nested} -> ${correct}`);
} else {
  console.warn(`fix-cesium-base: expected nested path not found (${nested}) -- vite-plugin-cesium's output layout may have changed.`);
}
