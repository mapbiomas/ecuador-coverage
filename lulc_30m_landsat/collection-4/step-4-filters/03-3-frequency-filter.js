/**
 * @name
 *      03-3-frequency-filter.js
 *
 * @description
 *      Frequency filter for the multiband classification of one region
 *      (MapBiomas Ecuador - Collection 4). Third filter of step 4, applied
 *      to the output of 03-2-temporal-filter.js.
 *
 *      For each pixel, it calculates how often (% of years) each class in
 *      `classIds` appears in the time series. If a pixel is stable in
 *      those classes, it is assigned to its dominant class in EVERY year:
 *
 *        1. sum of the frequencies of `classIds`  > percents.naturalVegetation (e.g. 80 %)
 *        2. frequency of one class                > percents.majority          (e.g. 60 %)
 *        -> all years of the pixel become that class.
 *
 *      Example with classIds [3, 13, 33], 42 years: a pixel that is forest
 *      (3) in 30 years (71 %), other natural formation (13) in 6 years and
 *      mosaic of uses (21) in 6 years has 86 % of natural classes and 71 %
 *      of forest, so it becomes forest in all 42 years.
 *
 *      Pixels with no data (masked or class 27) in any year are not changed.
 *
 * @usage
 *      1. Set PARAMS (region, versions, classes and percentages).
 *      2. Run and compare "Classification <year>" and "Frequency filter <year>"
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
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez
 *
 * @version
 *      2025-01-21
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

  inputVersion: 995,                // e.g. output of 03-2-temporal-filter.js
  outputVersion: 994,

  // Years of the time series.
  firstYear: 1985,
  lastYear: 2026,

  // Classes considered by the filter (usually natural vegetation and water).
  classIds: [13, 3, 33],

  percents: {
    naturalVegetation: 80,          // minimum % of years in any of classIds
    majority: 60                    // minimum % of years in the dominant class
  },

  // Years added to the map.
  yearsPreview: [2020, 2021, 2022, 2023, 2024, 2025, 2026],

  // Years and classes kept as in the input.
  exclusion: {
    years: [],
    classes: []
  },

  // Restrict the filter with a drawn area.
  hidden: {
    areas: null,     // FeatureCollection drawn in the Code Editor, with a numeric property 'id' = 1; null = whole region
    inside: false    // false: filter only OUTSIDE the area; true: only INSIDE
  },

  // Area charts (ha) of some classes: filtered, input and previous collection.
  plot: {
    plotGraph: true,
    classGraph: [21, 3]
  },

  addRegion: true,
  addMosaic: true
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
var NOT_OBSERVED = 27;

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
 * Loads the input and builds one band per year of YEARS. Years missing in
 * the input and pixels with class 27 (not observed) are masked.
 */
function loadClassification() {
  var inputImage = ee.Image(FILTER_PATH + PARAMS.country + '-' + PARAMS.regionId + '-' + PARAMS.inputVersion);
  var inputBands = inputImage.bandNames();
  var missingBands = ee.List(BAND_NAMES).removeAll(inputBands);

  var missingImages = ee.ImageCollection(missingBands.map(function (name) {
    return ee.Image(NOT_OBSERVED).rename(ee.String(name)).set('year', ee.String(name).slice(-4));
  }));

  var validImages = ee.ImageCollection(inputBands.map(function (name) {
    return inputImage.select([name]).set('year', ee.String(name).slice(-4));
  }));

  return missingImages.merge(validImages)
    .map(function (image) { return image.updateMask(image.unmask().neq(NOT_OBSERVED)); })
    .sort('year')
    .toBands()
    .rename(BAND_NAMES);
}

/**
 * Frequency filter (see the description at the top).
 *
 * @param {ee.Image} image        One band per year.
 * @param {ee.Image} hiddenMask   null, or 0 where the filter is applied.
 * @returns {ee.Image}
 */
