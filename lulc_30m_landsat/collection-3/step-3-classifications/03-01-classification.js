
/**
 * @name
 *      02-1-classifier-ecuador.js
 * 
 * @description
 *      CLASSIFICATION
 *      Script to generate year-by-year classifications for each classification region,
 *      requiring annual training samples
 * 
 * @authors
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @date
 *      20/01/2025
 *      04/02/2025 Modified by Fabricio Garcés
 */ 

/**
 * USER PARAMETERS
 */
var param = {
  country: 'ECUADOR',
  regionId: 40201,
  mosaicsatellites: ['l8'], //'l9', 'l4', 'l5', 'l7', 'lx', 'l8'
  addFalseNewYear: false, //add a dummy 2025
  samplesVersion: 2, //Version of training table, input
  outputVersion: 999, //Classification basemap version, output
  overwrite: false, //****CAUTION (Deletes ASSETS)
  estadisticos: true, //Calculate the error matrix and the accuracy of the classification
  trees: 120,
  maskNoDataValue: false, //Mask the no data values
  
  //years to classify
  years: [    
    // 1985,1986,1987,//1988,
    // 1989,
    // 1990,1991,//1992,
    // 1993,1994,
    // 1995,1996,1997,1998,1999,
    // 2000,2001,2002,2003,2004,
    // 2005,2006,2007,2008,2009,
    // 2010,2011,2012,2013,2014,
    // 2015,2016,2017,2018,2019,
    // 2020,2021,2022,2023
    2024
  ],
  
  yearsPreview: [ 
    // 1985,1986,1987,//1988,
    // 1989,
    // 1990,1991,//1992,
    // 1993,1994,
    // 1995,1996,1997,1998,1999,
    // 2000,2001,2002,2003,2004,
    // 2005,2006,2007,2008,2009,
    // 2010,2011,2012,2013,2014,
    // 2015,2016,2017,2018,2019,
    // 2020,2021,2022,2023
    2024
  ],
  
  removeSamples: [],
  tabla_importancia: true, //Generates the table of importance of variables
  variables: ee.List([
    //'blue_median', 'green_median', 'red_median',
    //'nir_median', 'swir2_median'
  ]),
  staticVariables: ee.List([ //Include only those found in the variable importance list
    'altitude',
    'latitude',
    'longitude',
    'shademask2',
    'slope',
    'slppost',
    'hand30_100',    
    'hand30_1000',
    'hand30_5000',
    'hand90_1000'
  ]),
  additionalSamples: { //To add samples, in addition to stable pixels
    polygons: [geometry_3/*,geometry_4,geometry_12,geometry_21*/], //geometry_4, geometry_11, geometry_25, geometry_3, geometry21, geometry_33
    classes: [3, /*4, 12, 21*/], //4, 11, 25, 3, 21, 33
    points: [20,/* 40, 30, 20*/] //350, 150, 100, 400, 200, 75
  },
  samplesFromRegions: {
    regionIds: [40201], //Region from which to bring samples
    classes: [33], //Land cover class to bring
    versions: [1] //Version of samples, note: process repeats for each region and each cover class
  },
  adicionar_muestras: true, //Load samples to map (training, complementary and from other region)
  addRegion: true, //Add Region to map
  
  driveFolder: 'RF-PRELIMINARY-CLASSIFICATION',
  //Load already generated classifications from regions selected by the user
  aditionalClasification: {
    regionsId: [], //40606, 40607, 40105, 40901, 40902, 40905, 40907, 40906, 40904, 40605, 40606
    versions: [], //6, 7, 9, 8, 5, 8, 7, 6, 6, 7, 7
  },
  //Create probability map
  probabiltiMap: {
    activate: false,
    addToMap: false,
    exportar: false,
  },
  //Add Planet data
  addPlanet: false,
  //Create cloud class
  aditionalCloudSamples: {
    geometryList: [/*geometry_90_2020, geometry_90_2017*/],
    years: [2020, 2017],
    nPoints: [40, 30]
  },
  //Example:
  // aditionalCloudSamples: {
  //   geometryList: [geometry_90_2020, geometry_90_2017],
  //   years: [2020, 2017],
  //   nPoints: [40, 30]
  // }
  lulcAct: true,
  scaleNumber: 30,
  //Module containing directory paths
  dirPath: require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths
};

