import { defineConfig } from "vite";
import cesium from "vite-plugin-cesium";

export default defineConfig(({ command }) => ({
  // GitHub Pages project sites serve from /<repo-name>/, not the domain
  // root -- but only for the production build; the local dev server should
  // keep serving from "/". Override with VITE_BASE_PATH if the repo is ever
  // renamed or deployed to a user/org root page instead (which uses "/").
  base:
    command === "build" ? (process.env.VITE_BASE_PATH ?? "/perseverance-traverse-3d/") : "/",
  plugins: [cesium()],
}));
