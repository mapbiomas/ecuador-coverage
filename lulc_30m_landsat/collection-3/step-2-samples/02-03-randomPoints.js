/**
 * @name
 *      03-random-points-ecuador.js
 * 
 * @description
 *      TRAINING SAMPLE GENERATION.
 *      Script that generates training samples based on the stable pixel map generated in step 01-1 
 *      and the training areas from step 01-2.
 * 
 * @authors
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 * 
 * @date
 *      08/11/2024 
 *      28/03/2025   Modified by Fabricio Garcés
 */

 
/** 
 * ----------------------------------------------------------------------------------------------
 * USER PARAMETERS:
 * Adjust the parameters below to generate your training samples
 * ----------------------------------------------------------------------------------------------
 */
var param = {
  country: 'ECUADOR',
  regionId: 40201,          // Classification region ID
  sampleSize: 1000,         // Total number of samples
  minSamples: 150,          // Minimum samples per class
  yearsPreview: [           // Years for preview/visualization
    //1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
    //1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 
    //2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
    //2018, 2019, 2020, 2021, 2022, 2023,
    2024
  ],
  yearsExport: [            // Years for export
    //1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
    //1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 
    //2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
    //2018, 2019, 2020, 2021, 2022, 2023,
    2024
  ],
  variables: [              // Variables/bands to include (empty = all)

  ],
  satellites: ['l8'],       // Satellites: 'l8' for Landsat 8, 'l9' for Landsat 9 (for 2024)
  inputVEstablePx: 998,     // Version of stable pixels map
  inputVAreas: 996,         // Version of training areas
  outputVersion: 990,       // Version for output training tables/points
  overwrite: false,         // *CAUTION (Deletes existing ASSETS)
};


/**
 * ----------------------------------------------------------------------------------------------
 * APPLICATION INITIALIZATION
 * Self-invoked expression that executes step 3 of the methodology
 * ----------------------------------------------------------------------------------------------
 */