function frequencyFilter(image, hiddenMask) {
  // Frequency (%) of each class. The sum is an expression over all bands,
  // so a pixel masked in any year gets no frequency (and is not changed).
  var expression = '100 * (' + BAND_NAMES.map(function (name, i) { return 'b(' + i + ')'; }).join(' + ') +
    ') / ' + BAND_NAMES.length;

  var frequency = ee.Image.cat(PARAMS.classIds.map(function (classId) {
    return image.eq(classId).expression(expression).rename('class' + classId);
  }));

  // 1. Pixels where the selected classes together exceed the threshold.
  var totalFrequency = frequency.reduce('sum');
  var candidates = ee.Image(0).where(totalFrequency.gt(PARAMS.percents.naturalVegetation), 1);

  // 2. Dominant class of each candidate pixel.
  var dominantClass = ee.Image(0);

  PARAMS.classIds.forEach(function (classId) {
    var rule = candidates.eq(1).and(frequency.select('class' + classId).gt(PARAMS.percents.majority));
    if (hiddenMask) {
      rule = rule.and(hiddenMask.eq(0));
    }
    dominantClass = dominantClass.where(rule, classId);
  });

  dominantClass = dominantClass.updateMask(dominantClass.neq(0));

  Map.addLayer(frequency, {}, 'Frequency by class (%)', false);
  Map.addLayer(totalFrequency, { min: 0, max: 100 }, 'Frequency of selected classes (%)', false);
  Map.addLayer(candidates, { min: 0, max: 1 }, 'Candidate pixels', false);
  Map.addLayer(dominantClass, CLASS_VIS, 'Pixels changed (dominant class)', false);

  // 3. All years of the changed pixels become the dominant class.
  return image.where(dominantClass, dominantClass);
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
// 4. FREQUENCY FILTER
// =============================================================================

Map.setOptions('SATELLITE');

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filter(ee.Filter.eq('id_regionC', PARAMS.regionId));

var regionMask = region
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

var input = loadClassification();
print('Input image', input);

// Hidden-area mask: the filter is applied where it is 0.
var hiddenMask = null;

if (PARAMS.hidden.areas) {
  hiddenMask = PARAMS.hidden.areas
    .reduceToImage(['id'], ee.Reducer.first())
    .clipToBoundsAndScale(region, null, null, null, 30)
    .unmask(0)
    .updateMask(regionMask);

  if (PARAMS.hidden.inside) {
    hiddenMask = hiddenMask.remap([0, 1], [1, 0]);
  }

  Map.addLayer(hiddenMask, { min: 0, max: 1 }, 'Hidden-area mask (0 = filtered)', false);
}

var filtered = frequencyFilter(input, hiddenMask);

// Excluded years: back to their input values.
if (PARAMS.exclusion.years.length > 0) {
  var excludedBands = PARAMS.exclusion.years.map(function (year) { return PREFIX + '_' + year; });
  filtered = filtered.addBands(input.select(excludedBands), null, true);
}

// Excluded classes: input pixels of these classes are kept.
if (PARAMS.exclusion.classes.length > 0) {
  var keptClasses = ee.ImageCollection(PARAMS.exclusion.classes.map(function (classId) {
    return input.updateMask(input.eq(classId)).selfMask();
  })).max();
  filtered = filtered.blend(keptClasses);
}

filtered = filtered.select(BAND_NAMES).set({
  regions: PARAMS.regionId.toString(),
  country: PARAMS.country,
  version: PARAMS.outputVersion,
  step: 'Frequency-filter',
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
// Layers are added directly (not in callbacks) to keep this order.
PARAMS.yearsPreview.forEach(function (year) {
  if (PARAMS.addMosaic) {
    Map.addLayer(getYearMosaic(mosaics, year).updateMask(regionMask), MOSAIC_VIS, 'Mosaic ' + year, false);
  }
  var name = PREFIX + '_' + year;
  Map.addLayer(input.select(name), CLASS_VIS, 'Classification ' + year, false);
  Map.addLayer(filtered.select(name), CLASS_VIS, 'Frequency filter ' + year, false);
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

if (PARAMS.plot.plotGraph) {
  print('Note: the charts are approximate; the 30 m maps are resampled to 250 m.');

  var previousCollection = ee.Image(PREVIOUS_COLLECTION_ASSET);
  var previousYears = [];
  for (var py = PREVIOUS_COLLECTION_YEARS[0]; py <= PREVIOUS_COLLECTION_YEARS[1]; py++) { previousYears.push(py); }

  PARAMS.plot.classGraph.forEach(function (classId) {
    print(areaChart(filtered, classId, region, YEARS, 'filtered'));
    print(areaChart(input, classId, region, YEARS, 'input'));
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
  region: region.geometry().bounds()
});
