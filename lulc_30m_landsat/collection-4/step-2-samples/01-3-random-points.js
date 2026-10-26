/**
 * @name
 *      01-3-random-points.js
 *
 * @description
 *      Generates the training samples of one classification region
 *      (MapBiomas Ecuador - Collection 4).
 *
 *      1. Draws random points over the stable-pixel map (01-0 / 01-1),
 *         stratified by class. The number of points per class is
 *         proportional to its area (01-2), with a minimum per class:
 *            points = max(round(classArea / totalArea * sampleSize), minSamples)
 *      2. For each export year, reads the value of every mosaic band and
 *         auxiliary variable (elevation, slope, HAND, shade, lon/lat...) at
 *         those points. The same points are used for every year.
 *      3. Exports one table of samples per year.
 *
 * @usage
 *      1. Set PARAMS: region, versions of the stable pixels and areas,
 *         years and satellites.
 *      2. Run and check the statistics printed in the console and the
 *         points on the map.
 *      3. Start the export tasks from the Tasks tab.
 *
 * @inputs
 *      - Stable pixels: <paths.stablesPixelsAct>/ME-<COUNTRY>-<regionId>-<inputVEstablePx>
 *      - Class areas:   <paths.pathTrainingAreasAct>/ac-<COUNTRY>-<regionId>-<inputVAreas>
 *      - Annual mosaics (Amazon and Pacific) and auxiliary layers (see getMosaic).
 *
 * @outputs
 *      One table asset per year:
 *      <paths.pathSamplesPointsAct>samples-<COUNTRY>-<regionId>[-<gridName>]-<year>-p03-<outputVersion>
 *      Each point has the class ('reference'), the year and one property per band.
 * 
 * @collection
 *      4
 *
 * @author
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @version
 *      2024-11-08  First version
 *      2025-03-28  Updated by Fabricio Garcés
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {
  country: 'ECUADOR',
  regionId: 40201,          // Classification region (field id_regionC)

  // Optional: restrict the samples to one RAISG map sheet inside the
  // region, e.g. 'SA-17-Z-D'. '' = whole region.
  gridName: '',

  sampleSize: 1000,         // Total number of points to distribute among classes
  minSamples: 150,          // Minimum number of points per class

  yearsPreview: [2024],     // Mosaics shown on the map
  yearsExport: [2024],      // Years for which samples are exported (1985-2024)

  // Bands to keep in the samples. [] = all mosaic bands and auxiliary variables.
  variables: [],

  // Satellite of the mosaics to sample ('lx', 'l5', 'l7', 'l8', 'l9').
  // Only mosaics of these satellites are used: include the satellites of
  // every year in `yearsExport` (from 2022 on, choose 'l8' or 'l9').
  satelites: ['l8'],

  inputVEstablePx: 998,     // Version of the stable-pixel map
  inputVAreas: 996,         // Version of the class areas table
  outputVersion: 990,       // Version of the sample tables

  // *** CAUTION *** true deletes existing sample tables with the same name
  // before exporting.
  overwrite: false
};


// =============================================================================
// 2. MODULES AND CONSTANTS
// =============================================================================

var paths = require('users/mapbiomasecuador/LULC:COLECCION4/05-modules/CollectionDirectories.js').paths;
var palette = require('users/mapbiomasecuador/LULC:MODULES/Palettes.js').get('EcuadorCol4');

var MOSAIC_VIS = { bands: ['swir1_median', 'nir_median', 'red_median'], gain: [0.08, 0.06, 0.2] };


// =============================================================================
// 3. FUNCTIONS
// =============================================================================

/**
 * Returns the region (or one map sheet inside it) as vector and raster mask.
 */
function getRegion(regionsAsset, gridsAsset, regionId, gridName) {
  var region = ee.FeatureCollection(regionsAsset)
    .filter(ee.Filter.eq('id_regionC', regionId));

  if (gridName) {
    var grid = ee.FeatureCollection(gridsAsset)
      .filter(ee.Filter.eq('name', gridName))
      .first();
    region = ee.FeatureCollection([ee.Feature(grid).set('pais', region.first().get('pais'))]);
  }

  var rasterMask = region
    .map(function (f) { return f.set('version', 1); })
    .reduceToImage(['version'], ee.Reducer.first());

  return { vector: region, rasterMask: rasterMask };
}

