var geometry = 
    /* color: #d63000 */
    /* shown: false */
    ee.Geometry.MultiPoint(
        [[-76.50301487311023, -0.0794463673523791],
         [-79.46601657917293, -3.9590050717323906],
         [-79.46682302828344, -3.9635170498627357],
         [-79.94702362393625, -3.8727566502184727],
         [-79.42800560172269, -3.9168982219842534],
         [-79.80815273963312, -3.8527785922928866],
         [-77.04838881901033, 0.12230894212699646],
         [-76.6217263089776, 0.00283293857558202],
         [-78.94331359121608, -4.792564325648361],
         [-78.92377965735025, -4.874760382060653],
         [-78.92274968908853, -4.8752735032088],
         [-78.42035291010555, -3.6261556886217696]]),
    hidden_0 = /* color: #929292 */ee.FeatureCollection(
        [ee.Feature(
            ee.Geometry.Point([-76.43947934517432, 0.07506496776938903]),
            {
              "id": 1,
              "system:index": "0"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-76.01375913033056, -0.03479828986715406],
                  [-76.11400937447118, 0.07094509806777728],
                  [-76.49303769478368, 0.1821813814777],
                  [-76.7141375482993, 0.20552719495714722],
                  [-76.77044247993993, 0.1560889660926879],
                  [-76.62350034126806, 0.06957180808466436],
                  [-76.38042783150243, -0.07599700019123398],
                  [-76.22249936470556, -0.12131553534389182]]]),
            {
              "id": 1,
              "system:index": "1"
            })]);


/**
 * @name
 *      03-3-frequency-filter-ecuador.js 
 * 
 * @description
 *      Filter that calculates the frequency of a value pixel by pixel across the entire time series,
 *      based on that it decides whether to keep it or change it to a land cover with higher frequency
 * 
 * @author
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez
 *
 * @date
 *      21/01/2025
 */

/**
 * USER PARAMETERS
 */
var param = {
  regionId: 40201,
  country: 'ECUADOR',
  
  // Years to process
  years: ee.List.sequence(1985, 2025).getInfo(),
  
  // Land cover classes to apply the filter to
  classIds: [13, 3, 33],
  
  // Years to preview on map
  yearsPreview: [
    1985, 1986, 1987, 1988,
    // 1989, 1990, 1991, 1992,
    // 1993, 1994, 1995,
    // 1996, 1997, 1998, 1999,
    // 2000, 2001, 2002, 2003, 2004,
    // 2005, 2006, 2007, 2008, 2009,
    // 2010, 2011, 2012, 2013, 2014,
    // 2015, 2016, 2017, 2018,
    // 2019, 2020,
    // 2021, 2022,
    // 2023, 2024, 2025
  ],
  
  // Percentage thresholds
  percents: {
    naturalVegetation: 70,  // Minimum frequency to be considered natural vegetation
    majority: 60             // Minimum frequency to change to majority class
  },
  
  // Years where filter should NOT modify values (preserve original)
  exclusion: {
    years: [],
    classes: []
  },
  
  // Years to completely ignore (filter doesn't use them or modify them)
  ignore: {
    years: [],
  },  

  // Version numbers for input/output images
  inputVersion: 32145,
  outputVersion: 32144,
  
  // Action area - Apply filter inside or outside a specific area
  hidden: {
    activate: false,                 // true = apply area restriction, false = ignore
    areas: null,                  // null if not used, hidden_0 for manually drawn polygon
    inside: false                     // true = apply inside the area, false = apply outside
  },
  
  // Chart generation settings
  chart: {
    generate: true,                   // true = print chart, false = don't print chart
    classIds: [3, 33],                // Classes to plot in console (both original and filtered)
  },
  
  // Display options
  addRegion: true,                    // Add region boundary to map
  addMosaic: true,                    // Add mosaic layers to map
  
  // Directory paths module
  dirPath: require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths,
};

/**
 * Main Frequency Filter Class
 * Applies frequency-based filtering to land cover classification
 */