var paths = param.dirPath;

param.samplesPath = paths.pathSamplesPointsAct;

param.basePath = paths.pathClasificationPreAct;

var palette = require('users/kahuertas/mapbiomas-colombia:mapbiomas-colombia/collection-3/modules/Palettes.js').get('ColombiaCol3');

palette[4] = '#7dc975';

param.palette = palette;

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filterMetadata('id_regionC', 'equals', param.regionId);

var setVersion = function(item) { return item.set('version', 1) };

var regionMask = region
  .map(setVersion)
  .reduceToImage(['version'], ee.Reducer.first());
  
var mosaic = ee.ImageCollection(paths.mosaicRaisgAct)
  .merge(ee.ImageCollection(paths.mosaicPacificoAct))
  .filterBounds(region);

var bandsMosaic = mosaic.first().bandNames();
bandsMosaic = bandsMosaic.cat(param.staticVariables);

var years = ee.List(param.years);

var year_max = years.reduce(ee.Reducer.max()).getInfo();

var variables = param.variables;

var staticVariables = param.staticVariables;

if(param.tabla_importancia) {
  var importance_table = ee.FeatureCollection([]);
}

var mosaicsatellites = param.mosaicsatellites;

var staticBands = [];

if(param.staticVariables.getInfo().length > 0) {
  staticBands = getStaticBands(staticVariables);
  mosaic = mosaic.map(function(img) {
    var img_sv = img.addBands(staticBands).select(bandsMosaic);
    return img_sv;
  });
}

var geometryCloudList = param.aditionalCloudSamples.geometryList;
var nCloudPoints = param.aditionalCloudSamples.nPoints;
var cloudYears = ee.List(param.aditionalCloudSamples.years);

