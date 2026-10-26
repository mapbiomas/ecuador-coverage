/**
 * @name
 *      01-0-mapbiomas-ecu-blacklist-path-row.js
 *
 * @description
 *      Interactive tool to build the image blacklist of a single Landsat
 *      WRS-2 tile (path/row) before generating the annual mosaics of
 *      MapBiomas Ecuador - Collection 4.
 *
 *      The script builds two cloud-masked median mosaics of the same tile,
 *      each one with its own parameter set (PARAMS_1 and PARAMS_2), and shows
 *      them side by side in a split-panel (swipe) view. For each parameter
 *      set two layers are added:
 *        - the mosaic with the blacklisted scenes removed (visible);
 *        - the mosaic using every available scene (hidden).
 *      On the left map every individual Landsat scene is also added as a
 *      hidden layer and its ID is printed to the console, so the analyst can
 *      spot the scenes that degrade the mosaic (residual clouds, haze,
 *      shadows, sensor artifacts) and add their IDs to `blackList`.
 *
 * @usage
 *      1. Open this script in the Google Earth Engine Code Editor.
 *      2. Set the tile (`grid_name`), dates and sensor in PARAMS_1 and PARAMS_2.
 *      3. Run it and inspect the individual scenes listed in the left map.
 *      4. Copy the IDs of the scenes to discard into `blackList` and run it
 *         again to compare the resulting mosaics.
 *
 * @inputs
 *      - Landsat Collection 2, Tier 1, Level-2 surface reflectance (GEE catalog).
 *      - Landsat WRS-2 grid for Ecuador (MapBiomas Ecuador asset).
 *      - First-level administrative boundaries of Ecuador (MapBiomas Ecuador asset).
 *      - BandNames.js helper module (MapBiomas Ecuador repository).
 *
 * @outputs
 *      Nothing is exported. Results are map layers and console messages; the
 *      final blacklist is copied manually into the mosaic-generation scripts.
 *
 * @see
 *      Landsat scene inventory app: https://ejvalero.users.earthengine.app/view/landsat-inventory
 *      TDOM cloud-shadow method: https://www.mdpi.com/2072-4292/10/8/1184/htm
 *
 * @author
 *      Adrián Rodríguez - EcoCiencia (adrianrodriguez@ecociencia.org)
 *
 * @version
 *      1.0.0 (2025-01-10)
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================
// Both parameter sets are processed the same way. By default they differ only
// in `cloudThresh`, so the swipe view shows the effect of a stricter (P1) or
// more permissive (P2) cloud mask.
//
// grid_name   : WRS-2 tile as 'PPPRRR' (3-digit path + 3-digit row), as a string.
// t0, t1      : search period, 'YYYY-MM-DD'. t0 is inclusive, t1 is exclusive.
// satellite   : 'l4', 'l5', 'l7', 'l8', 'l9', or 'lx' (Landsat 5 + Landsat 7).
// cloud_cover : maximum scene cloud cover (%) according to the scene metadata.
// shadowSum   : darkness threshold for cloud-shadow detection, in reflectance
//               x 10000 (range 0-10000, default 2500). Pixels whose sum of
//               infrared bands is below this value are shadow candidates.
// cloudThresh : cloud-score threshold (0-100, default 10). Lower values mask
//               more pixels as cloud.
// temp_min,   : surface temperature range (Kelvin, ST_B10 band) used by the
// temp_max      cloud score. Pixels at or below temp_min get the highest
//               cloud score; pixels at or above temp_max get none.
// blackList   : list of scene IDs (system:index) to exclude, e.g.
//               ['LC08_011061_20250214'].

var PARAMS_1 = {
  grid_name: '011061',
  t0: '2025-01-01',
  t1: '2026-01-01',
  satellite: 'l8',
  cloud_cover: 90,
  shadowSum: 2500,
  cloudThresh: 10,
  temp_max: 330,
  temp_min: 290,
  blackList: [
  ]
};

var PARAMS_2 = {
  grid_name: '011061',
  t0: '2025-01-01',
  t1: '2026-01-01',
  satellite: 'l8',
  cloud_cover: 90,
  shadowSum: 2500,
  cloudThresh: 50,
  temp_max: 330,
  temp_min: 290,
  blackList: [
  ]
};


// =============================================================================
// 2. ASSETS, MODULES AND CONSTANTS
// =============================================================================

var LANDSAT_GRID_ASSET =
  'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/ec-landsat-grid';

var BOUNDARIES_ASSET =
  'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-3/nivel_politico_1_ECU_col3';

// Maps the original Landsat band names to common names
// (blue, green, red, nir, swir1, swir2, temp, pixel_qa, ...).
var bns = require('users/mapbiomasecuador/LULC:COLECCION4/01-mosaicos/modules/BandNames.js');

// Landsat Collection 2 Level-2 collections for each sensor option.
var COLLECTION_IDS = {
  'l4': ['LANDSAT/LT04/C02/T1_L2'],
  'l5': ['LANDSAT/LT05/C02/T1_L2'],
  'l7': ['LANDSAT/LE07/C02/T1_L2'],
  'l8': ['LANDSAT/LC08/C02/T1_L2'],
  'l9': ['LANDSAT/LC09/C02/T1_L2'],
  'lx': ['LANDSAT/LT05/C02/T1_L2', 'LANDSAT/LE07/C02/T1_L2']
};

// Key used in BandNames.js for each collection.
var BAND_IDS = {
  'LANDSAT/LT04/C02/T1_L2': 'l4_sr2',
  'LANDSAT/LT05/C02/T1_L2': 'l5_sr2',
  'LANDSAT/LE07/C02/T1_L2': 'l7_sr2',
  'LANDSAT/LC08/C02/T1_L2': 'l8_sr2',
  'LANDSAT/LC09/C02/T1_L2': 'l9_sr2'
};

// False-color composite (SWIR1, NIR, red) used for every mosaic and scene.
var MOSAIC_VIS = {
  bands: 'swir1,nir,red',
  gain: '0.09,0.06,0.30',
  gamma: 0.6
};


// =============================================================================
// 3. HELPER FUNCTIONS
// =============================================================================

/**
 * Linearly rescales an image so that `min` maps to 0 and `max` maps to 1.
 * Values are not clamped. If min > max the scale is inverted.
 *
 * @param {Object} obj
 * @param {ee.Image} obj.image
 * @param {number} obj.min
 * @param {number} obj.max
 * @returns {ee.Image}
 */
