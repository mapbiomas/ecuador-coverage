/**
 * @name
 *      02-2-stack-multiband.js
 *
 * @description
 *      Stacks the annual classifications of one classification region into a
 *      single multiband image, one band per year ('classification_<year>')
 *      (MapBiomas Ecuador - Collection 4).
 *
 *      The stack can combine two sources:
 *        - years taken from the previous collection (one multiband image),
 *        - new years classified with 02-1-classifier.js (one image per year).
 *      If a year is in both, the new classification replaces the previous one.
 *
 *      The result is shown in a grid of small linked maps, one per year of
 *      the stack, above a large map for inspection.
 *
 * @usage
 *      1. Set PARAMS: region, years from each source and output version.
 *      2. Run and review the grid of years.
 *      3. Start the export task from the Tasks tab.
 *
 * @inputs
 *      - Previous collection: PARAMS.previousCollectionPath (bands classification_<year>)
 *      - New years: <PARAMS.currentCollectionPath><COUNTRY>-<regionId>-<year>-<currentCollectionVersion>
 *
 * @outputs
 *      Image asset <paths.pathClassificationGM><COUNTRY>-<regionId>-<outputVersion>
 *
 * @author
 *      Fabricio Garcés - EcoCiencia
 *
 * @version
 *      1.0.0 (2026-04-16)
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {
  regionId: 40904,                 // Classification region (field id_regionC)
  country: 'ECUADOR',

  // New years, classified with 02-1-classifier.js (version currentCollectionVersion).
  newYears: [2025, 2026],
  currentCollectionVersion: 1,
  currentCollectionPath: 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION4/GENERAL_MAP/CLASSIFICATION/preliminar-classification/',

  // Years taken from the previous collection. [] = none.
  previousCollectionYears: [
    1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992,
    1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000,
    2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008,
    2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016,
    2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024
  ],
  previousCollectionPath: 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION4/GENERAL_MAP/CLASSIFICATION/Integration_nacional_pre_filter_col3',

  outputVersion: 997,

  // *** CAUTION *** true deletes the existing asset with the same name before exporting.
  overwrite: false
};


// =============================================================================
// 2. MODULES AND CONSTANTS
// =============================================================================

var paths = require('users/mapbiomasecuador/LULC:COLECCION4/05-modules/CollectionDirectories.js').paths;
var palette = require('users/mapbiomasecuador/LULC:MODULES/Palettes.js').get('EcuadorCol4');

var MOSAIC_VIS = { bands: ['swir1_median', 'nir_median', 'red_median'], gain: [0.08, 0.06, 0.2] };

function classVis(year) {
  return { bands: 'classification_' + year, min: 0, max: palette.length - 1, palette: palette };
}


// =============================================================================
// 3. STACK
// =============================================================================

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filter(ee.Filter.eq('id_regionC', PARAMS.regionId));

var regionMask = region
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

// New years: one image per year, band 'classification_<year>'.
var newYearsImage = ee.Image.cat(PARAMS.newYears.map(function (year) {
  return ee.Image(PARAMS.currentCollectionPath + PARAMS.country + '-' + PARAMS.regionId + '-' +
    year + '-' + PARAMS.currentCollectionVersion).updateMask(regionMask);
})).byte();

var stack = newYearsImage;

// Previous collection years; new years replace them if repeated.
if (PARAMS.previousCollectionYears.length > 0) {
  var previousBands = PARAMS.previousCollectionYears.map(function (year) {
    return 'classification_' + year;
  });

  stack = ee.Image(PARAMS.previousCollectionPath)
    .select(previousBands)
    .updateMask(regionMask)
    .byte()
    .addBands(newYearsImage, null, true);
}

stack = stack.set({
  regions: PARAMS.regionId.toString(),
  country: PARAMS.country,
  version: PARAMS.outputVersion,
  step: 'stack multiband',
  theme: 'General Map'
});

print('Stack', stack);


// =============================================================================
// 4. EXPORT
// =============================================================================

var fileName = PARAMS.country + '-' + PARAMS.regionId + '-' + PARAMS.outputVersion;
var assetId = paths.pathClassificationGM + fileName;   // path must end with '/'

if (PARAMS.overwrite) {
  try {
    ee.data.deleteAsset(assetId);
  } catch (error) {
    print('Nothing to delete: ' + assetId);
  }
}

Export.image.toAsset({
  image: stack.byte().reproject('EPSG:4326', null, 30),
  description: fileName,
  assetId: assetId,
  scale: 30,
  pyramidingPolicy: { '.default': 'mode' },
  maxPixels: 1e13,
  region: region.geometry().bounds()
});


// =============================================================================
// 5. VISUALIZATION: GRID OF YEARS + LARGE MAP
// =============================================================================

var mosaics = ee.ImageCollection(paths.mosaicRaisgAct)
  .merge(ee.ImageCollection(paths.mosaicPacificoAct))
  .filterBounds(region);

/**
 * Median mosaic of a year. From 2022 on, Landsat 8 is used.
 * TODO: no 2026 mosaic yet; the 2025 Landsat 9 mosaic is shown instead.
 */
function getYearMosaic(year) {
  if (year === 2026) {
    return mosaics.filter(ee.Filter.eq('year', 2025)).filter(ee.Filter.eq('satellite', 'l9')).median();
  }
  var yearMosaics = mosaics.filter(ee.Filter.eq('year', year));
  if (year >= 2022) {
    yearMosaics = yearMosaics.filter(ee.Filter.eq('satellite', 'l8'));
  }
  return yearMosaics.median();
}

// Years in the stack, in order.
var stackYears = PARAMS.previousCollectionYears.concat(PARAMS.newYears)
  .filter(function (year, i, list) { return list.indexOf(year) === i; })
  .sort();

var lastYear = stackYears[stackYears.length - 1];

// One small map per year of the stack.
var smallMaps = stackYears.map(function (year) {
  var map = ui.Map();
  map.style().set({ margin: '2px', width: '300px' });
  map.setControlVisibility({
    zoomControl: false,
    fullscreenControl: false,
    layerList: true,
    mapTypeControl: false,
    drawingToolsControl: false
  });
  map.add(ui.Label(String(year), { position: 'bottom-right', fontWeight: 'bold' }));

  map.addLayer(getYearMosaic(year).updateMask(regionMask), MOSAIC_VIS, 'Mosaic ' + year, false);
  map.addLayer(stack, classVis(year), 'Stack ' + year);

  return map;
});

// Large map: region and the most recent year.
var largeMap = ui.Map();
largeMap.addLayer(region.style({ fillColor: 'FF000000', color: 'FF0000' }), {}, 'Region ' + PARAMS.regionId);
largeMap.addLayer(stack, classVis(lastYear), 'Stack ' + lastYear);
largeMap.centerObject(region, 10);

ui.Map.Linker(smallMaps.concat([largeMap]));

var topPanel = ui.Panel(smallMaps, ui.Panel.Layout.Flow('horizontal'), { stretch: 'both' });
topPanel.style().set({ width: '100%', height: '35%' });

var bottomPanel = ui.Panel([largeMap], ui.Panel.Layout.Flow('horizontal'), { stretch: 'both' });
bottomPanel.style().set({ width: '100%', height: '65%' });

ui.root.widgets().reset([
  ui.SplitPanel({
    firstPanel: topPanel,
    secondPanel: bottomPanel,
    orientation: 'vertical',
    wipe: false,
    style: { stretch: 'both' }
  })
]);
ui.root.setLayout(ui.Panel.Layout.Flow('vertical'));