years.evaluate(function(years, error) {
  try {
    years.forEach(function(year) {
      // get mosaics for the year
      var yearMosaic = mosaic.filterMetadata('year', 'equals', year);

      var satMosaic = ee.ImageCollection([]);
      for (var satellitep in mosaicsatellites) {
        var satellite = mosaicsatellites[satellitep];
        satMosaic = satMosaic.merge(yearMosaic.filterMetadata('satellite', 'equals', satellite));
      }
      yearMosaic = satMosaic;
      
      if (param.maskNoDataValue) {
        //Unmask the no data value
        yearMosaic = unmaskMosaic(yearMosaic.median())
          .updateMask(regionMask);
      } else {
        yearMosaic = yearMosaic.median();
      }
      
      //variables + static
      var bands = variables.cat(staticVariables);
      
      //Mask mosaic according to mapping region
      yearMosaic = yearMosaic.updateMask(regionMask);
      
      //Add mosaic to map
      if(param.yearsPreview.indexOf(year) > -1) {
        addMosaic(yearMosaic, year);
      }
      
      //Select mosaic variables, otherwise work with all variables
      yearMosaic = variables.getInfo().length > 0 
        ? yearMosaic.select(bands)
        : yearMosaic;
      
      //Add to mosaic configuration
      param.yearMosaic = yearMosaic;
      
      // update config
      param.singleYear = year;
      param.bands = yearMosaic.bandNames();
      param.contained = param.bands.containsAll(ee.List(param.variables));
      
      // samples by year
      var yearTrainingSamples = importSamples(param);
      
      // add samples from neighbour regions
      var classesFromRegions = param.samplesFromRegions.regionIds;
      var samples = classesFromRegions && classesFromRegions.length > 0
        ? getSamplesFromRegions(param, yearTrainingSamples)
        : yearTrainingSamples;

      //add additional samples from polygon
      var classesFromPolygons = param.additionalSamples.polygons;
      samples = classesFromPolygons && classesFromPolygons.length > 0
        ? samples.merge(resampleCover(param, param.yearMosaic))
        : samples;
        
      //add cloud samples
      if (cloudYears.contains(year).getInfo()) {
        var yearPosition = cloudYears.indexOf(year).getInfo();
        var cloudPolygon = geometryCloudList[yearPosition].geometry();
        var cloudPoint = nCloudPoints[yearPosition];
        samples = samples.merge(resampleCloudCover(param, param.yearMosaic, cloudPolygon, cloudPoint));
        param.probabiltiMap.coberturas_mapear.push("Id_90");
      }
      
      // Define classifier and compute importance tables
      param.regionMask = regionMask;
      var nClasSample = getNumberSamples(param, samples);
      param.nClasSample = nClasSample.reduce(ee.Reducer.countDistinct());
      
      if (param.probabiltiMap.activate) {
        // Function to convert strings to numbers
        var toNumber = function(str) {
          return ee.Number.parse(str);
        };
        
        var keys = ee.List(samples.aggregate_array('reference'));
        keys = keys.distinct();
        keys = keys.map(toNumber);
        keys = keys.distinct();
        param.probabiltiMap.coberturas_mapear = keys;
        var coberturas_mapear_p = param.probabiltiMap.coberturas_mapear;
        
        // Convert string list to numbers
        var numberList = coberturas_mapear_p.map(toNumber);
        
        // Sort number list
        var sortedNumberList = numberList.sort();
        
        // Function to convert numbers to strings
        var toString = function(num) {
          return ee.String(num);
        };
        
        // Convert number list to strings
        param.probabiltiMap.coberturas_mapear = sortedNumberList.map(toString).getInfo();
      }
      
      var classification = applyClassifier(param, samples);

      var img_classifier = classification.img_clasificacion;
      
      if (param.tabla_importancia) {
        var importance = classification.importance;
        
        //Define the importance table
        importance_table = importance_table.merge(importance);
        
        //Export the importance table
        if(year == year_max) {
          exportimportancetable(importance_table, param);
        }
      }

      if(param.yearsPreview.indexOf(year) > -1) {
        addClassification(img_classifier, year, param.palette, 'Classification', param.regionId);
        
        if (param.probabiltiMap.activate && param.probabiltiMap.addToMap) {
          print('probability map will be added');
          var img_probability = classification.mapProbability;
          
          if (cloudYears.contains(year).getInfo()) {
            var img_probability_bands = img_probability.bandNames().getInfo();
            img_probability_bands.pop();
            img_probability = img_probability.select(img_probability_bands);
          }
          
          var cobertura_id = param.probabiltiMap.coberturas_mapear[0];
          var BandNames = img_probability.bandNames().getInfo();
          var newBandNames = [];
          
          for (var p in BandNames) {
            newBandNames[p] = 'Id_' + BandNames[p];
          }
          
          img_probability = img_probability.rename(newBandNames);
          param.probabiltiMap.coberturas_mapear = coberturasId;
          addProbability(img_probability, year, newBandNames[0], 'Probability', param.regionId);
        }
        
        if(param.adicionar_muestras) {
          var styledPoints = ee.FeatureCollection(samples).map(
            function(point) {
              var classId = point.get('reference'),
                  color = ee.List(param.palette).get(classId);
              
              return point.set({ style: { color: color } });
            }
          );
          
          Map.addLayer(
            styledPoints.style({
              styleProperty: "style",
              width: 1.5,
            }), {}, 'SAMPLES ' + year
          );
        }
      }
      
      //Export the classifier
      if(param.years.indexOf(year) > -1) {
        if (year === 2025 && param.addFalseNewYear) {
          img_classifier = img_classifier.rename('classification_2026');
          year = 2026;
        }
        exportclassifier(img_classifier, param, year, region);
      }
      
      if(param.probabiltiMap.activate && param.probabiltiMap.exportar) {
        exportProbability(img_probability, config, year, vector);
      }
    });
  } catch(error) {
    print(error.message);
  }
});

//Add Region
if (param.addRegion) {
  addVectorToMap(region, 'FF0000');
}

//Add LUCL MAG-MAATE
if(param.lulcAct) {
  var lulcAct = ee.Image(param.dirPath.pathLulcAct).updateMask(regionMask);
  Map.addLayer(lulcAct, {
    min: 0,
    max: param.palette.length - 1,
    palette: param.palette
  }, 
  'Current LULC', false);
}

