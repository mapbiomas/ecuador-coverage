/**
 * @name
 *      03-1-gapfill.js
 *
 * @description
 *      Gap-fill filter for the multiband classification of one region
 *      (MapBiomas Ecuador - Collection 4). First filter of step 4.
 *
 *      Pixels with no information in a year (masked, or class 27 = not
 *      observed, e.g. clouds or missing mosaic) are filled with the class of
 *      the nearest valid year:
 *        - 't0tn_tnt0' (default): first from past years (t0 -> tn), then
 *          the remaining gaps from future years (tn -> t0);
 *        - 'tnt0_t0tn': first from future years, then from past years.
 *      Years missing from the input stack are added as empty bands and
 *      filled in the same way.
 *
 *      Exclusions:
 *        - exclusion.clases: these classes are neither filled nor used to
 *          fill other years; their original pixels are kept.
 *        - exclusion.years: these years do not pass their classes to other
 *          years and are kept unchanged. With `refill: true`, a second pass
 *          fills their own gaps from the other years.
 *
 * @usage
 *      1. Set PARAMS (region, input and output versions, exclusions).
 *      2. Run and compare the layers "Classification <year>" and
 *         "Gapfill <year>" over the mosaics.
 *      3. Start the export task from the Tasks tab.
 *
 * @inputs
 *      <INPUT_BASE><inputCollection>/<COUNTRY>-<regionId>-<inputVersion>
 *      (multiband image from step 3, bands classification_<year>)
 *
 * @outputs
 *      <paths.pathClassificationFilterGM><COUNTRY>-<regionId>-<outputVersion>
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
  regionId: 40105,                  // Classification region (field id_regionC)
  country: 'ECUADOR',

  // Input folder: 'classification' (stack from step 3) or
  // 'classification-ft' (output of another filter; missing years are not added).
  inputCollection: 'classification',
  inputVersion: 1,
  outputVersion: 996,

  // Years of the output (one band per year).
  firstYear: 1985,
  lastYear: 2026,

  // Years added to the map.
  yearsPreview: [1985, 1986, 1987, 1988, 1990, 1991, 2005, 2022, 2023, 2024, 2025, 2026],

  // Fill order: 't0tn_tnt0' (past first) or 'tnt0_t0tn' (future first).
  fillOrder: 't0tn_tnt0',

  exclusion: {
    clases: [],     // classes that are never filled nor used to fill
    years: []       // years that keep their values and do not fill other years
  },

  // true: after the first pass, also fill the gaps of exclusion.years.
  refill: false,

  addMosaic: true,
  addRegion: true
};


// =============================================================================
// 2. MODULES AND CONSTANTS
// =============================================================================

var paths = require('users/mapbiomasecuador/LULC:COLECCION4/05-modules/CollectionDirectories.js').paths;
var palette = require('users/mapbiomasecuador/LULC:MODULES/Palettes.js').get('EcuadorCol4');

var INPUT_BASE = 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION4/GENERAL_MAP/CLASSIFICATION/';
var OUTPUT_PATH = paths.pathClassificationFilterGM;   // must end with '/'

var NOT_OBSERVED = 27;

var YEARS = [];
for (var y = PARAMS.firstYear; y <= PARAMS.lastYear; y++) { YEARS.push(y); }

var BAND_NAMES = YEARS.map(function (year) { return 'classification_' + year; });

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
 * Loads the classification and builds one band per year of YEARS.
 *
 * @returns {Object}
 *   original:       years missing from the input are filled with 27;
 *   classification: same, but 27 is masked (gaps to fill).
 */
function loadClassification() {
  var inputPath = INPUT_BASE + PARAMS.inputCollection + '/';
  var baseImage = ee.Image(inputPath + PARAMS.country + '-' + PARAMS.regionId + '-' + PARAMS.inputVersion);

  // Filtered inputs already have every year.
  if (PARAMS.inputCollection.slice(-3) === '-ft') {
    return { original: baseImage, classification: baseImage };
  }

  var inputBands = baseImage.bandNames();
  var missingBands = ee.List(BAND_NAMES).removeAll(inputBands);
  print('Years added (missing in the input)', missingBands);

  // Years missing from the input: constant 27.
  var missingImages = ee.ImageCollection(missingBands.map(function (band) {
    return ee.Image(NOT_OBSERVED).rename(ee.String(band)).set('year', ee.String(band).slice(-4));
  }));

  var validImages = ee.ImageCollection(inputBands.map(function (band) {
    return baseImage.select([band]).set('year', ee.String(band).slice(-4));
  }));

  var allYears = missingImages.merge(validImages).sort('year');

  var original = allYears.toBands()
    .updateMask(baseImage.mask().reduce(ee.Reducer.max()))
    .rename(BAND_NAMES);

  // Footprint of the region: first input band other than 1985.
  var footprintBand = inputBands.filter(ee.Filter.neq('item', 'classification_1985')).get(0);

  var classification = allYears
    .map(function (image) { return image.updateMask(image.unmask().neq(NOT_OBSERVED)); })
    .toBands()
    .updateMask(baseImage.select([footprintBand]))
    .rename(BAND_NAMES);

  return { original: original, classification: classification };
}

/**
 * Masks the given classes in every band.
 */
function maskClasses(image, classes, bandNames) {
  return ee.Image.cat(bandNames.map(function (band) {
    var bandImage = image.select(band);
    var keep = classes.reduce(function (mask, classId) {
      return mask.and(bandImage.neq(classId));
    }, ee.Image.constant(1));
    return bandImage.updateMask(keep);
  }));
}

