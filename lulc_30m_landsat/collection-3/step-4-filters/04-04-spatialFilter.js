/**
 * @name
 *     03-4-spatial-filter-ecuador.js
 * 
 * @description 
 *      Spatial filter that removes isolated pixels. It eliminates land cover patches
 *      that have an area smaller than a specified number of connected pixels.
 * 
 * @author
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez
 *
 * @date
 *      21/01/2025
 *      01/05/2025  Modified by Fabricio Garcés
 */

/**
 * USER PARAMETERS
 */
var param = {
  regionId: 40201,
  country: 'ECUADOR',
  
  // Years to process
  years: ee.List.sequence(1985, 2025).getInfo(),
  
  // Years to preview on map
  yearsPreview: [
    //1985,1986,1987, 1988,
    //1989, 1990,1991, 1992,
    //1993, 1994,1995,
    //1996,1997,1998,1999,
    //2000,2001,2002,2003,2004,
    //2005,2006,2007,2008,2009,
    //2010,2011,2012,2013,2014,
    //2015,2016,2017,2018,2019,
    //2020, 2021, 2022
    // 2019, 2020, 2021, 2022, 2023,
    2024, 2025
  ],
  
  // Connectivity type: true = 8-direction (includes diagonals), false = 4-direction (cardinal only)
  eightConnected: true,
  
  // Minimum number of connected pixels required to keep a patch
  minConnectedPixels: 5,
  
  // Version numbers for input/output images
  inputVersion: 32143,
  outputVersion: 32142,
  
  // Years and classes to exclude from filtering (preserve original values)
  yearsExclude: [],
  classExclude: [],
  
  // Chart generation settings
  chart: {
    generate: true,                   // true = print chart, false = don't print chart
    classIds: [3, 33],                // Classes to plot in console (both original and filtered)
  },
  
  // Display options
  addMosaics: true,                    // Add mosaic layers to map
  addRegion: true,                      // Add region boundary to map
  
  // Directory paths module
  dirPath: require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths,
};

/**
 * Main Spatial Filter Class
 * Applies connected component analysis to remove small isolated patches
 */
