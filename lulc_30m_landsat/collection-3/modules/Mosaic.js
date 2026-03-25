/**
 * @name Mosaic.js
 * @description
 *     Mosaic generation and seasonal feature extraction for MapBiomas.
 *     Creates composite mosaics with dry/wet season separation, amplitude calculations,
 *     and statistical measures for land cover classification.
 * 
 * @author MapBiomas
 * @version 1.0.0
 */

/**
 * @name getMosaic
 * @description
 *     Generates comprehensive mosaic composites with seasonal and statistical features.
 *     This function processes an image collection to create multiple mosaic products:
 *     1. Annual median mosaic (baseline composite)
 *     2. Dry season median mosaic (based on NDVI percentile threshold)
 *     3. Wet season median mosaic (based on NDVI percentile threshold)
 *     4. Minimum value composite
 *     5. Maximum value composite
 *     6. Amplitude mosaic (max - min, seasonal variation)
 *     7. Standard deviation mosaic (temporal variability)
 *     
 *     These features are essential for capturing phenological patterns and
 *     improving land cover classification accuracy.
 * 
 * @param {Object} obj - Configuration object with the following properties:
 *     @param {ee.ImageCollection} obj.collection - Input image collection
 *     @param {string} obj.dateStart - Start date for annual mosaic (YYYY-MM-DD)
 *     @param {string} obj.dateEnd - End date for annual mosaic (YYYY-MM-DD)
 *     @param {Array} obj.medianList - List of image IDs for median calculation (currently unused in function)
 *     @param {string} obj.bandReference - Reference band for season separation (currently hardcoded as 'ndvi')
 *     @param {number} obj.percentileDry - Percentile threshold for dry season (e.g., 25)
 *     @param {number} obj.percentileWet - Percentile threshold for wet season (e.g., 75)
 * 
 * @returns {ee.Image} - Multi-band image containing all mosaic products
 * 
 * @example
 *     // Generate mosaic with seasonal features
 *     var landsatCollection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
 *         .filterDate('2020-01-01', '2020-12-31')
 *         .filterBounds(studyArea);
 *     
 *     var mosaicConfig = {
 *         'collection': landsatCollection,
 *         'dateStart': '2020-01-01',
 *         'dateEnd': '2020-12-31',
 *         'medianList': ['LC08_001001_20200101', 'LC08_001001_20200615'],
 *         'bandReference': 'ndvi',
 *         'percentileDry': 25,
 *         'percentileWet': 75
 *     };
 *     
 *     var fullMosaic = getMosaic(mosaicConfig);
 *     
 *     // Access different mosaic products
 *     var annualMedian = fullMosaic.select(['blue_median', 'green_median', 'red_median']);
 *     var drySeason = fullMosaic.select(['blue_median_dry', 'green_median_dry', 'red_median_dry']);
 *     var amplitude = fullMosaic.select(['blue_amp', 'green_amp', 'red_amp']);
 * 
 * @note
 *     - NDVI is used as the default vegetation indicator for season separation
 *     - Dry season: NDVI <= percentileDry (e.g., 25th percentile)
 *     - Wet season: NDVI >= percentileWet (e.g., 75th percentile)
 *     - Amplitude = Max - Min (captures seasonal variation range)
 *     - All bands are processed to create seasonal and statistical derivatives
 * 
 * @see
 *     - Median mosaicking in remote sensing: Common practice for annual composites
 *     - Phenology-based feature extraction: Improves land cover classification
 *     - Seasonal metrics: Important for distinguishing vegetation types
 */
