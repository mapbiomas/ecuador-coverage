/**
 * @name 
 *      01-0-mapbiomas-ecu-blacklist-path-row.js
 * 
 * @description
 *      Script that analyzes all images captured in the study area throughout the year
 *      and generates a mosaic for each different path-row at the national level.
 *      This tool helps identify and exclude problematic scenes (blacklist) to improve
 *      the quality of MapBiomas mosaics for Ecuador.
 * 
 * @author
 *      fabriciogarces@ecociencia.org
 *
 * @version
 *  1.0.0
 *
 * @Date
 *  10/01/2025
 */


// ============================================================================
// PARAMETER CONFIGURATION
// ============================================================================

// Parameters for first analysis (stricter cloud masking)
var param_1 = {
    'grid_name': '011061',      // Path-row ID (LandSat WRS-2 path/row system)
    't0': '2025-01-01',         // Start date for image search
    't1': '2026-01-01',         // End date for image search
    'satellite': 'l8',          // Satellite platform ('l9', 'l8', 'l7', 'l5', 'lx', 'l4')
    'cloud_cover': 90,          // Maximum cloud cover percentage allowed in images
    'pais': 'Ecuador',          // Country for filtering
    'shadowSum': 2500,          // Shadow detection threshold (0-10000, default 2500)
    'cloudThresh': 10,          // Cloud detection threshold (0-100, default 10)
    // Temperature mask using ST_B10 band (surface temperature)
    'temp_max': 330,            // Maximum surface temperature for masking
    'temp_min': 290,            // Minimum surface temperature for masking
    // List of specific image IDs to exclude from processing (blacklist)
    'blackList': [] 
};

// Parameters for second analysis (more relaxed cloud masking)
var param_2 = {
    'grid_name': '011061',      // Path-row ID (LandSat WRS-2 path/row system)
    't0': '2025-01-01',         // Start date for image search
    't1': '2026-01-01',         // End date for image search
    'satellite': 'l8',          // Satellite platform
    'cloud_cover': 90,          // Maximum cloud cover percentage allowed
    'pais': 'Ecuador',          // Country for filtering
    'shadowSum': 2500,          // Shadow detection threshold
    'cloudThresh': 50,          // Higher cloud threshold (more permissive)
    // Temperature mask
    'temp_max': 330,            // Maximum surface temperature
    'temp_min': 290,            // Minimum surface temperature
    // List of specific image IDs to exclude
    'blackList': [] 
};

// ============================================================================
// LOAD SPATIAL DATA
// ============================================================================

// Load Landsat grid for Ecuador and filter to specific path-row
var gridLandsat = ee.FeatureCollection('projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/ec-landsat-grid')
    .filterMetadata('P_R', 'equals', param_1.grid_name);

// Convert grid polygon to raster mask (1 = inside grid, 0 = outside)
var gridRaster = gridLandsat
    .map(function(f) { return f.set('version', 1); })
    .reduceToImage(['version'], ee.Reducer.first());

// ============================================================================
// SETUP USER INTERFACE
// ============================================================================

// Create titles for the two comparison maps
var title_1 = ui.Label('Mosaic with parameters 1 (strict)', {
    position: 'top-left',
    fontWeight: 'bold'
});

var title_2 = ui.Label('Mosaic with parameters 2 (relaxed)', {
    position: 'top-right',
    fontWeight: 'bold'
});

// Create two map panels for comparison
var mapa_1 = ui.Map().add(title_1);
var mapa_2 = ui.Map().add(title_2);

// Arrays to store parameters and map references
var param = [];
var mapa_base = [];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * @name rescale
 * @description
 *      Rescales an image to a specified range (normalization)
 * @argument
 *      Object containing attributes:
 *          @attribute image {ee.Image} - Image to rescale
 *          @attribute min {Integer} - Minimum value for rescaling
 *          @attribute max {Integer} - Maximum value for rescaling
 * @example
 *      var obj = {
 *          'image': image.expression('b(red) + b(green) + b(blue)'),
 *          'min': 2000,
 *          'max': 8000
 *      };
 *      var rescaled = rescale(obj);
 * @returns ee.Image
 */
