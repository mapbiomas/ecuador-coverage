/**
 * @name SmaAndNdfi.js
 * @description
 *     Spectral Mixture Analysis (SMA) and Normalized Difference Fraction Index (NDFI) calculations.
 *     Implements linear spectral unmixing and derived indices for vegetation and land cover analysis.
 *     Based on the CLASlite/CMS methodology for tropical forest monitoring.
 * 
 * @author MapBiomas
 * @version 1.0.0
 * 
 * @see
 *     - Souza Jr, C. M., et al. (2005). "Mapping forest degradation in the Amazon."
 *     - CLASlite/CMS methodology: Carnegie Institution for Science
 */

/**
 * Spectral endmembers configuration for linear unmixing.
 * Each endmember represents a "pure" spectral signature for a land cover component.
 * Values are reflectance scaled by 10000 (0-10000 range).
 * 
 * Endmember components:
 * 1. GV (Green Vegetation) - Photosynthetically active vegetation
 * 2. NPV (Non-Photosynthetic Vegetation) - Dead/dry vegetation, litter
 * 3. Soil - Bare soil and geological features
 * 4. Cloud - Cloud contamination (high reflectance in visible bands)
 * 
 * Band order: [blue, green, red, nir, swir1, swir2]
 * Reflectance range: 0-10000 (0-1 reflectance * 10000)
 */
exports.endmembers = {
    'landsat-4': [
        [119.0, 475.0, 169.0, 6250.0, 2399.0, 675.0],     /* GV - Green Vegetation */
        [1514.0, 1597.0, 1421.0, 3053.0, 7707.0, 1975.0], /* NPV - Non-Photosynthetic Vegetation */
        [1799.0, 2479.0, 3158.0, 5437.0, 7707.0, 6646.0], /* Soil - Bare Soil */
        [4031.0, 8714.0, 7900.0, 8989.0, 7002.0, 6607.0]  /* Cloud - Cloud Cover */
    ],
    'landsat-5': [
        [119.0, 475.0, 169.0, 6250.0, 2399.0, 675.0],     /* GV */
        [1514.0, 1597.0, 1421.0, 3053.0, 7707.0, 1975.0], /* NPV */
        [1799.0, 2479.0, 3158.0, 5437.0, 7707.0, 6646.0], /* Soil */
        [4031.0, 8714.0, 7900.0, 8989.0, 7002.0, 6607.0]  /* Cloud */
    ],
    'landsat-7': [
        [119.0, 475.0, 169.0, 6250.0, 2399.0, 675.0],     /* GV */
        [1514.0, 1597.0, 1421.0, 3053.0, 7707.0, 1975.0], /* NPV */
        [1799.0, 2479.0, 3158.0, 5437.0, 7707.0, 6646.0], /* Soil */
        [4031.0, 8714.0, 7900.0, 8989.0, 7002.0, 6607.0]  /* Cloud */
    ],
    'landsat-8': [
        [119.0, 475.0, 169.0, 6250.0, 2399.0, 675.0],     /* GV */
        [1514.0, 1597.0, 1421.0, 3053.0, 7707.0, 1975.0], /* NPV */
        [1799.0, 2479.0, 3158.0, 5437.0, 7707.0, 6646.0], /* Soil */
        [4031.0, 8714.0, 7900.0, 8989.0, 7002.0, 6607.0]  /* Cloud */
    ],
    'landsat-9': [
        [119.0, 475.0, 169.0, 6250.0, 2399.0, 675.0],     /* GV */
        [1514.0, 1597.0, 1421.0, 3053.0, 7707.0, 1975.0], /* NPV */
        [1799.0, 2479.0, 3158.0, 5437.0, 7707.0, 6646.0], /* Soil */
        [4031.0, 8714.0, 7900.0, 8989.0, 7002.0, 6607.0]  /* Cloud */
    ],
    'sentinel-2': [
        [119.0, 475.0, 169.0, 6250.0, 2399.0, 675.0],     /* GV */
        [1514.0, 1597.0, 1421.0, 3053.0, 7707.0, 1975.0], /* NPV */
        [1799.0, 2479.0, 3158.0, 5437.0, 7707.0, 6646.0], /* Soil */
        [4031.0, 8714.0, 7900.0, 8989.0, 7002.0, 6607.0]  /* Cloud */
    ],
};