var rescale = function (obj) {
  return obj.image
    .subtract(obj.min)
    .divide(ee.Number(obj.max).subtract(obj.min));
};


/**
 * Applies the Landsat Collection 2 Level-2 scale factors.
 *  - Optical bands are converted to surface reflectance x 10000.
 *  - Thermal band ('temp') is converted to surface temperature in Kelvin.
 *
 * @param {ee.Image} image  Image with common band names.
 * @returns {ee.Image}
 */
var scaleFactors = function (image) {
  var optical = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'];

  var opticalBands = image.select(optical)
    .multiply(0.0000275).add(-0.2).multiply(10000);

  var thermalBand = image.select('temp*')
    .multiply(0.00341802).add(149.0);

  return image
    .addBands(opticalBands, null, true)
    .addBands(thermalBand, null, true);
};


/**
 * Loads a Landsat collection filtered by date, cloud cover and WRS-2 tile,
 * and adds harmonized metadata properties (cloud_cover, date,
 * satellite_name, sun angles, reflectance type) to every image.
 *
 * The property harmonization also supports Sentinel-2 metadata names, so
 * the same function can be reused with other collections.
 *
 * @param {Object} obj
 * @param {string} obj.collectionid  GEE collection ID.
 * @param {string} obj.gridName      WRS-2 tile as 'PPPRRR'.
 * @param {string} obj.dateStart     'YYYY-MM-DD' (inclusive).
 * @param {string} obj.dateEnd       'YYYY-MM-DD' (exclusive).
 * @param {number} obj.cloudCover    Maximum scene cloud cover (%).
 * @returns {ee.ImageCollection}
 */