var FrequencyFilter = function(param) {
  
  var _this = this;
  
  /**
   * Initialize and execute the frequency filter
   */
  this.init = function(param) {
    
    var config = {
      scaleNumber: 30,                 // Processing scale in meters
      years: param.years,
      mapType: 'SATELLITE',
      collectionField: 'id_regionC',
      country: param.country,
      regionId: param.regionId,
      classIds: param.classIds,
      inputVersion: param.inputVersion,
      yearsPreview: param.yearsPreview,
      yearsToExclude: param.exclusion.years,
      yearsToIgnore: param.ignore.years,
      classesToExclude: param.exclusion.classes,
      vegetationPercent: param.percents.naturalVegetation,
      majorityPercent: param.percents.majority,
      outputVersion: param.outputVersion,
      addRegion: param.addRegion,
      addMosaic: param.addMosaic,
      hidden: param.hidden,
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
      palette: require('users/kahuertas/mapbiomas-colombia:mapbiomas-colombia/collection-3/modules/Palettes.js').get('ColombiaCol3')
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
    
    // Load mosaic collection
    var mosaic = ee.ImageCollection(param.dirPath.mosaicRaisgAct)
      .merge(ee.ImageCollection(param.dirPath.mosaicPacificoAct))
      .filterBounds(region);
    
    // Load classification and prepare for filtering
    var input = _this.getImage(config);
    var inputImage = _this.fillMissingBands(config);
    var originalImage = inputImage;
    print('Original image loaded:', originalImage);
    
    // Remove ignored years from filter processing
    if (config.yearsToIgnore && config.yearsToIgnore.length > 0) {
      inputImage = _this.removeIgnoredBands(inputImage, config.yearsToIgnore);
    }
    
    // Apply hidden area mask if activated
    var hiddenMask = null;
    if (config.hidden.activate) {
      hiddenMask = _this.createHiddenMask(config, region, regionMask);
      if (hiddenMask) {
        Map.addLayer(hiddenMask, { min: 0, max: 1 }, 'Hidden Mask', false);
      }
    }
    
    // Apply frequency filter
    var filtered = _this.frequencyFilter({
      image: inputImage,
      hiddenMask: hiddenMask,
      classIds: config.classIds,
      vegetationPercent: config.vegetationPercent,
      majorityPercent: config.majorityPercent,
      years: config.years
    });

    // Restore excluded years to original values
    if (config.yearsToExclude && config.yearsToExclude.length > 0) {
      filtered = _this.excludeYears(
        inputImage,
        filtered,
        config.yearsToExclude,
        'classification'
      );
    }
    
    // Restore excluded classes from original image
    if (config.classesToExclude && config.classesToExclude.length > 0) {
      filtered = _this.excludeClasses(
        inputImage,
        filtered,
        config.classesToExclude
      );
    }
    
    // Add back ignored years from original image
    if (config.yearsToIgnore && config.yearsToIgnore.length > 0) {
      filtered = _this.addIgnoredBands(filtered, originalImage, config.yearsToIgnore);
    }
    
    print('Filtered image:', filtered);
    
    // Add main layers to map
    if (config.yearsPreview.length > 0) {
      var yearTitle = config.yearsPreview[0];
      Map.addLayer(
        originalImage,
        { bands: ["classification_" + yearTitle], min: 0, max: config.palette.length - 1, palette: config.palette },
        'Original Classification',
        false
      );
      Map.addLayer(
        filtered,
        { bands: ["classification_" + yearTitle], min: 0, max: config.palette.length - 1, palette: config.palette },
        'Frequency Filtered',
        false
      );
    }

    // Display preview years
    config.yearsPreview.forEach(function(year) {
      if (config.addMosaic) {
        _this.addMosaic(mosaic, year, regionMask);
      }
      _this.addClassification(originalImage, year, config.palette, 'CLASSIFICATION');
      _this.addClassification(filtered, year, config.palette, 'FILTERED');
    });
    
    // Add legend to map
    mapLegend(Map, config.legendTitle, config.legendColors, config.legendLabels, config.legendPosition);
    
    // Generate comparison charts if enabled
    if (param.chart.generate) {
      _this.generateCharts(config, region, originalImage, filtered);
    }
    
    // Export filtered image to asset
    _this.exportFilteredImage(filtered, config, region);
    
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
    var yearMosaic = mosaicCollection.filterMetadata('year', 'equals', year);
    
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
        var mosaicImage = yearMosaic.median().updateMask(regionMask);
        
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
        image,
        {
          bands: ['classification_' + yearNum],
          min: 0,
          max: palette.length - 1,
          palette: palette
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
   * Fill missing year bands with placeholder (27) and mask them
   */
  this.fillMissingBands = function(config) {
    var inputPath = config.inputPath;
    var country = config.country;
    var regionId = config.regionId;
    var inputVersion = config.inputVersion;
    var years = config.years;
    
    var inputImage = ee.Image(inputPath + country + '-' + regionId + '-' + inputVersion);
    var expectedBandNames = ee.List(years.map(function(year) {
      return 'classification_' + year;
    }));
    
    // Get existing band names
    var existingBands = inputImage.bandNames();
    var missingBands = expectedBandNames.removeAll(existingBands);
    
    // Create placeholder images (value 27) for missing years
    var missingImages = ee.ImageCollection(
      ee.Algorithms.If(
        ee.Algorithms.IsEqual(missingBands.size(), 0),
        ee.ImageCollection([]),
        ee.ImageCollection(
          missingBands.map(function(band) {
            var stringBand = ee.String(band);
            var stringYear = stringBand.slice(-4);
            return ee.Image(27).rename(stringBand).set('year', stringYear);
          })
        )
      )
    );
    
    // Get valid classification images
    var validImages = ee.ImageCollection(
      existingBands.map(function(bandName) {
        var stringYear = ee.String(bandName).slice(-4);
        return inputImage.select([bandName]).set('year', stringYear);
      })
    );
    
    // Merge valid and missing images (mask value 27)
    var classification = missingImages.merge(validImages)
      .map(function(image) {
        return image.updateMask(image.unmask().neq(27));
      })
      .sort('year')
      .toBands();
    
    return classification.select(classification.bandNames(), expectedBandNames);
  };
  
  /**
   * Main frequency filter algorithm
   * Calculates pixel frequency across time series and applies majority rule
   */
  this.frequencyFilter = function(config) {
    var image = config.image;
    var classIds = config.classIds;
    var hiddenMask = config.hiddenMask;
    var naturalVegetation = config.vegetationPercent;
    var majorityPercent = config.majorityPercent;
    var years = config.years;
    
    // Build expression to calculate percentage
    // Format: 100*((b0 + b1 + b2 + ... + bn)/number_of_years)
    var exp = '100*((';
    years.forEach(function(y, i) {
      exp = exp + 'b(' + i + ')+';
    });
    exp = exp + '0)/' + years.length + ')';
    print('Frequency expression:', exp);
  
    // Calculate frequency for each class
    var frequency = ee.Image(0);
  
    classIds.forEach(function(classId) {
      var frequencyClass = image
        .eq(classId)
        .expression(exp)
        .rename("class" + classId);
      
      frequency = frequency.addBands(frequencyClass);
    });
  
    //Frequency mask (freq >%)
    var vegetationMask = frequency.reduce("sum");
    
    // Identify areas to modify (where natural vegetation frequency > threshold)
    vegetationMask = ee.Image(0)
      .where(vegetationMask.gt(naturalVegetation), 1);
  
    // Reclassify pixels based on class frequencies
    var vegetationMap = ee.Image(0);
    
    classIds.forEach(function(classId) {
      var frequencyClass = frequency.select("class" + classId);
      
      if (hiddenMask) {
        vegetationMap = vegetationMap
          .where(
            vegetationMask.eq(1)
              .and(frequencyClass.gt(majorityPercent))
              .and(hiddenMask.eq(0)),
            classId
          );
      } else {
        vegetationMap = vegetationMap
          .where(
            vegetationMask.eq(1)
              .and(frequencyClass.gt(majorityPercent)),
            classId
          );
      }
    });
  
    vegetationMap = vegetationMap.updateMask(vegetationMap.neq(0));
    return image.where(vegetationMap, vegetationMap);
  };
  
  /**
   * Remove ignored years from the image for filter processing
   */
  this.removeIgnoredBands = function(image, yearsToIgnore) {
    var imageBands = image.bandNames();
    var bandsToIgnore = ee.List(yearsToIgnore.map(function(year) {
      return 'classification_' + year;
    }));
    var bandsToKeep = imageBands.removeAll(bandsToIgnore);
    return image.select(bandsToKeep);
  };
  
  /**
   * Create hidden area mask based on user parameters
   */
  this.createHiddenMask = function(config, regionOriginal, regionRasterMask) {
    if (!config.hidden.areas) return null;
    
    var hiddenMask = config.hidden.areas
      .reduceToImage(['id'], ee.Reducer.first())
      .clipToBoundsAndScale(regionOriginal, null, null, null, 30)
      .unmask(0)
      .updateMask(regionRasterMask);
    
    // Invert mask if applying outside the area
    if (config.hidden.inside === false) {
      hiddenMask = hiddenMask.remap([0, 1], [1, 0]);
    }
    return hiddenMask;
  };
  
  /**
   * --------------------------------------------------------------------------
   * UTILITY METHODS
   * --------------------------------------------------------------------------
   */
  
  /**
   * Restore original values for excluded years
   */
  this.excludeYears = function(original, output, yearsToExclude, bandsPrefix) {
    var bandsToExclude = ee.List(
      yearsToExclude.map(function(year) {
        return bandsPrefix + '_' + year;
      })
    );
    
    var excludedBands = original.select(bandsToExclude);
    output = output.addBands(excludedBands, null, true);
    
    print('Restored original values for years:', yearsToExclude);
    return output;
  };
  
  /**
   * Restore original values for excluded classes
   */
  this.excludeClasses = function(input, output, classes) {
    var classified = ee.List([]);
    
    classes.forEach(function(classId) {
      var classMask = input.eq(classId).selfMask();
      classified = classified.add(input.updateMask(classMask).selfMask());
    });
    
    classified = ee.ImageCollection(classified);
    classified = classified.max();
    output = output.blend(classified);
    
    print('Restored original values for classes:', classes);
    return output;
  };
  
  /**
   * Add back ignored years from original image
   */
  this.addIgnoredBands = function(image, original, yearsToIgnore) {
    var bandsPrefix = 'classification';
    var bandsToAdd = ee.List(
      yearsToIgnore.map(function(year) {
        return bandsPrefix + '_' + year;
      })
    );
    
    var originalBands = original.select(bandsToAdd);
    image = image.addBands(originalBands);
    
    // Sort bands alphabetically (chronologically)
    var bandNames = image.bandNames();
    var sortedBandNames = bandNames.sort();
    image = image.select(sortedBandNames);
    
    return image;
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
   * Export filtered image to Google Earth Engine asset
   */
  this.exportFilteredImage = function(image, config, region) {
    var filename = config.country + '-' + config.regionId + '-' + config.outputVersion;
    var imageId = config.outputPath + filename;
    
    Export.image.toAsset({
      image: image
        .byte()
        .reproject('EPSG:4326', null, 30)
        .set({
          step: 'Frequency-filter',
          version: config.outputVersion
        }),
      description: filename,
      assetId: imageId,
      scale: config.scaleNumber,
      pyramidingPolicy: { '.default': 'mode' },
      maxPixels: 1e13,
      region: region.geometry().bounds()
    });
    
    print('Exporting to:', imageId);
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
  
  // Initialize and return
  return this.init(param);
};

// Execute the frequency filter
new FrequencyFilter(param);