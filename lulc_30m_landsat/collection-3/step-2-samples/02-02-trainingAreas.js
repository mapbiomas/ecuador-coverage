/**
 * @name
 *      02-training-areas-ecuador.js
 * 
 * @description
 *      AREA CALCULATION
 *      Script that calculates land cover areas for the purpose of sampling training points.
 *      Areas can be calculated based on the classification map or according to the stable pixel map.
 * 
 * @authors
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @date
 *      08/11/2024
 *      28/03/2025      Updated by Fabricio Garcés
 */

/** 
 * USER PARAMETERS:
 * Adjust the following parameters to generate the corresponding area calculations
 * ----------------------------------------------------------------------------------------------
 */
var param = {
  regionId: 40102,                    // Region classification ID
  referenceYear: '',                  // Reference year for area calculation, *Note: use '' to calculate based on stable pixel map
  inputVPixelesEstables: '1',         // Version of stable pixel map in single quotes, e.g., '1', for statistics calculation, *Note: use '' if not needed
  outputVersion: 999,                 // Output version for calculated areas
  remap: {                            // Class remapping configuration
    from: [3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 18, 21, 22, 23, 24, 25, 29, 30, 31, 33, 34, 35, 68],
    to:   [3, 4, 5, 3, 7, 3, 11, 12, 13, 21, 21, 21, 21, 22, 25, 25, 25, 25, 25, 33, 33, 34, 21, 25]
  },
  driveFolder: 'MAPBIOMAS-EXPORT',    // Google Drive folder for export
};

/**
 * ----------------------------------------------------------------------------------------------
 * APPLICATION INITIALIZATION
 * Self-invoked expression that executes step 3 of the methodology
 * ----------------------------------------------------------------------------------------------
 */
(function init(param) {
  // Import directory path modules
  var paths = require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths;
  
  // Import palette module for visualization
  var palette = require('users/mapbiomas/modules:Palettes.js').get('classification8');
  
  // Directory for storing training areas
  var trainingAreas = paths.pathTrainingAreasAct;
  
  // Regions used for current collection, with 50-meter buffer
  var regions = paths.regionVectorAct;
  
  // MapBiomas Ecuador integrated asset with spatial filter correction
  var referenceImage = paths.integratationEcuColAnt;
  
  // Directory for stable pixel feature collection in current collection
  var stablePixels = paths.pathPxAct;
  
  // Get region as vector and raster
  var region = getRegion(regions, param.regionId);
  
  // Assign raster mask
  var rasterMask = region.rasterMask;
  
  // Get country name from region
  var country = region.vector.first().get('pais').getInfo().toUpperCase();
  
  // Base name for file naming
  var baseName = country + '-' + param.regionId + '-' + param.inputVPixelesEstables.toString();
  
  // Define all possible classes (1-35)
  var classes = ee.List.sequence(1, 35).getInfo();
  
  var reference, updtReference;
  
  // Determine reference image based on parameters
  if (param.referenceYear) {
    // Select year for balancing
    reference = ee.Image(referenceImage)
      .select('classification_' + param.referenceYear.toString())
      .updateMask(rasterMask);
    
    var originalClasses = param.remap.from;
    var newClasses = param.remap.to;
    updtReference = remapBands(reference, originalClasses, newClasses);
  } else {
    // Use stable pixel map as reference
    updtReference = ee.Image(stablePixels + '/ME-' + baseName);
  }
  
  // Calculate areas
  var findareas = getAreas(updtReference, classes, region.vector);
  var areas = findareas.vector;
  var statics = findareas.stats;
  
  // Center map to object
  Map.centerObject(areas, 10);
  
  // Convert region polygon to line for visualization
  var AOI = areas.geometry().geometries();
  var AOIL = ee.Geometry.MultiLineString(AOI.map(
    function(geom) {
      return ee.Geometry.LineString(ee.Geometry(geom).coordinates().get(0));
    }
  ));
  
  // Add region boundary to map
  Map.addLayer(AOIL, {color: 'FCBA03'}, 'Region');
  
  // Display reference layer on map
  Map.addLayer(updtReference, {
    min: 0,
    max: 62,
    palette: palette
  }, 'Reference Classification');
  
  // Export statistics to Google Drive
  var tableName = 'ac-' + country + '-' + param.regionId + '-' + param.outputVersion.toString();
  
  print('Output location', trainingAreas);
  print('Output file', tableName);
  print('Area calculation results', statics);
  print('Areas', areas);
  
  exportFeatures(
    areas, 
    tableName, 
    trainingAreas + '/' + tableName,
    param.driveFolder
  );

})(param);