(function init(param) {
  // Import Modules
  var palette = require('users/kahuertas/mapbiomas-colombia:mapbiomas-colombia/collection-3/modules/Palettes.js').get('ColombiaCol3');
  palette[4] = '#7dc975';
  
  // Module for asset directory paths
  var paths = require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths;
  
  // Paths to assets
  var grids = paths.gridsAct;
  var regions = paths.regionVectorAct;
  var stablePixelsPath = paths.stablesPixelsAct;
  var classAreasPath = paths.pathTrainingAreasAct;
  var outputs = paths.pathSamplesPointsAct;

  var rgb = ['swir1_median', 'nir_median', 'red_median'];
  var years = param.yearsPreview;
  var grid = param.gridName;
  var regionId = param.regionId;
  var overwrite = param.overwrite;
  var yearsExport = param.yearsExport;
  
  // Get versions of stable pixels and training areas
  var vMuestras = param.inputVEstablePx;
  var vAreas = param.inputVAreas;
  
  // Create mask based on region vector and grid
  var region = getRegion(regions, grids, regionId, grid);
  var vector = region.vector;
  
  Map.centerObject(vector, 10);
  
  // Import assets based on the region
  var assetsMosaics = [paths.mosaicRaisgAct, paths.mosaicPacificoAct];
  var satelites = param.satellites;
  var mosaic = getMosaic(assetsMosaics, vector, param.variables, grid, vector, satelites, '');
  
  // Get country name based on region
  var country = region.vector.first().get('pais').getInfo().toUpperCase();
  var countryRegion = country + '-' + regionId;
  
  // Get stable pixels map generated in step 0, clipped to region
  var stablePixels = ee.Image(stablePixelsPath + '/ME-' + countryRegion + '-' + vMuestras)
    .updateMask(region.rasterMask)
    .rename('reference');
  
  // Get class areas table
  var classAreas = ee.FeatureCollection(classAreasPath + '/ac-' + countryRegion + '-' + vAreas);
  var classAreasDictionary = classAreas.first().toDictionary();
  
  // Filter to get only ID fields
  var classNames = classAreasDictionary.keys()
    .filter(ee.Filter.stringContains('item', 'ID'))
    .filter(ee.Filter.stringContains('item', 'ORIG_FID').not())
    .filter(ee.Filter.stringContains('item', 'FID').not())
    .filter(ee.Filter.stringContains('item', 'OBJECTID').not());
  
  // Generate training samples based on area of each land cover class
  var classIds = classNames.map(
    function(name) {
      var classId = ee.String(name).split('D').get(1);
      return ee.Number.parse(classId);
    }
  );
  
  // Calculate area of each class and total area
  var areas = classNames.map(function(name) {
    return classAreasDictionary.get(name);
  });
  var totalArea = areas.reduce(ee.Reducer.sum());
  
  // Calculate weighted number of samples and generate training points
  var pointsPerClass = areas.map(
    function(area) {
      return getPointsByArea(
        area, totalArea, param.sampleSize, param.minSamples);
    });
  
  var training = getSamples(stablePixels, mosaic, classIds, pointsPerClass, yearsExport);
  var points = training.points;

  // Add layers to map
  addLayersToMap(points, stablePixels, mosaic, years, vector, palette);
  
  // Export assets and statistics to GEE and Drive
  if(grid && grid !== '') regionId = regionId + '-' + grid;
  var data = training.data;
  exportSamples(data, outputs, country, regionId, param.outputVersion, overwrite, yearsExport);
  
  // Display information in console
  var zipped = classNames.zip(areas).zip(pointsPerClass);

  zipped = zipped.map(function(item){
    item = ee.List(item);
    var item0 = ee.List(item.get(0));
    var id = ee.String(item0.get(0)).replace('ID', 'Class '); 
    var area = ee.String(item0.get(1));
    var points = ee.String(item.get(1));
    
    return ee.String(id)
      .cat(', Area: ').cat(area)
      .cat(', Samples: ').cat(points);
  });
  
  zipped = zipped.filter(ee.Filter.stringContains('item', ': 0.0,').not());
  
  var samples = zipped.map(function(item){
    var points = ee.String(item).split('Samples: ');
    points = ee.List(points).get(1);
    return ee.Number.parse(points);
  });
  
  var global = ee.Dictionary.fromLists(
    ['Total area', 'Total samples: '],
    [totalArea, samples.reduce(ee.Reducer.sum())]
  );
  
  print('Areas', classAreas.first());
  print('General statistics', global);
  print('Statistics by class', zipped);
      
})(param);




/**
 * ----------------------------------------------------------------------------------------------
 * FUNCTIONALITIES
 * Below are the functionalities used in the application.
 * These features are injected into the init() function which executes them and generates results.
 * ----------------------------------------------------------------------------------------------
 */

/**
 * Global constants
 */

/**
 * Function to generate region of interest (ROI) based on
 * classification region or a millionth grid contained within it
 */
function getRegion(regionPath, gridPath, regionId, gridName){
  
  var region = ee.FeatureCollection(regionPath)
        .filterMetadata("id_regionC", "equals", regionId);
  
  if(gridName && gridName !== '') {
    var grid = ee.FeatureCollection(gridPath)
      .filterMetadata("name", "equals", gridName)
      .first();
      
    grid = grid.set('pais', region.first().get('pais'));
    
    region = ee.FeatureCollection(ee.Feature(grid));
  }
  
  // Generate raster mask
  var setVersion = function(item) { return item.set('version', 1) };
  
  var regionMask = region
    .map(setVersion)
    .reduceToImage(['version'], ee.Reducer.first());
    
  return {
    vector: region,
    rasterMask: regionMask
  };
}



/**
 * Function to filter mosaics
 * Allows filtering mosaics by region code and 250,000 grid,
 * Also manages the selection of indices that will be used to generate
 * training points.
 */