//Add Legend
var legendTitle = 'Land cover';
var legendColors = [ 
  '006400', 
  '00ff00', 
  '45c2a5',
  'b8af4f',
  'f1c232', 
  'ffffb2', 
  'FA8784',
  '665a3a',
  '0000ff'
];
var legendLabels = [
  '3. Forest formation',
  '4. Open forest',
  '11. Flooded natural non-forest formation',
  '12. Herbaceous',
  '13. Other natural non-forest formations',
  '21. Agricultural and forestry use',
  '25. Area without vegetation',
  '29. Rock outcrop',
  '33. Rivers, Lakes or Oceans'
];
var legendPosition = 'bottom-right';

mapLegend(Map, legendTitle, legendColors, legendLabels, legendPosition);

//Add additional classifier
var nDatos = ee.List(param.aditionalClasification.regionsId).length().getInfo();
if (nDatos > 0) {
  param.inputPath = param.basePath;
  var regionsId = param.aditionalClasification.regionsId.reverse();
  var inputVersions = param.aditionalClasification.versions.reverse();
  var k = 0;
  
  regionsId.forEach(function(regionID) {
    param.regionIdp = regionID;
    param.inputVersionp = inputVersions[k];
    var classification = getImage(param);
    
    param.yearsPreview.forEach(function(year) {
      addClassification(classification, year, param.palette, 'Classification', param.regionIdp);
    });
    
    k++;
  });
}

/**
 * FUNCTIONS
 */

function getStaticBands() {
  var paths = [
    [
      'JAXA/ALOS/AW3D30_V1_1', 
      'AVE',
      'altitude',
    ],
    [
      'projects/mapbiomas-raisg/MOSAICOS/shademask2_v3',
      null,
      'shademask2',
    ],
    [
      'projects/mapbiomas-raisg/MOSAICOS/slppost2_30_v3',
      null,
      'slppost'
    ],
    [
      'users/gena/GlobalHAND/30m/hand-1000',
      null,
      'hand30_1000'
    ],
    [
      'users/gena/GlobalHAND/90m-global/hand-1000',
      null,
      'hand30_5000'
    ],
    [
      'users/gena/GlobalHAND/30m/hand-5000',
      null,
      'hand90_1000'
    ],
  ];
  
  var hand30_100 = ee.ImageCollection('users/gena/global-hand/hand-100');
  // smoothen HAND a bit, scale varies a little in the tiles
  hand30_100 = hand30_100.mosaic().focal_mean(0.1).rename('hand30_100');
  
  // exclude SWBD water
  var swbd = ee.Image('MODIS/MOD44W/MOD44W_005_2000_02_24').select('water_mask');
  var swbdMask = swbd.unmask().not().focal_median(1);

  // potential water (valleys)
  var thresholds = [0, 1, 2, 5, 10];
  var HANDm = ee.List([]);
  thresholds.map(function(th) {
    var water = hand30_100.lte(th)
      .focal_max(1)
      .focal_mode(2, 'circle', 'pixels', 5).mask(swbdMask);
      
    HANDm = HANDm.add(water.mask(water).set('hand', 'water_HAND_<_' + th + 'm'));
  });
  
  // water_hand water (HAND < 5m)
  var HAND_water = ee.ImageCollection(HANDm);
  HAND_water = HAND_water.toBands().rename([
    'water_HAND_0m',
    'water_HAND_1m',
    'water_HAND_2m',
    'water_HAND_5m',
    'water_HAND_10m'
  ]);
  
  var names = paths.map(function(item) { return item[2] });
  
  var assets = paths.map(function(value) {
    var mainImage = ee.Image(value[0]);
    return value[1] ? mainImage.select(value[1]) : mainImage;
  });
  
  var main = ee.ImageCollection(assets)
    .toBands()
    .rename(names);
  
  var longLat = ee.Image.pixelLonLat();

  var slope = ee.Terrain
    .slope(main.select('altitude'))
    .int8()
    .rename('slope');
    
  main = main.addBands(slope).addBands(hand30_100).addBands(longLat).addBands(HAND_water);

  return main;
}

