/**
 * @name
 *      02-1-classifier.js
 *
 * @description
 *      Random Forest land-cover classification of one classification region,
 *      year by year (MapBiomas Ecuador - Collection 4).
 *
 *      For each year in `years`:
 *        1. Builds the annual mosaic of the region (selected satellites) and
 *           adds static variables (elevation, slope, HAND, shade, lon/lat...).
 *        2. Loads the training samples of that year (step 2) and,
 *           optionally, adds:
 *             - samples of selected classes from other regions,
 *             - extra samples drawn inside polygons (one class per polygon),
 *             - cloud samples (class 90) for specific years.
 *        3. Trains a Random Forest and classifies the mosaic. Optionally
 *           reports accuracy on a 30 % validation split, the variable
 *           importance and a per-class probability map.
 *        4. Groups classes (remap) and exports the classification.
 *
 * @usage
 *      1. Set PARAMS (region, samples version, years, output version).
 *      2. (Optional) Draw polygons for extra samples or clouds in the Code
 *         Editor and list them in `additionalSamples` / `aditionalCloudSamples`.
 *      3. Run, review the classification against the mosaic and the console
 *         statistics, and start the export tasks from the Tasks tab.
 *
 * @inputs
 *      - Samples:  <paths.pathSamplesPointsAct>samples-<COUNTRY>-<regionId>-<year>-p03-<samplesVersion>
 *      - Annual mosaics (step 1) and static variables (see getStaticBands).
 *
 * @outputs
 *      - Image asset per year:
 *        <paths.pathPreliminarClassificationGM><COUNTRY>-<regionId>-<year>-<outputVersion>
 *        band 'classification_<year>'; 27 = not observed / no data.
 *      - Optional: variable importance table (Drive, CSV) and probability maps.
 * 
 * @collection
 *      4
 *
 * @author
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @version
 *      2025-01-20  First version
 *      2025-02-04  Updated by Fabricio Garcés
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {
  country: 'ECUADOR',
  regionId: 40201,                 // Classification region (field id_regionC)

  // Satellites of the mosaics to classify ('lx', 'l4', 'l5', 'l7', 'l8', 'l9').
  // If several are given, their median is used.
  mosaicsatellites: ['l8'],

  samplesVersion: 990,             // Version of the training samples (input)
  outputVersion: 1,                // Version of the classification (output)

  years: [2024],                   // Years to classify (1985-2025)
  yearsPreview: [2024],            // Years added to the map

  // true: when classifying 2025, export the result as 2026 too
  // (placeholder until a 2026 mosaic exists).
  addFalseNewYear: false,

  // *** CAUTION *** true deletes existing assets with the same name before exporting.
  overwrite: false,

  // --- Random Forest ----------------------------------------------------------
  trees: 120,
  variablesPerSplit: 1,
  tileScale: 16,

  // true: hold out 30 % of the samples to report the accuracy and the
  // confusion matrix. NOTE: the classification is then trained with the
  // remaining 70 % only.
  estadisticos: true,

  // true: export the variable importance table (Drive, CSV).
  tabla_importancia: true,
  driveFolder: 'RF-PRELIMINAR-CLASSIFICATION',

  // Classes to drop from the samples, e.g. [27].
  removeSamples: [],

  // --- Variables --------------------------------------------------------------
  // Mosaic bands to use. [] = all mosaic bands.
  variables: [
    // 'blue_median', 'green_median', 'red_median', 'nir_median', 'swir2_median'
  ],
  // Static variables added to every mosaic. Keep only those that are
  // important (see the importance table).
  staticVariables: [
    'altitude', 'latitude', 'longitude', 'shademask2', 'slope', 'slppost',
    // 'hand30_100',
    'hand30_1000', 'hand30_5000', 'hand90_1000'
  ],

  // true: fill pixels with no data before classifying (see unmaskMosaic).
  maskNoDataValue: false,

  // --- Extra samples ----------------------------------------------------------
  // Extra samples drawn inside polygons drawn in the Code Editor:
  // polygon i gets points[i] samples of class classes[i].
  additionalSamples: {
    polygons: [],    // e.g. [geometry_3, geometry_21]
    classes: [],     // e.g. [3, 21]
    points: []       // e.g. [20, 40]
  },
  // Samples of some classes taken from other regions (one entry per region).
  samplesFromRegions: {
    regionIds: [40201],
    classes: [33],
    versions: [998]
  },
  // Cloud samples (class 90, grouped to 27 afterwards) for specific years.
  aditionalCloudSamples: {
    geometryList: [],  // e.g. [geometry_90_2020, geometry_90_2017]
    years: [],         // e.g. [2020, 2017]
    nPoints: []        // e.g. [40, 30]
  },
  scaleNumber: 30,     // Scale (m) used to draw the extra samples

  // --- Probability map --------------------------------------------------------
  probabiltiMap: {
    activate: false,   // compute one probability band per class
    addToMap: false,
    exportar: false,
    assetFolder: ''    // TODO: folder for the probability assets (must end with '/')
  },

  // --- Map --------------------------------------------------------------------
  adicionar_muestras: true,   // add the samples to the map
  addRegion: true,            // add the region outline
  lulcAct: true,              // add the current national land-cover map

  // Classifications of other regions to show on the map (same years).
  aditionalClasification: {
    regionsId: [],    // e.g. [40606, 40607]
    vesions: []       // e.g. [6, 7]
  }
};


// =============================================================================
// 2. MODULES AND CONSTANTS
// =============================================================================

var paths = require('users/mapbiomasecuador/LULC:COLECCION4/05-modules/CollectionDirectories.js').paths;
var palette = require('users/mapbiomasecuador/LULC:MODULES/Palettes.js').get('EcuadorCol4');

var SAMPLES_PATH = paths.pathSamplesPointsAct;               // must end with '/'
var CLASSIFICATION_PATH = paths.pathPreliminarClassificationGM;  // must end with '/'

var NOT_OBSERVED = 27;
var CLOUD = 90;

// Class grouping applied to the classification.
var REMAP_FROM = [3, 4, 5, 6, 11, 12, 29, 13, 14, 15, 18, 21, 35, 9, 22, 24, 30, 25, 33, 34, 27, 90];
var REMAP_TO =   [3, 4, 5, 3, 11, 12, 25, 13, 21, 21, 21, 21, 21, 3, 25, 25, 25, 25, 33, 34, 27, 27];

// Classes shown in the legend (output classes after the remap).
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

var CLASS_VIS = { min: 0, max: palette.length - 1, palette: palette };
var MOSAIC_VIS = { bands: ['swir1_median', 'nir_median', 'red_median'], gain: [0.08, 0.06, 0.2] };
var PROBABILITY_PALETTE = ['606060', '29ff7f', '6638c0', 'ff0000'];


// =============================================================================
// 3. FUNCTIONS
// =============================================================================

/**
 * Static variables: elevation, slope, HAND (height above nearest drainage),
 * shade and slope-position layers, longitude, latitude and potential-water
 * masks (HAND below 0, 1, 2, 5, 10 m, excluding permanent water).
 *
 * The band names must match the variables of the samples (step 2,
 * 01-3-random-points.js).
 */
