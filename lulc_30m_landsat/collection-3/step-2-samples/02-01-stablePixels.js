var exclude3 = /* color: #1f46ff */ee.FeatureCollection(
        [ee.Feature(
            ee.Geometry.Polygon(
                [[[-91.0092188455956, -0.8304840375451423],
                  [-91.0255421579602, -0.8148082740746224],
                  [-91.03530382969127, -0.8112667809178061],
                  [-91.04542518349889, -0.8436854279283934],
                  [-91.02776165849083, -0.8544931248261514],
                  [-90.99549310611611, -0.8380310957323288]]]),
            {
              "original": "3,",
              "new": "27,",
              "system:index": "0"
            })]),
    remap3a11 = 
    /* color: #98ff00 */
    /* shown: false */
    ee.FeatureCollection(
        [ee.Feature(
            ee.Geometry.Polygon(
                [[[-91.05074578427337, -0.7963984477606076],
                  [-91.05992966794037, -0.8025776557155828],
                  [-91.04714089535736, -0.8127904928081338],
                  [-91.04130440854095, -0.8012044991964957]]]),
            {
              "original": "3,",
              "new": "11,",
              "system:index": "0"
            })]);

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
/***** End of imports. If edited, may not auto-convert in the playground. *****/

/** 
 * 01-stablePixels.js 
 * STABLE PIXELS AND EXCLUSION AREAS CALCULATION v3.2 
 * 
 * DESCRIPTION:
 * This script identifies stable land cover pixels over time and creates exclusion areas
 * for MapBiomas classification training data generation. It processes multi-temporal
 * land cover classifications to identify pixels that remain unchanged over specified
 * periods, which are then used as reliable training samples.
 * 
 * DOCUMENTATION:
 * ----------------------------------------------------------------------------------------------
 */

/** 
 * USER PARAMETERS:
 * Adjust the following parameters to generate stable pixel images.
 * CAUTION: Exclusion with polygons or shapes occurs AFTER remapping and may affect
 * results if exclusion polygons overlap with remapped classes.
 * ----------------------------------------------------------------------------------------------
 */
var param = {
  regionId: 40909,                              // Region classification ID
  country: 'ECUADOR',                           // Country name
  yearsPreview: [1990, 2000, 2022],             // Years to preview in the map interface
  remap: {                                      // Class remapping configuration
    from: [3, 4, 5, 6, 9, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33, 34, 35, 68],
    to:   [3, 4, 5, 6, 9, 11, 12, 13, 21, 21, 21, 19, 20, 21, 22, 23, 25, 29, 26, 29, 25, 31, 32, 33, 34, 35, 68]
  },
  yearsStable: [1985, 2022],                    // Start and end years for stable period
  exclusion: {                                  // Exclusion configuration
    years: [                                    // Years to exclude from analysis
      // 1987, 1989
    ],
    classes: [],                                // Classes to exclude from stable pixel calculation
    polygons: [exclude3, remap3a11],            // Polygon collections for manual exclusions
    shape: '',                                  // Asset path for exclusion shapefile
  },
  driveFolder: 'DRIVE-EXPORT',                  // Google Drive export folder
  ciclo: 'ciclo-1',                             // Processing cycle identifier
  version: 1                                    // Output version number
};

/**
 * APPLICATION IMPLEMENTATION
 * Self-invoked expression that executes step 2 of the methodology
 * ----------------------------------------------------------------------------------------------
 */

// Import required modules
var paths = require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths;