function unmaskMosaic(image) {
  var blue = image.select('blue_median').rename(['constant']);
  var bluemask = blue.updateMask(blue.eq(0));
  var bands = image.bandNames();
  
  return ee.ImageCollection(
    bands.map(function(band) {
      var imgBand = image.select([band]).rename(['constant']);
      return bluemask.blend(imgBand).rename([band]);
    })
  )
  .toBands()
  .rename(bands);
}

function addMosaic(collection, year) {
  Map.addLayer(
    collection,
    {
      bands: ['swir1_median', 'nir_median', 'red_median'],
      gain: [0.08, 0.06, 0.2]
    },
    'MOSAIC ' + year.toString(),
    false
  );
}

function importSamples(param) {
  var bands = param.bands;
  var country = param.country;
  var regionId = param.regionId;
  var year = param.singleYear;
  var version = param.samplesVersion;
  var samplesPath = param.samplesPath;
  var removeSamples = param.removeSamples;
  var contained = param.contained;
  var assetId = samplesPath + 'samples-' + country + '-' + regionId + '-' + year + '-' + 'p03-' + version;

  var samples = ee.FeatureCollection(
    ee.Algorithms.If(
      contained,
      ee.FeatureCollection(assetId),
      null
    )
  )
  .select(bands.add('reference'))
  .filter(ee.Filter.notNull(bands))
  .filter(ee.Filter.inList('reference', removeSamples).not());
    
  return samples;
}

function getSamplesFromRegions(param, samples) {
  var bands = param.bands;
  var country = param.country;
  var year = param.singleYear;
  var samplesPath = param.samplesPath;
  var coverClasses = param.samplesFromRegions.classes;
  
  param.samplesFromRegions.regionIds.forEach(function(regionId, i) {
    var mainPath = samplesPath + 'samples-' + country + '-' + regionId + '-' + year + '-' + 'p03-';
    var path = mainPath + param.samplesFromRegions.versions[i];
    var newSamples = ee.FeatureCollection(path)
      .filter(
        ee.Filter.and(
          ee.Filter.inList('reference', coverClasses),
          ee.Filter.notNull(bands)
        )
      );
    samples = samples.merge(newSamples);
  });
  
  return samples;
}

function resampleCover(param, image) {
  var polygons = param.additionalSamples.polygons;
  var classIds = param.additionalSamples.classes;
  var points = param.additionalSamples.points;
  var scale = param.scaleNumber;
  var newSamples = [];
  
  polygons.forEach(function(polygon, i) {
    var newSample = image.sample({
      numPixels: points[i],
      region: polygon.geometry(),
      scale: scale,
      projection: 'EPSG:4326',
      seed: 1,
      geometries: true,
      tileScale: param.tileScale
    })
    .map(function(item) { 
      return item.set('reference', classIds[i]);
    });
    newSamples.push(newSample);
  });
  
  return ee.FeatureCollection(newSamples).flatten();
}

function resampleCloudCover(param, image, polygon, nsamples) {
  var newSamples = [];
  
  var newSample = image.sample({
    numPixels: nsamples,
    region: polygon,
    scale: param.scaleNumber,
    projection: 'EPSG:4326',
    seed: 1,
    geometries: true,
    tileScale: param.tileScale
  })
  .map(function(item) { 
    return item.set('reference', 90);
  });
  
  newSamples.push(newSample);
  print('newSamples', newSamples);
  
  return ee.FeatureCollection(newSamples).flatten();
}

function getNumberSamples(param, samples) {
  var contained = param.contained;
  var nClasSample = ee.List(
    ee.Algorithms.If(
      contained,
      samples.reduceColumns(ee.Reducer.toList(), ['reference']).get('list'),
      null
    )
  );
  return nClasSample;
}