/**
 * Puts back the original pixels of the given classes in every band.
 */
function restoreClasses(filled, original, classes, bandNames) {
  return ee.Image.cat(bandNames.map(function (band) {
    var originalBand = original.select(band);
    var result = filled.select(band);
    classes.forEach(function (classId) {
      result = result.blend(originalBand.updateMask(originalBand.unmask().eq(classId)));
    });
    return result;
  }));
}

/**
 * Fills masked pixels with the previous valid year (t0 -> tn).
 */
function fillForward(image) {
  var bands = image.bandNames();

  // Bands are stacked newest first, so band 0 is always the previous year.
  var filled = ee.Image(bands.slice(1).iterate(function (bandName, previous) {
    previous = ee.Image(previous);
    return image.select(ee.String(bandName)).unmask(previous.select([0])).addBands(previous);
  }, image.select([bands.get(0)])));

  return filled.select(bands);
}

/**
 * Fills masked pixels with the next valid year (tn -> t0).
 */
function fillBackward(image) {
  var bands = image.bandNames();
  var reversed = bands.reverse();

  // Bands are stacked oldest last, so the last band is always the next year.
  var filled = ee.Image(reversed.slice(1).iterate(function (bandName, next) {
    next = ee.Image(next);
    var lastIndex = next.bandNames().length().subtract(1);
    return next.addBands(image.select(ee.String(bandName)).unmask(next.select(lastIndex)));
  }, image.select([reversed.get(0)])));

  return filled.select(bands);
}

/**
 * Gap fill in both directions. `yearsToExclude` are emptied before filling
 * (so they do not fill other years) and restored afterwards.
 */
function applyGapFill(image, order, yearsToExclude) {
  var input = image;

  yearsToExclude.forEach(function (year) {
    var name = 'classification_' + year;
    var empty = ee.Image(0).selfMask().rename(name);
    input = input.addBands(empty, [name], true);
  });

  var filled = order === 'tnt0_t0tn'
    ? fillForward(fillBackward(input))
    : fillBackward(fillForward(input));

  if (yearsToExclude.length > 0) {
    var excludedBands = yearsToExclude.map(function (year) { return 'classification_' + year; });
    filled = filled.addBands(image.select(excludedBands), null, true);
    print('Unchanged years', yearsToExclude);
  }

  return filled.select(image.bandNames());
}

/**
 * Median mosaic of a year for the map. From 2022 on, Landsat 8 is used.
 * TODO: no 2026 mosaic yet; the 2025 Landsat 9 mosaic is shown instead.
 */
function addMosaic(mosaics, year, regionMask) {
  var yearMosaics;

  if (year === 2026) {
    yearMosaics = mosaics.filter(ee.Filter.eq('year', 2025)).filter(ee.Filter.eq('satellite', 'l9'));
  } else {
    yearMosaics = mosaics.filter(ee.Filter.eq('year', year));
    if (year >= 2022) {
      yearMosaics = yearMosaics.filter(ee.Filter.eq('satellite', 'l8'));
    }
  }

  // Added directly (not in a callback) so that, for each year, the layers
  // keep the order: mosaic, classification, gapfill.
  Map.addLayer(yearMosaics.median().updateMask(regionMask), MOSAIC_VIS, 'Mosaic ' + year, false);
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
// 4. GAP FILL
// =============================================================================

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filter(ee.Filter.eq('id_regionC', PARAMS.regionId));

var regionMask = region
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

var loaded = loadClassification();
var original = loaded.original;
var input = loaded.classification;

var excludedClasses = PARAMS.exclusion.clases;
var outputBands = input.bandNames().getInfo();

// Excluded classes do not take part in the filling.
if (excludedClasses.length > 0) {
  input = maskClasses(input, excludedClasses, outputBands);
}

var gapfill = applyGapFill(input, PARAMS.fillOrder, PARAMS.exclusion.years);

if (PARAMS.refill) {
  gapfill = applyGapFill(gapfill, PARAMS.fillOrder, []);
}

// Put back the original pixels of the excluded classes.
if (excludedClasses.length > 0) {
  gapfill = restoreClasses(gapfill, original, excludedClasses, outputBands);
}

gapfill = gapfill.set({
  regions: PARAMS.regionId.toString(),
  country: PARAMS.country,
  version: PARAMS.outputVersion,
  step: 'Gapfill filter',
  theme: 'General Map'
});

print('Output image', gapfill);


// =============================================================================
// 5. MAP
// =============================================================================

Map.setOptions('SATELLITE');

var mosaics = ee.ImageCollection(paths.mosaicRaisgAct)
  .merge(ee.ImageCollection(paths.mosaicPacificoAct))
  .filterBounds(region);

// For each preview year: mosaic, original classification and gapfill.
PARAMS.yearsPreview.forEach(function (year) {
  if (PARAMS.addMosaic) {
    addMosaic(mosaics, year, regionMask);
  }
  var band = 'classification_' + year;
  Map.addLayer(original.select(band), CLASS_VIS, 'Classification ' + year, false);
  Map.addLayer(gapfill.select(band), CLASS_VIS, 'Gapfill ' + year, false);
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


// =============================================================================
// 6. EXPORT
// =============================================================================

var fileName = PARAMS.country + '-' + PARAMS.regionId + '-' + PARAMS.outputVersion;

Export.image.toAsset({
  image: gapfill.byte().reproject('EPSG:4326', null, 30),
  description: fileName,
  assetId: OUTPUT_PATH + fileName,
  scale: 30,
  pyramidingPolicy: { '.default': 'mode' },
  maxPixels: 1e13,
  region: region.geometry().bounds()
});