// Main function wrapped in IIFE (Immediately Invoked Function Expression)
(function init(param) {
  print(paths.mensaje);  // Print module message
  
  // Define asset paths
  var assets = {
    basePath: paths.pathPxAct,                    // Base path for stable pixels
    regions: paths.regionVectorAct,              // Region vector path
    mosaics: [paths.mosaicRaisgAct, paths.mosaicPacificoAct], // Mosaic collections
    image: paths.integratationEcuColAntNotFilter, // Land cover classification image
    canopy_height: 'users/nlang/ETH_GlobalCanopyHeight_2020_10m_v1' // Canopy height data
  };
  
  // Get version based on processing cycle
  var version = getVersion(param.ciclo);
  
  // Create mask based on region vector
  var regionId = param.regionId;
  var region = getRegion(assets.regions, '', regionId);
  var regionMask = region.rasterMask;
  
  print(region.vector);  // Log region vector information
  
  // Format country name for file naming
  var country = region.vector.first().get('pais').getInfo().toUpperCase();
  country = country.replace('Ú', 'U').replace(' ', '_');
  var countryRegion = country + '-' + regionId;
  
  // Apply area exclusions
  var shapePath = assets.basePath + country + '/';
  var shapeName = param.exclusion.shape;
  var fullRegion = excludeAreas(regionMask, shapePath, shapeName);
  
  // Extract classification, ignoring inconsistent years
  var image = ee.Image(assets.image).updateMask(fullRegion);
  image = selectBands(image, param.yearsStable);
  image = ExclusionBands(image, param.exclusion.years);
  print('Years used', image.bandNames());
  
  // Remap classes according to configuration
  var originalClasses = param.remap.from;
  var newClasses = param.remap.to;
  image = remapBands(image, originalClasses, newClasses);
  
  // Generate stable pixels
  var classes = ee.List.sequence(1, 34);
  classes = classes.removeAll(param.exclusion.classes).getInfo();
  var stablePixels = getStablePixels(image, classes);
  
  // Apply polygon-based exclusions
  var polygons = param.exclusion.polygons;
  stablePixels = remapWithPolygons(stablePixels, polygons);
  
  // Import mosaics for visualization
  var assetsMosaics = assets.mosaics;
  var variables = ['nir_median', 'swir1_median', 'red_median'];
  var mosaics = getMosaic(assetsMosaics, region.vector, variables, '');
  
  // Display images on the map
  var assetData = {
    asset: assets.image,
    region: region,
    years: param.yearsPreview
  };
  
  addLayersToMap(stablePixels, mosaics, assetData);
  
  // Export results to GEE Assets and Google Drive
  var imageName = 'ME-' + countryRegion + '-' + param.version;
  var assetId = assets.basePath + imageName;
  var driveFolder = param.driveFolder;
  var vector = region.vector;
  
  // Set image properties for metadata
  var props = {
    code_region: param.regionId,
    pais: country,
    version: version.toString(),
    paso: 'P02'
  };
  
  stablePixels = stablePixels.set(props);
  exportImage(stablePixels, imageName, assetId, vector, driveFolder);
  
})(param);

/**
 * FUNCTIONALITIES
 * Below are the functions used in the application.
 * ----------------------------------------------------------------------------------------------
 */

/**
 * @name getVersion
 * @description
 *     Assigns a version number based on processing cycle
 * @param {string} cycle - Processing cycle identifier ('ciclo-1' or 'ciclo-2')
 * @returns {number} - Version number
 */
function getVersion(cycle) {
  var version = {
    'ciclo-1': 1,
    'ciclo-2': 2
  };
  return version[cycle];
}

/**
 * @name remapBands
 * @description
 *     Remaps (reclassifies) land cover classes according to specified mapping.
 *     This function runs before polygon-based remapping in the processing order.
 * @param {ee.Image} image - Input land cover classification image
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
 * @name excludeAreas
 * @description
 *     Delimits exclusion areas where training samples will not be collected.
 *     These areas can be defined as polygons using drawing tools or as
 *     ee.FeatureCollection() located at the path specified in exclusion.shape parameter.
 * @param {ee.Image} image - Input region mask image
 * @param {string} shapePath - Path to shapefile asset
 * @param {string} shapeName - Name of shapefile asset
 * @returns {ee.Image} - Region mask with exclusion areas masked out
 */
function excludeAreas(image, shapePath, shapeName) {
  var exclusionRegions;
  var shapes = shapePath !== '' && shapeName !== '';
  
  if (shapes) {
    exclusionRegions = ee.FeatureCollection(shapePath + shapeName);
  } else {
    exclusionRegions = null;
  }
  
  // Exclude all defined areas
  if (exclusionRegions !== null) {
    var setVersion = function(item) { return item.set('version', 1); };
    
    exclusionRegions = exclusionRegions
      .map(setVersion)
      .reduceToImage(['version'], ee.Reducer.first())
      .eq(1);
    
    return image.where(exclusionRegions.eq(1), 0).selfMask();
  } else {
    return image;
  }
}

/**
 * @name remapWithPolygons
 * @description
 *     Interactive remapping of zones delimited by polygons.
 *     Polygons are drawn using GEE drawing tools and defined as ee.FeatureCollection().
 * @param {ee.Image} stablePixels - Stable pixel image
 * @param {Array} polygons - Array of polygon feature collections
 * @returns {ee.Image} - Stable pixel image with polygon-based remapping applied
 */
