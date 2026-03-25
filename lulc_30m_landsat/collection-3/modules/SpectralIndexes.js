/**
 * @name SpectralIndexes.js
 * @description
 *     Spectral vegetation and land cover index calculations for MapBiomas.
 *     Implements commonly used spectral indices for vegetation monitoring,
 *     soil analysis, and land cover characterization.
 * 
 * @author MapBiomas
 * @version 1.0.0
 * 
 * @see
 *     - Remote sensing literature on vegetation indices
 *     - Land cover classification methodologies
 *     - Ecological monitoring applications
 */

/**
 * @name getNDVI
 * @description
 *     Calculates Normalized Difference Vegetation Index (NDVI).
 *     NDVI = (NIR - Red) / (NIR + Red)
 *     
 *     NDVI measures vegetation greenness and photosynthetic activity.
 *     Values range from -1 to 1, scaled to 0-100 for storage.
 *     
 *     Applications:
 *     - Vegetation health monitoring
 *     - Biomass estimation
 *     - Drought assessment
 *     - Phenology tracking
 * 
 * @param {ee.Image} image - Input image containing 'nir' and 'red' bands
 * 
 * @returns {ee.Image} - Input image with added 'ndvi' band (0-100 range)
 * 
 * @example
 *     var landsatImage = ee.Image('LANDSAT/LC08/C02/T1_L2/LC08_001001_20200101');
 *     var scaled = landsatImage.select(['SR_B5', 'SR_B4'])
 *         .multiply(0.0000275).add(-0.2).multiply(10000)
 *         .rename(['nir', 'red']);
 *     
 *     var withNDVI = getNDVI(scaled);
 *     
 *     Map.addLayer(withNDVI.select('ndvi'), {
 *         min: 0,
 *         max: 100,
 *         palette: ['brown', 'yellow', 'green']
 *     }, 'NDVI');
 * 
 * @note
 *     - NDVI is sensitive to chlorophyll absorption and leaf structure
 *     - Saturated in dense vegetation canopies
 *     - Affected by soil background, especially in sparse vegetation
 *     - Values: <0 = water/snow, 0-30 = bare soil, 30-70 = vegetation, >70 = dense vegetation
 */
exports.getNDVI = function(image) {
    // NDVI formula: (NIR - Red) / (NIR + Red)
    var exp = '( b("nir") - b("red") ) / ( b("nir") + b("red") )';
    
    var ndvi = image.expression(exp).rename("ndvi")
        .multiply(100)      // Scale from [-1, 1] to [-100, 100]
        .byte();           // Convert to 8-bit (0-255, but actual range -100 to 100)
    
    return image.addBands(ndvi);
};

/**
 * @name getNDWI
 * @description
 *     Calculates Normalized Difference Water Index (NDWI).
 *     NDWI = (NIR - SWIR1) / (NIR + SWIR1)
 *     
 *     NDWI measures water content in vegetation and detects water bodies.
 *     Values range from -1 to 1, scaled to 0-100 for storage.
 *     
 *     Applications:
 *     - Water body mapping
 *     - Vegetation water stress
 *     - Flood monitoring
 *     - Soil moisture estimation
 * 
 * @param {ee.Image} image - Input image containing 'nir' and 'swir1' bands
 * 
 * @returns {ee.Image} - Input image with added 'ndwi' band (0-100 range)
 * 
 * @note
 *     - Positive values typically indicate water bodies
 *     - Negative values indicate vegetation or dry soil
 *     - Sensitive to leaf water content
 *     - Can be affected by soil moisture
 */
exports.getNDWI = function(image) {
    // NDWI formula: (NIR - SWIR1) / (NIR + SWIR1)
    var exp = 'float(b("nir") - b("swir1"))/(b("nir") + b("swir1"))';
    
    var ndwi = image.expression(exp).rename("ndwi")
        .multiply(100)      // Scale from [-1, 1] to [-100, 100]
        .byte();           // Convert to 8-bit
    
    return image.addBands(ndwi);
};

/**
 * @name getSAVI
 * @description
 *     Calculates Soil-Adjusted Vegetation Index (SAVI).
 *     SAVI = 1.5 * (NIR - Red) / (NIR + Red + 0.5)
 *     
 *     SAVI minimizes soil background effects in areas with sparse vegetation.
 *     Includes a soil brightness correction factor (L = 0.5).
 *     
 *     Applications:
 *     - Arid and semi-arid regions
 *     - Sparse vegetation monitoring
 *     - Agricultural fields with exposed soil
 * 
 * @param {ee.Image} image - Input image containing 'nir' and 'red' bands
 * 
 * @returns {ee.Image} - Input image with added 'savi' band (0-100 range)
 * 
 * @note
 *     - L factor (0.5) optimized for intermediate vegetation cover
 *     - Less sensitive to soil brightness than NDVI
 *     - Values comparable to NDVI but with soil correction
 */