/**
 * NDFI color palette for visualization.
 * Color progression from red (degraded) to green (healthy forest).
 * Format: RGB hexadecimal values separated by commas.
 * 
 * Color interpretation:
 * - Red/orange: High degradation, low forest cover
 * - Yellow: Moderate degradation
 * - Green: Healthy forest
 * - Blue: Non-forest, water, or cloud
 */
exports.ndfiColors = 
    'ffffff,fffcff,fff9ff,fff7ff,fff4ff,fff2ff,ffefff,ffecff,ffeaff,ffe7ff,' +
    'ffe5ff,ffe2ff,ffe0ff,ffddff,ffdaff,ffd8ff,ffd5ff,ffd3ff,ffd0ff,ffceff,' +
    'ffcbff,ffc8ff,ffc6ff,ffc3ff,ffc1ff,ffbeff,ffbcff,ffb9ff,ffb6ff,ffb4ff,' +
    'ffb1ff,ffafff,ffacff,ffaaff,ffa7ff,ffa4ff,ffa2ff,ff9fff,ff9dff,ff9aff,' +
    'ff97ff,ff95ff,ff92ff,ff90ff,ff8dff,ff8bff,ff88ff,ff85ff,ff83ff,ff80ff,' +
    'ff7eff,ff7bff,ff79ff,ff76ff,ff73ff,ff71ff,ff6eff,ff6cff,ff69ff,ff67ff,' +
    'ff64ff,ff61ff,ff5fff,ff5cff,ff5aff,ff57ff,ff55ff,ff52ff,ff4fff,ff4dff,' +
    'ff4aff,ff48ff,ff45ff,ff42ff,ff40ff,ff3dff,ff3bff,ff38ff,ff36ff,ff33ff,' +
    'ff30ff,ff2eff,ff2bff,ff29ff,ff26ff,ff24ff,ff21ff,ff1eff,ff1cff,ff19ff,' +
    'ff17ff,ff14ff,ff12ff,ff0fff,ff0cff,ff0aff,ff07ff,ff05ff,ff02ff,ff00ff,' +
    'ff00ff,ff0af4,ff15e9,ff1fdf,ff2ad4,ff35c9,ff3fbf,ff4ab4,ff55aa,ff5f9f,' +
    'ff6a94,ff748a,ff7f7f,ff8a74,ff946a,ff9f5f,ffaa55,ffb44a,ffbf3f,ffc935,' +
    'ffd42a,ffdf1f,ffe915,fff40a,ffff00,ffff00,fffb00,fff700,fff300,fff000,' +
    'ffec00,ffe800,ffe400,ffe100,ffdd00,ffd900,ffd500,ffd200,ffce00,ffca00,' +
    'ffc600,ffc300,ffbf00,ffbb00,ffb700,ffb400,ffb000,ffac00,ffa800,ffa500,' +
    'ffa500,f7a400,f0a300,e8a200,e1a200,d9a100,d2a000,ca9f00,c39f00,bb9e00,' +
    'b49d00,ac9c00,a59c00,9d9b00,969a00,8e9900,879900,7f9800,789700,709700,' +
    '699600,619500,5a9400,529400,4b9300,439200,349100,2d9000,258f00,1e8e00,' +
    '168e00,0f8d00,078c00,008c00,008c00,008700,008300,007f00,007a00,007600,' +
    '007200,006e00,006900,006500,006100,005c00,005800,005400,005000,004c00';