function remapWithPolygons(stablePixels, polygons) {
  if (polygons.length > 0) {
    polygons.forEach(function(polygon) {
      var excluded = polygon.map(function(layer) {
        var area = stablePixels.clip(layer);
        var from = ee.String(layer.get('original')).split(',');
        var to = ee.String(layer.get('new')).split(',');
        
        from = from.map(function(item) {
          return ee.Number.parse(item);
        });
        
        to = to.map(function(item) {
          return ee.Number.parse(item);
        });
        
        return area.remap(from, to);
      });
      
      excluded = ee.ImageCollection(excluded).mosaic();
      stablePixels = excluded.unmask(stablePixels).rename('reference');
      stablePixels = stablePixels.mask(stablePixels.neq(27));
    });
  }
  
  return stablePixels;
}

/**
 * @name ExclusionBands
 * @description
 *     Removes specified years from the image band selection
 * @param {ee.Image} image - Input classification image
 * @param {Array} years - Array of years to exclude
 * @returns {ee.Image} - Image with specified years removed
 */
function ExclusionBands(image, years) {
  var bandNames = [];
  
  years.forEach(function(year) {
    bandNames.push('classification_' + year);
  });
  
  return ee.Image(
    ee.Algorithms.If(
      years.length === 0,
      image,
      image.select(image.bandNames().removeAll(bandNames))
    )
  );
}

/**
 * @name selectBands
 * @description
 *     Selects classification bands based on specified years
 * @param {ee.Image} image - Input classification image
 * @param {Array} years - Array of [startYear, endYear] for band selection
 * @returns {ee.Image} - Image with selected year bands
 */
function selectBands(image, years) {
  var bandNames = [];
  var y = ee.List.sequence(years[0], years[1], 1).getInfo();
  
  y.forEach(function(year) {
    bandNames.push('classification_' + year);
  });
  
  return ee.Image(image.select(bandNames));
}

/**
 * @name getRegion
 * @description
 *     Generates Region of Interest (ROI) based on classification region
 *     or millionth grid contained within it
 * @param {string} regionPath - Path to region vector asset
 * @param {string} regionImagePath - Path to region raster asset
 * @param {number} regionId - Region classification ID
 * @returns {Object} - Object containing vector and raster mask for the region
 */