exports.getSAVI = function(image) {
    // SAVI formula: 1.5 * (NIR - Red) / (NIR + Red + 0.5)
    var exp = '1.5 * (b("nir") - b("red")) / (0.5 + b("nir") + b("red"))';
    
    var savi = image.expression(exp).rename("savi")
        .multiply(100)      // Scale from [-1, 1] to [-100, 100]
        .byte();           // Convert to 8-bit
    
    return image.addBands(savi);
};

/**
 * @name getPRI
 * @description
 *     Calculates Photochemical Reflectance Index (PRI).
 *     PRI = (Blue - Green) / (Blue + Green)
 *     
 *     PRI measures photosynthetic light use efficiency and plant stress.
 *     Sensitive to xanthophyll pigment changes.
 *     
 *     Applications:
 *     - Plant stress detection
 *     - Photosynthetic efficiency monitoring
 *     - Drought stress assessment
 * 
 * @param {ee.Image} image - Input image containing 'blue' and 'green' bands
 * 
 * @returns {ee.Image} - Input image with added 'pri' band (0-100 range)
 * 
 * @note
 *     - Values typically range from -0.5 to 0.5
 *     - Sensitive to sun angle and viewing geometry
 *     - Requires careful atmospheric correction
 */
exports.getPRI = function(image) {
    // PRI formula: (Blue - Green) / (Blue + Green)
    var exp = 'float(b("blue") - b("green"))/(b("blue") + b("green"))';
    
    var pri = image.expression(exp).rename("pri")
        .multiply(100)      // Scale from [-1, 1] to [-100, 100]
        .byte();           // Convert to 8-bit
    
    return image.addBands(pri);
};

/**
 * @name getCAI
 * @description
 *     Calculates Cellulose Absorption Index (CAI).
 *     CAI = SWIR2 / SWIR1
 *     
 *     CAI detects cellulose and lignin in dry vegetation (crop residues, litter).
 *     Sensitive to non-photosynthetic vegetation (NPV).
 *     
 *     Applications:
 *     - Crop residue monitoring
 *     - Dry vegetation detection
 *     - Fire fuel assessment
 *     - Soil conservation studies
 * 
 * @param {ee.Image} image - Input image containing 'swir1' and 'swir2' bands
 * 
 * @returns {ee.Image} - Input image with added 'cai' band (0-100 range)
 * 
 * @note
 *     - Values typically range from 0.5 to 2.0
 *     - High values indicate high cellulose/lignin content
 *     - Useful for conservation agriculture monitoring
 */
exports.getCAI = function(image) {
    // CAI formula: SWIR2 / SWIR1
    var exp = 'float( b("swir2") / b("swir1") )';
    
    var cai = image.expression(exp).rename("cai")
        .multiply(100)      // Scale to 0-100 range
        .byte();           // Convert to 8-bit
    
    return image.addBands(cai);
};

/**
 * @name getEVI
 * @description
 *     Calculates Enhanced Vegetation Index (EVI).
 *     EVI = 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
 *     
 *     EVI improves sensitivity in high biomass regions and reduces atmospheric
 *     and soil background influences.
 *     
 *     Applications:
 *     - Dense forest monitoring
 *     - High biomass regions
 *     - Areas with atmospheric haze
 * 
 * @param {ee.Image} image - Input image containing 'nir', 'red', and 'blue' bands
 * 
 * @returns {ee.Image} - Input image with added 'evi' band (0-100 range)
 * 
 * @note
 *     - Less prone to saturation than NDVI in dense vegetation
 *     - Includes atmospheric correction via blue band
 *     - Values typically range from 0 to 1
 */
exports.getEVI = function(image) {
    // EVI formula: 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
    var exp = '2.5 * ((b("nir") - b("red")) / (b("nir") + 6 * b("red") - 7.5 * b("blue") + 1))';
    
    var evi = image.expression(exp).rename("evi")
        .multiply(100)      // Scale to 0-100 range
        .byte();           // Convert to 8-bit
    
    return image.addBands(evi);
};