/**
 * @name getFractions
 * @description
 *     Performs Linear Spectral Mixture Analysis (LSMA) to estimate fractional cover
 *     of four components: Green Vegetation (GV), Non-Photosynthetic Vegetation (NPV),
 *     Soil, and Cloud. Also calculates shade fraction.
 *     
 *     Methodology:
 *     1. Linear unmixing solves: R_pixel = Σ(f_i * R_endmember_i) + ε
 *     2. Constraints: f_i ≥ 0, Σf_i ≤ 1
 *     3. Results scaled to 0-100% (0-100 range)
 *     4. Shade calculated as residual: 100 - Σ(GV+NPV+Soil)
 * 
 * @param {ee.Image} image - Input image with spectral bands [blue, green, red, nir, swir1, swir2]
 * @param {Array} endmembers - 2D array of endmember spectra [4 endmembers × 6 bands]
 * 
 * @returns {ee.Image} - Image with added fractional bands: 'gv', 'npv', 'soil', 'cloud', 'shade'
 * 
 * @example
 *     var landsatImage = ee.Image('LANDSAT/LC08/C02/T1_L2/LC08_001001_20200101');
 *     
 *     // Scale to reflectance
 *     var scaled = landsatImage.select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'])
 *         .multiply(0.0000275).add(-0.2).multiply(10000)
 *         .rename(['blue', 'green', 'red', 'nir', 'swir1', 'swir2']);
 *     
 *     var endmembers = exports.endmembers['landsat-8'];
 *     var fractions = getFractions(scaled, endmembers);
 *     
 *     // Visualize GV fraction
 *     Map.addLayer(fractions.select('gv'), {min: 0, max: 100, palette: ['white', 'green']}, 'GV Fraction');
 * 
 * @note
 *     - Uses constrained linear unmixing (non-negative)
 *     - Assumes endmembers are representative of the study area
 *     - Cloud endmember helps identify and mask cloud contamination
 *     - Shade indicates canopy closure, topography, or cloud shadows
 */
exports.getFractions = function(image, endmembers) {
    var outBandNames = ['gv', 'npv', 'soil', 'cloud'];
    
    // Perform linear spectral unmixing
    var fractions = ee.Image(image)
        .select(['blue', 'green', 'red', 'nir', 'swir1', 'swir2'])
        .unmix(endmembers)      // Linear unmixing with non-negative constraint
        .max(0)                 // Ensure non-negative fractions
        .multiply(100)          // Convert to percentage (0-100)
        .byte();               // Store as 8-bit integer (0-255, but values 0-100)
    
    fractions = fractions.rename(outBandNames);
    
    // Calculate shade as residual fraction (100 - sum of other fractions)
    var summed = fractions.expression('b("gv") + b("npv") + b("soil")');
    var shade = summed
        .subtract(100)          // Shade = 100 - (GV + NPV + Soil)
        .abs()                  // Absolute value (handles cases where sum > 100)
        .byte()                 // Store as 8-bit integer
        .rename("shade");
    
    // Add fraction bands to original image
    image = image.addBands(fractions);
    image = image.addBands(shade);
    
    return image;
};

/**
 * @name getNDFI
 * @description
 *     Calculates Normalized Difference Fraction Index (NDFI).
 *     NDFI = (GVS - (NPV+Soil)) / (GVS + (NPV+Soil))
 *     Where GVS = (GV / (GV+NPV+Soil)) * 100 (Green Vegetation + Shade adjusted)
 *     
 *     NDFI ranges from -1 to 1, rescaled to 0-200 for visualization.
 *     High NDFI values indicate healthy forest, low values indicate degradation.
 * 
 * @param {ee.Image} imageFractions - Image containing fractional bands ('gv', 'npv', 'soil')
 * 
 * @returns {ee.Image} - Image with added 'gvs' and 'ndfi' bands
 * 
 * @example
 *     var fractions = getFractions(image, endmembers);
 *     var withNDFI = getNDFI(fractions);
 *     
 *     // Visualize NDFI
 *     Map.addLayer(withNDFI.select('ndfi'), {
 *         min: 0,
 *         max: 200,
 *         palette: exports.ndfiColors
 *     }, 'NDFI');
 * 
 * @note
 *     - NDFI is sensitive to forest degradation and regrowth
 *     - Values near 100 indicate healthy forest
 *     - Values below 50 indicate significant degradation
 *     - Useful for monitoring forest disturbance and recovery
 */
exports.getNDFI = function(imageFractions) {
    // Calculate sum of GV, NPV, and Soil fractions
    var summed = imageFractions.expression('b("gv") + b("npv") + b("soil")');
    
    // Calculate GVS (Green Vegetation + Shade adjusted)
    var gvs = imageFractions.select("gv")
        .divide(summed)          // GV proportion of total
        .multiply(100)           // Scale to 0-100
        .byte()                  // Convert to 8-bit
        .rename("gvs");
    
    // Calculate NPV+Soil sum
    var npvSoil = imageFractions.expression('b("npv") + b("soil")');
    
    // Calculate NDFI: (GVS - (NPV+Soil)) / (GVS + (NPV+Soil))
    var ndfi = ee.Image.cat(gvs, npvSoil)
        .normalizedDifference()   // (b1 - b2) / (b1 + b2)
        .rename('ndfi');
    
    // Rescale NDFI from [-1, 1] to [0, 200] for visualization
    ndfi = ndfi.expression('byte(b("ndfi") * 100 + 100)');
    
    // Add GVS and NDFI bands to image
    imageFractions = imageFractions.addBands(gvs);
    imageFractions = imageFractions.addBands(ndfi);
    
    return imageFractions;
};