function getRegion(regionPath, regionImagePath, regionId) {
  var region = ee.FeatureCollection(regionPath)
    .filterMetadata("id_regionC", "equals", regionId);
  
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
 * @name getMosaic
 * @description
 *     Filters mosaics by region code and 250k grid.
 *     Manages the selection of indices used for training point generation.
 * @param {Array} paths - Array of mosaic collection paths
 * @param {ee.FeatureCollection} region - Region feature collection
 * @param {Array} variables - Variables/bands to select
 * @param {string} gridName - Grid name for filtering
 * @returns {ee.ImageCollection} - Filtered mosaic collection
 */
function getMosaic(paths, region, variables, gridName) {
  // Import elevation data
  var altitude = ee.Image('JAXA/ALOS/AW3D30_V1_1')
    .select('AVE')
    .rename('altitude');
      
  var slope = ee.Terrain.slope(altitude).int8()
    .rename('slope');
  
  var mosaic = ee.ImageCollection(paths[0]).merge(ee.ImageCollection(paths[1]))
    .filterBounds(region);
  
  if (gridName && gridName !== '') {
    mosaic = mosaic.filterMetadata('grid_name', 'equals', gridName);
  }
  
  if (mosaic.size().getInfo() !== 0) {
    return mosaic;
  }
  
  var mosaics = [];
  // Additional mosaic processing logic would go here
  
  if (variables.length > 0) {
    return mosaic.select(variables);
  } else {
    return mosaic;
  }
}

/**
 * @name getStablePixels
 * @description
 *     Extracts stable pixels that remain unchanged over time for specified classes.
 *     This is the core function for identifying reliable training samples.
 * @param {ee.Image} image - Multi-temporal classification image
 * @param {Array} classes - Array of class IDs to analyze for stability
 * @returns {ee.Image} - Image with stable pixels marked (0 = unstable, classID = stable)
 */
function getStablePixels(image, classes) {
  var bandNames = image.bandNames();
  var images = [];
  
  classes.forEach(function(classId) {
    var previousBand = image.select([bandNames.get(0)]).eq(classId);
    
    var singleClass = ee.Image(
      bandNames.slice(1)
        .iterate(
          function(bandName, previousBand) {
            bandName = ee.String(bandName);
            return image.select(bandName).eq(classId)
              .multiply(previousBand);
          },
          previousBand
        )
    );
    
    singleClass = singleClass
      .updateMask(singleClass.eq(1))
      .multiply(classId);
    
    images.push(singleClass);
  });
  
  // Blend all images
  var allStable = ee.Image();
  for (var i = 0; i < classes.length; i++) {
    allStable = allStable.blend(images[i]);
  }
  
  return allStable;
}

/**
 * @name addLayersToMap
 * @description
 *     Displays results on the map interface including:
 *     - Mosaics for visualization
 *     - Original classifications
 *     - Region boundaries
 *     - Stable pixels
 * @param {ee.Image} stablePixels - Stable pixel image
 * @param {ee.ImageCollection} mosaics - Mosaic collection for visualization
 * @param {Object} originalImage - Object containing original image data and region info
 */
function addLayersToMap(stablePixels, mosaics, originalImage) {
  var palette = require('users/mapbiomas/modules:Palettes.js')
    .get('classification8');
    
  var region = originalImage.region;
  var image = ee.Image(originalImage.asset)
    .updateMask(region.rasterMask);
    
  var bands;
  
  if (originalImage.years.length === 0) {
    bands = image.bandNames();
  } else {
    bands = ee.List([]);
    originalImage.years.forEach(function(year) {
      bands = bands.add('classification_' + year.toString());
    });
  }
  
  bands.evaluate(function(bandnames) {
    bandnames.forEach(function(bandname) {
      // Mosaics for visualization
      var year = parseInt(bandname.split('_')[1], 10);
      var mosaic = mosaics.filterMetadata('year', 'equals', year)
        .mosaic()
        .updateMask(region.rasterMask);
        
      Map.addLayer(
        mosaic,
        {
          bands: ['swir1_median', 'nir_median', 'red_median'],
          gain: [0.08, 0.06, 0.2]
        },
        'MOSAIC ' + year.toString(),
        false
      );
      
      // Original classifications
      Map.addLayer(
        image,
        {
          bands: bandname,
          min: 0,
          max: 62,
          palette: palette
        },
        bandname.toUpperCase().replace('TION_', 'TION '),
        false
      );
    });
    
    // Region boundaries
    Map.addLayer(
      region.vector.style({
        fillColor: '00000066',
        color: 'FCBA03'
      }),
      {},
      'REGION ' + param.regionId
    );
    
    // Stable pixels
    Map.addLayer(
      stablePixels,
      {
        min: 0,
        max: 62,
        palette: palette
      },
      'STABLE PIXELS'
    );
  });
}

/**
 * @name exportImage
 * @description
 *     Exports results to GEE Assets and Google Drive
 * @param {ee.Image} image - Image to export
 * @param {string} imageName - Name for the exported image
 * @param {string} imageId - Asset ID for GEE export
 * @param {ee.FeatureCollection} region - Region for export bounds
 * @param {string} driveFolder - Google Drive folder for export
 */
function exportImage(image, imageName, imageId, region, driveFolder) {
  // Export to GEE Assets
  Export.image.toAsset({
    image: image.toInt8(),
    description: imageName,
    assetId: imageId,
    scale: 30,
    pyramidingPolicy: {
      '.default': 'mode'
    },
    maxPixels: 1e13,
    region: region.geometry().bounds()
  });
  
  // Export to Google Drive (if specified)
  if (driveFolder !== '' && driveFolder !== undefined) {
    Export.image.toDrive({
      image: image.toInt8(),
      description: imageName + '-DRIVE',
      folder: driveFolder,
      scale: 30,
      maxPixels: 1e13,
      region: region.geometry().bounds()
    });
  }
}

/**
 * APPLICATION WORKFLOW SUMMARY:
 * 
 * 1. Load and prepare region mask
 * 2. Apply area exclusions (shapefiles and polygons)
 * 3. Extract classification bands for specified years
 * 4. Remap land cover classes according to configuration
 * 5. Calculate stable pixels (unchanged over time)
 * 6. Apply additional polygon-based exclusions/remapping
 * 7. Load mosaics for visualization
 * 8. Display results on map
 * 9. Export results to GEE Assets and Google Drive
 * 
 * KEY CONCEPTS:
 * - Stable pixels: Areas with consistent land cover classification over time
 * - Exclusion areas: Regions excluded from training sample collection
 * - Class remapping: Consolidation or adjustment of land cover classes
 * - Multi-temporal analysis: Comparison across multiple years
 * 
 * USE CASES:
 * - Training data generation for land cover classification
 * - Quality assessment of classification consistency
 * - Identification of problematic areas for manual review
 * - Creation of reference datasets for change detection
 */