var getCollection = function (obj) {

  var setProperties = function (image) {

    var cloudCover = ee.Algorithms.If(image.get('SPACECRAFT_NAME'),
      image.get('CLOUDY_PIXEL_PERCENTAGE'),
      image.get('CLOUD_COVER')
    );

    var date = ee.Algorithms.If(image.get('DATE_ACQUIRED'),
      image.get('DATE_ACQUIRED'),
      ee.Algorithms.If(image.get('SENSING_TIME'),
        image.get('SENSING_TIME'),
        image.get('GENERATION_TIME')
      )
    );

    var satellite = ee.Algorithms.If(image.get('SPACECRAFT_ID'),
      image.get('SPACECRAFT_ID'),
      ee.Algorithms.If(image.get('SATELLITE'),
        image.get('SATELLITE'),
        image.get('SPACECRAFT_NAME')
      )
    );

    var azimuth = ee.Algorithms.If(image.get('SUN_AZIMUTH'),
      image.get('SUN_AZIMUTH'),
      ee.Algorithms.If(image.get('SOLAR_AZIMUTH_ANGLE'),
        image.get('SOLAR_AZIMUTH_ANGLE'),
        image.get('MEAN_SOLAR_AZIMUTH_ANGLE')
      )
    );

    // Sun elevation = 90 - sun zenith angle.
    var elevation = ee.Algorithms.If(image.get('SUN_ELEVATION'),
      image.get('SUN_ELEVATION'),
      ee.Algorithms.If(image.get('SOLAR_ZENITH_ANGLE'),
        ee.Number(90).subtract(image.get('SOLAR_ZENITH_ANGLE')),
        ee.Number(90).subtract(image.get('MEAN_SOLAR_ZENITH_ANGLE'))
      )
    );

    // 'SR' if the collection ID contains "SR", otherwise 'TOA'.
    var reflectance = ee.Algorithms.If(
      ee.String(ee.Dictionary(ee.Algorithms.Describe(image)).get('id')).match('SR').length(),
      'SR',
      'TOA'
    );

    return image
      .set('image_id', image.id())
      .set('cloud_cover', cloudCover)
      .set('satellite_name', satellite)
      .set('sun_azimuth_angle', azimuth)
      .set('sun_elevation_angle', elevation)
      .set('reflectance', reflectance)
      .set('date', ee.Date(date).format('Y-MM-dd'));
  };

  var filters = ee.Filter.and(
    ee.Filter.date(obj.dateStart, obj.dateEnd),
    ee.Filter.lte('cloud_cover', obj.cloudCover),
    ee.Filter.eq('WRS_PATH', parseInt(obj.gridName.slice(0, 3), 10)),
    ee.Filter.eq('WRS_ROW', parseInt(obj.gridName.slice(3, 6), 10))
  );

  return ee.ImageCollection(obj.collectionid)
    .map(setProperties)
    .filter(filters);
};


// =============================================================================
// 4. CLOUD AND CLOUD-SHADOW MASKS
// =============================================================================

/**
 * Cloud score: combines several spectral indicators of cloudiness (bright in
 * visible and infrared, cold, not snow) and takes the minimum of them.
 * Adds a binary band 'cloudScoreMask' (1 = cloud).
 *
 * Reflectance thresholds are in reflectance x 10000.
 *
 * @param {ee.Image} image        Scaled image (see scaleFactors).
 * @param {number} cloudThresh    Score (0-100) above which a pixel is cloud.
 * @param {number} tempMax        Temperature (K) with cloud score 0.
 * @param {number} tempMin        Temperature (K) with cloud score 1.
 * @returns {ee.Image}
 */