function getMosaic(paths, region, variables, gridName, regionVector, satellites, evaluate) {
  
  // Import elevation data
  var altitude = ee.Image('JAXA/ALOS/AW3D30_V1_1')
    .select('AVE')
    .rename('altitude');
      
  var slope = ee.Terrain.slope(altitude).int8()
    .rename('slope');
    
  // HAND (Height Above Nearest Drainage) data
  var hand30_100 = ee.ImageCollection('users/gena/global-hand/hand-100');
  var srtm = ee.Image("USGS/SRTMGL1_003");
  var hand30_1000 =  ee.Image("users/gena/GlobalHAND/30m/hand-1000");
  var hand90_1000 = ee.Image("users/gena/GlobalHAND/90m-global/hand-1000");
  var hand30_5000 = ee.Image("users/gena/GlobalHAND/30m/hand-5000");
  var fa = ee.Image("users/gena/GlobalHAND/90m-global/fa");
  var jrc = ee.Image("JRC/GSW1_0/GlobalSurfaceWater");
  var HS_fa = ee.Image("WWF/HydroSHEDS/15ACC");
  var HS_fa30 = ee.Image("WWF/HydroSHEDS/30ACC");
  var demUk = ee.Image("users/gena/HAND/test_uk_DSM");
    
  // Smoothen HAND a bit, scale varies a little in the tiles
  hand30_100 = hand30_100.mosaic().focal_mean(0.1);
    
  // Potential water (valleys)
  var thresholds = [0, 1, 2, 5, 10];
  var HANDm = ee.List([]);
  thresholds.map(function(th) {
    var water = hand30_100.lte(th)
      .focal_max(1)
      .focal_mode(2, 'circle', 'pixels', 5).mask(swbdMask);
      
    HANDm = HANDm.add(water.mask(water).set('hand', 'water_HAND_<_' + th + 'm'));
  });
  
  // Exclude SWBD water
  var swbd = ee.Image('MODIS/MOD44W/MOD44W_005_2000_02_24').select('water_mask');
  var water = swbd.eq(1).selfMask();
  Map.addLayer(water, {palette: ['00FFFF']}, 'swbd mask', false);
  var swbdMask = swbd.unmask().not().focal_median(1);
  
  // water_hand: water (HAND < 5m)
  var HAND_water = ee.ImageCollection(HANDm);
  
  // Export HAND bands
  hand30_100  = hand30_100.rename('hand30_100');
  hand30_1000 = hand30_1000.rename('hand30_1000');
  hand30_5000 = hand30_5000.rename('hand30_5000');
  hand90_1000 = hand90_1000.rename('hand90_1000');
  HAND_water  = HAND_water.toBands()
    .rename(['water_HAND_0m', 'water_HAND_1m', 'water_HAND_2m', 'water_HAND_5m', 'water_HAND_10m']);
          
  var Hand_bands = hand30_100
    .addBands(hand30_1000)
    .addBands(hand30_5000)
    .addBands(hand90_1000)
    .addBands(HAND_water);
                                
  // Shademask2
  var shademask2 = ee.Image("projects/mapbiomas-raisg/MOSAICOS/shademask2_v3")
    .rename('shademask2');

  // Slppost
  var slppost = ee.Image("projects/mapbiomas-raisg/MOSAICOS/slppost2_30_v3")
    .rename('slppost');
  
  // Latitude and longitude
  var longLat = ee.Image.pixelLonLat();
  
  var workspace_c3_v2 = ee.ImageCollection(paths[0]).merge(ee.ImageCollection(paths[1]))
                        .filterBounds(region);
  // Add bands: DEM, Slope, Hand Bands, slp, shade mask, longLat
  var joinedMosaics = workspace_c3_v2
    .map(function(image){
      return ee.Image
        .cat(image, altitude, slope, Hand_bands, slppost, shademask2, longLat);
    });

  // Filter for Landsat 8 or Landsat 9
  joinedMosaics = joinedMosaics.filter(ee.Filter.inList('satellite', satellites));
  // Select variables
  if(variables.length > 0) return joinedMosaics.select(variables);
  else return joinedMosaics;
}

