/**
 * @name Miscellaneous.js
 * @description
 *     Miscellaneous terrain and texture analysis functions for MapBiomas.
 *     Provides topographic and textural feature extraction for land cover classification.
 * 
 * @author MapBiomas
 * @version 1.0.0
 */

/**
 * @name getSlope
 * @description
 *     Extracts slope information from digital elevation data and adds it as a band.
 *     Uses JAXA's ALOS AW3D30 global digital surface model (30m resolution).
 *     Slope is calculated in degrees, multiplied by 100, and converted to int16 for storage efficiency.
 *     
 *     The slope band is important for:
 *     - Distinguishing terrain features (flat vs. steep areas)
 *     - Identifying areas prone to erosion
 *     - Separating different land cover types with topographic constraints
 *     - Modeling hydrological processes
 * 
 * @param {ee.Image} image - Input image to which slope band will be added
 * 
 * @returns {ee.Image} - Input image with added 'slope' band as int16 type
 * 
 * @example
 *     // Add slope information to a Landsat composite
 *     var landsatComposite = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
 *         .filterDate('2020-01-01', '2020-12-31')
 *         .median();
 *     
 *     var imageWithSlope = getSlope(landsatComposite);
 *     
 *     // Visualize slope
 *     Map.addLayer(imageWithSlope.select('slope'), {
 *         min: 0,
 *         max: 5000,  // 50 degrees (multiplied by 100)
 *         palette: ['green', 'yellow', 'red']
 *     }, 'Slope');
 * 
 * @note
 *     - Uses JAXA ALOS AW3D30 V1.1 digital surface model (DSM)
 *     - Slope calculated in degrees using ee.Terrain.slope()
 *     - Values multiplied by 100 to preserve precision when converting to int16
 *     - int16 range: -32768 to 32767 (covers -327.68 to 327.67 degrees)
 * 
 * @see
 *     - JAXA ALOS AW3D30 documentation: https://developers.google.com/earth-engine/datasets/catalog/JAXA_ALOS_AW3D30_V1_1
 *     - Earth Engine Terrain functions: https://developers.google.com/earth-engine/apidocs/ee-terrain-slope
 */
exports.getSlope = function(image) {
    // Load JAXA ALOS AW3D30 global digital surface model (30m resolution)
    // AVE band contains the average elevation (digital surface model)
    var terrain = ee.Image("JAXA/ALOS/AW3D30_V1_1").select("AVE");
    
    // Calculate slope in degrees using Earth Engine's terrain algorithm
    // Multiply by 100 to preserve precision when converting to integer
    // Convert to int16 for efficient storage (signed integer allows negative slopes)
    var slope = ee.Terrain.slope(terrain)
        .multiply(100)      // Scale to preserve decimal precision
        .int16()           // Convert to signed 16-bit integer
        .rename('slope');  // Standardize band name
    
    // Add slope band to input image
    return image.addBands(slope);
};

/**
 * @name getEntropyG
 * @description
 *     Calculates texture entropy from the green band and adds it as a feature band.
 *     Entropy measures the randomness or complexity of pixel values in a neighborhood,
 *     which is useful for identifying textural patterns in vegetation and land cover.
 *     
 *     The entropy band is important for:
 *     - Distinguishing between homogeneous and heterogeneous areas
 *     - Identifying texture patterns in vegetation canopies
 *     - Detecting forest structure and density variations
 *     - Separating agricultural fields from natural vegetation
 * 
 * @param {ee.Image} image - Input image containing 'green_median' band
 * 
 * @returns {ee.Image} - Input image with added 'green_median_texture' band as calculated entropy
 * 
 * @example
 *     // Calculate green band texture entropy
 *     var landsatComposite = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
 *         .filterDate('2020-01-01', '2020-12-31')
 *         .median();
 *     
 *     var imageWithTexture = getEntropyG(landsatComposite);
 *     
 *     // Visualize texture entropy
 *     Map.addLayer(imageWithTexture.select('green_median_texture'), {
 *         min: 0,
 *         max: 100,
 *         palette: ['blue', 'green', 'yellow', 'red']
 *     }, 'Green Band Texture Entropy');
 * 
 * @note
 *     - Uses a 5x5 pixel square kernel (11x11 pixel neighborhood including center)
 *     - Converts green band to int32 for entropy calculation
 *     - Multiplies result by 100 to scale for better visualization/storage
 *     - Texture is calculated on the green band as it often shows good contrast for vegetation
 * 
 * @see
 *     - Entropy definition in image processing: https://en.wikipedia.org/wiki/Entropy_(information_theory)
 *     - Earth Engine entropy method: https://developers.google.com/earth-engine/apidocs/ee-image-entropy
 *     - Texture analysis for land cover classification: Various remote sensing literature
 */
