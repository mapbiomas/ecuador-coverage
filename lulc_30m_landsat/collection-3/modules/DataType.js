/**
 * @name DataType.js
 * @description
 *     Band data type specifications and conversion functions for MapBiomas projects.
 *     Defines standardized data types for spectral bands, indices, and derived features
 *     across different MapBiomas regional initiatives.
 * 
 * @author MapBiomas
 * @version 1.0.0
 */

/**
 * Band specifications configuration for different MapBiomas projects
 * Each project configuration contains an array of [band_name, data_type] pairs
 * 
 * Data type considerations:
 * - uint8: 0-255 range, used for normalized indices (0-1 scaled to 0-255)
 * - uint16: 0-65535 range, used for spectral reflectance values (0-10000 scale)
 * - uint32: 0-4294967295 range, used for variance/standard deviation
 * - int16: -32768 to 32767 range, used for signed values like slope
 */
var bandsSpecifications = {
    /**
     * MapBiomas Brazil - Complete feature set
     * Used for Brazilian land cover monitoring with full spectral-temporal features
     */
    'mapbiomas-brazil': [
        // Spectral bands - median reflectance values (dry/wet seasons)
        ["blue_median", "uint16"],
        ["blue_median_wet", "uint16"],
        ["blue_median_dry", "uint16"],
        ["blue_min", "uint16"],
        ["blue_stdDev", "uint32"],
        
        ["green_median", "uint16"],
        ["green_median_dry", "uint16"],
        ["green_median_wet", "uint16"],
        ["green_median_texture", "int16"],  // Texture feature (can be negative)
        ["green_min", "uint16"],
        ["green_stdDev", "uint32"],
        
        ["red_median", "uint16"],
        ["red_median_dry", "uint16"],
        ["red_min", "uint16"],
        ["red_median_wet", "uint16"],
        ["red_stdDev", "uint32"],
        
        ["nir_median", "uint16"],
        ["nir_median_dry", "uint16"],
        ["nir_median_wet", "uint16"],
        ["nir_min", "uint16"],
        ["nir_stdDev", "uint32"],
        
        ["swir1_median", "uint16"],
        ["swir1_median_dry", "uint16"],
        ["swir1_median_wet", "uint16"],
        ["swir1_min", "uint16"],
        ["swir1_stdDev", "uint32"],
        
        ["swir2_median", "uint16"],
        ["swir2_median_wet", "uint16"],
        ["swir2_median_dry", "uint16"],
        ["swir2_min", "uint16"],
        ["swir2_stdDev", "uint32"],
        
        // Vegetation indices - normalized to uint8 (0-255)
        ["ndvi_median_dry", "uint8"],
        ["ndvi_median_wet", "uint8"],
        ["ndvi_median", "uint8"],
        ["ndvi_amp", "uint8"],        // Amplitude (seasonal variation)
        ["ndvi_stdDev", "uint32"],
        
        ["ndwi_median", "uint8"],
        ["ndwi_median_dry", "uint8"],
        ["ndwi_median_wet", "uint8"],
        ["ndwi_amp", "uint8"],
        ["ndwi_stdDev", "uint32"],
        
        ["evi2_median", "uint8"],
        ["evi2_median_dry", "uint8"],
        ["evi2_median_wet", "uint8"],
        ["evi2_amp", "uint8"],
        ["evi2_stdDev", "uint32"],
        
        ["savi_median_dry", "uint8"],
        ["savi_median_wet", "uint8"],
        ["savi_median", "uint8"],
        ["savi_stdDev", "uint32"],
        
        ["pri_median_dry", "uint8"],  // Photochemical Reflectance Index
        ["pri_median", "uint8"],
        ["pri_median_wet", "uint8"],
        
        ["gcvi_median", "uint8"],     // Green Chlorophyll Vegetation Index
        ["gcvi_median_dry", "uint8"],
        ["gcvi_median_wet", "uint8"],
        ["gcvi_stdDev", "uint32"],
        
        // Fractional cover and SMA (Spectral Mixture Analysis)
        ["hallcover_median", "uint16"],  // Fractional cover
        ["hallcover_stdDev", "uint32"],
        
        ["cai_median", "uint8"],      // Cellulose Absorption Index
        ["cai_median_dry", "uint8"],
        ["cai_stdDev", "uint32"],
        
        ["gv_median", "uint8"],       // Green Vegetation fraction
        ["gv_amp", "uint8"],
        ["gv_stdDev", "uint32"],
        
        ["gvs_median", "uint8"],      // Green Vegetation + Shadow fraction
        ["gvs_median_dry", "uint8"],
        ["gvs_median_wet", "uint8"],
        ["gvs_stdDev", "uint32"],
        
        ["npv_median", "uint8"],      // Non-Photosynthetic Vegetation
        ["soil_median", "uint8"],     // Bare Soil fraction
        ["soil_amp", "uint8"],
        ["soil_stdDev", "uint32"],
        
        // Cloud and shadow features
        ["cloud_median", "uint8"],
        ["cloud_stdDev", "uint32"],
        ["shade_median", "uint8"],
        ["shade_stdDev", "uint32"],
        
        // NDFI (Normalized Difference Fraction Index) and derivatives
        ["ndfi_median", "uint8"],
        ["ndfi_median_dry", "uint8"],
        ["ndfi_median_wet", "uint8"],
        ["ndfi_amp", "uint8"],
        ["ndfi_stdDev", "uint32"],
        
        ["sefi_median", "uint8"],     // Something?
        ["sefi_stdDev", "uint32"],
        ["sefi_median_dry", "uint8"],
        
        ["wefi_median", "uint8"],     // Something?
        ["wefi_median_wet", "uint8"],
        ["wefi_amp", "uint8"],
        ["wefi_stdDev", "uint32"],
        
        ["fns_median", "uint8"],      // Something?
        ["fns_median_dry", "uint8"],
        ["fns_stdDev", "uint32"],
        
        // Topographic feature
        ["slope", "int16"],           // Can be negative (signed integer)
    ],

    /**
     * MapBiomas Indonesia - Similar to Brazil with complete feature set
     * Adapted for Indonesian tropical ecosystems
     */
    'mapbiomas-indonesia': [
        // Same comprehensive feature set as Brazil
        ["blue_median", "uint16"],
        ["blue_median_wet", "uint16"],
        ["blue_median_dry", "uint16"],
        ["blue_min", "uint16"],
        ["blue_stdDev", "uint32"],
        ["green_median", "uint16"],
        ["green_median_dry", "uint16"],
        ["green_median_wet", "uint16"],
        ["green_median_texture", "int16"],
        ["green_min", "uint16"],
        ["green_stdDev", "uint32"],
        ["red_median", "uint16"],
        ["red_median_dry", "uint16"],
        ["red_min", "uint16"],
        ["red_median_wet", "uint16"],
        ["red_stdDev", "uint32"],
        ["nir_median", "uint16"],
        ["nir_median_dry", "uint16"],
        ["nir_median_wet", "uint16"],
        ["nir_min", "uint16"],
        ["nir_stdDev", "uint32"],
        ["swir1_median", "uint16"],
        ["swir1_median_dry", "uint16"],
        ["swir1_median_wet", "uint16"],
        ["swir1_min", "uint16"],
        ["swir1_stdDev", "uint32"],
        ["swir2_median", "uint16"],
        ["swir2_median_wet", "uint16"],
        ["swir2_median_dry", "uint16"],
        ["swir2_min", "uint16"],
        ["swir2_stdDev", "uint32"],
        ["ndvi_median_dry", "uint8"],
        ["ndvi_median_wet", "uint8"],
        ["ndvi_median", "uint8"],
        ["ndvi_amp", "uint8"],
        ["ndvi_stdDev", "uint32"],
        ["ndwi_median", "uint8"],
        ["ndwi_median_dry", "uint8"],
        ["ndwi_median_wet", "uint8"],
        ["ndwi_amp", "uint8"],
        ["ndwi_stdDev", "uint32"],
        ["evi2_median", "uint8"],
        ["evi2_median_dry", "uint8"],
        ["evi2_median_wet", "uint8"],
        ["evi2_amp", "uint8"],
        ["evi2_stdDev", "uint32"],
        ["savi_median_dry", "uint8"],
        ["savi_median_wet", "uint8"],
        ["savi_median", "uint8"],
        ["savi_stdDev", "uint32"],
        ["pri_median_dry", "uint8"],
        ["pri_median", "uint8"],
        ["pri_median_wet", "uint8"],
        ["gcvi_median", "uint8"],
        ["gcvi_median_dry", "uint8"],
        ["gcvi_median_wet", "uint8"],
        ["gcvi_stdDev", "uint32"],
        ["hallcover_median", "uint16"],
        ["hallcover_stdDev", "uint32"],
        ["cai_median", "uint8"],
        ["cai_median_dry", "uint8"],
        ["cai_stdDev", "uint32"],
        ["gv_median", "uint8"],
        ["gv_amp", "uint8"],
        ["gv_stdDev", "uint32"],
        ["gvs_median", "uint8"],
        ["gvs_median_dry", "uint8"],
        ["gvs_median_wet", "uint8"],
        ["gvs_stdDev", "uint32"],
        ["npv_median", "uint8"],
        ["soil_median", "uint8"],
        ["soil_amp", "uint8"],
        ["soil_stdDev", "uint32"],
        ["cloud_median", "uint8"],
        ["cloud_stdDev", "uint32"],
        ["shade_median", "uint8"],
        ["shade_stdDev", "uint32"],
        ["ndfi_median", "uint8"],
        ["ndfi_median_dry", "uint8"],
        ["ndfi_median_wet", "uint8"],
        ["ndfi_amp", "uint8"],
        ["ndfi_stdDev", "uint32"],
        ["sefi_median", "uint8"],
        ["sefi_stdDev", "uint32"],
        ["sefi_median_dry", "uint8"],
        ["wefi_median", "uint8"],
        ["wefi_median_wet", "uint8"],
        ["wefi_amp", "uint8"],
        ["wefi_stdDev", "uint32"],
        ["fns_median", "uint8"],
        ["fns_median_dry", "uint8"],
        ["fns_stdDev", "uint32"],
        ["slope", "int16"],
    ],

    /**
     * MapBiomas Africa Trinational - Optimized feature set
     * Reduced feature set for efficiency in African ecosystems
     * Commented out bands are excluded for this region
     */
    'mapbiomas-af-trinacional': [
        ["blue_median", "uint16"],
        ["blue_median_wet", "uint16"],
        ["blue_median_dry", "uint16"],
        ["blue_min", "uint16"],
        ["blue_stdDev", "uint32"],
        ["green_median", "uint16"],
        ["green_median_dry", "uint16"],
        ["green_median_wet", "uint16"],
        ["green_median_texture", "int16"],
        ["green_min", "uint16"],
        ["green_stdDev", "uint32"],
        ["red_median", "uint16"],
        ["red_median_dry", "uint16"],
        ["red_min", "uint16"],
        ["red_median_wet", "uint16"],
        ["red_stdDev", "uint32"],
        ["nir_median", "uint16"],
        ["nir_median_dry", "uint16"],
        ["nir_median_wet", "uint16"],
        ["nir_min", "uint16"],
        ["nir_stdDev", "uint32"],
        ["swir1_median", "uint16"],
        ["swir1_median_dry", "uint16"],
        ["swir1_median_wet", "uint16"],
        ["swir1_min", "uint16"],
        ["swir1_stdDev", "uint32"],
        ["swir2_median", "uint16"],
        ["swir2_median_wet", "uint16"],
        ["swir2_median_dry", "uint16"],
        ["swir2_min", "uint16"],
        ["swir2_stdDev", "uint32"],
        ["ndvi_median_dry", "uint8"],
        ["ndvi_median_wet", "uint8"],
        ["ndvi_median", "uint8"],
        ["ndvi_amp", "uint8"],
        ["ndvi_stdDev", "uint32"],
        ["ndwi_median", "uint8"],
        ["ndwi_median_dry", "uint8"],
        ["ndwi_median_wet", "uint8"],
        ["ndwi_amp", "uint8"],
        // ["ndwi_stdDev", "uint32"],  // Excluded for efficiency
        ["evi2_median", "uint8"],
        ["evi2_median_dry", "uint8"],
        ["evi2_median_wet", "uint8"],
        ["evi2_amp", "uint8"],
        ["evi2_stdDev", "uint32"],
        ["savi_median_dry", "uint8"],
        ["savi_median_wet", "uint8"],
        ["savi_median", "uint8"],
        // ["savi_stdDev", "uint32"],  // Excluded for efficiency
        ["pri_median_dry", "uint8"],
        ["pri_median", "uint8"],
        // ["pri_median_wet", "uint8"],  // Excluded for efficiency
        ["gcvi_median", "uint8"],
        ["gcvi_median_dry", "uint8"],
        ["gcvi_median_wet", "uint8"],
        ["gcvi_stdDev", "uint32"],
        ["hallcover_median", "uint16"],
        // ["hallcover_stdDev", "uint32"],  // Excluded for efficiency
        ["cai_median", "uint8"],
        // ["cai_median_dry", "uint8"],  // Excluded for efficiency
        // ["cai_stdDev", "uint32"],  // Excluded for efficiency
        ["gv_median", "uint8"],
        // ["gv_amp", "uint8"],  // Excluded for efficiency
        ["gv_stdDev", "uint32"],
        ["gvs_median", "uint8"],
        ["gvs_median_dry", "uint8"],
        ["gvs_median_wet", "uint8"],
        ["gvs_stdDev", "uint32"],
        ["npv_median", "uint8"],
        ["soil_median", "uint8"],
        ["soil_amp", "uint8"],
        // ["soil_stdDev", "uint32"],  // Excluded for efficiency
        ["cloud_median", "uint8"],
        // ["cloud_stdDev", "uint32"],  // Excluded for efficiency
        ["shade_median", "uint8"],
        // ["shade_stdDev", "uint32"],  // Excluded for efficiency
        ["ndfi_median", "uint8"],
        ["ndfi_median_dry", "uint8"],
        ["ndfi_median_wet", "uint8"],
        ["ndfi_amp", "uint8"],
        ["ndfi_stdDev", "uint32"],
        ["sefi_median", "uint8"],
        ["sefi_stdDev", "uint32"],
        ["sefi_median_dry", "uint8"],
        ["wefi_median", "uint8"],
        ["wefi_median_wet", "uint8"],
        // ["wefi_amp", "uint8"],  // Excluded for efficiency
        ["wefi_stdDev", "uint32"],
        ["fns_median", "uint8"],
        ["fns_median_dry", "uint8"],
        ["fns_stdDev", "uint32"],
        ["slope", "int16"],
    ],

    /**
     * MapBiomas Pampa Trinational - Optimized for grassland ecosystems
     * Reduced feature set optimized for Pampa region
     */
    'mapbiomas-pampa-trinacional': [
        // Similar optimized set as Africa Trinational
        ["blue_median", "uint16"],
        ["blue_median_wet", "uint16"],
        ["blue_median_dry", "uint16"],
        ["blue_min", "uint16"],
        ["blue_stdDev", "uint32"],
        ["green_median", "uint16"],
        ["green_median_dry", "uint16"],
        ["green_median_wet", "uint16"],
        ["green_median_texture", "int16"],
        ["green_min", "uint16"],
        ["green_stdDev", "uint32"],
        ["red_median", "uint16"],
        ["red_median_dry", "uint16"],
        ["red_min", "uint16"],
        ["red_median_wet", "uint16"],
        ["red_stdDev", "uint32"],
        ["nir_median", "uint16"],
        ["nir_median_dry", "uint16"],
        ["nir_median_wet", "uint16"],
        ["nir_min", "uint16"],
        ["nir_stdDev", "uint32"],
        ["swir1_median", "uint16"],
        ["swir1_median_dry", "uint16"],
        ["swir1_median_wet", "uint16"],
        ["swir1_min", "uint16"],
        ["swir1_stdDev", "uint32"],
        ["swir2_median", "uint16"],
        ["swir2_median_wet", "uint16"],
        ["swir2_median_dry", "uint16"],
        ["swir2_min", "uint16"],
        ["swir2_stdDev", "uint32"],
        ["ndvi_median_dry", "uint8"],
        ["ndvi_median_wet", "uint8"],
        ["ndvi_median", "uint8"],
        ["ndvi_amp", "uint8"],
        ["ndvi_stdDev", "uint32"],
        ["ndwi_median", "uint8"],
        ["ndwi_median_dry", "uint8"],
        ["ndwi_median_wet", "uint8"],
        ["ndwi_amp", "uint8"],
        // ["ndwi_stdDev", "uint32"],  // Excluded for efficiency
        ["evi2_median", "uint8"],
        ["evi2_median_dry", "uint8"],
        ["evi2_median_wet", "uint8"],
        ["evi2_amp", "uint8"],
        ["evi2_stdDev", "uint32"],
        ["savi_median_dry", "uint8"],
        ["savi_median_wet", "uint8"],
        ["savi_median", "uint8"],
        // ["savi_stdDev", "uint32"],  // Excluded for efficiency
        ["pri_median_dry", "uint8"],
        ["pri_median", "uint8"],
        // ["pri_median_wet", "uint8"],  // Excluded for efficiency
        ["gcvi_median", "uint8"],
        ["gcvi_median_dry", "uint8"],
        ["gcvi_median_wet", "uint8"],
        ["gcvi_stdDev", "uint32"],
        ["hallcover_median", "uint16"],
        // ["hallcover_stdDev", "uint32"],  // Excluded for efficiency
        ["cai_median", "uint8"],
        // ["cai_median_dry", "uint8"],  // Excluded for efficiency
        // ["cai_stdDev", "uint32"],  // Excluded for efficiency
        ["gv_median", "uint8"],
        // ["gv_amp", "uint8"],  // Excluded for efficiency
        ["gv_stdDev", "uint32"],
        ["gvs_median", "uint8"],
        ["gvs_median_dry", "uint8"],
        ["gvs_median_wet", "uint8"],
        ["gvs_stdDev", "uint32"],
        ["npv_median", "uint8"],
        ["soil_median", "uint8"],
        ["soil_amp", "uint8"],
        // ["soil_stdDev", "uint32"],  // Excluded for efficiency
        ["cloud_median", "uint8"],
        // ["cloud_stdDev", "uint32"],  // Excluded for efficiency
        ["shade_median", "uint8"],
        // ["shade_stdDev", "uint32"],  // Excluded for efficiency
        ["ndfi_median", "uint8"],
        ["ndfi_median_dry", "uint8"],
        ["ndfi_median_wet", "uint8"],
        ["ndfi_amp", "uint8"],
        ["ndfi_stdDev", "uint32"],
        ["sefi_median", "uint8"],
        ["sefi_stdDev", "uint32"],
        ["sefi_median_dry", "uint8"],
        ["wefi_median", "uint8"],
        ["wefi_median_wet", "uint8"],
        // ["wefi_amp", "uint8"],  // Excluded for efficiency
        ["wefi_stdDev", "uint32"],
        ["fns_median", "uint8"],
        ["fns_median_dry", "uint8"],
        ["fns_stdDev", "uint32"],
        ["slope", "int16"],
    ],
    
    /**
     * MapBiomas Amazonia - Optimized for Amazon basin
     * Specialized feature set for tropical rainforest monitoring
     */
    'mapbiomas-amazonia': [
        ["blue_median", "uint16"],
        ["blue_median_wet", "uint16"],
        ["blue_median_dry", "uint16"],
        ["blue_min", "uint16"],
        ["blue_stdDev", "uint32"],
        ["green_median", "uint16"],
        ["green_median_dry", "uint16"],
        ["green_median_wet", "uint16"],
        ["green_median_texture", "int16"],
        ["green_min", "uint16"],
        ["green_stdDev", "uint32"],
        ["red_median", "uint16"],
        ["red_median_dry", "uint16"],
        ["red_min", "uint16"],
        ["red_median_wet", "uint16"],
        ["red_stdDev", "uint32"],
        ["nir_median", "uint16"],
        ["nir_median_dry", "uint16"],
        ["nir_median_wet", "uint16"],
        ["nir_min", "uint16"],
        ["nir_stdDev", "uint32"],
        ["swir1_median", "uint16"],
        ["swir1_median_dry", "uint16"],
        ["swir1_median_wet", "uint16"],
        ["swir1_min", "uint16"],
        ["swir1_stdDev", "uint32"],
        ["swir2_median", "uint16"],
        ["swir2_median_wet", "uint16"],
        ["swir2_median_dry", "uint16"],
        ["swir2_min", "uint16"],
        ["swir2_stdDev", "uint32"],
        ["ndvi_median_dry", "uint8"],
        ["ndvi_median_wet", "uint8"],
        ["ndvi_median", "uint8"],
        ["ndvi_amp", "uint8"],
        ["ndvi_stdDev", "uint32"],
        ["ndwi_median", "uint8"],
        ["ndwi_median_dry", "uint8"],
        ["ndwi_median_wet", "uint8"],
        ["ndwi_amp", "uint8"],
        ["evi2_median", "uint8"],
        ["evi2_median_dry", "uint8"],
        ["evi2_median_wet", "uint8"],
        ["evi2_amp", "uint8"],
        ["evi2_stdDev", "uint32"],
        ["savi_median_dry", "uint8"],
        ["savi_median_wet", "uint8"],
        ["savi_median", "uint8"],
        ["pri_median_dry", "uint8"],
        ["pri_median", "uint8"],
        ["gcvi_median", "uint8"],
        ["gcvi_median_dry", "uint8"],
        ["gcvi_median_wet", "uint8"],
        ["gcvi_stdDev", "uint32"],
        ["hallcover_median", "uint16"],
        ["cai_median", "uint8"],
        ["gv_median", "uint8"],
        ["gv_stdDev", "uint32"],
        ["gvs_median", "uint8"],
        ["gvs_median_dry", "uint8"],
        ["gvs_median_wet", "uint8"],
        ["gvs_stdDev", "uint32"],
        ["npv_median", "uint8"],
        ["soil_median", "uint8"],
        ["soil_amp", "uint8"],
        ["cloud_median", "uint8"],
        ["shade_median", "uint8"],
        ["ndfi_median", "uint8"],
        ["ndfi_median_dry", "uint8"],
        ["ndfi_median_wet", "uint8"],
        ["ndfi_amp", "uint8"],
        ["ndfi_stdDev", "uint32"],
        ["sefi_median", "uint8"],
        ["sefi_stdDev", "uint32"],
        ["sefi_median_dry", "uint8"],
        ["wefi_median", "uint8"],
        ["wefi_median_wet", "uint8"],
        ["wefi_stdDev", "uint32"],
        ["fns_median", "uint8"],
        ["fns_median_dry", "uint8"],
        ["fns_stdDev", "uint32"],
        ["slope", "int16"],
    ]
};