/**
 * Function to evaluate Amazon or Pacific region
 */
function getAmazonOrPacific(amazonlist, region){
  var evaluate = false;
  amazonlist.forEach(function(region_amazon){
    if (region_amazon == region){
      evaluate = true;
    }
  });
  return evaluate;
} 

/**
 * Function to calculate number of training samples based on the area
 * occupied by each class
 */
function getPointsByArea(singleArea, totalArea, sampleSize, minSamples) {
  return ee.Number(singleArea)
    .divide(totalArea)
    .multiply(sampleSize)
    .round()
    .int16()
    .max(minSamples);
}



/**
 * Function to implement point collection for all years in the param.year list
 * defined in user parameters.
 */
function getSamples(stablePixels, mosaic, classIds, pointsPerClass, yearsexport) {
  
  var years = ee.List(yearsexport);
  
  var keys = years.map(function(year) {
    var stringYear = ee.String(year);
    return ee.String('samples-').cat(stringYear);
  });
  
  var points = stablePixels
    .stratifiedSample({
        numPoints: 0,
        classBand: 'reference',
        region: stablePixels.geometry(),
        scale: 30,
        seed: 1,
        geometries: true,
        dropNulls: true,
        classValues: classIds, 
        classPoints: pointsPerClass
    });

  var yearMosaic;
  
  var trainingSamples = years.map(function(year) {
    yearMosaic = mosaic
      .filterMetadata('year', 'equals', year)
      .mosaic();
    
    var training = stablePixels
      .addBands(yearMosaic)
      .sampleRegions({
        collection: points,
        properties: ['reference'],
        scale: 30,
        tileScale: 3,
        geometries: true
      });
    return training;
  });
  
  return {
    data: ee.Dictionary.fromLists(keys, trainingSamples),
    points: points
  };
}


/**
 * Function to add visualization layers to the map
 */
function addLayersToMap(training, stablePixels, mosaic, years, region, color_palette) {
  
  var PALETTE = color_palette;

  years.forEach(function(year) {
    var filtered = mosaic.filterMetadata('year', 'equals', year)
      .mosaic()
      .clip(region);
     
    Map.addLayer(
      filtered,
      {
        bands: ['swir1_median', 'nir_median', 'red_median'],
        gain: [0.08, 0.06, 0.2]
      },
      'MOSAIC ' + year.toString(), false
    );
  });

  var styledPoints = ee.FeatureCollection(training).map(
    function(point) {
      var classId = point.get('reference'),
          color = ee.List(PALETTE).get(classId);
      
      return point.set({ style: { color: color } });
    }
  );
  
  Map.addLayer(stablePixels, {
    min: 0,
    max: PALETTE.length - 1,
    palette: PALETTE
  }, 'STABLE PIXELS');
  
  Map.addLayer(region.style({ fillColor: 'FCBA0300', color: 'FCBA03'}), {}, 'Region');
  
  Map.addLayer(
    styledPoints.style({
      styleProperty: "style",
      width: 1.5,
    }), {}, 'TRAINING SAMPLES'
  );
}


/**
 * Function to export training samples as GEE assets
 */
function exportSamples(samples, outputDir, country, regionId, version, overwrite, yearsexport) {
  
  var years = yearsexport;
  
  years.forEach(function(year) {
  
    var sampleYear = samples.get('samples-' + year),
        yearInt = parseInt(year, 10);
    var collection = ee.FeatureCollection(sampleYear)
      .map(function(feature) {
        feature = feature.set('year', yearInt);
        return feature;
      });
    
    // Export samples
    var filename = 'samples-' + country + '-' + regionId + '-' + 
      year + '-'+ 'p03' + '-' + version;          
    
    if(overwrite){
      ee.data.deleteAsset(outputDir + filename);
    }
    
    Export.table.toAsset(
      collection,
      filename,
      outputDir + filename
    );
  });
}