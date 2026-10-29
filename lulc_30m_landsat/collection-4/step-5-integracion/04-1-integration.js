/**
 * @name
 *      04-1-integration.js
 *
 * @description
 *      Integrates the filtered classifications of all classification regions
 *      into the national general map of MapBiomas Ecuador - Collection 4.
 *
 *      1. Loads the final filtered image of each region (step 4), using the
 *         version chosen for each region in REGION_VERSIONS.
 *      2. Mosaics them into one national image. Where regions overlap, the
 *         region listed LAST in REGION_VERSIONS is kept.
 *      3. Pixels inside Ecuador with no classification get class 27
 *         (not observed); pixels outside Ecuador are masked.
 *      4. Exports the national multiband image (one band per year).
 *
 * @usage
 *      1. Update REGION_VERSIONS with the final filter version of each region.
 *      2. Set the output version and run.
 *      3. Review the national map, year by year, and start the export task.
 *
 * @inputs
 *      <CLASSIFICATION_FT_PATH>ECUADOR-<regionId>-<version>  (one per region)
 *
 * @outputs
 *      <PARAMS.outputPath>ECUADOR-GENERAL-MAP-<outputVersion>
 *
 * @author
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @version
 *      2025-08-01  First version
 *      2026-02-23  Updated by Fabricio Garcés
 *
 * @collection
 *      4
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {
  country: 'ECUADOR',
  collection: '4.0',
  theme: 'GENERAL-MAP',
  source: 'EcoCiencia',

  outputVersion: 1,
  outputPath: 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION4/INTEGRATION/integration/',

  // Years added to the map.
  yearsPreview: { first: 1985, last: 2025 }
};

// Final filtered version of each classification region (step 4).
// Order matters where regions overlap: later regions are drawn on top.
var REGION_VERSIONS = [
  [40101, 23], [40102, 9], [40103, 14], [40104, 11], [40105, 12],
  [40201, 14], [40202, 12], [40203, 10], [40204, 15], [40205, 13],
  [40601, 24], [40602, 22], [40603, 15], [40604, 11], [40605, 19],
  [40606, 17], [40607, 12], [40608, 21], [40609, 21],
  [40901, 15], [40902, 13], [40903, 12], [40904, 16], [40905, 21],
  [40906, 11], [40907, 13], [40908, 11], [40909, 11], [40910, 25]
];


// =============================================================================
// 2. MODULES AND ASSETS
// =============================================================================

var palette = require('users/mapbiomasecuador/LULC:MODULES/Palettes.js').get('EcuadorCol4');

var CLASSIFICATION_FT_PATH = 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION4/GENERAL_MAP/CLASSIFICATION/classification-ft/';
var COUNTRY_ASSET = 'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-4/nivel_politico_1_col4';
var REGIONS_ASSET = 'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-4/regionesClassif_Col4_v1';

var NOT_OBSERVED = 27;

var CLASS_VIS = { min: 0, max: palette.length - 1, palette: palette };


// =============================================================================
// 3. INTEGRATION
// =============================================================================

var country = ee.FeatureCollection(COUNTRY_ASSET);

var countryMask = country
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

var assets = REGION_VERSIONS.map(function (item) {
  return CLASSIFICATION_FT_PATH + PARAMS.country + '-' + item[0] + '-' + item[1];
});

print('Regions integrated', assets);

var integration = ee.ImageCollection(assets)
  .mosaic()
  .unmask(NOT_OBSERVED)
  .updateMask(countryMask)
  .set({
    version: PARAMS.outputVersion,
    collection: PARAMS.collection,
    country: PARAMS.country,
    source: PARAMS.source,
    theme: PARAMS.theme,
    created: ee.Date(Date.now()).format('YYYY-MM-dd HH:mm:ss')
  });

print('Integration', integration);


// =============================================================================
// 4. EXPORT
// =============================================================================

var outputName = PARAMS.country + '-GENERAL-MAP-' + PARAMS.outputVersion;

Export.image.toAsset({
  image: integration.byte().reproject('EPSG:4326', null, 30),
  description: outputName,
  assetId: PARAMS.outputPath + outputName,
  pyramidingPolicy: { '.default': 'mode' },
  region: country.geometry().bounds(),
  scale: 30,
  maxPixels: 1e13
});


// =============================================================================
// 5. MAP
// =============================================================================

for (var year = PARAMS.yearsPreview.first; year <= PARAMS.yearsPreview.last; year++) {
  Map.addLayer(integration.select('classification_' + year), CLASS_VIS, PARAMS.country + ' ' + year, false);
}

Map.addLayer(
  ee.FeatureCollection(REGIONS_ASSET).style({ fillColor: 'FF000000', color: 'FF0000' }),
  {}, 'Classification regions', false
);