/**
 * Auxiliary variables added to every mosaic: elevation, slope, HAND
 * (height above nearest drainage) and potential-water masks, shade and
 * slope-position layers, longitude and latitude.
 *
 * Note: these must be the same variables used by the classification step.
 */
function getAuxiliaryBands() {
  var altitude = ee.Image('JAXA/ALOS/AW3D30_V1_1').select('AVE').rename('altitude');
  var slope = ee.Terrain.slope(altitude).int8().rename('slope');

  // HAND (Donchyts et al.), slightly smoothed.
  var hand30_100 = ee.ImageCollection('users/gena/global-hand/hand-100').mosaic().focal_mean(0.1);
  var hand30_1000 = ee.Image('users/gena/GlobalHAND/30m/hand-1000');
  var hand30_5000 = ee.Image('users/gena/GlobalHAND/30m/hand-5000');
  var hand90_1000 = ee.Image('users/gena/GlobalHAND/90m-global/hand-1000');

  // Potential water (valleys): HAND below 0, 1, 2, 5 and 10 m.
  // Note: `.mask()` without arguments returns the mask of the image, so
  // permanent water bodies are NOT excluded here. This reproduces the
  // variables used in Collection 4.
  var handWater = ee.ImageCollection([0, 1, 2, 5, 10].map(function (threshold) {
    var water = hand30_100.lte(threshold)
      .focal_max(1)
      .focal_mode(2, 'circle', 'pixels', 5)
      .mask();
    return water.mask(water);
  })).toBands()
    .rename(['water_HAND_0m', 'water_HAND_1m', 'water_HAND_2m', 'water_HAND_5m', 'water_HAND_10m']);

  var shademask2 = ee.Image('projects/mapbiomas-raisg/MOSAICOS/shademask2_v3').rename('shademask2');
  var slppost = ee.Image('projects/mapbiomas-raisg/MOSAICOS/slppost2_30_v3').rename('slppost');

  return ee.Image.cat(
    altitude, slope,
    hand30_100.rename('hand30_100'),
    hand30_1000.rename('hand30_1000'),
    hand30_5000.rename('hand30_5000'),
    hand90_1000.rename('hand90_1000'),
    handWater,
    slppost, shademask2,
    ee.Image.pixelLonLat()
  );
}

/**
 * Annual mosaics (Amazon + Pacific) of the region with the auxiliary
 * variables, filtered by satellite and, optionally, by band.
 */
function getMosaic(mosaicAssets, region, variables, satellites) {
  var auxiliary = getAuxiliaryBands();

  var mosaics = ee.ImageCollection(mosaicAssets[0])
    .merge(ee.ImageCollection(mosaicAssets[1]))
    .filterBounds(region)
    .filter(ee.Filter.inList('satellite', satellites))
    .map(function (image) { return ee.Image.cat(image, auxiliary); });

  return variables.length > 0 ? mosaics.select(variables) : mosaics;
}

/**
 * Number of points of a class, proportional to its area, with a minimum.
 */
function getPointsByArea(classArea, totalArea, sampleSize, minSamples) {
  return ee.Number(classArea)
    .divide(totalArea)
    .multiply(sampleSize)
    .round()
    .int16()
    .max(minSamples);
}

/**
 * Draws the stratified random points once and samples the mosaic of each
 * year at those points.
 *
 * @returns {Object} points: ee.FeatureCollection;
 *                   data: {'samples-<year>': ee.FeatureCollection}
 */