/**
 * Data type conversion functions
 * Maps data type strings to Earth Engine conversion methods
 */
var conversionFunctions = {
    "uint8": function(image) {
        return image.toUint8();   // Convert to unsigned 8-bit integer (0-255)
    },

    "uint16": function(image) {
        return image.toUint16();  // Convert to unsigned 16-bit integer (0-65535)
    },

    "uint32": function(image) {
        return image.toUint32();  // Convert to unsigned 32-bit integer (0-4294967295)
    },

    "int16": function(image) {
        return image.toInt16();   // Convert to signed 16-bit integer (-32768 to 32767)
    },
};

/**
 * @name setBandTypes
 * @description
 *     Converts image bands to their specified data types according to project specifications.
 *     Ensures consistent data types across different MapBiomas projects and reduces storage requirements.
 * 
 * @param {ee.Image} image - Input image with bands that need type conversion
 * @param {string} projectName - Name of the MapBiomas project (e.g., 'mapbiomas-brazil', 'mapbiomas-amazonia')
 * 
 * @returns {ee.Image} - Image with bands converted to specified data types
 * 
 * @example
 *     // Convert Landsat composite to MapBiomas Brazil specifications
 *     var landsatComposite = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
 *         .filterDate('2020-01-01', '2020-12-31')
 *         .median();
 *     
 *     var typedImage = setBandTypes(landsatComposite, 'mapbiomas-brazil');
 *     
 *     // Now all bands have appropriate data types for classification
 *     print('Band types:', typedImage.bandTypes());
 * 
 * @throws
 *     Will throw an error if projectName is not found in bandsSpecifications
 *     Will throw an error if band is not present in the input image
 */
