/**
 * @name
 *      03-2-temporal-filter.js
 *
 * @description
 *      Temporal filter for the multiband classification of one region
 *      (MapBiomas Ecuador - Collection 4). Second filter of step 4, applied
 *      to the output of 03-1-gapfill.js.
 *
 *      It removes short, implausible class changes in the time series: if a
 *      class is interrupted for 1 to 3 years and then comes back, the
 *      interruption is replaced by that class. Example for class FF and any
 *      other class NV:
 *          FF NV FF        -> FF FF FF        (middle3)
 *          FF NV NV FF     -> FF FF FF FF     (middle4 + middle3)
 *          FF NV NV NV FF  -> FF FF FF FF FF  (middle5 + middle4 + middle3)
 *      The first and last years, which have a neighbor on one side only,
 *      use two years of context:
 *          NV FF FF -> FF FF FF   (first3, first year)
 *          FF FF NV -> FF FF FF   (last3, last year)
 *
 *      Filters are applied in the order of `filterExecution`, and for each
 *      filter, class by class in the order of `order`: the first classes
 *      have priority because later classes see their result.
 *
 * @usage
 *      1. Set PARAMS (region, versions, filters, exclusions).
 *      2. Run and compare "Classification <year>" and "Temporal filter <year>"
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
 *      2025-04-28  Updated by Fabricio Garcés
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

  inputVersion: 996,                // e.g. output of 03-1-gapfill.js
  outputVersion: 995,

  // Years of the time series.
  firstYear: 1985,
  lastYear: 2026,

  // Years added to the map.
  yearsPreview: [1985, 1986, 1987, 1988, 2025, 2026],

  // Filters, applied in this order. For each filter, classes are processed
  // in the order given (the first class has priority).
  //   first3  : fixes the first year          (NV FF FF -> FF FF FF)
  //   middle3 : fixes 1-year interruptions    (FF NV FF -> FF FF FF)
  //   middle4 : fixes the first year of a 2-year interruption; follow it
  //             with middle3 to fix the second one
  //   middle5 : fixes the first year of a 3-year interruption; follow it
  //             with middle4 and middle3
  //   last3   : fixes the last year           (FF FF NV -> FF FF FF)
  filterExecution: [
    { name: 'first3',  order: [3, 21, 25] },
    { name: 'middle3', order: [3, 21, 25] },
    { name: 'middle4', order: [3, 21, 25] },
    { name: 'middle3', order: [3, 21, 25] },
    { name: 'middle5', order: [3, 21, 25] },
    { name: 'middle4', order: [3, 21, 25] },
    { name: 'middle3', order: [3, 21, 25] },
    { name: 'last3',   order: [3, 21, 25] }
  ],

  // Years and classes kept as in the input. Excluded years are still used
  // as neighbors by the filter; their own values are restored at the end.
  exclusion: {
    years: [],
    classes: []
  },

  // Years removed from the filter: they are neither used as neighbors nor
  // changed, and are added back unchanged at the end.
  ignore: {
    years: []
  },

  // Restrict the filter to an area (or to everything outside it).
  hidden: {
    activate: false,
    areas: null,     // FeatureCollection drawn in the Code Editor, with a numeric property 'id' = 1
    mascara: null,   // ee.Image mask (1 = area), e.g. an imported asset
    inside: true     // true: filter only inside the area; false: only outside
  },

  // Area charts (ha) of some classes: filtered, input and previous collection.
  Graficar: {
    graficar: true,
    claseGraph: [3, 13]
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
// 3. TEMPORAL RULES
// =============================================================================
// Each rule returns the corrected band of one year. Masks are always
// computed on the input of the current pass (`image`), not on the bands
// already corrected in the same pass.

function band(image, year) {
  return image.select(PREFIX + '_' + year);
}

/** Sets `value` where `mask` is 1 (also on masked pixels of `target`). */
function setWhere(target, mask, value) {
  return target.blend(target.mask(mask.eq(1)).where(mask.eq(1), value));
}

var RULES = {

  // y-1 = c, y != c, y+1 = c  ->  y = c
  middle3: function (image, value, years, i) {
    var current = band(image, years[i]);
    var mask = band(image, years[i - 1]).eq(value)
      .and(current.neq(value))
      .and(band(image, years[i + 1]).eq(value));
    return setWhere(current, mask, value);
  },

  // y-1 = c, y != c, y+1 != c, y+2 = c  ->  y = c   (y+1 is fixed by a later middle3)
  middle4: function (image, value, years, i) {
    var current = band(image, years[i]);
    var mask = band(image, years[i - 1]).eq(value)
      .and(current.neq(value))
      .and(band(image, years[i + 1]).neq(value))
      .and(band(image, years[i + 2]).eq(value));
    return setWhere(current, mask, value);
  },

  // y-1 = c, y, y+1, y+2 != c, y+3 = c  ->  y = c   (the rest is fixed by middle4 + middle3)
  middle5: function (image, value, years, i) {
    var current = band(image, years[i]);
    var mask = band(image, years[i - 1]).eq(value)
      .and(current.neq(value))
      .and(band(image, years[i + 1]).neq(value))
      .and(band(image, years[i + 2]).neq(value))
      .and(band(image, years[i + 3]).eq(value));
    return setWhere(current, mask, value);
  }
};