/**
 * @name getEVI2
 * @description
 *     Calculates Enhanced Vegetation Index 2 (EVI2).
 *     EVI2 = 2.5 * (NIR - Red) / (NIR + 2.4*Red + 1)
 *     
 *     EVI2 is a simplified version of EVI that doesn't require blue band.
 *     Maintains sensitivity in high biomass while reducing atmospheric effects.
 *     
 *     Applications:
 *     - Vegetation monitoring when blue band is unavailable
 *     - Historical Landsat data analysis
 *     - Large-scale vegetation studies
 * 
 * @param {ee.Image} image - Input image containing 'nir' and 'red' bands
 * 
 * @returns {ee.Image} - Input image with added 'evi2' band (0-100 range)
 * 
 * @note
 *     - Compatible with sensors lacking blue band (e.g., some historical data)
 *     - Less atmospheric correction than EVI but better than NDVI
 *     - Values comparable to EVI
 */
exports.getEVI2 = function(image) {
    // EVI2 formula: 2.5 * (NIR - Red) / (NIR + 2.4*Red + 1)
    var exp = '2.5 * (b("nir") - b("red")) / (b("nir") + (2.4 * b("red")) + 1)';
    
    var evi2 = image.expression(exp).rename("evi2")
        .multiply(100)      // Scale to 0-100 range
        .byte();           // Convert to 8-bit
    
    return image.addBands(evi2);
};

/**
 * @name getHallCover
 * @description
 *     Calculates Hall Cover Index using a linear regression model.
 *     Hall Cover = (-Red * 0.017) - (NIR * 0.007) - (SWIR2 * 0.079) + 5.22
 *     
 *     Estimates fractional vegetation cover based on empirical relationships.
 *     Possibly derived from field measurements and regression analysis.
 * 
 * @param {ee.Image} image - Input image containing 'red', 'nir', and 'swir2' bands
 * 
 * @returns {ee.Image} - Input image with added 'hallcover' band (scaled by 100)
 * 
 * @note
 *     - Empirical model, coefficients may be region-specific
 *     - Results should be validated with ground truth data
 *     - Multiply by 100 to convert to percentage scale
 */
exports.getHallCover = function(image) {
    // Hall Cover empirical formula
    var exp = '( (-b("red") * 0.017) - (b("nir") * 0.007) - (b("swir2") * 0.079) + 5.22 )';
    
    var hallcover = image.expression(exp).rename("hallcover")
        .multiply(100);     // Scale to percentage
    
    return image.addBands(hallcover);
};

/**
 * @name getHallHeight
 * @description
 *     Calculates Hall Height Index using a linear regression model.
 *     Hall Height = (-Red * 0.039) - (NIR * 0.011) - (SWIR1 * 0.026) + 4.13
 *     
 *     Estimates vegetation height based on empirical relationships.
 *     Possibly derived from LiDAR or field measurement correlations.
 * 
 * @param {ee.Image} image - Input image containing 'red', 'nir', and 'swir1' bands
 * 
 * @returns {ee.Image} - Input image with added 'hallheight' band (scaled by 100)
 * 
 * @note
 *     - Empirical model, coefficients may be region-specific
 *     - Results should be validated with ground truth data
 *     - Multiply by 100 to convert to appropriate scale
 */
exports.getHallHeight = function(image) {
    // Hall Height empirical formula
    var exp = '( (-b("red") * 0.039) - (b("nir") * 0.011) - (b("swir1") * 0.026) + 4.13 )';
    
    var hallheight = image.expression(exp).rename("hallheight")
        .multiply(100);     // Scale to appropriate units
    
    return image.addBands(hallheight);
};

/**
 * @name getGCVI
 * @description
 *     Calculates Green Chlorophyll Vegetation Index (GCVI).
 *     GCVI = (NIR / Green) - 1
 *     
 *     GCVI is sensitive to chlorophyll content and green biomass.
 *     Alternative to NDVI with different sensitivity characteristics.
 *     
 *     Applications:
 *     - Chlorophyll content estimation
 *     - Crop nutrient status monitoring
 *     - Vegetation stress detection
 * 
 * @param {ee.Image} image - Input image containing 'nir' and 'green' bands
 * 
 * @returns {ee.Image} - Input image with added 'gcvi' band (0-100 range)
 * 
 * @note
 *     - Sensitive to chlorophyll absorption in green band
 *     - Less affected by soil background than some indices
 *     - Values typically positive for vegetation
 */
exports.getGCVI = function(image) {
    // GCVI formula: (NIR / Green) - 1
    var exp = 'b("nir") / b("green") - 1';
    
    var gcvi = image.expression(exp).rename("gcvi")
        .multiply(100)      // Scale to 0-100 range
        .byte();           // Convert to 8-bit
    
    return image.addBands(gcvi);
};

