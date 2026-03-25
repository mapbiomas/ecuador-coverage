/**** Start of imports. If edited, may not auto-convert in the playground. ****/
// Define the region of interest (ROI) for export
// This is a polygon geometry that can be modified using the geometry drawing tool
var geometry = 
    /* color: #d63000 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-76.56018125919545, -0.13895251572936648],
          [-76.56018125919545, -0.42253341671883393],
          [-76.11454832462513, -0.42253341671883393],
          [-76.11454832462513, -0.13895251572936648]]], null, false);

// ============================================================================
// INSTRUCTIONS FOR USAGE:
// ============================================================================
// 1. Choose the year by modifying the 'year' variable (line below)
// 2. Set the export geometry using the "geometry" button on the top-left of the map
// 3. RUN the script
// 4. Run the export task from the Tasks panel on the top-right side
//
// Note: If you define a large geometry, the data may be split into multiple files
// on Google Drive. You will need to mosaic these files locally using GIS software
// such as ArcGIS, QGIS, or ENVI.
// ============================================================================

// Define the target year for mosaic extraction
var year = 2024;

// Define the output file name (will be used for the exported file)
var fileName = 'mosaic-' + String(year);

// ============================================================================
// LOAD AND PREPARE MOSAIC DATA
// ============================================================================

// Load and merge the two MapBiomas RAISG mosaic collections
var mosaicEC = ee.ImageCollection('projects/mapbiomas-raisg/MOSAICOS/mosaics-2')
    .merge(ee.ImageCollection('projects/mapbiomas-raisg/MOSAICOS/mosaics-pathrow-2'))
    // Filter to get only images from the specified year
    .filterMetadata('year', 'equals', year)
    // Filter to get only Ecuador data
    .filter(ee.Filter.eq('country', 'ECUADOR'))
    // Select the 6 spectral bands for export
    .select(["blue_median", "green_median", "red_median", "nir_median", "swir1_median", "swir2_median"]);

// Load Ecuador's political boundary data (Nivel Político 1 - provinces)
var region = ee.FeatureCollection('projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-3/nivel_politico_1_ECU_col3');

// Function to add a version attribute to each feature
var setVersion = function(item) {
    return item.set('version', 1);
};

// Convert region boundaries to a raster mask
// This creates a binary mask where Ecuador = 1, outside Ecuador = 0
var regionRaster = region
    .map(setVersion)
    .reduceToImage(['version'], ee.Reducer.first());

// Apply the Ecuador boundary mask to the mosaic collection
// This ensures we only keep pixels within Ecuador's territory
mosaicEC = mosaicEC.map(function(image) {
    return image.updateMask(regionRaster);
});

// Create a single mosaic image by combining all images in the collection
// The mosaic() function overlays images, using the last added pixel where there's overlap
var mosaic = mosaicEC.mosaic();

// ============================================================================
// VISUALIZATION
// ============================================================================

// Display the mosaic on the map using a false-color composite
// Band combination: SWIR1 (Red), NIR (Green), Red (Blue) - good for vegetation visualization
Map.addLayer(mosaic, {
    bands: 'swir1_median,nir_median,red_median',  // SWIR1, NIR, Red band combination
    gain: '0.08,0.06,0.2',                         // Brightness adjustment for each band
    gamma: 0.75                                    // Contrast adjustment
}, 'mapbiomas mosaic EC ' + year);                 // Layer name

// Center the map on the defined geometry
Map.centerObject(geometry, 10);

// ============================================================================
// EXPORT TO GOOGLE DRIVE
// ============================================================================

// Export the mosaic as a GeoTIFF to Google Drive
// Only exports the 3-band RGB composite (not the full 6-band dataset)
Export.image.toDrive({
    'image': mosaic.select(['swir1_median', 'nir_median', 'red_median']).int32(),  // Select and convert to 32-bit integer
    'description': fileName,               // Task description in Earth Engine
    'folder': 'MAPBIOMAS-EXPORT' + year,  // Google Drive folder name
    'fileNamePrefix': fileName,            // Output file name prefix
    'region': geometry,                    // Export region (defined at the top)
    'scale': 30,                           // Pixel resolution in meters (Landsat resolution)
    'maxPixels': 1e13,                     // Maximum number of pixels allowed (very large number)
    'fileFormat': 'GeoTIFF'                // Output format
});

// ============================================================================
// ADDITIONAL NOTES:
// ============================================================================
// - The export uses int32 data type to preserve precision while keeping file size manageable
// - Only 3 bands are exported (SWIR1, NIR, Red) for visualization purposes
// - To export all 6 bands, modify the select() function in the export statement
// - The script masks data outside Ecuador to ensure only national territory is exported
// - The mosaic() function handles overlapping scenes by taking the most recent pixel
// ============================================================================