var cloudScore = function (image, cloudThresh, tempMax, tempMin) {

  var score = ee.Image(1.0);

  // Clouds are reasonably bright in the blue band.
  score = score.min(rescale({
    image: image.select(['blue']),
    min: 1000,
    max: 3000
  }));

  // Clouds are reasonably bright in all visible bands.
  score = score.min(rescale({
    image: image.expression("b('red') + b('green') + b('blue')"),
    min: 2000,
    max: 8000
  }));

  // Clouds are reasonably bright in all infrared bands.
  score = score.min(rescale({
    image: image.expression("b('nir') + b('swir1') + b('swir2')"),
    min: 3000,
    max: 10000
  }));

  // Clouds are reasonably cold. The range is inverted on purpose:
  // colder pixels get a higher score. Only applied where 'temp' is valid.
  var temperature = image.select(['temp']);

  score = score.where(temperature.mask(),
    score.min(rescale({
      image: temperature,
      min: tempMax,
      max: tempMin
    }))
  );

  // Clouds are not snow: NDSI above 0.8 gets score 0 (inverted range).
  var ndsi = image.normalizedDifference(['green', 'swir1']);

  score = score.min(rescale({
    image: ndsi,
    min: 0.8,
    max: 0.6
  }))
    .multiply(100)
    .byte();

  score = score.gte(cloudThresh).rename('cloudScoreMask');

  return image.addBands(score);
};


/**
 * TDOM (Temporal Dark Outlier Mask), Housman et al. 2018.
 * Computes the per-pixel mean and standard deviation of NIR and SWIR1 over
 * the whole collection. A pixel is a shadow candidate when the z-score of
 * both bands is below `zScoreThresh` and the sum NIR + SWIR1 is below
 * `shadowSumThresh` (the paper uses 0.35 in reflectance; here the value is
 * in reflectance x 10000).
 *
 * Adds the band 'tdomMask' (0 = dark outlier, 1 = valid), eroded by
 * `dilatePixels` so that the 0 areas grow.
 *
 * @param {Object} obj
 * @param {ee.ImageCollection} obj.collection
 * @param {number} obj.zScoreThresh
 * @param {number} obj.shadowSumThresh
 * @param {number} obj.dilatePixels
 * @returns {ee.ImageCollection}
 */
var tdom = function (obj) {

  var shadowSumBands = ['nir', 'swir1'];

  // Per-pixel statistics of the time series.
  var irStdDev = obj.collection
    .select(shadowSumBands)
    .reduce(ee.Reducer.stdDev());

  var irMean = obj.collection
    .select(shadowSumBands)
    .mean();

  return obj.collection.map(function (image) {
    var zScore = image.select(shadowSumBands)
      .subtract(irMean)
      .divide(irStdDev);

    var irSum = image.select(shadowSumBands)
      .reduce(ee.Reducer.sum());

    var tdomMask = zScore.lt(obj.zScoreThresh)
      .reduce(ee.Reducer.sum())
      .eq(2)
      .and(irSum.lt(obj.shadowSumThresh))
      .not();

    tdomMask = tdomMask.focal_min(obj.dilatePixels);

    return image.addBands(tdomMask.rename('tdomMask'));
  });
};


/**
 * Projects the cloud mask along the sun direction for a range of cloud
 * heights to find where shadows are expected. A pixel is flagged as shadow
 * ('shadowTdomMask' = 1) when it falls in a projected cloud area, is dark,
 * is a TDOM dark outlier and is not itself a cloud.
 *
 * @param {Object} obj
 * @param {ee.Image} obj.image            Image with 'tdomMask' and the cloud band.
 * @param {ee.List} obj.cloudHeights      Cloud heights to test (meters).
 * @param {number} obj.shadowSumThresh    Darkness threshold (NIR+SWIR1+SWIR2).
 * @param {number} obj.dilatePixels       Buffer applied to the shadow (pixels).
 * @param {string} obj.cloudBand          'cloudScoreMask' or 'cloudBQAMask'.
 * @returns {ee.Image}
 */