function getSamples(stablePixels, mosaics, classIds, pointsPerClass, years) {

  var points = stablePixels.stratifiedSample({
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

  var data = {};

  years.forEach(function (year) {
    var yearMosaic = mosaics.filter(ee.Filter.eq('year', year)).mosaic();

    data['samples-' + year] = stablePixels
      .addBands(yearMosaic)
      .sampleRegions({
        collection: points,
        properties: ['reference'],
        scale: 30,
        tileScale: 3,
        geometries: true
      });
  });

  return { points: points, data: data };
}

/**
 * Adds mosaics, stable pixels, region and points (colored by class).
 */
function addLayersToMap(points, stablePixels, mosaics, years, region) {
  years.forEach(function (year) {
    var yearMosaic = mosaics.filter(ee.Filter.eq('year', year)).mosaic().clip(region);
    Map.addLayer(yearMosaic, MOSAIC_VIS, 'Mosaic ' + year, false);
  });

  Map.addLayer(stablePixels, { min: 0, max: palette.length - 1, palette: palette }, 'Stable pixels');
  Map.addLayer(region.style({ fillColor: 'FCBA0300', color: 'FCBA03' }), {}, 'Region');

  var styledPoints = points.map(function (point) {
    return point.set({ style: { color: ee.List(palette).get(point.get('reference')) } });
  });

  Map.addLayer(styledPoints.style({ styleProperty: 'style', width: 1.5 }), {}, 'Training samples');
}

/**
 * Exports one sample table per year.
 */
function exportSamples(data, outputDir, baseName, version, overwrite, years) {
  years.forEach(function (year) {
    var collection = ee.FeatureCollection(data['samples-' + year])
      .map(function (feature) { return feature.set('year', year); });

    var fileName = 'samples-' + baseName + '-' + year + '-p03-' + version;

    if (overwrite) {
      try {
        ee.data.deleteAsset(outputDir + fileName);
        print('Deleted existing table', outputDir + fileName);
      } catch (error) {
        print('Nothing to delete: ' + outputDir + fileName);
      }
    }

    Export.table.toAsset(collection, fileName, outputDir + fileName);
  });
}


// =============================================================================
// 4. SAMPLES
// =============================================================================

var region = getRegion(paths.regionVectorAct, paths.gridsAct, PARAMS.regionId, PARAMS.gridName);
Map.centerObject(region.vector, 10);

var mosaics = getMosaic(
  [paths.mosaicRaisgAct, paths.mosaicPacificoAct],
  region.vector,
  PARAMS.variables,
  PARAMS.satelites
);

var countryRegion = PARAMS.country + '-' + PARAMS.regionId;

var stablePixels = ee.Image(paths.stablesPixelsAct + '/ME-' + countryRegion + '-' + PARAMS.inputVEstablePx)
  .updateMask(region.rasterMask)
  .rename('reference');

// Class areas: properties ID<class> of the areas table (other fields such
// as FID or OBJECTID are ignored).
var classAreas = ee.FeatureCollection(paths.pathTrainingAreasAct + '/ac-' + countryRegion + '-' + PARAMS.inputVAreas);
var areasDictionary = classAreas.first().toDictionary();

var classNames = areasDictionary.keys()
  .filter(ee.Filter.stringContains('item', 'ID'))
  .filter(ee.Filter.stringContains('item', 'FID').not())
  .filter(ee.Filter.stringContains('item', 'OBJECTID').not());

var classIds = classNames.map(function (name) {
  return ee.Number.parse(ee.String(name).replace('ID', ''));
});

var areas = classNames.map(function (name) { return areasDictionary.get(name); });
var totalArea = areas.reduce(ee.Reducer.sum());

var pointsPerClass = areas.map(function (area) {
  return getPointsByArea(area, totalArea, PARAMS.sampleSize, PARAMS.minSamples);
});

var training = getSamples(stablePixels, mosaics, classIds, pointsPerClass, PARAMS.yearsExport);


// =============================================================================
// 5. STATISTICS, MAP AND EXPORT
// =============================================================================

// One row per class present in the region (classes with area 0 have no
// stable pixels, so they get no points).
var classStats = ee.FeatureCollection(
  ee.List.sequence(0, classIds.size().subtract(1)).map(function (i) {
    return ee.Feature(null, {
      class: classIds.get(i),
      area_km2: areas.get(i),
      samples: pointsPerClass.get(i)
    });
  })
).filter(ee.Filter.gt('area_km2', 0));

print('Areas table', classAreas.first());
print('Total area (km²)', totalArea);
print('Total samples', classStats.aggregate_sum('samples'));
print('Samples by class', classStats);

addLayersToMap(training.points, stablePixels, mosaics, PARAMS.yearsPreview, region.vector);

var baseName = PARAMS.gridName ? countryRegion + '-' + PARAMS.gridName : countryRegion;

exportSamples(
  training.data,
  paths.pathSamplesPointsAct,   // must end with '/'
  baseName,
  PARAMS.outputVersion,
  PARAMS.overwrite,
  PARAMS.yearsExport
);