/**
 * COMPLETE WORKFLOW EXAMPLE:
 * 
 * // 1. Load and prepare Landsat image
 * var landsat = ee.Image('LANDSAT/LC08/C02/T1_L2/LC08_001001_20200101');
 * 
 * // 2. Scale to reflectance and rename bands
 * var scaled = landsat.select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'])
 *     .multiply(0.0000275).add(-0.2).multiply(10000)
 *     .rename(['blue', 'green', 'red', 'nir', 'swir1', 'swir2']);
 * 
 * // 3. Calculate all spectral indices
 * var withNDVI = exports.getNDVI(scaled);
 * var withNDWI = exports.getNDWI(withNDVI);
 * var withSAVI = exports.getSAVI(withNDWI);
 * var withPRI = exports.getPRI(withSAVI);
 * var withCAI = exports.getCAI(withPRI);
 * var withEVI = exports.getEVI(withCAI);
 * var withEVI2 = exports.getEVI2(withEVI);
 * var withHallCover = exports.getHallCover(withEVI2);
 * var withHallHeight = exports.getHallHeight(withHallCover);
 * var withAllIndices = exports.getGCVI(withHallHeight);
 * 
 * // 4. Extract specific indices for analysis
 * var ndviLayer = withAllIndices.select('ndvi');
 * var evi2Layer = withAllIndices.select('evi2');
 * var ndwiLayer = withAllIndices.select('ndwi');
 * 
 * // 5. Visualize results
 * Map.addLayer(ndviLayer, {min: 0, max: 100, palette: ['brown', 'yellow', 'green']}, 'NDVI');
 * Map.addLayer(evi2Layer, {min: 0, max: 100, palette: ['brown', 'yellow', 'green']}, 'EVI2');
 * Map.addLayer(ndwiLayer, {min: -50, max: 50, palette: ['blue', 'white', 'brown']}, 'NDWI');
 */

/**
 * INDEX SELECTION GUIDE:
 * 
 * 1. General Vegetation Health:
 *    - NDVI: Standard vegetation index, widely used
 *    - EVI2: Better for dense vegetation, less atmospheric effects
 * 
 * 2. Water and Moisture:
 *    - NDWI: Water bodies and vegetation water content
 * 
 * 3. Soil and Sparse Vegetation:
 *    - SAVI: Soil-adjusted, better for arid regions
 * 
 * 4. Plant Stress and Physiology:
 *    - PRI: Photosynthetic efficiency, plant stress
 *    - GCVI: Chlorophyll content
 * 
 * 5. Dry Vegetation and Residues:
 *    - CAI: Cellulose/lignin in dry vegetation
 * 
 * 6. Structural Properties:
 *    - Hall Cover: Fractional vegetation cover (empirical)
 *    - Hall Height: Vegetation height (empirical)
 */

/**
 * DATA QUALITY CONSIDERATIONS:
 * 
 * 1. Atmospheric Correction:
 *    - All indices benefit from surface reflectance data
 *    - Some indices (EVI) include atmospheric correction
 * 
 * 2. Scaling Factors:
 *    - All indices scaled by 100 for 8-bit storage (0-255)
 *    - Actual meaningful ranges typically 0-100 or -100 to 100
 * 
 * 3. Band Requirements:
 *    - Check required bands before calculating each index
 *    - Some sensors may lack specific bands (e.g., blue for EVI)
 * 
 * 4. Validation:
 *    - Empirical indices (Hall Cover/Height) need local validation
 *    - Compare with ground measurements when possible
 */

/**
 * PERFORMANCE OPTIMIZATION:
 * 
 * 1. Batch Processing:
 *    // Calculate multiple indices at once
 *    var indices = ['ndvi', 'evi2', 'ndwi', 'savi'];
 *    indices.forEach(function(index) {
 *        image = exports['get' + index.toUpperCase()](image);
 *    });
 * 
 * 2. Selective Calculation:
 *    // Calculate only needed indices to reduce processing time
 *    var neededIndices = {
 *        'forest': ['ndvi', 'evi2'],
 *        'agriculture': ['ndvi', 'savi', 'gcvi'],
 *        'water': ['ndwi', 'mndwi']
 *    };
 */

/**
 * COMMON PITFALLS:
 * 
 * 1. Saturation:
 *    - NDVI saturates in dense vegetation (>0.7-0.8)
 *    - Use EVI/EVI2 for high biomass areas
 * 
 * 2. Soil Background:
 *    - NDVI affected by bare soil in sparse vegetation
 *    - Use SAVI for soil-adjusted measurements
 * 
 * 3. Atmospheric Effects:
 *    - Haze and aerosols affect visible bands
 *    - Use atmosphere-resistant indices (EVI) or corrected data
 * 
 * 4. Seasonality:
 *    - Vegetation indices vary seasonally
 *    - Consider phenology in analysis and thresholds
 */