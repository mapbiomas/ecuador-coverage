/**
 * @name bandNames
 * @description
 *     Standardized band naming configuration for different satellite sensors.
 *     Provides consistent band names across Landsat 4-9 and Sentinel-2 data collections.
 *     
 *     This module maps original sensor-specific band names to standardized names
 *     to ensure compatibility across different data sources in MapBiomas processing.
 * 
 * @author MapBiomas Ecuador
 * @version 1.0.0
 */

/**
 * Band name mapping configuration
 * Each sensor configuration contains:
 *   - bandNames: Array of original band names from the satellite product
 *   - newNames:  Array of standardized names for MapBiomas processing
 */
var bandNames = { 
    /**
     * Landsat 5 Top of Atmosphere (TOA) configuration
     * Used for historical Landsat 5 TM data
     */
    'l5': {
        'bandNames': ['B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'pixel_qa', 'B6'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'pixel_qa', 'temp']
    },
    
    /**
     * Landsat 7 Top of Atmosphere (TOA) configuration
     * Used for Landsat 7 ETM+ data (includes Scan Line Corrector gap)
     */
    'l7': {
        'bandNames': ['B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'pixel_qa', 'B6'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'pixel_qa', 'temp']
    },

    /**
     * Landsat 8 Top of Atmosphere (TOA) configuration
     * Used for Landsat 8 OLI/TIRS data (post-2013)
     */
    'l8': {
        'bandNames': ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B10', 'pixel_qa', 'B11'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'thermal', 'pixel_qa', 'temp']
    },

    /**
     * Landsat 4 Collection 2 Surface Reflectance (SR) configuration
     * Early Landsat TM data with atmospheric correction applied
     */
    'l4_sr2': {
        'bandNames': ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7', 'QA_PIXEL', 'ST_B6'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'pixel_qa', 'temp']
    },
    
    /**
     * Landsat 5 Collection 2 Surface Reflectance (SR) configuration
     * Landsat 5 TM data with atmospheric correction applied
     */
    'l5_sr2': {
        'bandNames': ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7', 'QA_PIXEL', 'ST_B6'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'pixel_qa', 'temp']
    },
    
    /**
     * Landsat 7 Collection 2 Surface Reflectance (SR) configuration
     * Landsat 7 ETM+ data with atmospheric correction applied
     */
    'l7_sr2': {
        'bandNames': ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7', 'QA_PIXEL', 'ST_B6'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'pixel_qa', 'temp']
    },
    
    /**
     * Landsat 8 Collection 2 Surface Reflectance (SR) configuration
     * Landsat 8 OLI/TIRS data with atmospheric correction applied
     * Note: Different band arrangement from TOA product
     */
    'l8_sr2': {
        'bandNames': ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'ST_B10', 'QA_PIXEL'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'temp', 'pixel_qa']
    },

    /**
     * Landsat 9 Collection 2 Surface Reflectance (SR) configuration
     * Latest Landsat 9 OLI-2/TIRS-2 data with atmospheric correction applied
     */
    'l9_sr2': {
        'bandNames': ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'ST_B10', 'QA_PIXEL'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'temp', 'pixel_qa']
    },
    
    /**
     * Landsat 5 TOA alternative configuration
     * Used for legacy processing or specific product versions
     */
    'l5toa': {
        'bandNames': ['B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'BQA', 'B6'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'BQA', 'temp']
    },
    
    /**
     * Landsat 7 TOA alternative configuration
     * Used for legacy processing or specific product versions
     */
    'l7toa': {
        'bandNames': ['B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'BQA', 'B6_VCID_1'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'BQA', 'temp']
    },

    /**
     * Landsat 8 TOA alternative configuration
     * Used for legacy processing or specific product versions
     */
    'l8toa': {
        'bandNames': ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B10', 'BQA', 'B11'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'thermal', 'BQA', 'temp']
    },
    
    /**
     * Sentinel-2 MSI configuration
     * European Space Agency's Copernicus Sentinel-2 data
     * Note: Different band specifications from Landsat
     */
    'sentinel2': {
        'bandNames': ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'QA60'],
        'newNames': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'BQA']
    },
};