var cloudProject = function (obj) {

  var cloud = obj.image.select(obj.cloudBand);
  var tdomMask = obj.image.select(['tdomMask']);

  // Dark pixels.
  var darkPixels = obj.image.select(['nir', 'swir1', 'swir2'])
    .reduce(ee.Reducer.sum())
    .lt(obj.shadowSumThresh);

  var nominalScale = cloud.projection().nominalScale();

  // Sun geometry in radians.
  var meanAzimuth = obj.image.get('sun_azimuth_angle');
  var meanElevation = obj.image.get('sun_elevation_angle');

  var azR = ee.Number(meanAzimuth)
    .multiply(Math.PI)
    .divide(180.0)
    .add(ee.Number(0.5).multiply(Math.PI));

  var zenR = ee.Number(0.5)
    .multiply(Math.PI)
    .subtract(ee.Number(meanElevation).multiply(Math.PI).divide(180.0));

  // Shift the cloud mask by the shadow offset for each cloud height.
  var shadows = obj.cloudHeights.map(function (cloudHeight) {
    cloudHeight = ee.Number(cloudHeight);

    var shadowCastedDistance = zenR.tan().multiply(cloudHeight);

    var x = azR.cos().multiply(shadowCastedDistance)
      .divide(nominalScale).round();

    var y = azR.sin().multiply(shadowCastedDistance)
      .divide(nominalScale).round();

    return cloud.changeProj(cloud.projection(), cloud.projection().translate(x, y));
  });

  var shadow = ee.ImageCollection.fromImages(shadows).max().unmask();

  shadow = shadow.focal_max(obj.dilatePixels);
  shadow = shadow.and(darkPixels).and(tdomMask.not().and(cloud.not()));

  return obj.image.addBands(shadow.rename(['shadowTdomMask']));
};


/**
 * Cloud mask from the Landsat Collection 2 QA_PIXEL band
 * (bit 1 = dilated cloud, bit 2 = cirrus, bit 3 = cloud).
 * Adds the band 'cloudBQAMask' (1 = cloud).
 *
 * @param {ee.Image} image  Image with the 'pixel_qa' band.
 * @returns {ee.Image}
 */
var cloudBQAMask = function (image) {
  var qaBand = image.select(['pixel_qa']);

  var cloudMask = qaBand.bitwiseAnd(Math.pow(2, 3))
    .or(qaBand.bitwiseAnd(Math.pow(2, 2)))
    .or(qaBand.bitwiseAnd(Math.pow(2, 1)))
    .neq(0)
    .rename('cloudBQAMask');

  return image.addBands(cloudMask);
};


/**
 * Cloud-shadow mask from the QA_PIXEL band (bit 4 = cloud shadow).
 * Adds the band 'shadowBQAMask' (1 = shadow). Sentinel-2 images, which have
 * no equivalent bit, get an empty mask (all 0).
 *
 * @param {ee.Image} image  Image with the 'pixel_qa' band.
 * @returns {ee.Image}
 */
var shadowBQAMask = function (image) {

  var landsatShadowMask = function () {
    return image.select(['pixel_qa'])
      .bitwiseAnd(Math.pow(2, 4))
      .neq(0)
      .rename('shadowBQAMask');
  };

  var cloudShadowMask = ee.Algorithms.If(
    ee.String(image.get('satellite_name')).slice(0, 10).compareTo('Sentinel-2').not(),
    ee.Image(0).mask(image.select(0)).rename('shadowBQAMask'),  // Sentinel-2
    landsatShadowMask()                                           // Landsat
  );

  return image.addBands(ee.Image(cloudShadowMask));
};


/**
 * Adds the selected cloud and cloud-shadow mask bands to every image:
 * 'cloudBQAMask', 'cloudScoreMask', 'shadowBQAMask', 'tdomMask' and
 * 'shadowTdomMask'.
 *
 * @param {Object} obj
 * @param {ee.ImageCollection} obj.collection
 * @param {boolean} obj.cloudBQA        Use QA_PIXEL cloud mask.
 * @param {boolean} obj.cloudScore      Use the cloud score.
 * @param {boolean} obj.shadowBQA       Use QA_PIXEL shadow mask.
 * @param {boolean} obj.shadowTdom      Use TDOM + cloud projection.
 * @param {number} obj.cloudThresh      See cloudScore.
 * @param {number} obj.tempMax          See cloudScore.
 * @param {number} obj.tempMin          See cloudScore.
 * @param {number} obj.zScoreThresh     See tdom.
 * @param {number} obj.shadowSumThresh  See tdom and cloudProject.
 * @param {number} obj.dilatePixels     See tdom and cloudProject.
 * @param {ee.List} obj.cloudHeights    See cloudProject.
 * @param {string} obj.cloudBand        See cloudProject.
 * @returns {ee.ImageCollection}
 */