/**
 * FUNCTIONALITIES
 * Below are the functionalities used in the application.
 * These features are injected into the init() function which executes them
 * and generates the results.
 * ----------------------------------------------------------------------------------------------
 */

/**
 * @name remapBands
 * @description
 *     Remaps (reclassifies) classified bands.
 *     In the execution order, this function runs before polygon-based remapping.
 * @param {ee.Image} image - Input classification image
 * @param {Array} originalClasses - Array of original class values
 * @param {Array} newClasses - Array of new class values for remapping
 * @returns {ee.Image} - Remapped classification image
 */
function remapBands(image, originalClasses, newClasses) {
  var bandNames = image.bandNames().getInfo();
  var collectionList = ee.List([]);
  
  bandNames.forEach(function(bandName) {
    var remapped = image.select(bandName)
      .remap(originalClasses, newClasses);
    
    collectionList = collectionList.add(remapped.int8().rename(bandName));
  });
  
  var collectionRemap = ee.ImageCollection(collectionList);
  image = collectionRemap.toBands();
  
  var actualBandNames = image.bandNames();
  var singleClass = actualBandNames.slice(1)
    .iterate(
      function(bandName, previousBand) {
        bandName = ee.String(bandName);
        previousBand = ee.Image(previousBand);
        
        return previousBand.addBands(
          image.select(bandName)
            .rename(ee.String('classification_')
              .cat(bandName.split('_').get(2)))
        );
      },
      ee.Image(image.select([actualBandNames.get(0)])
        .rename(ee.String('classification_')
          .cat(ee.String(actualBandNames.get(0)).split('_').get(2))))
    );
  return ee.Image(singleClass);
}

/**
 * @name getAreas
 * @description
 *     Calculates areas (in km²) per class based on the stable pixel image.
 *     This function computes the total area for each land cover class within
 *     the specified region using pixel area calculation.
 * @param {ee.Image} image - Input image (classification or stable pixels)
 * @param {Array} classes - Array of class IDs to calculate areas for
 * @param {ee.FeatureCollection} region - Region feature collection
 * @returns {Object} - Object containing vector with area properties and statistics
 */
function getAreas(image, classes, region) {
  // Define reducer configuration for area calculation
  var reducer = {
    reducer: ee.Reducer.sum(),
    geometry: region.geometry(),
    scale: 30,           // 30m resolution (Landsat)
    maxPixels: 1e13      // Large pixel limit for large regions
  };
  
  var propFilter = ee.Filter.neq('item', 'OBJECTID');
  var results = {};
  
  classes.forEach(function(classId) {
    // Calculate area for each class
    var imageArea = ee.Image.pixelArea()           // Area in m² per pixel
      .divide(1e6)                                 // Convert to km² (1,000,000 m² = 1 km²)
      .mask(image.eq(classId))                     // Mask only pixels of current class
      .reduceRegion(reducer);                      // Sum areas
    
    var area = ee.Number(imageArea.get('area')).round();  // Round to nearest integer
    
    // Store result if area > 0
    if (area.getInfo() >> 0) {
      results['ID' + classId] = area.getInfo();
    }
    
    // Add area as property to region features
    region = region.map(function(item) {
      var props = item.propertyNames();
      var selectProperties = props.filter(propFilter);
      
      return item
        .select(selectProperties)
        .set('ID' + classId.toString(), area);
    });
    
    return region;
  });
  
  return {
    vector: region,     // Feature collection with area properties
    stats: results      // Statistics object with area by class
  };
}

