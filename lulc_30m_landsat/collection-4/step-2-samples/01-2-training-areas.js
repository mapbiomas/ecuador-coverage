/**
 * @name
 *      01-2-training-areas.js
 *
 * @description
 *      Calculates the area (km²) of each land-cover class inside one
 *      classification region (MapBiomas Ecuador - Collection 4).
 *
 *      These areas are used to balance the training samples: the number of
 *      sample points drawn for each class in the next script is
 *      proportional to its area in the region.
 *
 *      Areas can be calculated from:
 *        - the stable-pixel map (default, `referenceYear: ''`), or
 *        - one year of the Collection 3 integrated map (`referenceYear`),
 *          after applying the same class grouping (`remap`) as 01-0.
 *
 * @usage
 *      1. Set PARAMS (region, source of areas, output version).
 *      2. Run and check the areas printed in the console.
 *      3. Start the export tasks from the Tasks tab.
 *
 * @inputs
 *      - Stable pixels: <paths.stablesPixelsAct>/ME-<COUNTRY>-<regionId>-<inputStablePixelsVersion>
 *      - or Collection 3 integrated map: paths.integrationCol3
 *
 * @outputs
 *      - Table asset <paths.pathTrainingAreasAct>/ac-<COUNTRY>-<regionId>-<outputVersion>:
 *        the region polygon with one property per class, ID<class> = area in km²
 *        (0 if the class is absent).
 *      - Optional CSV copy in Google Drive.
 *
 * @author
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 * 
 * @collection
 *      4
 *
 * @version
 *      2026-04-21  Updated by Fabricio Garcés
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {
  regionId: 40201,                  // Classification region (field id_regionC)
  country: 'ECUADOR',

  // Source of the areas:
  //   ''      -> stable-pixel map, version `inputStablePixelsVersion`
  //   a year  -> Collection 3 integrated map of that year, e.g. 2024
  referenceYear: '',
  inputStablePixelsVersion: '998',

  outputVersion: 990,               // Version of the areas table

  // Class grouping, only used with `referenceYear` (same as 01-0).
  remap: {
    from: [3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 18, 21, 22, 23, 24, 25, 29, 30, 31, 33, 34, 35, 68],
    to:   [3, 4, 5, 3, 7, 3, 11, 12, 13, 21, 21, 21, 21, 22, 25, 25, 25, 25, 25, 33, 33, 34, 21, 25]
  },

  // Google Drive folder for a CSV copy. '' = do not export to Drive.
  driveFolder: 'MAPBIOMAS-EXPORT'
};


// =============================================================================
// 2. MODULES AND CONSTANTS
// =============================================================================

var paths = require('users/mapbiomasecuador/LULC:COLECCION4/05-modules/CollectionDirectories.js').paths;
var palette = require('users/mapbiomasecuador/LULC:MODULES/Palettes.js').get('EcuadorCol4');

// Class IDs reported in the table.
var CLASSES = ee.List.sequence(1, 35).getInfo();


// =============================================================================
// 3. FUNCTIONS
// =============================================================================

/**
 * Applies a class remap to a single-band image, keeping the band name.
 * Classes not in `from` become masked.
 */
function remapBand(image, from, to) {
  return image.remap(from, to).int8().rename(image.bandNames());
}

/**
 * Calculates the area (km², rounded) of each class inside the region.
 *
 * @param {ee.Image} image            Single band with class IDs.
 * @param {Array<number>} classes      Class IDs to report.
 * @param {ee.FeatureCollection} region
 * @returns {Object} vector: region with ID<class> properties;
 *                   stats: {ID<class>: km²} for classes present.
 */
function getAreas(image, classes, region) {

  // Area of every class in a single request.
  var groups = ee.List(
    ee.Image.pixelArea().divide(1e6)
      .addBands(image.rename('class').int())
      .reduceRegion({
        reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'class' }),
        geometry: region.geometry(),
        scale: 30,
        maxPixels: 1e13
      })
      .get('groups')
  ).getInfo();

  var stats = {};
  groups.forEach(function (group) {
    var area = Math.round(group.sum);
    if (area > 0) {
      stats['ID' + group['class']] = area;
    }
  });

  // One property per class (0 if absent); the OBJECTID field is dropped.
  var properties = {};
  classes.forEach(function (classId) {
    properties['ID' + classId] = stats['ID' + classId] || 0;
  });

  var vector = region.map(function (feature) {
    var keep = feature.propertyNames().filter(ee.Filter.neq('item', 'OBJECTID'));
    return feature.select(keep).set(properties);
  });

  return { vector: vector, stats: stats };
}


// =============================================================================
// 4. AREAS
// =============================================================================

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filter(ee.Filter.eq('id_regionC', PARAMS.regionId));

var regionMask = region
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

var reference;

if (PARAMS.referenceYear) {
  reference = remapBand(
    ee.Image(paths.integrationCol3)
      .select('classification_' + PARAMS.referenceYear)
      .updateMask(regionMask),
    PARAMS.remap.from,
    PARAMS.remap.to
  );
} else {
  reference = ee.Image(paths.stablesPixelsAct + '/ME-' + PARAMS.country + '-' +
    PARAMS.regionId + '-' + PARAMS.inputStablePixelsVersion);
}

var result = getAreas(reference, CLASSES, region);
var areas = result.vector;

var tableName = 'ac-' + PARAMS.country + '-' + PARAMS.regionId + '-' + PARAMS.outputVersion;

print('Areas by class (km²)', result.stats);
print('Output table', paths.pathTrainingAreasAct + '/' + tableName);
print('Areas', areas);


// =============================================================================
// 5. MAP
// =============================================================================

Map.centerObject(region, 10);
Map.addLayer(reference, { min: 0, max: palette.length - 1, palette: palette }, 'Reference classification');
Map.addLayer(region.style({ color: 'FCBA03', fillColor: '00000000' }), {}, 'Region ' + PARAMS.regionId);


// =============================================================================
// 6. EXPORT
// =============================================================================

Export.table.toAsset({
  collection: areas,
  description: tableName,
  assetId: paths.pathTrainingAreasAct + '/' + tableName
});

if (PARAMS.driveFolder) {
  Export.table.toDrive({
    collection: ee.FeatureCollection([ee.Feature(null, areas.first().toDictionary())]),
    description: tableName + '-DRIVE',
    folder: PARAMS.driveFolder,
    fileFormat: 'CSV'
  });
}
