/**
 * @name
 *      01-1-stable-pixels-spatial-filter.js
 *
 * @description
 *      Spatial filter for the stable-pixel map of one classification region
 *      (MapBiomas Ecuador - Collection 4).
 *
 *      Removes small, isolated patches: a stable pixel is kept only if it
 *      belongs to a group of at least `minConnectedPixels` connected pixels
 *      of the same class. Dropping the scattered pixels leaves only the
 *      larger patches, so the visual review and correction of the stable
 *      pixels is faster.
 *
 * @usage
 *      1. Run 01-0-stable-pixels.js and export the stable-pixel map
 *         (version `inputVersion`).
 *      2. Set PARAMS and run this script. Compare the layers
 *         "Stable pixels - original" and "Stable pixels - filtered".
 *      3. Start the export task from the Tasks tab. To keep working on the
 *         filtered map, use it in 01-0 with `filtroEspacial.use = true`
 *         and `filtroEspacial.version = outputVersion`.
 *
 * @inputs
 *      <paths.stablesPixelsAct>/ME-<COUNTRY>-<regionId>-<inputVersion>
 *
 * @outputs
 *      <paths.stablesPixelsAct>/ME-<COUNTRY>-<regionId>-<outputVersion>
 *
 * @author
 *      MapBiomas Ecuador - EcoCiencia
 * 
 * @collection
 *      4
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {
  country: 'ECUADOR',
  regionId: 40201,                  // Classification region (field id_regionC)
  yearsPreview: [2000, 2024, 2025, 2026],  // Mosaics added to the map for review

  inputVersion: 999,                // Stable-pixel map to filter
  outputVersion: 998,               // Version of the filtered map

  // Minimum patch size, in pixels (30 m). Must be <= 1000.
  minConnectedPixels: 10,

  // true: diagonal neighbors count as connected (8-connectivity);
  // false: only up, down, left and right (4-connectivity).
  eightConnected: true
};


// =============================================================================
// 2. MODULES AND ASSETS
// =============================================================================

var paths = require('users/mapbiomasecuador/LULC:COLECCION4/05-modules/CollectionDirectories.js').paths;
var palette = require('users/mapbiomasecuador/LULC:MODULES/Palettes.js').get('EcuadorCol4');

var CLASS_VIS = { min: 0, max: palette.length - 1, palette: palette };
var MOSAIC_VIS = { bands: ['swir1_median', 'nir_median', 'red_median'], gain: [0.08, 0.06, 0.08], gamma: 0.65 };

// connectedPixelCount stops counting at this size (maximum allowed: 1024).
var MAX_PATCH_SIZE = 1000;


// =============================================================================
// 3. FUNCTIONS
// =============================================================================

/**
 * Keeps only pixels that belong to a patch of at least `minPixels`
 * connected pixels of the same class.
 *
 * @param {ee.Image} image        Single band 'reference' with class IDs.
 * @param {number} minPixels
 * @param {boolean} eightConnected
 * @returns {ee.Image}
 */
function filterConnectedPixels(image, minPixels, eightConnected) {

  // Classes present in the image.
  var histogram = image.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: image.geometry(),
    scale: 30,
    maxPixels: 1e13
  }).get('reference');

  var classList = ee.Dictionary(histogram).keys().map(ee.Number.parse);

  // For each class: 1 where the pixel is in a large enough patch, else 0.
  var largePatches = ee.ImageCollection.fromImages(
    classList.map(function (classId) {
      var classMask = image.eq(ee.Number(classId));
      var patchSize = classMask.connectedPixelCount(MAX_PATCH_SIZE, eightConnected);
      return classMask.updateMask(patchSize.gte(minPixels)).uint8();
    })
  );

  return image.updateMask(largePatches.sum());
}


// =============================================================================
// 4. FILTER
// =============================================================================

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filter(ee.Filter.eq('id_regionC', PARAMS.regionId));

var regionMask = region
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

var baseName = 'ME-' + PARAMS.country + '-' + PARAMS.regionId + '-';

var stablePixels = ee.Image(paths.stablesPixelsAct + '/' + baseName + PARAMS.inputVersion)
  .reproject('EPSG:4326', null, 30)
  .rename('reference');

var filteredImage = filterConnectedPixels(stablePixels, PARAMS.minConnectedPixels, PARAMS.eightConnected)
  .set({
    code_region: PARAMS.regionId,
    pais: PARAMS.country,
    version: PARAMS.outputVersion.toString(),
    paso: 'P02'
  });

print('Filtered stable pixels', filteredImage);


// =============================================================================
// 5. MAP
// =============================================================================

var mosaics = ee.ImageCollection(paths.mosaicPacificoAct)
  .merge(ee.ImageCollection(paths.mosaicRaisgAct))
  .filter(ee.Filter.bounds(region))
  .select(['swir1_median', 'nir_median', 'red_median']);

PARAMS.yearsPreview.forEach(function (year) {
  var yearMosaic;

  if (year === 2026) {
    // TODO: no 2026 mosaic yet; the 2025 Landsat 9 mosaic is shown instead.
    yearMosaic = mosaics.filter(ee.Filter.eq('year', 2025))
      .filter(ee.Filter.eq('satellite', 'l9'));
  } else {
    yearMosaic = mosaics.filter(ee.Filter.eq('year', year));
    // From 2022 on there are L8 and L9 mosaics; L8 is shown.
    if (year >= 2022) {
      yearMosaic = yearMosaic.filter(ee.Filter.eq('satellite', 'l8'));
    }
  }

  Map.addLayer(yearMosaic.mosaic().updateMask(regionMask), MOSAIC_VIS, 'Mosaic ' + year, false);
});

Map.addLayer(region.style({ fillColor: 'FF000000', color: 'FF0000' }), {}, 'Region ' + PARAMS.regionId);
Map.addLayer(stablePixels, CLASS_VIS, 'Stable pixels - original');
Map.addLayer(filteredImage, CLASS_VIS, 'Stable pixels - filtered');


// =============================================================================
// 6. EXPORT
// =============================================================================

Export.image.toAsset({
  image: filteredImage.byte().reproject('EPSG:4326', null, 30),
  description: baseName + PARAMS.outputVersion,
  assetId: paths.stablesPixelsAct + '/' + baseName + PARAMS.outputVersion,
  scale: 30,
  pyramidingPolicy: { '.default': 'mode' },
  maxPixels: 1e13,
  region: region.geometry().bounds()
});