var SpatialFilter = function(param) {
  
  var _this = this;
  
  /**
   * Initialize and execute the spatial filter
   */
  this.init = function(param) {
    
    var config = {
      scaleNumber: 30,                  // Processing scale in meters
      years: param.years,
      mapType: 'SATELLITE',
      collectionField: 'id_regionC',
      country: param.country,
      regionId: param.regionId,
      inputVersion: param.inputVersion,
      yearsPreview: param.yearsPreview,
      outputVersion: param.outputVersion,
      eightConnected: param.eightConnected,
      minConnectedPx: param.minConnectedPixels,
      yearsExclude: param.yearsExclude,
      classExclude: param.classExclude,
      addMosaics: param.addMosaics,
      addRegion: param.addRegion,
      legendTitle: 'Land cover',
      legendPosition: 'bottom-right',
      legendColors: [ 
        '006400', '00ff00', '45c2a5', 'b8af4f',
        'f1c232', 'ffffb2', 'FA8784', '665a3a', '0000ff'
      ],
      legendLabels: [
        '3. Forest formation',
        '4. Open forest',
        '11. Flooded natural non-forest formation',
        '12. Herbaceous',
        '13. Other natural non-forest formations',
        '21. Agricultural and forestry use',
        '25. Area without vegetation',
        '29. Rock outcrop',
        '33. Rivers, Lakes or Oceans'
      ],
      functions: require('users/mapbiomasecuador/LULC:COLECCION3/api').functions,
      inputPath: param.dirPath.pathClassificationActFilter,
      outputPath: param.dirPath.pathClassificationActFilter,
      regionPath: param.dirPath.regionVectorAct,
      palette: require('users/kahuertas/mapbiomas-colombia:mapbiomas-colombia/collection-3/modules/Palettes.js').get('ColombiaCol3'),
      eePalette: require('users/gena/packages:palettes')
    };
    
    // Import functions from API
    var mapLegend = _this.mapLegend;

    // Adjust palette color for class 4
    config.palette[4] = '#7dc975';
    
    // Load region of interest
    var region = ee.FeatureCollection(param.dirPath.regionVectorAct)
      .filterMetadata('id_regionC', 'equals', param.regionId);
    
    // Create region mask
    var setVersion = function(item) { return item.set('version', 1); };
    var regionMask = region
      .map(setVersion)
      .reduceToImage(['version'], ee.Reducer.first());
    
    // Load mosaic collection for visualization
    var mosaic = ee.ImageCollection(param.dirPath.mosaicRaisgAct)
      .merge(ee.ImageCollection(param.dirPath.mosaicPacificoAct))
      .filterBounds(region);
    
    // Load classification image
    var input = _this.getImage(config);

    // Add connected pixel count bands to the image
    var inputImage = _this.addConnectedPixelBands(input, config);
    
    // Apply spatial filter to remove small isolated patches
    var filtered = _this.applySpatialFilter(inputImage, config, regionMask);
    
    // Restore excluded years (keep original values)
    if (config.yearsExclude.length > 0) {
      var bandNamesExclude = ee.List(
        config.yearsExclude.map(function(year) {
          return 'classification_' + String(year);
        })
      );
      var yearExcluded = input.select(bandNamesExclude);  // Original bands to preserve
      
      config.yearsExclude.forEach(function(year) {
        var yearExcludedBand = yearExcluded.select('classification_' + String(year));
        filtered = filtered.addBands(yearExcludedBand, null, true);
      });
      
      print('Years excluded from spatial filter:', config.yearsExclude);
    }
    
    // Restore excluded classes (keep original values for specific classes)
    if (config.classExclude.length > 0) {
      config.years.forEach(function(year) {
        var yearBand = input.select('classification_' + year);
        
        config.classExclude.forEach(function(className) {
          // Create mask for the excluded class
          var classMask = yearBand.updateMask(yearBand.unmask().eq(className));
          var filteredYearBand = filtered.select('classification_' + year).blend(classMask);
          filtered = filtered.addBands(filteredYearBand, null, true);
        });
      });
    }

    // Get first preview year for main layer display
    var yearsLength = config.yearsPreview.length;
    var yearTitle = ee.List(config.yearsPreview).get(0).getInfo();

    // Add main classification layers to map
    Map.addLayer(
      input.reproject('EPSG:4326', null, 30), 
      { bands: ["classification_" + yearTitle], min: 0, max: config.palette.length - 1, palette: config.palette }, 
      'Original Classification', 
      false
    );
    Map.addLayer(
      filtered.reproject('EPSG:4326', null, 30), 
      { bands: ["classification_" + yearTitle], min: 0, max: config.palette.length - 1, palette: config.palette }, 
      'Spatially Filtered', 
      false
    );
    
    // Display preview years
    config.yearsPreview.forEach(function(year) {
      if (config.addMosaics) {
        _this.addMosaic(mosaic, year, regionMask);
      }
      _this.addClassification(input, year, config.palette, 'CLASSIFICATION');
      _this.addClassification(filtered, year, config.palette, 'FILTERED');
    });
    
    // Generate comparison charts if enabled
    if (param.chart.generate) {
      _this.generateCharts(config, region, input, filtered);
    }

    // Add legend to map
    mapLegend(Map, config.legendTitle, config.legendColors, config.legendLabels, config.legendPosition);

    // Export filtered image to asset
    var filename = config.country + '-' + config.regionId + '-' + config.outputVersion;
    var imageId = config.outputPath + filename;
    
    Export.image.toAsset({
      image: filtered
        .byte()
        .set({
          step: 'spatial-filter', 
          version: config.outputVersion
        }),
      description: filename,
      assetId: imageId,
      scale: config.scaleNumber,
      pyramidingPolicy: {
        '.default': 'mode'
      },
      maxPixels: 1e13,
      region: input.geometry().bounds()
    });
    
    // Add region boundary to map
    if (config.addRegion) {
      Map.addLayer(region.style({ fillColor: '00000000', color: 'FF0000' }), {}, 'Region');
    }
    
    // Center map on region
    Map.centerObject(region, 7);
  };
  
  /**
   * --------------------------------------------------------------------------
   * PUBLIC METHODS
   * --------------------------------------------------------------------------
   */
  
  /**
   * Add mosaic layer to map for a specific year
   */
  this.addMosaic = function(mosaicCollection, year, regionMask) {
    var yearMosaic = mosaicCollection
      .filterMetadata('year', 'equals', year);
    
    // Filter by satellite for specific years
    if (year == 2022 || year == 2023 || year == 2024) {
      yearMosaic = yearMosaic.filterMetadata('satellite', 'equals', 'l8');
    }
    
    // For 2025, use 2024 L9 mosaic as placeholder
    if (year == 2025) {
      yearMosaic = mosaicCollection.filterMetadata('year', 'equals', 2024);
      yearMosaic = yearMosaic.filterMetadata('satellite', 'equals', 'l9');
    }
    
    yearMosaic.size().evaluate(function(size) {
      if (size > 0) {
        var mosaicImage = yearMosaic
          .median()
          .updateMask(regionMask);
        
        Map.addLayer(
          mosaicImage,
          {
            bands: ['swir1_median', 'nir_median', 'red_median'],
            gain: [0.08, 0.06, 0.2]
          },
          'MOSAIC ' + year.toString(),
          false
        );
      }
    });
  };
  
  /**
   * Add classification layer to map for a specific year
   */
  this.addClassification = function(image, year, palette, title) {
    ee.Number(year).evaluate(function(yearNum) {
      Map.addLayer(
        image.reproject('EPSG:4326', null, 30),
        {
          'bands': 'classification_' + yearNum,
          'min': 0,
          'max': palette.length - 1,
          'palette': palette
        },
        title + ' ' + yearNum,
        false
      );
    });
  };
  
  /**
   * Load main classification image
   */
  this.getImage = function(config) {
    var inputPath = config.inputPath;
    var country = config.country;
    var regionId = config.regionId;
    var inputVersion = config.inputVersion;
    
    return ee.Image(inputPath + country + '-' + regionId + '-' + inputVersion);
  };
  
  /**
   * Add connected pixel count bands to the image
   * This identifies how many pixels are connected to each pixel
   */
  this.addConnectedPixelBands = function(image, config) {
    var bandNames = image.bandNames();
    
    // Add a band for each year showing the number of connected pixels
    var connected = image.addBands(
      image
        .connectedPixelCount(100, config.eightConnected)
        .rename(bandNames.map(
          function(band) { 
            return ee.String(band).cat('_connected'); 
          }
        ))
    );
    
    return connected;
  };
  
  /**
   * Generate area comparison charts for specified classes
   */
  this.generateCharts = function(config, region, originalImage, filteredImage) {
    var previousCollection = ee.Image(
      'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/INTEGRACION/integracion-nacional/ECUADOR-COL2-21'
    );
    
    print(
      'Note: The following charts are for reference only. They were generated',
      'by resampling Landsat data from 30m to 250m, so interpret with caution.'
    );
    
    var years = ee.List.sequence(1985, 2025).getInfo();
    var previousYears = ee.List.sequence(1985, 2023).getInfo();
    
    param.chart.classIds.forEach(function(classId) {
      // Filtered chart
      print(
        'Chart-Filtered-Class ' + classId,
        ui.Chart.image.regions({
          image: filteredImage.eq(classId).multiply(6.25).selfMask(),
          regions: region.geometry().bounds(),
          reducer: ee.Reducer.sum(),
          scale: 250,
          seriesProperty: 'system:id',
          xLabels: years
        })
        .setChartType('LineChart')
        .setOptions({
          title: 'Class ' + classId + ' - Filtered (resampled to 250m)',
          hAxis: { title: 'Year', titleTextStyle: { italic: false, bold: true } },
          vAxis: { title: 'Area (ha)', titleTextStyle: { italic: false, bold: true } },
          colors: [config.palette[classId]],
          lineSize: 3
        })
      );
      
      // Original chart
      print(
        'Chart-Original-Class ' + classId,
        ui.Chart.image.regions({
          image: originalImage.eq(classId).multiply(6.25).selfMask(),
          regions: region.geometry().bounds(),
          reducer: ee.Reducer.sum(),
          scale: 250,
          seriesProperty: 'system:id',
          xLabels: years
        })
        .setChartType('LineChart')
        .setOptions({
          title: 'Class ' + classId + ' - Original (resampled to 250m)',
          hAxis: { title: 'Year', titleTextStyle: { italic: false, bold: true } },
          vAxis: { title: 'Area (ha)', titleTextStyle: { italic: false, bold: true } },
          colors: [config.palette[classId]],
          lineSize: 3
        })
      );
      
      // Previous collection chart
      print(
        'Chart-PreviousCollection-Class ' + classId,
        ui.Chart.image.regions({
          image: previousCollection.eq(classId).multiply(6.25).selfMask(),
          regions: region.geometry().bounds(),
          reducer: ee.Reducer.sum(),
          scale: 250,
          seriesProperty: 'system:id',
          xLabels: previousYears
        })
        .setChartType('LineChart')
        .setOptions({
          title: 'Class ' + classId + ' - Previous Collection (resampled to 250m)',
          hAxis: { title: 'Year', titleTextStyle: { italic: false, bold: true } },
          vAxis: { title: 'Area (ha)', titleTextStyle: { italic: false, bold: true } },
          colors: [config.palette[classId]],
          lineSize: 3
        })
      );
    });
  };

  /**
   * Apply spatial filter to remove small isolated patches
   * Uses focal mode to replace small patches with surrounding majority class
   */
  this.applySpatialFilter = function(image, config, regionRaster) {
    var bandNames = image.bandNames();
    var output = ee.Image(0);
    var bands = [];
    
    config.years.forEach(function(year) {
      // Get classification band for current year
      var classificationBand = image.select('classification_' + year);
      
      // Get connected pixel count band for current year
      var connectedBand = image.select('classification_' + year + '_connected');
      
      // Create mask for pixels that have enough connected neighbors (keep these)
      var keepMask = classificationBand.mask(connectedBand.gt(config.minConnectedPx));
      
      // Calculate focal mode (majority class) in a 1-pixel radius
      // This will replace small patches with the surrounding dominant class
      var focalMode = keepMask
        .focalMode(1, 'square', 'pixels', 30);
      
      // Blend: keep original pixels that meet size threshold, 
      // replace others with focal mode
      var filteredBand = focalMode.blend(keepMask).updateMask(regionRaster);
      
      output = output.addBands(filteredBand);
      bands.push('classification_' + year);
    });
    
    return output.select(bands);
  };

  /**
   * Create and add legend to map
   */
  this.mapLegend = function(map, title, colors, labels, position) {
    var legend = ui.Panel({
      style: {
        backgroundColor: "#fff",
        position: position,
        padding: '8px'
      }
    });
    
    // Create legend title
    var legendTitle = ui.Label({
      value: title,
      style: {
        backgroundColor: "#ffffff00",
        fontWeight: 'bold',
        fontSize: '14px',
        color: "#000000",
        margin: '0 0 6px 0',
        padding: '0'
      }
    });
    
    legend.add(legendTitle);
    
    // Create a row with color box and label
    var makeRow = function(color, name) {
      var colorBox = ui.Label({
        style: {
          backgroundColor: color,
          margin: '5px 0 0 0',
          height: "12px",
          width: "12px"
        }
      });
    
      var description = ui.Label({
        value: name,
        style: {
          backgroundColor: "#ffffff00",
          margin: '3px 0 0 6px',
          padding: "2px 2px 4px 2px",
          height: "16px",
          fontSize: "13px",
          color: "#757575"
        }
      });
    
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal'),
        style: {
          backgroundColor: "#ffffff00"
        }
      });
    };
    
    // Generate legend rows
    for (var i = 0; i < labels.length; i++) {
      legend.add(makeRow(colors[i], labels[i]));
    }
    
    map.add(legend);
  }
  
  return this.init(param);
};

// Execute the spatial filter
new SpatialFilter(param);