/**
 * @name getAmazonOrPacific
 * @description
 *     Evaluates if a region belongs to Amazon or Pacific zone.
 *     This function checks if the region ID is in the Amazon region list.
 * @param {Array} amazonlist - Array of Amazon region IDs
 * @param {number} region - Region ID to check
 * @returns {boolean} - True if region is in Amazon, false if in Pacific
 */
function getAmazonOrPacific(amazonlist, region) {
  var evaluate = false;
  amazonlist.forEach(function(region_amazon) {
    if (region_amazon == region) {
      evaluate = true;
    }
  });
  return evaluate;
}

/**
 * @name getRegion
 * @description
 *     Generates Region of Interest (ROI) based on classification region.
 *     Returns both vector and raster representations of the region.
 * @param {string} regionPath - Path to region vector asset
 * @param {number} regionId - Region classification ID
 * @returns {Object} - Object containing vector and raster mask for the region
 */
function getRegion(regionPath, regionId) {
  // Get region as vector
  var region = ee.FeatureCollection(regionPath)
    .filterMetadata("id_regionC", "equals", regionId);
  
  // Create raster mask with value 1 inside region
  var setVersion = function(item) { return item.set('version', 1); };
  var regionMask = region
    .map(setVersion)
    .reduceToImage(['version'], ee.Reducer.first());
  
  return {
    vector: region,
    rasterMask: regionMask
  };
}

/**
 * @name exportFeatures
 * @description
 *     Exports calculated areas as GEE assets and optionally to Google Drive.
 * @param {ee.FeatureCollection} features - Feature collection with area data
 * @param {string} tableName - Name for the exported table
 * @param {string} tableId - Asset ID for GEE export
 * @param {string} driveFolder - Google Drive folder for export (empty string to skip)
 */
function exportFeatures(features, tableName, tableId, driveFolder) {
  // Export to GEE Assets
  Export.table.toAsset({
    collection: features,
    description: tableName,
    assetId: tableId,
  });
  
  // Create a feature collection with statistics for CSV export
  var featuresTable = ee.FeatureCollection([
    ee.Feature(null, features.first().toDictionary())
  ]);
  
  // Export to Google Drive if folder specified
  if (driveFolder !== '' && driveFolder) {
    Export.table.toDrive({
      collection: featuresTable,
      description: tableName + '-DRIVE',
      folder: driveFolder,
      fileFormat: 'CSV',
    });
  }
}

/**
 * APPLICATION WORKFLOW SUMMARY:
 * 
 * 1. Load configuration parameters and required modules
 * 2. Get region of interest (vector and raster mask)
 * 3. Determine reference image:
 *    - If referenceYear specified: use classification for that year
 *    - Otherwise: use stable pixel map
 * 4. Apply class remapping if specified
 * 5. Calculate areas for each land cover class (1-35)
 * 6. Display results on map:
 *    - Region boundaries
 *    - Reference classification
 * 7. Export results:
 *    - To GEE Assets (full feature collection)
 *    - To Google Drive as CSV (summary statistics)
 * 
 * KEY FEATURES:
 * - Flexible reference source: can use annual classification or stable pixel map
 * - Class remapping: consolidates similar classes before area calculation
 * - Area calculation: computes km² per class using pixel area
 * - Multi-format export: GEE Assets and CSV for different use cases
 * 
 * OUTPUT FORMAT:
 * - GEE Asset: Feature collection with area properties for each class (ID1, ID2, ...)
 * - CSV File: Single row with area statistics for all classes
 * 
 * USE CASES:
 * - Training sample stratification based on class area proportions
 * - Quality control of classification results
 * - Change detection and trend analysis
 * - Reporting and documentation of land cover statistics
 * 
 * NOTES:
 * - Area calculation uses 30m pixel resolution (Landsat)
 * - Results are in square kilometers (km²)
 * - Classes with 0 area are excluded from results
 * - The script supports both Amazon and Pacific regions of Ecuador
 */