function getStaticBands() {
  var altitude = ee.Image('JAXA/ALOS/AW3D30_V1_1').select('AVE').rename('altitude');
  var slope = ee.Terrain.slope(altitude).int8().rename('slope');

  var hand30_100 = ee.ImageCollection('users/gena/global-hand/hand-100')
    .mosaic().focal_mean(0.1).rename('hand30_100');

  // Potential water, excluding SWBD permanent water.
  var swbdMask = ee.Image('MODIS/MOD44W/MOD44W_005_2000_02_24').select('water_mask')
    .unmask().not().focal_median(1);

  var handWater = ee.ImageCollection([0, 1, 2, 5, 10].map(function (threshold) {
    var water = hand30_100.lte(threshold)
      .focal_max(1)
      .focal_mode(2, 'circle', 'pixels', 5)
      .mask(swbdMask);
    return water.mask(water);
  })).toBands()
    .rename(['water_HAND_0m', 'water_HAND_1m', 'water_HAND_2m', 'water_HAND_5m', 'water_HAND_10m']);

  return ee.Image.cat(
    altitude,
    ee.Image('projects/mapbiomas-raisg/MOSAICOS/shademask2_v3').rename('shademask2'),
    ee.Image('projects/mapbiomas-raisg/MOSAICOS/slppost2_30_v3').rename('slppost'),
    ee.Image('users/gena/GlobalHAND/30m/hand-1000').rename('hand30_1000'),
    ee.Image('users/gena/GlobalHAND/30m/hand-5000').rename('hand30_5000'),
    ee.Image('users/gena/GlobalHAND/90m-global/hand-1000').rename('hand90_1000'),
    slope,
    hand30_100,
    ee.Image.pixelLonLat(),
    handWater
  );
}