function applyClassifier(param, samples) {
  var varSplit = 1;
  var trees = param.trees;
  var bands = param.bands;
  var year = param.singleYear;
  var mosaic = param.yearMosaic;
  var regionMask = param.regionMask;
  var nClasSample = param.nClasSample;
  var estadisticos = param.estadisticos;
  
  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: trees,
    variablesPerSplit: varSplit
  });
  
  if(estadisticos) {
    //Random values
    print('year: ', year);
    samples = samples.randomColumn();
    var split = 0.7; // Roughly 70% training, 30% testing.
    var training = samples.filter(ee.Filter.lt('random', split));
    print('training', training.size());
    var validation = samples.filter(ee.Filter.gte('random', split));
    print('validation', validation.size());
    
    samples = training;
  }
  
  print(ee.Algorithms.If(ee.Algorithms.IsEqual(nClasSample, 1),
    "Number of classes is 1, classification cannot be performed",
    "Number of classes: " + nClasSample.getInfo()));
    
  classifier = ee.Classifier(
    ee.Algorithms.If(
      param.contained,
      ee.Algorithms.If(
        // solution to 'only one class' problem
        ee.Algorithms.IsEqual(nClasSample, 1),
        null,
        classifier.train(samples, 'reference', bands)
      ),
      null
    )
  );
  
  var img = mosaic.classify(classifier);
  
  img = img
    .select(['classification'], ['classification_' + year])
    .unmask(27)
    .updateMask(regionMask)
    .byte();
  
  if(param.probabiltiMap.activate) {
    print('Probability map activated');
    var probabilidad = classifier.setOutputMode('MULTIPROBABILITY');
    var prob_classification = mosaic.classify(probabilidad);
    print('coverages to map in year ' + year + ' are: ');
    print(param.probabiltiMap.coberturas_mapear);
    
    var coberturas = param.probabiltiMap.coberturas_mapear;
    var probabilities = prob_classification.arrayFlatten([coberturas]).updateMask(regionMask);
  }

  //Remapping
  var fromList, toList;
  if (param.pacific) {
    fromList = [3, 4, 5, 6, 11, 12, 29, 13, 14, 15, 18, 21, 35, 9, 22, 24, 30, 25, 33, 34, 27, 90];
    toList = [3, 4, 5, 3, 11, 12, 22, 13, 21, 21, 21, 21, 21, 3, 25, 25, 25, 25, 33, 34, 27, 27];
  } else {
    fromList = [3, 4, 5, 6, 11, 12, 29, 13, 14, 15, 18, 21, 35, 9, 22, 24, 30, 25, 33, 34, 27, 90];
    toList = [3, 4, 5, 3, 11, 12, 25, 13, 21, 21, 21, 21, 21, 3, 25, 25, 25, 25, 33, 34, 27, 27];
  }

  img = img.remap({
    from: fromList,
    to: toList,
    defaultValue: 0,
    bandName: 'classification_' + year
  }).rename('classification_' + year);
  
  var explainer = ee.Dictionary(
    ee.Algorithms.If(
      param.contained,
      ee.Algorithms.If(
        ee.Algorithms.IsEqual(nClasSample, 1),
        null,
        classifier.explain()
      ),
      null
    )
  );
  
  //confusion matrix and accuracy
  if(estadisticos) {
    // Classify the validation data
    var validated = validation.classify(classifier);
    print('accuracy: ', validated.errorMatrix('reference', 'classification').accuracy());
    print('Confusion matrix: ', validated.errorMatrix('reference', 'classification'));
  }
  
  var importances = [];
  if (param.tabla_importancia) {
    //Importance table
    importances = ee.Feature(
      ee.Algorithms.If(
        param.contained,
        ee.Algorithms.If(
          // solution to 'only one class' problem
          ee.Algorithms.IsEqual(nClasSample, 1),
          null,
          ee.Feature(null,
            ee.Dictionary(explainer.get('importance')))
              .set('_trees', explainer.get('numberOfTrees'))
              .set('_oobError', explainer.get('outOfBagErrorEstimate'))
              .set('_year', year)
        ),
        null
      )
    );
  } else {
    importances = ee.Feature(
      ee.Geometry.MultiPoint(),
      {
        "system:index": "0"
      }
    );
  }
  
  var variablesImportance = ee.FeatureCollection([importances]);
  
  var classification = {
    img_clasificacion: img,
    importance: variablesImportance
  };
  
  if (param.probabiltiMap.activate && param.probabiltiMap.exportar) {
    classification.mapProbability = probabilities;
    print('classification', classification);
  }
    
  return classification;
}

