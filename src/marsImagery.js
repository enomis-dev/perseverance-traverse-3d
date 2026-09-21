import * as Cesium from "cesium";

// Both layers verified live against their WMTS GetCapabilities documents at
// trek.nasa.gov/tiles/Mars/EQ/<layer>/1.0.0/WMTSCapabilities.xml: global
// geographic tiling (EPSG:104905), TileMatrixSet "default028mm", levels 0-7,
// level 0 = 2x1 tiles of 256px. The literal double slash before {Style}
// mirrors the ResourceURL template NASA's server actually publishes/expects.
const TILE_URL_TEMPLATE =
  "https://trek.nasa.gov/tiles/Mars/EQ/{layer}/1.0.0//{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg";

function createMarsTrekLayer({ layer, credit, ellipsoid }) {
  return new Cesium.WebMapTileServiceImageryProvider({
    url: TILE_URL_TEMPLATE.replace("{layer}", layer),
    layer,
    style: "default",
    format: "image/jpeg",
    tileMatrixSetID: "default028mm",
    maximumLevel: 7,
    tilingScheme: new Cesium.GeographicTilingScheme({
      ellipsoid,
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 1,
    }),
    credit,
  });
}

export function createVikingColorMosaicProvider(ellipsoid) {
  return createMarsTrekLayer({
    layer: "Mars_Viking_MDIM21_ClrMosaic_global_232m",
    credit: "NASA / JPL-Caltech / USGS — Viking MDIM 2.1 color mosaic (Mars Trek)",
    ellipsoid,
  });
}

export function createMolaColorizedElevationProvider(ellipsoid) {
  return createMarsTrekLayer({
    layer: "Mars_MGS_MOLA_ClrShade_merge_global_463m",
    credit: "NASA / JPL-Caltech / MSSS — MGS MOLA colorized elevation (Mars Trek)",
    ellipsoid,
  });
}