/**
 * @name get
 * @description
 *     Retrieves band name mapping configuration for a specific sensor
 *     Standardizes band names across Landsat 4-9 and Sentinel-2 data
 *     
 *     This function is essential for ensuring consistent band naming
 *     in multi-sensor and multi-temporal analysis workflows.
 * 
 * @argument
 *     key {String} - Sensor configuration identifier
 *                    Options: 'l4_sr2', 'l5', 'l5_sr2', 'l5toa', 'l7', 'l7_sr2', 
 *                            'l7toa', 'l8', 'l8_sr2', 'l8toa', 'l9_sr2', 'sentinel2'
 * 
 * @example
 *     // Get Landsat 8 Surface Reflectance band configuration
 *     var landsat8Bands = get('l8_sr2');
 *     
 *     // Use in image selection
 *     var image = ee.Image('LANDSAT/LC08/C02/T1_L2/LC08_001001_20200101')
 *         .select(landsat8Bands.bandNames, landsat8Bands.newNames);
 * 
 * @returns
 *     Dictionary containing band mapping configuration with:
 *         - bandNames: Array of original band names
 *         - newNames: Array of standardized band names
 * 
 * @throws
 *     Returns undefined if key is not found in bandNames object
 */
exports.get = function(key) {
    return bandNames[key];
};

/**
 * NOTES:
 * 1. Band naming conventions:
 *    - blue: Coastal aerosol / blue band (0.45-0.52 μm)
 *    - green: Green band (0.52-0.60 μm)
 *    - red: Red band (0.63-0.69 μm)
 *    - nir: Near Infrared band (0.76-0.90 μm)
 *    - swir1: Shortwave Infrared 1 (1.55-1.75 μm)
 *    - swir2: Shortwave Infrared 2 (2.08-2.35 μm)
 *    - temp: Thermal band (surface temperature)
 *    - pixel_qa: Quality assessment band (cloud, shadow, snow flags)
 * 
 * 2. Different Landsat products have different band arrangements:
 *    - TOA products: Top of Atmosphere reflectance
 *    - SR products: Surface Reflectance (atmospherically corrected)
 *    - Collection 2: Latest data processing version
 * 
 * 3. Sentinel-2 has different spectral bands but similar nomenclature:
 *    - B2: Blue (490 nm), B3: Green (560 nm), B4: Red (665 nm)
 *    - B8: NIR (842 nm), B11: SWIR1 (1610 nm), B12: SWIR2 (2190 nm)
 * 
 * 4. This standardization allows for consistent processing across:
 *    - Different Landsat missions (4, 5, 7, 8, 9)
 *    - Different processing levels (TOA vs SR)
 *    - Different satellites (Landsat vs Sentinel-2)
 */

/**
 * USAGE EXAMPLES:
 * 
 * // Process Landsat 8 Surface Reflectance data
 * var l8Config = get('l8_sr2');
 * var landsat8Image = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
 *     .filterDate('2020-01-01', '2020-12-31')
 *     .first()
 *     .select(l8Config.bandNames, l8Config.newNames);
 * 
 * // Process Sentinel-2 data
 * var s2Config = get('sentinel2');
 * var sentinel2Image = ee.ImageCollection('COPERNICUS/S2_SR')
 *     .filterDate('2020-01-01', '2020-12-31')
 *     .first()
 *     .select(s2Config.bandNames, s2Config.newNames);
 * 
 * // Both images now have consistent band names for further processing
 * var composite = ee.ImageCollection([landsat8Image, sentinel2Image])
 *     .mosaic()
 *     .select(['blue', 'green', 'red', 'nir', 'swir1', 'swir2']);
 */