// Number of years after `y` needed by each middle rule.
var RULE_SPAN = { middle3: 1, middle4: 2, middle5: 3 };

/**
 * Applies one rule for one class to every year of the series.
 */
function applyWindow(image, filterName, value, years) {
  var n = years.length;

  if (filterName === 'first3') {
    // y0 != c, y1 = c, y2 = c  ->  y0 = c
    var first = band(image, years[0]);
    var firstMask = first.neq(value)
      .and(band(image, years[1]).eq(value))
      .and(band(image, years[2]).eq(value));
    return setWhere(first, firstMask, value)
      .addBands(image.select(years.slice(1).map(function (year) { return PREFIX + '_' + year; })));
  }

  if (filterName === 'last3') {
    // yn-2 = c, yn-1 = c, yn != c  ->  yn = c
    var last = band(image, years[n - 1]);
    var lastMask = band(image, years[n - 3]).eq(value)
      .and(band(image, years[n - 2]).eq(value))
      .and(last.neq(value));
    return image.select(years.slice(0, n - 1).map(function (year) { return PREFIX + '_' + year; }))
      .addBands(setWhere(last, lastMask, value));
  }

  var span = RULE_SPAN[filterName];
  var bands = years.map(function (year, i) {
    var applies = i > 0 && i < n - span;
    return applies ? RULES[filterName](image, value, years, i) : band(image, year);
  });

  return ee.Image.cat(bands);
}

/**
 * Applies one filter (all its classes, in order). With a hidden-area mask,
 * the result is only kept where the mask is 1.
 */
function applyFilter(image, filter, years, hiddenMask) {
  var original = image;

  filter.order.forEach(function (classId) {
    image = applyWindow(image, filter.name, classId, years);
  });

  if (hiddenMask) {
    image = original.blend(image.updateMask(hiddenMask));
  }

  return image;
}


// =============================================================================
// 4. HELPER FUNCTIONS
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
    .updateMask(inputImage.select([inputBands.get(0)]))
    .rename(BAND_NAMES);
}

/**
 * Builds the hidden-area mask (1 = filter, 0 = keep input).
 */
function getHiddenMask(region, regionMask) {
  var options = PARAMS.hidden;
  var mask;

  var drawnMask = options.areas
    ? options.areas.reduceToImage(['id'], ee.Reducer.first())
        .clipToBoundsAndScale(region, null, null, null, 30)
        .unmask(0)
        .updateMask(regionMask)
    : null;

  if (drawnMask && options.mascara) {
    mask = drawnMask.blend(options.mascara.updateMask(regionMask));
  } else if (drawnMask) {
    mask = drawnMask;
  } else {
    mask = regionMask.multiply(0).blend(options.mascara.updateMask(regionMask));
  }

  if (!options.inside) {
    mask = mask.remap([0, 1], [1, 0]);
  }

  Map.addLayer(mask, { min: 0, max: 1 }, 'Hidden-area mask', false);
  return mask;
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
// 5. TEMPORAL FILTER
// =============================================================================

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filter(ee.Filter.eq('id_regionC', PARAMS.regionId));

var regionMask = region
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

var original = loadClassification();
print('Input image', original);

// Ignored years are taken out of the series.
var ignoredBands = PARAMS.ignore.years.map(function (year) { return PREFIX + '_' + year; });
var filterYears = YEARS.filter(function (year) { return PARAMS.ignore.years.indexOf(year) === -1; });
var input = original.select(ee.List(BAND_NAMES).removeAll(ignoredBands));

var hiddenMask = PARAMS.hidden.activate ? getHiddenMask(region, regionMask) : null;

var filtered = input;
PARAMS.filterExecution.forEach(function (filter) {
  filtered = applyFilter(filtered, filter, filterYears, hiddenMask);
});

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

// Ignored years: added back unchanged.
if (ignoredBands.length > 0) {
  filtered = filtered.addBands(original.select(ignoredBands));
}

filtered = filtered.select(BAND_NAMES).set({
  regions: PARAMS.regionId.toString(),
  country: PARAMS.country,
  version: PARAMS.outputVersion,
  step: 'Temporal-filter',
  theme: 'General Map'
});

print('Output image', filtered);


// =============================================================================
// 6. MAP AND CHARTS
// =============================================================================

Map.setOptions('SATELLITE');

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
  Map.addLayer(original.select(name), CLASS_VIS, 'Classification ' + year, false);
  Map.addLayer(filtered.select(name), CLASS_VIS, 'Temporal filter ' + year, false);
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
    print(areaChart(original, classId, region, YEARS, 'input'));
    print(areaChart(previousCollection, classId, region, previousYears, 'previous collection'));
  });
}


// =============================================================================
// 7. EXPORT
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