var rescale = function(obj) {
    var image = obj.image
        .subtract(obj.min)
        .divide(ee.Number(obj.max).subtract(obj.min));
    return image;
};

/**
 * @name scaleFactors
 * @description
 *      Applies scaling factors to convert Landsat digital numbers to surface reflectance
 *      and temperature values
 * @argument image {ee.Image} - Input Landsat image
 * @returns ee.Image - Scaled image with corrected reflectance and temperature
 */
var scaleFactors = function(image) {
    // Optical bands scaling (to surface reflectance)
    var optical = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'];
    var opticalBands = image.select(optical)
        .multiply(0.0000275)  // Multiplicative scaling
        .add(-0.2)            // Additive scaling
        .multiply(10000);     // Convert to 0-10000 range
    
    // Thermal band scaling (to temperature in Kelvin)
    var thermalBand = image.select('temp*')
        .multiply(0.00341802)  // Multiplicative scaling
        .add(149.0);           // Additive scaling
    
    // Replace original bands with scaled bands
    return image
        .addBands(opticalBands, null, true)
        .addBands(thermalBand, null, true);
};

/**
 * @name getCollection
 * @description
 *      Retrieves and filters a Landsat image collection based on parameters
 * @argument obj {Object} - Parameters for collection filtering
 * @returns ee.ImageCollection - Filtered image collection
 */