/**
 * @name getSEFI
 * @description
 *     Calculates Shade-Enhanced Fraction Index (SEFI).
 *     SEFI = ((GV+NPV)/(GV+NPV+Soil) - Soil) / ((GV+NPV)/(GV+NPV+Soil) + Soil)
 *     
 *     Enhanced sensitivity to soil exposure and vegetation-soil mixtures.
 * 
 * @param {ee.Image} imageFractions - Image containing fractional bands
 * 
 * @returns {ee.Image} - Image with added 'sefi' band
 * 
 * @note
 *     - Useful for detecting bare soil exposure
 *     - Sensitive to early stages of degradation
 *     - Helps distinguish between different types of non-forest areas
 */
exports.getSEFI = function(imageFractions) {
    var summed = imageFractions.expression('b("gv") + b("npv") + b("soil")');
    var soil = imageFractions.select('soil');
    var npv = imageFractions.select('npv');
    var gv = imageFractions.select('gv');
    
    // Calculate (GV+NPV) proportion of total
    var gvnpv_s = (gv.add(npv).divide(summed)).multiply(100);
    
    // Calculate SEFI: (GVNPV_proportion - Soil) / (GVNPV_proportion + Soil)
    var sefi = ee.Image.cat(gvnpv_s, soil)
        .normalizedDifference()
        .rename('sefi');
    
    // Rescale from [-1, 1] to [0, 200]
    sefi = sefi.expression('byte(b("sefi") * 100 + 100)');
    
    imageFractions = imageFractions.addBands(sefi);
    
    return imageFractions;
};

/**
 * @name getWEFI
 * @description
 *     Calculates Water-Enhanced Fraction Index (WEFI).
 *     WEFI = (GV+NPV - (Soil+Shade)) / (GV+NPV + (Soil+Shade))
 *     
 *     Enhanced sensitivity to water and flooded vegetation.
 * 
 * @param {ee.Image} imageFractions - Image containing fractional bands
 * 
 * @returns {ee.Image} - Image with added 'wefi' band
 * 
 * @note
 *     - Useful for detecting flooded forests and wetlands
 *     - Sensitive to soil moisture and water content
 *     - Helps identify riparian zones and hydrologic features
 */
exports.getWEFI = function(imageFractions) {
    var summed = imageFractions.expression('b("gv") + b("npv") + b("soil")');
    var soil = imageFractions.select('soil');
    var npv = imageFractions.select('npv');
    var gv = imageFractions.select('gv');
    
    // Calculate shade as residual
    var shd = summed.subtract(100).abs().byte();
    
    // Calculate GV+NPV and Soil+Shade
    var gvnpv = gv.add(npv);
    var soilshade = soil.add(shd);
    
    // Calculate WEFI: (GV+NPV - (Soil+Shade)) / (GV+NPV + (Soil+Shade))
    var wefi = ee.Image.cat(gvnpv, soilshade)
        .normalizedDifference()
        .rename('wefi');
    
    // Rescale from [-1, 1] to [0, 200]
    wefi = wefi.expression('byte(b("wefi") * 100 + 100)');
    
    imageFractions = imageFractions.addBands(wefi);
    
    return imageFractions;
};

/**
 * @name getFNS
 * @description
 *     Calculates Forest-Nonforest Separation Index (FNS).
 *     FNS = (GV+Shade - Soil) / (GV+Shade + Soil)
 *     
 *     Designed to separate forest from non-forest areas.
 * 
 * @param {ee.Image} imageFractions - Image containing fractional bands
 * 
 * @returns {ee.Image} - Image with added 'fns' band
 * 
 * @note
 *     - Useful for forest/non-forest classification
 *     - Sensitive to forest canopy closure
 *     - Helps distinguish between forest and agriculture/urban areas
 */