/**
 * Fills masked pixels of every band where the blue band equals 0.
 * TODO: document the purpose of this option.
 */
function unmaskMosaic(image) {
  var blue = image.select('blue_median').rename(['constant']);
  var blueZero = blue.updateMask(blue.eq(0));
  var bands = image.bandNames();

  return ee.ImageCollection(bands.map(function (band) {
    return blueZero.blend(image.select([band]).rename(['constant'])).rename([band]);
  })).toBands().rename(bands);
}

/**
 * Training samples of the region for one year, with the given bands.
 */
function importSamples(year, bands) {
  var assetId = SAMPLES_PATH + 'samples-' + PARAMS.country + '-' + PARAMS.regionId + '-' +
    year + '-p03-' + PARAMS.samplesVersion;

  return ee.FeatureCollection(assetId)
    .select(bands.add('reference'))
    .filter(ee.Filter.notNull(bands))
    .filter(ee.Filter.inList('reference', PARAMS.removeSamples).not());
}

/**
 * Adds samples of selected classes from other regions.
 */
function addSamplesFromRegions(samples, year, bands) {
  var options = PARAMS.samplesFromRegions;

  options.regionIds.forEach(function (regionId, i) {
    var assetId = SAMPLES_PATH + 'samples-' + PARAMS.country + '-' + regionId + '-' +
      year + '-p03-' + options.versions[i];

    samples = samples.merge(
      ee.FeatureCollection(assetId).filter(ee.Filter.and(
        ee.Filter.inList('reference', options.classes),
        ee.Filter.notNull(bands)
      ))
    );
  });

  return samples;
}

/**
 * Draws `nPoints` random samples of `classId` from the mosaic inside a polygon.
 */
function samplePolygon(image, polygon, classId, nPoints) {
  return image.sample({
    numPixels: nPoints,
    region: polygon,
    scale: PARAMS.scaleNumber,
    projection: 'EPSG:4326',
    seed: 1,
    geometries: true,
    tileScale: PARAMS.tileScale
  }).map(function (item) { return item.set('reference', classId); });
}

/**
 * Trains the Random Forest and classifies the mosaic.
 *
 * @returns {Object} image: classification (remapped, band
 *   'classification_<year>'); importance: ee.Feature; probability: ee.Image
 *   (only if probabiltiMap.activate).
 */
function applyClassifier(mosaic, samples, bands, year, regionMask) {

  var training = samples;
  var validation;

  if (PARAMS.estadisticos) {
    samples = samples.randomColumn();
    training = samples.filter(ee.Filter.lt('random', 0.7));
    validation = samples.filter(ee.Filter.gte('random', 0.7));
    print(year + ' - training samples', training.size());
    print(year + ' - validation samples', validation.size());
  }

  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: PARAMS.trees,
    variablesPerSplit: PARAMS.variablesPerSplit
  }).train(training, 'reference', bands);


  var bandName = 'classification_' + year;

  var image = mosaic.classify(classifier)
    .select(['classification'], [bandName])
    .unmask(NOT_OBSERVED)
    .updateMask(regionMask)
    .byte()
    .remap({ from: REMAP_FROM, to: REMAP_TO, defaultValue: 0, bandName: bandName })
    .rename(bandName);

  var result = { image: image };

  // Accuracy on the validation split.
  if (PARAMS.estadisticos) {
    var errorMatrix = validation.classify(classifier).errorMatrix('reference', 'classification');
    print(year + ' - accuracy', errorMatrix.accuracy());
    print(year + ' - confusion matrix', errorMatrix);
  }

  // Variable importance.
  if (PARAMS.tabla_importancia) {
    var explanation = ee.Dictionary(classifier.explain());
    result.importance = ee.Feature(null, ee.Dictionary(explanation.get('importance')))
      .set('_trees', explanation.get('numberOfTrees'))
      .set('_oobError', explanation.get('outOfBagErrorEstimate'))
      .set('_year', year);
  }

  // Probability of each class (one band per class, 'Id_<class>').
  if (PARAMS.probabiltiMap.activate) {
    // Band order = sorted classes of the training samples.
    var classIds = training.aggregate_array('reference').distinct().sort().getInfo();
    var names = classIds.map(function (id) { return 'Id_' + id; });

    result.probability = mosaic
      .classify(classifier.setOutputMode('MULTIPROBABILITY'))
      .arrayFlatten([names])
      .updateMask(regionMask);
  }

  return result;
}