exports.getMosaic = function(obj) {
    // Get band names from the first image in the collection
    var bands = ee.Image(obj.collection.first()).bandNames();
    
    // Create band name suffixes for different mosaic products
    var bandsDry = bands.map(function(band) {
        return ee.String(band).cat('_median_dry');
    });
    
    var bandsWet = bands.map(function(band) {
        return ee.String(band).cat('_median_wet');
    });
    
    var bandsAmp = bands.map(function(band) {
        return ee.String(band).cat('_amp');
    });

    // =====================================================================
    // DRY SEASON MOSAIC
    // =====================================================================
    // Calculate NDVI percentile threshold for dry season
    // Dry season defined as periods with NDVI <= specified percentile
    var ndviDry = obj.collection
        .select(['ndvi'])
        .reduce(ee.Reducer.percentile([obj.percentileDry]));
    
    // Create dry season collection by masking images with NDVI <= threshold
    var collectionDry = obj.collection.map(function(image) {
        return image.mask(image.select(['ndvi']).lte(ndviDry));
    });
    
    // Calculate dry season median mosaic
    var mosaicDry = collectionDry.reduce(ee.Reducer.median())
        .rename(bandsDry);

    // =====================================================================
    // WET SEASON MOSAIC
    // =====================================================================
    // Calculate NDVI percentile threshold for wet season
    // Wet season defined as periods with NDVI >= specified percentile
    var ndviWet = obj.collection
        .select(['ndvi'])
        .reduce(ee.Reducer.percentile([obj.percentileWet]));
    
    // Create wet season collection by masking images with NDVI >= threshold
    var collectionWet = obj.collection.map(function(image) {
        return image.mask(image.select(['ndvi']).gte(ndviWet));
    });
    
    // Calculate wet season median mosaic
    var mosaicWet = collectionWet.reduce(ee.Reducer.median())
        .rename(bandsWet);

    // =====================================================================
    // ANNUAL MEDIAN MOSAIC (Baseline)
    // =====================================================================
    // Calculate annual median mosaic for the specified date range
    var mosaic = obj.collection
        .filter(ee.Filter.date(obj.dateStart, obj.dateEnd))
        .reduce(ee.Reducer.median());

    // =====================================================================
    // MINIMUM VALUE COMPOSITE
    // =====================================================================
    // Calculate minimum value across the entire collection
    // Useful for identifying persistent features and noise reduction
    var mosaicMin = obj.collection.reduce(ee.Reducer.min());

    // =====================================================================
    // MAXIMUM VALUE COMPOSITE
    // =====================================================================
    // Calculate maximum value across the entire collection
    // Useful for identifying peak vegetation conditions
    var mosaicMax = obj.collection.reduce(ee.Reducer.max());

    // =====================================================================
    // AMPLITUDE MOSAIC (Seasonal Variation)
    // =====================================================================
    // Calculate amplitude = maximum - minimum
    // Measures the range of seasonal variation for each pixel
    var mosaicAmp = mosaicMax.subtract(mosaicMin)
        .rename(bandsAmp);

    // =====================================================================
    // STANDARD DEVIATION MOSAIC (Temporal Variability)
    // =====================================================================
    // Calculate standard deviation across the collection
    // Measures temporal variability and consistency
    var mosaicStdDev = obj.collection.reduce(ee.Reducer.stdDev());

    // =====================================================================
    // COMBINE ALL MOSAIC PRODUCTS
    // =====================================================================
    mosaic = mosaic
        .addBands(mosaicDry)      // Add dry season median
        .addBands(mosaicWet)      // Add wet season median
        .addBands(mosaicMin)      // Add minimum composite
        .addBands(mosaicMax)      // Add maximum composite
        .addBands(mosaicAmp)      // Add amplitude (seasonal variation)
        .addBands(mosaicStdDev);  // Add temporal variability

    return mosaic;
};

/**
 * MOSAIC PRODUCTS EXPLANATION:
 * 
 * 1. Annual Median (_median):
 *    - Baseline composite representing typical conditions
 *    - Reduces noise and cloud contamination
 *    - Standard product for annual land cover mapping
 * 
 * 2. Dry Season (_median_dry):
 *    - Represents low vegetation activity periods
 *    - Useful for identifying:
 *        * Bare soil exposure
 *        * Water stress patterns
 *        * Crop harvesting periods
 * 
 * 3. Wet Season (_median_wet):
 *    - Represents peak vegetation activity periods
 *    - Useful for identifying:
 *        * Maximum greenness
 *        * Flooded areas
 *        * Crop growing periods
 * 
 * 4. Minimum (_min):
 *    - Persistent surface features
 *    - Cloud/shadow minimum reflectance
 *    - Water body minimum reflectance
 * 
 * 5. Maximum (_max):
 *    - Peak vegetation reflectance
 *    - Maximum water reflectance
 *    - Urban/built-up maximum reflectance
 * 
 * 6. Amplitude (_amp):
 *    - Seasonal variation range
 *    - High amplitude = strong seasonal cycle (e.g., deciduous forest, agriculture)
 *    - Low amplitude = stable conditions (e.g., evergreen forest, water, urban)
 * 
 * 7. Standard Deviation (_stdDev):
 *    - Temporal variability
 *    - High stdDev = variable conditions (e.g., agriculture, seasonal flooding)
 *    - Low stdDev = stable conditions (e.g., mature forest, urban areas)
 */