exports.getFNS = function(imageFractions) {
    var summed = imageFractions.expression('b("gv") + b("npv") + b("soil")');
    var soil = imageFractions.select('soil');
    var gv = imageFractions.select('gv');
    
    // Calculate shade as residual
    var shd = summed.subtract(100).abs().byte();
    
    // Calculate GV+Shade
    var gvshade = gv.add(shd);
    
    // Calculate FNS: (GV+Shade - Soil) / (GV+Shade + Soil)
    var fns = ee.Image.cat(gvshade, soil)
        .normalizedDifference()
        .rename('fns');
    
    // Rescale from [-1, 1] to [0, 200]
    fns = fns.expression('byte(b("fns") * 100 + 100)');
    
    imageFractions = imageFractions.addBands(fns);
    
    return imageFractions;
};

/**
 * COMPLETE WORKFLOW EXAMPLE:
 * 
 * // 1. Load and prepare image
 * var landsat = ee.Image('LANDSAT/LC08/C02/T1_L2/LC08_001001_20200101');
 * 
 * // 2. Scale to reflectance and rename bands
 * var scaled = landsat.select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'])
 *     .multiply(0.0000275).add(-0.2).multiply(10000)
 *     .rename(['blue', 'green', 'red', 'nir', 'swir1', 'swir2']);
 * 
 * // 3. Get endmembers for Landsat 8
 * var endmembers = exports.endmembers['landsat-8'];
 * 
 * // 4. Calculate fractional cover
 * var fractions = exports.getFractions(scaled, endmembers);
 * 
 * // 5. Calculate all derived indices
 * var withNDFI = exports.getNDFI(fractions);
 * var withSEFI = exports.getSEFI(withNDFI);
 * var withWEFI = exports.getWEFI(withSEFI);
 * var withAllIndices = exports.getFNS(withWEFI);
 * 
 * // 6. Extract specific indices for analysis
 * var ndfi = withAllIndices.select('ndfi');
 * var gvFraction = withAllIndices.select('gv');
 * var shade = withAllIndices.select('shade');
 * 
 * // 7. Visualize results
 * Map.addLayer(ndfi, {min: 0, max: 200, palette: exports.ndfiColors}, 'NDFI');
 * Map.addLayer(gvFraction, {min: 0, max: 100, palette: ['white', 'green']}, 'GV Fraction');
 * Map.addLayer(shade, {min: 0, max: 100, palette: ['white', 'black']}, 'Shade');
 */

/**
 * APPLICATION NOTES:
 * 
 * 1. Forest Monitoring:
 *    - NDFI > 100: Healthy, intact forest
 *    - NDFI 50-100: Degraded or secondary forest
 *    - NDFI < 50: Severely degraded or non-forest
 * 
 * 2. Land Cover Classification:
 *    - GV: Photosynthetic vegetation (forest, crops, pasture)
 *    - NPV: Dry vegetation, litter, crop residues
 *    - Soil: Bare soil, urban areas, roads
 *    - Cloud: Cloud contamination (mask or remove)
 *    - Shade: Canopy closure, topography, cloud shadows
 * 
 * 3. Change Detection:
 *    - Decreasing NDFI: Forest degradation or deforestation
 *    - Increasing NDFI: Forest recovery or regrowth
 *    - GV changes: Vegetation growth or removal
 *    - Soil changes: Land clearing or erosion
 * 
 * 4. Quality Control:
 *    - Check fraction sums (should be ~100% for valid pixels)
 *    - High cloud fraction indicates contamination
 *    - Unreasonable fractions may indicate poor endmember fit
 */

/**
 * LIMITATIONS AND CONSIDERATIONS:
 * 
 * 1. Endmember Selection:
 *    - Endmembers should be representative of local conditions
 *    - Different biomes may require different endmembers
 *    - Seasonal variations affect endmember spectra
 * 
 * 2. Atmospheric Conditions:
 *    - Assumes proper atmospheric correction
 *    - Haze and aerosols can affect results
 *    - Cloud shadows not explicitly modeled
 * 
 * 3. Spatial Resolution:
 *    - 30m resolution may mix multiple cover types
 *    - Sub-pixel heterogeneity affects unmixing accuracy
 *    - Topographic effects not accounted for
 * 
 * 4. Temporal Considerations:
 *    - Phenology affects vegetation spectra
 *    - Soil moisture affects soil reflectance
 *    - Best results from dry season imagery
 */