var getMasks = function (obj) {

  var applyCloudScore = function (image) {
    return cloudScore(image, obj.cloudThresh, obj.tempMax, obj.tempMin);
  };

  var getShadowTdomMask = function (image) {
    return cloudProject({
      image: image,
      shadowSumThresh: obj.shadowSumThresh,
      dilatePixels: obj.dilatePixels,
      cloudHeights: obj.cloudHeights,
      cloudBand: obj.cloudBand
    });
  };

  // Cloud masks.
  var collection = ee.ImageCollection(
    ee.Algorithms.If(
      obj.cloudBQA,
      ee.Algorithms.If(
        obj.cloudScore,
        obj.collection.map(cloudBQAMask).map(applyCloudScore),
        obj.collection.map(cloudBQAMask)
      ),
      obj.collection.map(applyCloudScore)
    )
  );

  // Cloud-shadow masks.
  collection = ee.ImageCollection(
    ee.Algorithms.If(
      obj.shadowBQA,
      ee.Algorithms.If(
        obj.shadowTdom,
        tdom({
          collection: collection.map(shadowBQAMask),
          zScoreThresh: obj.zScoreThresh,
          shadowSumThresh: obj.shadowSumThresh,
          dilatePixels: obj.dilatePixels
        }),
        collection.map(shadowBQAMask)
      ),
      tdom({
        collection: collection,
        zScoreThresh: obj.zScoreThresh,
        shadowSumThresh: obj.shadowSumThresh,
        dilatePixels: obj.dilatePixels
      })
    )
  );

  return ee.ImageCollection(
    ee.Algorithms.If(
      obj.shadowTdom,
      collection.map(getShadowTdomMask),
      collection
    )
  );
};


// =============================================================================
// 5. COLLECTION PROCESSING
// =============================================================================

/**
 * Returns the cloud- and shadow-masked Landsat collection for one parameter
 * set, restricted to [t0, t1) and with the scenes in `blackList` removed.
 * Only the six optical bands are kept (reflectance x 10000).
 *
 * Note: images are first loaded for whole calendar years (January 1 of the
 * year of t0 to December 31 of the year of t1), so the TDOM statistics use
 * that wider window. The result is then clipped to [t0, t1).
 *
 * @param {Object} params     PARAMS_1 or PARAMS_2.
 * @param {Array} blackList   Scene IDs to exclude.
 * @returns {ee.ImageCollection}
 */
var getImages = function (params, blackList) {

  var spectralBands = ['blue', 'red', 'green', 'nir', 'swir1', 'swir2'];

  var applyCloudAndShadowMask = function (collection) {

    var collectionWithMasks = getMasks({
      collection: collection,
      cloudBQA: true,     // cloud mask from QA_PIXEL
      cloudScore: true,   // cloud mask from the cloud score
      shadowBQA: true,    // shadow mask from QA_PIXEL
      shadowTdom: true,   // shadow mask from TDOM + cloud projection
      cloudThresh: params.cloudThresh,
      tempMax: params.temp_max,
      tempMin: params.temp_min,
      zScoreThresh: -1,
      shadowSumThresh: params.shadowSum,
      dilatePixels: 2,
      cloudHeights: ee.List.sequence(2000, 10000, 500),
      cloudBand: 'cloudScoreMask'  // 'cloudScoreMask' or 'cloudBQAMask'
    });

    // Keep only pixels not flagged by any mask.
    return collectionWithMasks.map(function (image) {
      return image.mask(
        image.select([
          'cloudBQAMask',
          'cloudScoreMask',
          'shadowBQAMask',
          'shadowTdomMask'
        ]).reduce(ee.Reducer.anyNonZero()).eq(0)
      );
    });
  };

  var processCollection = function (collectionId) {

    var bands = bns.get(BAND_IDS[collectionId]);

    var collection = getCollection({
      collectionid: collectionId,
      gridName: params.grid_name,
      dateStart: params.t0.slice(0, 4) + '-01-01',
      dateEnd: params.t1.slice(0, 4) + '-12-31',
      cloudCover: params.cloud_cover
    })
      .select(bands.bandNames, bands.newNames)
      .filter(ee.Filter.inList('system:index', blackList).not());

    collection = collection.map(scaleFactors);

    return applyCloudAndShadowMask(collection).select(spectralBands);
  };

  // Main sensor, plus the second one when satellite = 'lx' (L5 + L7).
  var collectionIds = COLLECTION_IDS[params.satellite];
  var collection = processCollection(collectionIds[0]);

  if (collectionIds.length === 2) {
    collection = collection.merge(processCollection(collectionIds[1]));
  }

  return collection.filterDate(params.t0, params.t1);
};