/**
 * Exports an image to an asset (deleting it first if `overwrite`).
 */
function exportImage(image, assetId, region, properties) {
  if (PARAMS.overwrite) {
    try {
      ee.data.deleteAsset(assetId);
    } catch (error) {
      print('Nothing to delete: ' + assetId);
    }
  }

  var name = assetId.split('/').pop();

  Export.image.toAsset({
    image: image.reproject('EPSG:4326', null, 30).set(properties),
    description: name,
    assetId: assetId,
    scale: 30,
    pyramidingPolicy: { '.default': 'mode' },
    maxPixels: 1e13,
    region: region.geometry().bounds()
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
// 4. DATA
// =============================================================================

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filter(ee.Filter.eq('id_regionC', PARAMS.regionId));

var regionMask = region
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

var mosaics = ee.ImageCollection(paths.mosaicRaisgAct)
  .merge(ee.ImageCollection(paths.mosaicPacificoAct))
  .filterBounds(region)
  .filter(ee.Filter.inList('satellite', PARAMS.mosaicsatellites));

// Add the static variables to every mosaic.
if (PARAMS.staticVariables.length > 0) {
  var staticBands = getStaticBands();
  var mosaicBands = ee.Image(mosaics.first()).bandNames().cat(PARAMS.staticVariables);

  mosaics = mosaics.map(function (image) {
    return image.addBands(staticBands).select(mosaicBands);
  });
}

var importanceTable = ee.FeatureCollection([]);
var lastYear = Math.max.apply(null, PARAMS.years);


// =============================================================================
// 5. CLASSIFICATION, YEAR BY YEAR
// =============================================================================

PARAMS.years.forEach(function (year) {
  try {
    // Annual mosaic.
    var yearMosaic = mosaics.filter(ee.Filter.eq('year', year)).median();

    if (PARAMS.maskNoDataValue) {
      yearMosaic = unmaskMosaic(yearMosaic);
    }

    yearMosaic = yearMosaic.updateMask(regionMask);

    if (PARAMS.yearsPreview.indexOf(year) > -1) {
      Map.addLayer(yearMosaic, MOSAIC_VIS, 'Mosaic ' + year, false);
    }

    if (PARAMS.variables.length > 0) {
      yearMosaic = yearMosaic.select(PARAMS.variables.concat(PARAMS.staticVariables));
    }

    var bands = yearMosaic.bandNames();

    // Samples.
    var samples = importSamples(year, bands);

    if (PARAMS.samplesFromRegions.regionIds.length > 0) {
      samples = addSamplesFromRegions(samples, year, bands);
    }

    PARAMS.additionalSamples.polygons.forEach(function (polygon, i) {
      samples = samples.merge(samplePolygon(
        yearMosaic, polygon.geometry(),
        PARAMS.additionalSamples.classes[i], PARAMS.additionalSamples.points[i]));
    });

    var cloudIndex = PARAMS.aditionalCloudSamples.years.indexOf(year);
    if (cloudIndex > -1) {
      samples = samples.merge(samplePolygon(
        yearMosaic, PARAMS.aditionalCloudSamples.geometryList[cloudIndex].geometry(),
        CLOUD, PARAMS.aditionalCloudSamples.nPoints[cloudIndex]));
    }

    // A Random Forest needs at least two classes.
    var nClasses = samples.aggregate_array('reference').distinct().size().getInfo();
    print(year + ' - number of classes', nClasses);

    if (nClasses < 2) {
      print('WARNING: ' + year + ' has fewer than 2 classes. Year skipped.');
      return;
    }

    // Classify.
    var result = applyClassifier(yearMosaic, samples, bands, year, regionMask);
    var classification = result.image;

    // Importance table (exported once, with all years, after the last one).
    if (PARAMS.tabla_importancia) {
      importanceTable = importanceTable.merge(ee.FeatureCollection([result.importance]));

      if (year === lastYear) {
        Export.table.toDrive({
          collection: importanceTable,
          description: 'importance-' + PARAMS.country + '-' + PARAMS.regionId + '-' + PARAMS.outputVersion,
          folder: PARAMS.driveFolder,
          fileFormat: 'CSV'
        });
      }
    }

    // Map.
    if (PARAMS.yearsPreview.indexOf(year) > -1) {
      Map.addLayer(classification, CLASS_VIS, 'Classification ' + year + ' ' + PARAMS.regionId, false);

      if (PARAMS.probabiltiMap.activate && PARAMS.probabiltiMap.addToMap) {
        var firstBand = result.probability.bandNames().getInfo()[0];
        Map.addLayer(result.probability, { bands: [firstBand], palette: PROBABILITY_PALETTE },
          'Probability ' + year + ' ' + PARAMS.regionId, false);
      }

      if (PARAMS.adicionar_muestras) {
        var styledPoints = samples.map(function (point) {
          return point.set({ style: { color: ee.List(palette).get(point.get('reference')) } });
        });
        Map.addLayer(styledPoints.style({ styleProperty: 'style', width: 1.5 }), {}, 'Samples ' + year);
      }
    }

    // Export.
    var exportYear = year;
    if (year === 2025 && PARAMS.addFalseNewYear) {
      classification = classification.rename('classification_2026');
      exportYear = 2026;
    }

    exportImage(
      classification,
      CLASSIFICATION_PATH + PARAMS.country + '-' + PARAMS.regionId + '-' + exportYear + '-' + PARAMS.outputVersion,
      region,
      { year: exportYear, step: 'classifier', version: PARAMS.outputVersion }
    );

    if (PARAMS.probabiltiMap.activate && PARAMS.probabiltiMap.exportar) {
      exportImage(
        result.probability,
        PARAMS.probabiltiMap.assetFolder + PARAMS.country + '-probability-' + PARAMS.regionId + '-' +
          year + '-' + PARAMS.outputVersion,
        region,
        { year: year, step: 'Probability', version: PARAMS.outputVersion }
      );
    }

  } catch (error) {
    print('ERROR in ' + year + ': ' + error.message);
  }
});


// =============================================================================
// 6. REFERENCE LAYERS AND LEGEND
// =============================================================================

if (PARAMS.addRegion) {
  Map.addLayer(region.style({ fillColor: 'FF000000', color: 'FF0000' }), {}, 'Region ' + PARAMS.regionId);
}

if (PARAMS.lulcAct) {
  Map.addLayer(ee.Image(paths.pathLulcAct).updateMask(regionMask), CLASS_VIS, 'Current national land cover', false);
}

// Classifications of other regions, same preview years.
PARAMS.aditionalClasification.regionsId.forEach(function (regionId, i) {
  PARAMS.yearsPreview.forEach(function (year) {
    var image = ee.Image(CLASSIFICATION_PATH + PARAMS.country + '-' + regionId + '-' + year + '-' +
      PARAMS.aditionalClasification.vesions[i]);
    Map.addLayer(image, CLASS_VIS, 'Classification ' + year + ' ' + regionId, false);
  });
});

mapLegend(
  Map,
  'Land cover',
  LEGEND.map(function (item) { return palette[item[0]]; }),
  LEGEND.map(function (item) { return item[0] + '. ' + item[1]; }),
  'bottom-right'
);