var getCollection = function(obj) {
    // Function to standardize image properties across different Landsat versions
    var setProperties = function(image) {
        // Handle different metadata field names across Landsat collections
        var cloudCover = ee.Algorithms.If(image.get('SPACECRAFT_NAME'),
            image.get('CLOUDY_PIXEL_PERCENTAGE'),  // For newer collections
            image.get('CLOUD_COVER')              // For older collections
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
        
        // Get solar geometry for shadow detection
        var azimuth = ee.Algorithms.If(image.get('SUN_AZIMUTH'),
            image.get('SUN_AZIMUTH'),
            ee.Algorithms.If(image.get('SOLAR_AZIMUTH_ANGLE'),
                image.get('SOLAR_AZIMUTH_ANGLE'),
                image.get('MEAN_SOLAR_AZIMUTH_ANGLE')
            )
        );
        
        var elevation = ee.Algorithms.If(image.get('SUN_ELEVATION'),
            image.get('SUN_ELEVATION'),
            ee.Algorithms.If(image.get('SOLAR_ZENITH_ANGLE'),
                ee.Number(90).subtract(image.get('SOLAR_ZENITH_ANGLE')),
                ee.Number(90).subtract(image.get('MEAN_SOLAR_ZENITH_ANGLE'))
            )
        );
        
        // Determine if image is Surface Reflectance (SR) or Top of Atmosphere (TOA)
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
    
    // Create filters for collection
    var filters = ee.Filter.and(
        ee.Filter.date(obj.dateStart, obj.dateEnd),
        ee.Filter.lte('cloud_cover', obj.cloudCover),
        ee.Filter.eq('WRS_PATH', parseInt(obj.gridName.slice(0, 3), 10)),  // Extract path from grid name
        ee.Filter.eq('WRS_ROW', parseInt(obj.gridName.slice(3, 6), 10))    // Extract row from grid name
    );
    
    // Apply properties and filters to collection
    var collection = ee.ImageCollection(obj.collectionid)
        .map(setProperties)
        .filter(filters);
    
    return collection;
};

// ============================================================================
// CLOUD AND SHADOW DETECTION FUNCTIONS
// ============================================================================

/**
 * @name cloudScore
 * @description
 *      Creates a cloud mask using multiple cloud indicators and temperature thresholds
 *      Based on: https://www.mdpi.com/2072-4292/10/8/1184/htm
 * @argument image {ee.Image} - Input image
 * @returns ee.Image - Image with added cloudScoreMask band
 */
var cloudScore = function(image) {
    var cloudThresh = param.cloudThresh;  // Get cloud threshold from parameters
    
    // Start with maximum cloud score (1.0)
    var score = ee.Image(1.0);
    
    // Indicator 1: Clouds are bright in the blue band
    score = score.min(rescale({
        'image': image.select(['blue']),
        'min': 1000,
        'max': 3000
    }));
    
    // Indicator 2: Clouds are bright in all visible bands
    score = score.min(rescale({
        'image': image.expression("b('red') + b('green') + b('blue')"),
        'min': 2000,
        'max': 8000
    }));
    
    // Indicator 3: Clouds are bright in infrared bands
    score = score.min(rescale({
        'image': image.expression("b('nir') + b('swir1') + b('swir2')"),
        'min': 3000,
        'max': 10000
    }));
    
    // Indicator 4: Clouds are relatively cool in temperature
    var temperature = image.select(['temp']);
    score = score.where(temperature.mask(),
        score.min(rescale({
            'image': temperature,
            'min': param.temp_max,  // Maximum temperature threshold
            'max': param.temp_min   // Minimum temperature threshold
        }))
    );
    
    // Indicator 5: Distinguish clouds from snow using NDSI
    var ndsi = image.normalizedDifference(['green', 'swir1']);
    score = score.min(rescale({
        'image': ndsi,
        'min': 0.8,
        'max': 0.6
    }));
    
    // Convert to binary mask and rename
    score = score.multiply(100).byte();
    score = score.gte(cloudThresh).rename('cloudScoreMask');
    
    return image.addBands(score);
};

/**
 * @name tdom
 * @description
 *      Temporal Dark-Outlier Mask (TDOM) method for cloud shadow detection
 *      Identifies cloud shadows as dark outliers in the temporal series
 * @argument obj {Object} - Parameters for TDOM calculation
 * @returns ee.ImageCollection - Collection with added tdomMask band
 */
var tdom = function(obj) {
    var shadowSumBands = ['nir', 'swir1'];
    
    // Calculate pixel-wise statistics for the time series
    var irStdDev = obj.collection.select(shadowSumBands).reduce(ee.Reducer.stdDev());
    var irMean = obj.collection.select(shadowSumBands).mean();
    
    // Apply TDOM algorithm to each image
    var collection = obj.collection.map(function(image) {
        // Calculate z-scores for NIR and SWIR1 bands
        var zScore = image.select(shadowSumBands)
            .subtract(irMean)
            .divide(irStdDev);
        
        // Calculate sum of NIR and SWIR1 bands
        var irSum = image.select(shadowSumBands).reduce(ee.Reducer.sum());
        
        // Create TDOM mask: pixels that are dark outliers in both bands
        var tdomMask = zScore.lt(obj.zScoreThresh)  // z-score below threshold
            .reduce(ee.Reducer.sum())               // Both bands must be below threshold
            .eq(2)
            .and(irSum.lt(obj.shadowSumThresh))     // Dark pixels
            .not();                                 // Invert mask (1 = good, 0 = shadow)
        
        // Apply dilation to expand shadow mask slightly
        tdomMask = tdomMask.focal_min(obj.dilatePixels);
        
        return image.addBands(tdomMask.rename('tdomMask'));
    });
    
    return collection;
};

/**
 * @name cloudProject
 * @description
 *      Projects cloud shadows based on solar geometry and cloud heights
 *      Uses cloud mask to predict where shadows should fall
 * @argument obj {Object} - Parameters for cloud shadow projection
 * @returns ee.Image - Image with added shadowTdomMask band
 */
var cloudProject = function(obj) {
    // Get cloud mask
    var cloud = obj.image.select(obj.cloudBand);
    
    // Get TDOM mask for validation
    var tdomMask = obj.image.select(['tdomMask']);
    
    // Find dark pixels (potential shadows)
    var darkPixels = obj.image.select(['nir', 'swir1', 'swir2'])
        .reduce(ee.Reducer.sum())
        .lt(obj.shadowSumThresh);
    
    // Get image scale for geometric calculations
    var nominalScale = cloud.projection().nominalScale();
    
    // Get solar geometry from image metadata
    var meanAzimuth = obj.image.get('sun_azimuth_angle');
    var meanElevation = obj.image.get('sun_elevation_angle');
    
    // Convert to radians for trigonometric calculations
    var azR = ee.Number(meanAzimuth).multiply(Math.PI).divide(180.0).add(ee.Number(0.5).multiply(Math.PI));
    var zenR = ee.Number(0.5).multiply(Math.PI).subtract(ee.Number(meanElevation).multiply(Math.PI).divide(180.0));
    
    // Project clouds to potential shadow locations for different cloud heights
    var shadows = obj.cloudHeights.map(function(cloudHeight) {
        cloudHeight = ee.Number(cloudHeight);
        
        // Calculate shadow distance based on cloud height and sun angle
        var shadowCastedDistance = zenR.tan().multiply(cloudHeight);
        
        // Calculate x and y offset in pixels
        var x = azR.cos().multiply(shadowCastedDistance).divide(nominalScale).round();
        var y = azR.sin().multiply(shadowCastedDistance).divide(nominalScale).round();
        
        // Translate cloud mask to predicted shadow location
        return cloud.changeProj(cloud.projection(), cloud.projection().translate(x, y));
    });
    
    // Combine shadow predictions from all cloud heights
    var shadow = ee.ImageCollection.fromImages(shadows).max().unmask();
    
    // Refine shadow mask
    shadow = shadow.focal_max(obj.dilatePixels);  // Expand shadow areas
    shadow = shadow.and(darkPixels)               // Must be dark
                  .and(tdomMask.not())            // Not already in TDOM mask
                  .and(cloud.not());              // Not in cloud mask
    
    var shadowMask = shadow.rename(['shadowTdomMask']);
    
    return obj.image.addBands(shadowMask);
};

// Functions for QA-based cloud and shadow masking
var cloudBQAMaskSr = function(image) {
    var qaBand = image.select(['pixel_qa']);
    var cloudMask = qaBand.bitwiseAnd(Math.pow(2, 3))  // Cloud confidence bits
        .or(qaBand.bitwiseAnd(Math.pow(2, 2)))
        .or(qaBand.bitwiseAnd(Math.pow(2, 1)))
        .neq(0)
        .rename('cloudBQAMask');
    return ee.Image(cloudMask);
};

var cloudBQAMask = function(image) {
    var cloudMask = cloudBQAMaskSr(image);
    return image.addBands(ee.Image(cloudMask));
};

var shadowBQAMaskSrLX = function(image) {
    var qaBand = image.select(['pixel_qa']);
    var cloudShadowMask = qaBand.bitwiseAnd(Math.pow(2, 4))  // Cloud shadow bit
        .neq(0)
        .rename('shadowBQAMask');
    return ee.Image(cloudShadowMask);
};

var shadowBQAMask = function(image) {
    var cloudShadowMask = ee.Algorithms.If(
        ee.String(image.get('satellite_name')).slice(0, 10).compareTo('Sentinel-2').not(),
        ee.Image(0).mask(image.select(0)).rename('shadowBQAMask'),  // For Sentinel-2
        shadowBQAMaskSrLX(image)  // For Landsat
    );
    return image.addBands(ee.Image(cloudShadowMask));
};

/**
 * @name getMasks
 * @description
 *      Main function to apply all cloud and shadow masks
 *      Combines QA-based masks, cloud score, and TDOM methods
 * @argument obj {Object} - Parameters for mask generation
 * @returns ee.ImageCollection - Collection with all mask bands
 */
var getMasks = function(obj) {
    // Function to apply TDOM-based shadow projection
    var getShadowTdomMask = function(image) {
        image = cloudProject({
            'image': image,
            'shadowSumThresh': obj.shadowSumThresh,
            'dilatePixels': obj.dilatePixels,
            'cloudHeights': obj.cloudHeights,
            'cloudBand': obj.cloudBand,
        });
        return image;
    };
    
    // Apply cloud masks
    var collection = ee.ImageCollection(
        ee.Algorithms.If(obj.cloudBQA,
            ee.Algorithms.If(obj.cloudScore,
                obj.collection.map(cloudBQAMask).map(cloudScore),
                obj.collection.map(cloudBQAMask)
            ),
            obj.collection.map(cloudScore)
        )
    );
    
    // Apply shadow masks
    collection = ee.ImageCollection(
        ee.Algorithms.If(obj.shadowBQA,
            ee.Algorithms.If(obj.shadowTdom,
                tdom({
                    'collection': collection.map(shadowBQAMask),
                    'zScoreThresh': obj.zScoreThresh,
                    'shadowSumThresh': obj.shadowSumThresh,
                    'dilatePixels': obj.dilatePixels,
                }),
                collection.map(shadowBQAMask)
            ),
            tdom({
                'collection': collection,
                'zScoreThresh': obj.zScoreThresh,
                'shadowSumThresh': obj.shadowSumThresh,
                'dilatePixels': obj.dilatePixels,
            })
        )
    );
    
    // Apply TDOM shadow projection if requested
    return ee.ImageCollection(
        ee.Algorithms.If(obj.shadowTdom,
            collection.map(getShadowTdomMask),
            collection)
    );
};

// ============================================================================
// MAIN IMAGE PROCESSING FUNCTION
// ============================================================================

/**
 * @name getImages
 * @description
 *      Main function to retrieve and process Landsat images
 *      Applies all filtering, cloud masking, and blacklist exclusion
 * @argument param {Object} - Processing parameters
 * @argument blackList {Array} - List of image IDs to exclude
 * @returns ee.ImageCollection - Processed image collection
 */
var getImages = function(param, blackList) {
    var options = {
        dates: { t0: param.t0, t1: param.t1 },
        collection: null,
        gridName: param.grid_name,
        cloudCover: param.cloud_cover,
        shadowSum: param.shadowSum,
        cloudThresh: param.cloudThresh,
        blackList: blackList,
        imageList: [],
        
        // Collection IDs for different Landsat missions
        collectionid: param.satellite,
        collectionIds: {
            'l4': ['LANDSAT/LT04/C02/T1_L2'],
            'l5': ['LANDSAT/LT05/C02/T1_L2'],
            'l7': ['LANDSAT/LE07/C02/T1_L2'],
            'l8': ['LANDSAT/LC08/C02/T1_L2'],
            'l9': ['LANDSAT/LC09/C02/T1_L2'],
            'lx': ['LANDSAT/LT05/C02/T1_L2', 'LANDSAT/LE07/C02/T1_L2'],  // Extended collection
        },
        
        // Band mapping for different Landsat versions
        bandIds: {
            'LANDSAT/LT04/C02/T1_L2': 'l4_sr2',
            'LANDSAT/LT05/C02/T1_L2': 'l5_sr2',
            'LANDSAT/LE07/C02/T1_L2': 'l7_sr2',
            'LANDSAT/LC08/C02/T1_L2': 'l8_sr2',
            'LANDSAT/LC09/C02/T1_L2': 'l9_sr2',
        },
        
        // Visualization parameters
        visParams: {
            bands: 'swir1,nir,red',
            min: -26.875000000000092,
            max: 5505.850000000001,
            gamma: 1
        }
    };
    
    // Apply cloud and shadow masks to collection
    var applyCloudAndShadowMask = function(collection) {
        var collectionWithMasks = getMasks({
            'collection': collection,
            'cloudBQA': true,
            'cloudScore': true,
            'shadowBQA': true,
            'shadowTdom': true,
            'zScoreThresh': -1,
            'shadowSumThresh': options.shadowSum,
            'cloudThresh': options.cloudThresh,
            'dilatePixels': 2,
            'cloudHeights': ee.List.sequence(2000, 10000, 500),
            'cloudBand': 'cloudScoreMask'
        });
        
        // Create clean mask by combining all cloud/shadow masks
        var collectionWithoutClouds = collectionWithMasks.map(function(image) {
            return image.mask(
                image.select(['cloudBQAMask', 'cloudScoreMask', 'shadowBQAMask', 'shadowTdomMask'])
                    .reduce(ee.Reducer.anyNonZero())
                    .eq(0)  // Mask pixels where any mask indicates cloud/shadow
            );
        });
        
        return collectionWithoutClouds;
    };
    
    // Process individual Landsat collection
    var processCollection = function(collectionid) {
        var spectralBands = ['blue', 'red', 'green', 'nir', 'swir1', 'swir2'];
        
        var objLandsat = {
            'collectionid': collectionid,
            'gridName': options.gridName,
            'dateStart': options.dates.t0.slice(0, 4) + '-01-01',
            'dateEnd': options.dates.t1.slice(0, 4) + '-12-31',
            'cloudCover': options.cloudCover,
        };
        
        // Get band name mapping
        var bands = bns.get(options.bandIds[collectionid]);
        
        // Filter and process collection
        var collection = getCollection(objLandsat)
            .select(bands.bandNames, bands.newNames)
            .filter(ee.Filter.inList('system:index', options.blackList).not());
        
        // Apply scaling and cloud masking
        collection = collection.map(scaleFactors);
        collection = applyCloudAndShadowMask(collection).select(spectralBands);
        
        return collection;
    };
    
    // Main collection building function
    var makeCollection = function() {
        var collection = processCollection(options.collectionIds[options.collectionid][0]);
        
        // If extended collection (lx), merge with second collection
        if (options.collectionIds[options.collectionid].length == 2) {
            var collection2 = processCollection(options.collectionIds[options.collectionid][1]);
            collection = collection.merge(collection2);
        }
        
        return collection.filterDate(options.dates.t0, options.dates.t1);
    };
    
    return makeCollection();
};

// ============================================================================
// VISUALIZATION HELPER FUNCTION
// ============================================================================

/**
 * @name evaluacion_ad
 * @description
 *      Helper function to visualize individual scenes for quality assessment
 * @argument ids {Array} - List of image IDs to display
 */
var evaluacion_ad = function(ids) {
    ids.forEach(function(imageid) {
        var image = collection_without_blacklist
            .filterMetadata('system:index', 'equals', imageid)
            .mosaic();
        
        mapa_1.addLayer(image, {
            bands: 'swir1,nir,red',
            gain: '0.09,0.06,0.30',
            gamma: 0.6
        }, imageid, false);
        
        print(imageid);  // Print ID to console for reference
    });
};

// ============================================================================
// LOAD EXTERNAL MODULES
// ============================================================================

// Import MapBiomas modules for additional functionality
var bns = require('users/mapbiomasecuador/LULC:COLECCION4/01-mosaicos/modules/BandNames.js');
var dtp = require('users/mapbiomasecuador/LULC:COLECCION4/01-mosaicos/modules/DataType.js');
var ind = require('users/mapbiomasecuador/LULC:COLECCION4/01-mosaicos/modules/SpectralIndexes.js');
var mis = require('users/mapbiomasecuador/LULC:COLECCION4/01-mosaicos/modules/Miscellaneous.js');
var mos = require('users/mapbiomasecuador/LULC:COLECCION4/01-mosaicos/modules/Mosaic.js');
var sma = require('users/mapbiomasecuador/LULC:COLECCION4/01-mosaicos/modules/SmaAndNdfi.js');

// ============================================================================
// MAIN PROCESSING LOOP
// ============================================================================

// Process both parameter sets for comparison
for (var n = 1; n <= 2; n++) {
    if (n === 1) {
        param = param_1;        // Use strict parameters
        mapa_base = mapa_1;     // Use first map
    } else {
        param = param_2;        // Use relaxed parameters
        mapa_base = mapa_2;     // Use second map
    }
    
    // Get blacklist from parameters
    var blackList = param.blackList;
    
    // Get image collections with and without blacklist
    var collection_without_blacklist = getImages(param, []);
    var collection_with_blacklist = getImages(param, blackList);
    
    // Print results to console
    if (n === 1) {
        print('Collection without blacklist P1:', collection_without_blacklist);
        print('Collection with blacklist P1:', collection_with_blacklist);
    } else {
        print('Collection without blacklist P2:', collection_without_blacklist);
        print('Collection with blacklist P2:', collection_with_blacklist);
    }
    
    // Configure map visualization
    mapa_base.setOptions({ mapTypeId: 'ROADMAP' });
    
    // Get image geometry for centering map
    var area_img = ee.FeatureCollection(
        collection_with_blacklist.first().geometry()
    );
    mapa_base.centerObject(area_img, 10);
    
    // Add layers to map
    mapa_base.addLayer(
        gridLandsat.style({ fillColor: 'f8fc0300', color: 'f8fc03' }), 
        {}, 
        'LANDSAT GRID', 0
    );
    
    // Add median mosaics to map
    mapa_base.addLayer(
        collection_with_blacklist.median().updateMask(gridRaster),
        {
            bands: 'swir1,nir,red',
            gain: '0.09,0.06,0.30',
            gamma: 0.6
        },
        'MOSAIC WITH BLACKLIST P' + n,
        true 
    );
    
    mapa_base.addLayer(
        collection_without_blacklist.median().updateMask(gridRaster),
        {
            bands: 'swir1,nir,red',
            gain: '0.09,0.06,0.30',
            gamma: 0.6
        },
        'MOSAIC WITHOUT BLACKLIST P' + n,
        false
    );
    
    // For first map, list all available scenes for quality assessment
    if (n === 1) {
        var lista_collection_without_blacklist = ee.List(
            collection_without_blacklist.reduceColumns(ee.Reducer.toList(), ['system:index'])
                .get('list')
        ).evaluate(evaluacion_ad);
    }
    
    // Add country boundaries (requires 'table' variable to be defined)
    // var paises = ee.FeatureCollection(table);
    // mapa_base.addLayer(paises.style({ fillColor: 'f8fc0300', color: 'fa2074'}), {}, 'COUNTRY BORDER', false);
}

// ============================================================================
// CREATE COMPARISON INTERFACE
// ============================================================================

// Link maps for synchronized navigation
var SWIPE = ui.Map.Linker([mapa_1, mapa_2]);

// Create swipe comparison panel
var SWIPE2 = ui.SplitPanel({
    firstPanel: SWIPE.get(0),
    secondPanel: SWIPE.get(1),
    orientation: 'horizontal',  // Horizontal swipe comparison
    wipe: true,                 // Enable swipe functionality
    style: { stretch: 'both' }
});

// Set as root widget for display
ui.root.widgets().reset([SWIPE2]);

// ============================================================================
// SCRIPT PURPOSE AND USAGE NOTES:
// ============================================================================
// This script is designed to help MapBiomas technicians identify problematic
// Landsat scenes that should be excluded from annual mosaic generation.
// 
// Key features:
// 1. Compares two different cloud/shadow masking strategies
// 2. Allows manual exclusion of specific scenes (blacklist)
// 3. Visualizes individual scenes for quality assessment
// 4. Generates median mosaics for comparison
// 
// Typical workflow:
// 1. Set path-row and date range
// 2. Run script to see available scenes
// 3. Visually inspect individual scenes
// 4. Add problematic scene IDs to blacklist
// 5. Compare mosaics with/without blacklisted scenes
// 6. Export final blacklist for production processing
// ============================================================================