// =============================================================================
// 6. VISUALIZATION
// =============================================================================

/**
 * Builds the mosaics for one parameter set and adds them to a map.
 *
 * @param {Object} params        PARAMS_1 or PARAMS_2.
 * @param {ui.Map} map           Map where layers are added.
 * @param {string} label         Suffix for layer names ('P1' or 'P2').
 * @param {boolean} showScenes   If true, add every individual scene as a layer.
 */
var showComparison = function (params, map, label, showScenes) {

  // Tile footprint, as a vector and as a raster mask.
  var grid = ee.FeatureCollection(LANDSAT_GRID_ASSET)
    .filter(ee.Filter.eq('P_R', params.grid_name));

  var gridMask = grid
    .map(function (f) { return f.set('version', 1); })
    .reduceToImage(['version'], ee.Reducer.first());

  var collectionAll = getImages(params, []);
  var collectionFiltered = getImages(params, params.blackList);

  print('Collection without blacklist ' + label + ':', collectionAll);
  print('Collection with blacklist ' + label + ':', collectionFiltered);

  map.setOptions({ mapTypeId: 'ROADMAP' });
  map.centerObject(ee.FeatureCollection(collectionFiltered.first().geometry()), 10);

  map.addLayer(
    grid.style({ fillColor: 'f8fc0300', color: 'f8fc03' }),
    {}, 'Landsat tile', false
  );

  map.addLayer(
    collectionFiltered.median().updateMask(gridMask),
    MOSAIC_VIS, 'Mosaic with blacklist ' + label, true
  );

  map.addLayer(
    collectionAll.median().updateMask(gridMask),
    MOSAIC_VIS, 'Mosaic without blacklist ' + label, false
  );

  map.addLayer(
    ee.FeatureCollection(BOUNDARIES_ASSET).style({ fillColor: 'f8fc0300', color: 'fa2074' }),
    {}, 'Administrative boundaries', false
  );

  // Add every available scene (hidden) and print its ID, so it can be
  // inspected and, if needed, copied into the blacklist.
  if (showScenes) {
    collectionAll.aggregate_array('system:index').evaluate(function (ids) {
      ids.forEach(function (imageId) {
        var image = collectionAll
          .filter(ee.Filter.eq('system:index', imageId))
          .mosaic();

        map.addLayer(image, MOSAIC_VIS, imageId, false);
        print(imageId);
      });
    });
  }
};


// =============================================================================
// 7. RUN
// =============================================================================

var map1 = ui.Map().add(ui.Label('Mosaic - parameters 1', { position: 'top-left', fontWeight: 'bold' }));
var map2 = ui.Map().add(ui.Label('Mosaic - parameters 2', { position: 'top-right', fontWeight: 'bold' }));

showComparison(PARAMS_1, map1, 'P1', true);
showComparison(PARAMS_2, map2, 'P2', false);

// Linked split panel (swipe) to compare both mosaics.
var linker = ui.Map.Linker([map1, map2]);

var splitPanel = ui.SplitPanel({
  firstPanel: linker.get(0),
  secondPanel: linker.get(1),
  orientation: 'horizontal',
  wipe: true,
  style: { stretch: 'both' }
});

ui.root.widgets().reset([splitPanel]);