exports.setBandTypes = function(image, projectName) {
    // Get the band specifications for the requested project
    var imageSpecifBands = bandsSpecifications[projectName]
        .reduce(
            function(imageSpecifBands, bandSpecification) {
                // Get conversion function for the specified data type
                var conversionFunction = conversionFunctions[bandSpecification[1]];
                
                // Select the band and apply type conversion
                var convertedBand = conversionFunction(
                    image.select([bandSpecification[0]])
                );
                
                // Add converted band to the result
                return imageSpecifBands.addBands(
                    convertedBand,
                    [bandSpecification[0]],  // Keep original band name
                    true                     // Overwrite if band already exists
                );
            }, 
            ee.Image().select()  // Start with empty image
        );
    
    // Copy properties from original image to maintain metadata
    return ee.Image(imageSpecifBands.copyProperties(image));
};

/**
 * NOTES:
 * 1. Data type optimization:
 *    - uint8: Used for normalized indices (NDVI, EVI, etc.) scaled 0-255
 *    - uint16: Used for reflectance values (0-10000 scale = 0-1 reflectance * 10000)
 *    - uint32: Used for variance/standard deviation which can have larger values
 *    - int16: Used for signed values like slope (negative slopes possible)
 * 
 * 2. Storage optimization:
 *    - Using appropriate data types reduces storage requirements by 50-75%
 *    - uint8 uses 1 byte per pixel vs. float64 which uses 8 bytes
 * 
 * 3. Regional optimizations:
 *    - Some projects exclude certain bands to reduce data volume
 *    - This is based on feature importance analysis for each region
 * 
 * 4. Processing considerations:
 *    - Type conversion should happen after all computations are complete
 *    - Some operations require float precision during intermediate steps
 */

/**
 * USAGE EXAMPLES:
 * 
 * // Process image for Brazil project
 * var brazilImage = setBandTypes(compositeImage, 'mapbiomas-brazil');
 * 
 * // Process image for Amazonia project
 * var amazoniaImage = setBandTypes(compositeImage, 'mapbiomas-amazonia');
 * 
 * // Check resulting band types
 * var bandTypes = brazilImage.bandTypes();
 * print('Brazil image band types:', bandTypes);
 * 
 * // Export with optimized data types
 * Export.image.toDrive({
 *     image: brazilImage,
 *     description: 'mapbiomas_brazil_composite',
 *     scale: 30,
 *     region: studyArea,
 *     maxPixels: 1e13
 * });
 */