function exportimportancetable(tablefc, param) {
  Export.table.toDrive({
    collection: tablefc,
    description: param.tableName,
    folder: param.driveFolder,
    fileFormat: 'CSV',
  });
}

function addClassification(image, year, palette, name, regionID) {
  Map.addLayer(
    image.select('classification_' + year),
    {
      min: 0,
      max: palette.length - 1,
      palette: palette
    },
    name + '_' + year + '_' + regionID,
    false
  );
}

function addProbability(image, year, cobertura, name, regionID) {
  Map.addLayer(
    image,
    {
      "opacity": 1,
      "bands": [cobertura],
      "palette": ["606060", "29ff7f", "6638c0", "ff0000"]
    },
    name + '_' + year + '_' + regionID,
    false
  );
}

function exportclassifier(image, param, year, region) {
  var filename = param.country + '-' + param.regionId + '-' + year + '-' + param.outputVersion;
  var imageId = param.basePath + filename;
  print('Output ID: ', imageId);
  
  if(param.overwrite) ee.data.deleteAsset(imageId);
  
  Export.image.toAsset({
    image: image.reproject('EPSG:4326', null, 30)
      .set({
        year: year,
        step: 'classifier',
        version: param.outputVersion
      }),
    description: filename,
    assetId: imageId,
    scale: 30,
    pyramidingPolicy: {
      '.default': 'mode'
    },
    maxPixels: 1e13,
    region: region.geometry().bounds()
  });
}

function exportProbability(image, param, year, region) {
  var filename = param.country + '-' + 'probability-' + param.regionId + '-' + year + '-' + param.outputVersion;
  var imageId = param.probabilityPath + filename;
  print('Probability output ID: ', imageId);
  
  if(param.overwrite) ee.data.deleteAsset(imageId);
  
  Export.image.toAsset({
    image: image.reproject('EPSG:4326', null, 30)
      .set({
        year: year,
        step: 'Probability',
        version: param.outputVersion
      }),
    description: filename,
    assetId: imageId,
    scale: 30,
    pyramidingPolicy: {
      '.default': 'mode'
    },
    maxPixels: 1e13,
    region: region.geometry().bounds()
  });
}

function addVectorToMap(region, coloracion) {
  Map.addLayer(region.style({ fillColor: coloracion + '00', color: coloracion }), {}, 'region');
}

function mapLegend(map, title, colors, labels, position) {
  var legend = ui.Panel({
    style: {
      backgroundColor: "#fff",
      position: position,
      padding: '8px'
    }
  });
  
  // Create legend title
  var legendTitle = ui.Label({
    value: title,
    style: {
      backgroundColor: "#ffffff00",
      fontWeight: 'bold',
      fontSize: '14px',
      color: "#000000",
      margin: '0 0 6px 0',
      padding: '0'
    }
  });
  
  legend.add(legendTitle);
  
  var makeRow = function(color, name) {
    // Create the label that is actually the colored box
    var colorBox = ui.Label({
      style: {
        backgroundColor: color,
        margin: '5px 0 0 0',
        height: "12px",
        width: "12px"
      }
    });
  
    // Create the label filled with the description text
    var description = ui.Label({
      value: name,
      style: {
        backgroundColor: "#ffffff00",
        margin: '3px 0 0 6px',
        padding: "2px 2px 4px 2px",
        height: "16px",
        fontSize: "13px",
        color: "#757575"
      }
    });
  
    // return the panel
    return ui.Panel({
      widgets: [colorBox, description],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {
        backgroundColor: "#ffffff00"
      }
    });
  };
  
  // generate legend
  for (var i = 0; i < labels.length; i++) {
    legend.add(makeRow(colors[i], labels[i]));
  }
  
  map.add(legend);
}

function getImage(config) {
  var inputPath = config.inputPath;
  var country = config.country;
  var regionId = config.regionIdp;
  var inputVersion = config.inputVersionp;
  
  return ee.Image(inputPath + country + '-' + regionId + '-' + '2024-' + inputVersion);
}