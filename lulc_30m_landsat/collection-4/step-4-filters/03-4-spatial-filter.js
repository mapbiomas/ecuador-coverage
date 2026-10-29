/**
 * @name
 *      03-4-spatial-filter.js
 *
 * @description
 *      Spatial filter for the multiband classification of one region
 *      (MapBiomas Ecuador - Collection 4). Fourth filter of step 4, applied
 *      to the output of 03-3-frequency-filter.js.
 *
 *      Removes isolated pixels ("salt and pepper"), year by year:
 *        1. Patches of the same class smaller than `minConnectedPixels`
 *           connected pixels are removed.
 *        2. The removed pixels are filled with the most frequent class
 *           around them (focal mode, 5-pixel square window, repeated up to
 *           30 times until the gap is closed).
 *
 * @usage
 *      1. Set PARAMS (region, versions, minimum patch size).
 *      2. Run and compare "Classification <year>" and "Spatial filter <year>"
 *         over the mosaics, and the area charts in the console.
 *      3. Start the export task from the Tasks tab.
 *
 * @inputs
 *      <paths.pathClassificationFilterGM><COUNTRY>-<regionId>-<inputVersion>
 *
 * @outputs
 *      <paths.pathClassificationFilterGM><COUNTRY>-<regionId>-<outputVersion>
 *
 * @author
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @version
 *      2025-01-21  First version
 *      2025-05-01  Updated by Fabricio Garcés
 *
 * @collection
 *      4
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {
  regionId: 40904,                  // Classification region (field id_regionC)
  country: 'ECUADOR',

  inputVersion: 994,                // e.g. output of 03-3-frequency-filter.js
  outputVersion: 993,

  // Years of the time series (all must exist in the input).
  firstYear: 1985,
  lastYear: 2026,

  // Years added to the map.
  yearsPreview: [2024, 2025, 2026],

  // Minimum patch size, in pixels (30 m). Must be <= 100.
  minConnectedPixels: 5,

  // true: diagonal neighbors count as connected (8-connectivity);
  // false: only up, down, left and right (4-connectivity).
  eightConnected: true,

  // Years and classes kept as in the input.
  yearsExclude: [],
  classExclude: [],

  // Area charts (ha) of some classes: filtered, input and previous collection.
  Graficar: {
    graficar: true,
    claseGraph: [13, 3]
  },

  addMosaics: true,
  addRegion: true
};


// =============================================================================
// 2. MODULES AND CONSTANTS
// =============================================================================

var paths = require('users/mapbiomasecuador/LULC:COLECCION4/05-modules/CollectionDirectories.js').paths;
var palette = require('users/mapbiomasecuador/LULC:MODULES/Palettes.js').get('EcuadorCol4');

var FILTER_PATH = paths.pathClassificationFilterGM;   // must end with '/'
var PREVIOUS_COLLECTION_ASSET = 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION3/INTEGRATION/ECUADOR-3';
var PREVIOUS_COLLECTION_YEARS = [1985, 2024];

var PREFIX = 'classification';

// connectedPixelCount stops counting at this size.
var MAX_PATCH_SIZE = 100;

// Focal mode used to fill the removed pixels.
var FOCAL_RADIUS = 5;        // pixels
var FOCAL_ITERATIONS = 30;

var YEARS = [];
for (var y = PARAMS.firstYear; y <= PARAMS.lastYear; y++) { YEARS.push(y); }

var BAND_NAMES = YEARS.map(function (year) { return PREFIX + '_' + year; });

var CLASS_VIS = { min: 0, max: palette.length - 1, palette: palette };
var MOSAIC_VIS = { bands: ['swir1_median', 'nir_median', 'red_median'], gain: [0.08, 0.06, 0.2] };

var LEGEND = [
  [3, 'Forest formation'],
  [4, 'Open forest'],
  [5, 'Mangrove'],
  [11, 'Wetland'],
  [12, 'Grassland'],
  [13, 'Other non-forest natural formation'],
  [21, 'Mosaic of uses'],
  [25, 'Other non-vegetated area'],
  [33, 'River, lake or ocean'],
  [34, 'Glacier']
];


// =============================================================================
// 3. FUNCTIONS
// =============================================================================

/**
 * Spatial filter, year by year (see the description at the top).
 */
function spatialFilter(image, regionMask) {
  // Size of the patch of each pixel (same class, connected), per band.
  var patchSize = image.select(BAND_NAMES).connectedPixelCount(MAX_PATCH_SIZE, PARAMS.eightConnected);

  return ee.Image.cat(BAND_NAMES.map(function (name) {
    var yearImage = image.select(name);

    // 1. Remove small patches.
    var largePatches = yearImage.mask(patchSize.select(name).gte(PARAMS.minConnectedPixels));

    // 2. Fill the gaps with the most frequent class around them.
    var neighborhood = largePatches.focalMode(FOCAL_RADIUS, 'square', 'pixels', FOCAL_ITERATIONS);

    return neighborhood.blend(largePatches).updateMask(regionMask).rename(name);
  }));
}

/**
 * Median mosaic of a year. From 2022 on, Landsat 8 is used.
 * TODO: no 2026 mosaic yet; the 2025 Landsat 9 mosaic is shown instead.
 */
function getYearMosaic(mosaics, year) {
  if (year === 2026) {
    return mosaics.filter(ee.Filter.eq('year', 2025)).filter(ee.Filter.eq('satellite', 'l9')).median();
  }
  var yearMosaics = mosaics.filter(ee.Filter.eq('year', year));
  if (year >= 2022) {
    yearMosaics = yearMosaics.filter(ee.Filter.eq('satellite', 'l8'));
  }
  return yearMosaics.median();
}