/**
 * BAND NAMING CONVENTION:
 * 
 * Original bands: blue, green, red, nir, swir1, swir2, ndvi, etc.
 * 
 * After mosaic generation:
 * - blue_median        (annual median)
 * - blue_median_dry    (dry season median)
 * - blue_median_wet    (wet season median)
 * - blue_min           (minimum value)
 * - blue_max           (maximum value)
 * - blue_amp           (amplitude = max - min)
 * - blue_stdDev        (temporal standard deviation)
 * 
 * Same pattern for all other bands
 */

/**
 * USAGE EXAMPLE WITH COMPLETE WORKFLOW:
 * 
 * // 1. Load and preprocess Landsat collection
 * var landsatCollection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
 *     .filterDate('2020-01-01', '2020-12-31')
 *     .filterBounds(studyArea)
 *     .map(function(image) {
 *         // Apply cloud masking
 *         var cloudMask = image.select('QA_PIXEL').bitwiseAnd(1 << 3).eq(0);
 *         return image.updateMask(cloudMask);
 *     })
 *     .select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'])
 *     .map(function(image) {
 *         // Scale to reflectance (0-10000)
 *         return image.multiply(0.0000275).add(-0.2).multiply(10000);
 *     });
 * 
 * // 2. Calculate vegetation indices
 * var withIndices = landsatCollection.map(function(image) {
 *     var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('ndvi');
 *     return image.addBands(ndvi);
 * });
 * 
 * // 3. Generate comprehensive mosaic
 * var mosaicParams = {
 *     'collection': withIndices,
 *     'dateStart': '2020-01-01',
 *     'dateEnd': '2020-12-31',
 *     'medianList': [],  // Can specify specific images if needed
 *     'bandReference': 'ndvi',
 *     'percentileDry': 25,
 *     'percentileWet': 75
 * };
 * 
 * var fullMosaic = getMosaic(mosaicParams);
 * 
 * // 4. Use for classification
 * var trainingData = ee.FeatureCollection('projects/.../training');
 * 
 * var classifier = ee.Classifier.smileRandomForest(100)
 *     .train({
 *         features: trainingData,
 *         classProperty: 'landcover',
 *         inputProperties: [
 *             'blue_median', 'green_median', 'red_median',
 *             'nir_median', 'swir1_median', 'swir2_median',
 *             'ndvi_median', 'ndvi_median_dry', 'ndvi_median_wet',
 *             'ndvi_amp', 'ndvi_stdDev'
 *         ]
 *     });
 * 
 * var classification = fullMosaic.classify(classifier);
 */

/**
 * PERFORMANCE CONSIDERATIONS:
 * 
 * 1. Memory usage: Multiple reducers run in parallel where possible
 * 2. Processing time: Depends on collection size and study area
 * 3. Storage: Each band creates 7 derivatives (increases data volume 7x)
 * 4. Optimization: Consider subsetting bands if not all are needed
 * 
 * RECOMMENDATIONS:
 * 1. Pre-filter collection to study area and time period
 * 2. Use appropriate percentile thresholds for local climate
 * 3. Test different band combinations for classification
 * 4. Validate seasonal thresholds with local phenology knowledge
 */

/**
 * EXTENSION IDEAS:
 * 
 * // Add additional percentiles (e.g., 10th, 90th)
 * exports.getMultiPercentileMosaic = function(obj) {
 *     // Could generate mosaics for multiple percentile thresholds
 * };
 * 
 * // Add other vegetation indices for season separation
 * exports.getMosaicWithMultipleIndices = function(obj) {
 *     // Could use EVI, NDWI, or other indices for different ecosystems
 * };
 * 
 * // Add phenology metrics
 * exports.getPhenologyMosaic = function(obj) {
 *     // Could calculate SOS (Start of Season), EOS (End of Season), etc.
 * };
 */