exports.getEntropyG = function(image) {
    // Define a 5x5 square kernel for texture analysis
    // Radius of 5 creates an 11x11 neighborhood (2*radius + 1)
    var squareKernel = ee.Kernel.square({ radius: 5 });
    
    // Calculate entropy on the green median band
    var entropyG = image.select('green_median')
        .int32()                    // Convert to 32-bit integer for entropy calculation
        // .divide(10000)            // Optional: Normalize reflectance values (commented out)
        .entropy(squareKernel)     // Calculate Shannon entropy in the kernel neighborhood
        .multiply(100)             // Scale for better visualization and storage
        .rename("green_median_texture");  // Standardize band name
    
    // Add texture band to input image
    return image.addBands(entropyG);
};

/**
 * NOTES:
 * 1. Slope calculation:
 *    - Uses ALOS AW3D30 DSM which includes vegetation and buildings (not bare earth)
 *    - For bare earth topography, consider using SRTM or other DTM products
 *    - Slope values in degrees: 0° = flat, 45° = very steep, >60° = cliffs
 *    - Multiplication by 100 allows storing 2 decimal places in integer format
 * 
 * 2. Texture entropy:
 *    - Entropy measures randomness: high entropy = complex texture, low entropy = uniform
 *    - 5x5 kernel radius was chosen as a compromise between local detail and computational cost
 *    - Green band often shows good texture for vegetation due to chlorophyll absorption
 *    - Other bands (NIR, SWIR) could also be used for texture analysis
 * 
 * 3. Data type considerations:
 *    - Slope stored as int16: sufficient range for all terrain slopes on Earth
 *    - Texture stored as scaled values: multiplication by 100 preserves precision
 * 
 * 4. Applications in MapBiomas:
 *    - Slope helps distinguish:
 *        * Flat agriculture vs. terraced agriculture
 *        * Lowland vs. montane forests
 *        * Areas suitable for different land uses
 *    - Texture helps distinguish:
 *        * Homogeneous crops vs. heterogeneous natural vegetation
 *        * Different forest types based on canopy structure
 *        * Urban areas with complex textures
 */

/**
 * USAGE EXAMPLES:
 * 
 * // Complete feature extraction for classification
 * var composite = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
 *     .filterDate('2020-01-01', '2020-12-31')
 *     .median();
 * 
 * // Add topographic feature
 * var withSlope = getSlope(composite);
 * 
 * // Add texture feature
 * var withFeatures = getEntropyG(withSlope);
 * 
 * // Extract specific bands for visualization
 * var slopeLayer = withFeatures.select('slope');
 * var textureLayer = withFeatures.select('green_median_texture');
 * 
 * // Use in classification
 * var trainingData = ee.FeatureCollection('projects/.../training_points');
 * var classifier = ee.Classifier.smileRandomForest(100)
 *     .train({
 *         features: trainingData,
 *         classProperty: 'landcover',
 *         inputProperties: ['blue_median', 'green_median', 'red_median', 
 *                          'nir_median', 'swir1_median', 'swir2_median',
 *                          'slope', 'green_median_texture']
 *     });
 * 
 * var classified = withFeatures.classify(classifier);
 */

/**
 * EXTENSION IDEAS:
 * 
 * // Additional topographic features
 * exports.getAspect = function(image) {
 *     var terrain = ee.Image("JAXA/ALOS/AW3D30_V1_1").select("AVE");
 *     var aspect = ee.Terrain.aspect(terrain)
 *         .int16()
 *         .rename('aspect');
 *     return image.addBands(aspect);
 * };
 * 
 * // Hillshade for visualization
 * exports.getHillshade = function(image) {
 *     var terrain = ee.Image("JAXA/ALOS/AW3D30_V1_1").select("AVE");
 *     var hillshade = ee.Terrain.hillshade(terrain)
 *         .uint8()
 *         .rename('hillshade');
 *     return image.addBands(hillshade);
 * };
 * 
 * // Multiple texture measures
 * exports.getTextureMeasures = function(image) {
 *     var kernel = ee.Kernel.square({ radius: 3 });
 *     
 *     var gray = image.select('green_median').int32();
 *     
 *     var contrast = gray.reduceNeighborhood({
 *         reducer: ee.Reducer.stdDev(),
 *         kernel: kernel
 *     }).rename('texture_contrast');
 *     
 *     var homogeneity = gray.reduceNeighborhood({
 *         reducer: ee.Reducer.mean(),
 *         kernel: kernel
 *     }).divide(gray).rename('texture_homogeneity');
 *     
 *     return image.addBands([contrast, homogeneity]);
 * };
 */