/**
 * Line chart of the area (ha) of one class per year, at 250 m
 * (one 250 m pixel = 6.25 ha).
 */
function areaChart(image, classId, region, xLabels, title) {
  return ui.Chart.image.regions({
    image: image.eq(classId).multiply(6.25).selfMask(),
    regions: region.geometry().bounds(),
    reducer: ee.Reducer.sum(),
    scale: 250,
    seriesProperty: 'system:id',
    xLabels: xLabels
  })
    .setChartType('LineChart')
    .setOptions({
      title: 'Class ' + classId + ' - ' + title + ' (250 m)',
      hAxis: { title: 'Year', titleTextStyle: { italic: false, bold: true } },
      vAxis: { title: 'Area (ha)', titleTextStyle: { italic: false, bold: true } },
      colors: ['#' + palette[classId]],
      lineSize: 3
    });
}

/**
 * Legend panel with colored boxes.
 */
function mapLegend(map, title, colors, labels, position) {
  var legend = ui.Panel({ style: { backgroundColor: '#fff', position: position, padding: '8px' } });

  legend.add(ui.Label({
    value: title,
    style: { fontWeight: 'bold', fontSize: '14px', margin: '0 0 6px 0', padding: '0' }
  }));

  labels.forEach(function (label, i) {
    legend.add(ui.Panel({
      widgets: [
        ui.Label({ style: { backgroundColor: '#' + colors[i], margin: '5px 0 0 0', height: '12px', width: '12px' } }),
        ui.Label({ value: label, style: { margin: '3px 0 0 6px', fontSize: '13px', color: '#757575' } })
      ],
      layout: ui.Panel.Layout.Flow('horizontal')
    }));
  });

  map.add(legend);
}


// =============================================================================
// 4. SPATIAL FILTER
// =============================================================================

Map.setOptions('SATELLITE');

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filter(ee.Filter.eq('id_regionC', PARAMS.regionId));

var regionMask = region
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

var input = ee.Image(FILTER_PATH + PARAMS.country + '-' + PARAMS.regionId + '-' + PARAMS.inputVersion);

var filtered = spatialFilter(input, regionMask);

// Excluded years: back to their input values.
if (PARAMS.yearsExclude.length > 0) {
  var excludedBands = PARAMS.yearsExclude.map(function (year) { return PREFIX + '_' + year; });
  filtered = filtered.addBands(input.select(excludedBands), null, true);
  print('Excluded years', PARAMS.yearsExclude);
}

// Excluded classes: input pixels of these classes are kept.
if (PARAMS.classExclude.length > 0) {
  filtered = ee.Image.cat(BAND_NAMES.map(function (name) {
    var inputYear = input.select(name);
    var result = filtered.select(name);
    PARAMS.classExclude.forEach(function (classId) {
      result = result.blend(inputYear.updateMask(inputYear.unmask().eq(classId)));
    });
    return result;
  }));
}

filtered = filtered.select(BAND_NAMES).set({
  regions: PARAMS.regionId.toString(),
  country: PARAMS.country,
  version: PARAMS.outputVersion,
  step: 'Spatial-filter',
  theme: 'General Map'
});

print('Output image', filtered);


// =============================================================================
// 5. MAP AND CHARTS
// =============================================================================

var mosaics = ee.ImageCollection(paths.mosaicRaisgAct)
  .merge(ee.ImageCollection(paths.mosaicPacificoAct))
  .filterBounds(region);

// For each preview year: mosaic, input classification and filtered result.
// Classifications are shown at 30 m so that small patches are visible at
// any zoom level.
PARAMS.yearsPreview.forEach(function (year) {
  if (PARAMS.addMosaics) {
    Map.addLayer(getYearMosaic(mosaics, year).updateMask(regionMask), MOSAIC_VIS, 'Mosaic ' + year, false);
  }
  var name = PREFIX + '_' + year;
  Map.addLayer(input.select(name).reproject('EPSG:4326', null, 30), CLASS_VIS, 'Classification ' + year, false);
  Map.addLayer(filtered.select(name).reproject('EPSG:4326', null, 30), CLASS_VIS, 'Spatial filter ' + year, false);
});

if (PARAMS.addRegion) {
  Map.addLayer(region.style({ fillColor: 'FF000000', color: 'FF0000' }), {}, 'Region ' + PARAMS.regionId);
}

mapLegend(
  Map,
  'Land cover',
  LEGEND.map(function (item) { return palette[item[0]]; }),
  LEGEND.map(function (item) { return item[0] + '. ' + item[1]; }),
  'bottom-right'
);

if (PARAMS.Graficar.graficar) {
  print('Note: the charts are approximate; the 30 m maps are resampled to 250 m.');

  var previousCollection = ee.Image(PREVIOUS_COLLECTION_ASSET);
  var previousYears = [];
  for (var py = PREVIOUS_COLLECTION_YEARS[0]; py <= PREVIOUS_COLLECTION_YEARS[1]; py++) { previousYears.push(py); }

  PARAMS.Graficar.claseGraph.forEach(function (classId) {
    print(areaChart(filtered, classId, region, YEARS, 'filtered'));
    print(areaChart(input.select(BAND_NAMES), classId, region, YEARS, 'input'));
    print(areaChart(previousCollection, classId, region, previousYears, 'previous collection'));
  });
}


// =============================================================================
// 6. EXPORT
// =============================================================================

var fileName = PARAMS.country + '-' + PARAMS.regionId + '-' + PARAMS.outputVersion;

Export.image.toAsset({
  image: filtered.byte().reproject('EPSG:4326', null, 30),
  description: fileName,
  assetId: FILTER_PATH + fileName,
  scale: 30,
  pyramidingPolicy: { '.default': 'mode' },
  maxPixels: 1e13,
  region: input.geometry().bounds()
});
