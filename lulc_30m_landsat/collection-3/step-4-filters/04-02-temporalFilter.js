
/**
 * @name
 *      03-2-temporal-filter-ecuador.js 
 * 
 * @description
 *      TEMPORAL FILTER
 *      Filter that compares intermediate years with the upper or lower year.
 *      Changes the pixel value if the intermediate year is different and both
 *      the upper and lower years have the same value.
 * 
 * @authors
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @date
 *      21/01/2025
 *      28/04/2025    Modified by Fabricio Garcés
 */

/**
 * ----------------------------------------------------------------------------
 * USER PARAMETERS
 * ----------------------------------------------------------------------------
 */
var param = {
  regionId: 40201,
  country: 'ECUADOR',
  // Years to process
  years: ee.List.sequence(1985, 2025).getInfo(),
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
  // Years where filter should not modify values (preserve original)
  exclusion: {
    years: [],
    classes: []
  },
  // Years to completely ignore (filter doesn't use them or modify them)
  ignore: {
    years: [],
  },  
  addRegion: true,
  addMosaic: true,
  // Versions
  inputVersion: 32145,
  outputVersion: 32144,
  
  // Filter execution sequence
  // Example: if passing 3 -> FF NV FF NV FF NV FF = FF FF FF FF FF FF FF
  // Priority order determines which class is applied when multiple rules match
  filterExecution: [
    { name: 'first3',  order: [3, 21, 25] },
    { name: 'middle3', order: [3, 21, 25] },
    { name: 'middle4', order: [3, 21, 25] },
    { name: 'middle3', order: [3, 21, 25] },
    { name: 'middle5', order: [3, 21, 25] },
    { name: 'middle4', order: [3, 21, 25] },
    { name: 'middle3', order: [3, 21, 25] },
    { name: 'last3',   order: [3, 21, 25] },
  ],
  // Action area - Apply filter inside or outside a specific area
  hidden: {
    activate: false,
    areas: hidden_0,        // null if not used, hidden_0 for manually drawn polygon
    mask: MaskAntropico,    // null if not used, name of imported mask asset
    inside: true           // true = apply inside the area, false = apply outside
  },
  
  // Chart generation settings
  chart: {
    generate: true,        // true = print chart, false = don't print chart
    classIds: [3, 33],    // Classes to plot in console (both original and filtered)
  },
  
  // Directory paths module
  dirPath: require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths,
};

/**
 * ----------------------------------------------------------------------------
 * TEMPORAL FILTER CLASS
 * ----------------------------------------------------------------------------
 */
var TemporalFilter = function(param) {
  
  var _this = this;
  
  /**
   * Initialize and execute the temporal filter
   */
  this.init = function(param) {
    
    var config = {
      scaleNumber: 30,
      years: param.years,
      mapType: 'SATELLITE',
      collectionField: 'id_regionC',
      country: param.country,
      regionId: param.regionId,
      inputVersion: param.inputVersion,
      yearsPreview: param.yearsPreview,
      yearsToExclude: param.exclusion.years,
      yearsToIgnore: param.ignore.years,
      classesToExclude: param.exclusion.classes,
      outputVersion: param.outputVersion,
      addRegion: param.addRegion,
      addMosaic: param.addMosaic,
      hidden: param.hidden,
      legendTitle: 'Land cover',
      legendPosition: 'bottom-right',
      legendColors: [ 
        '006400', 
        '00ff00', 
        '45c2a5',
        'b8af4f',
        'f1c232', 
        'ffffb2', 
        'FA8784',
        '665a3a',
        '0000ff'
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
      filterExecution: param.filterExecution,
      functions: require('users/mapbiomasecuador/LULC:COLECCION3/api').functions,
      inputPath: param.dirPath.pathClassificationActFilter,
      outputPath: param.dirPath.pathClassificationActFilter,
      regionPath: param.dirPath.regionVectorAct,
      palette: require('users/kahuertas/mapbiomas-colombia:mapbiomas-colombia/collection-3/modules/Palettes.js').get('ColombiaCol3')
    };
    

    // Import functions from API
    var mapLegend = _this.mapLegend

    config.palette[4] = '#7dc975';
    
    var region = ee.FeatureCollection(param.dirPath.regionVectorAct)
      .filterMetadata('id_regionC', 'equals', param.regionId);
    
    var setVersion = function(item) { return item.set('version', 1) };
    
    var regionMask = region
      .map(setVersion)
      .reduceToImage(['version'], ee.Reducer.first());
    
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
    
    var filtered = inputImage;
  
    // Apply hidden area mask if activated
    if (config.hidden.activate) {
      var hiddenMask = _this.createHiddenMask(config, region, regionMask);
      Map.addLayer(hiddenMask, { min: 0, max: 1 }, 'Hidden Mask', false);
    }
    
    // Apply sequence of temporal filters
    config.filterExecution.forEach(function(filter) {
      filtered = _this.applyFilter({
        image: filtered,
        years: config.years,
        yearsIgnore: config.yearsToIgnore,
        classOrder: filter.order,
        filterName: filter.name,
        hiddenMask: hiddenMask,
      });
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
    
    // Add layers to map
    var yearTitle = ee.List(config.yearsPreview).get(0).getInfo();
    Map.addLayer(
      originalImage,
      { bands: ["classification_" + yearTitle], min: 0, max: config.palette.length - 1, palette: config.palette },
      'Original Classification',
      false
    );
    Map.addLayer(
      filtered,
      { bands: ["classification_" + yearTitle], min: 0, max: config.palette.length - 1, palette: config.palette },
      'Temporal Filtered',
      false
    );

    // Display preview years
    config.yearsPreview.map(function(year) {
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
      .toBands()
      .updateMask(inputImage.select([existingBands.get(0)]));
    
    return classification.select(classification.bandNames(), expectedBandNames);
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
    var hiddenMask = null;
    
    if (config.hidden.areas && config.hidden.mask) {
      hiddenMask = config.hidden.areas
        .reduceToImage(['id'], ee.Reducer.first())
        .clipToBoundsAndScale(regionOriginal, null, null, null, 30)
        .unmask(0)
        .updateMask(regionRasterMask);
      
      print('Using both drawn polygons and external mask');
      hiddenMask = hiddenMask.blend(config.hidden.mask.updateMask(regionRasterMask));
    } else if (config.hidden.areas) {
      print('Using drawn polygons only');
      hiddenMask = config.hidden.areas
        .reduceToImage(['id'], ee.Reducer.first())
        .clipToBoundsAndScale(regionOriginal, null, null, null, 30)
        .unmask(0)
        .updateMask(regionRasterMask);
    } else if (config.hidden.mask) {
      print('Using external mask only');
      var baseImage = regionRasterMask.multiply(ee.Image(0));
      hiddenMask = config.hidden.mask.updateMask(regionRasterMask);
      hiddenMask = baseImage.blend(hiddenMask);
    }
    
    // Invert mask if applying outside the area
    if (config.hidden.inside === false) {
      hiddenMask = hiddenMask.remap([0, 1], [1, 0]);
    }
    
    return hiddenMask;
  };
  
  /**
   * Apply a specific temporal filter to the image
   */
  this.applyFilter = function(params) {
    var image = params.image;
    var classOrder = params.classOrder;
    var hiddenMask = params.hiddenMask;
    var filterName = params.filterName;
    var years = params.years;
    var prefix = params.bandsPrefix || 'classification';
    var yearsIgnore = params.yearsIgnore;
    
    // Remove ignored years from the year list
    years = ee.List(years);
    years = years.removeAll(yearsIgnore).getInfo();
    
    var original = null;
    if (hiddenMask) {
      original = image;
    }
    
    // Apply filter sequentially for each class in priority order
    classOrder.forEach(function(classId) {
      image = _this.windows[filterName](image, classId, years, prefix);
    });
    
    // Apply hidden mask if specified
    if (hiddenMask) {
      image = image.updateMask(hiddenMask);
      image = original.blend(image);
    }
    
    return image;
  };
  
  /**
   * --------------------------------------------------------------------------
   * TEMPORAL MASKS - Define the pattern detection rules
   * --------------------------------------------------------------------------
   */
  this.masks = {
    /**
     * 3-year pattern: X Y X -> changes Y to X
     */
    middle3: function(value, year, years, image, prefix) {
      var position = years.indexOf(year);
      var year1 = image.select(prefix + '_' + years[position - 1]);
      var year2 = image.select(prefix + '_' + year);
      var year3 = image.select(prefix + '_' + years[position + 1]);
      
      var mask = year1.eq(value)
        .and(year2.neq(value))
        .and(year3.eq(value));
      
      var remapped = image
        .select(prefix + '_' + year)
        .mask(mask.eq(1))
        .where(mask.eq(1), value);
      
      return image
        .select(prefix + '_' + year)
        .blend(remapped);
    },
    
    /**
     * 4-year pattern: X Y Z X -> changes Y and Z to X
     */
    middle4: function(value, year, years, image, prefix) {
      var position = years.indexOf(year);
      var year1 = image.select(prefix + '_' + years[position - 1]);
      var year2 = image.select(prefix + '_' + year);
      var year3 = image.select(prefix + '_' + years[position + 1]);
      var year4 = image.select(prefix + '_' + years[position + 2]);
      
      var mask = year1.eq(value)
        .and(year2.neq(value))
        .and(year3.neq(value))
        .and(year4.eq(value));
      
      var remapped0 = year2.mask(mask.eq(1)).where(mask.eq(1), value);
      var remapped1 = year3.mask(mask.eq(1)).where(mask.eq(1), value);
      
      return year2.blend(remapped0).blend(remapped1);
    },
    
    /**
     * 5-year pattern: X Y Z W X -> changes Y, Z, W to X
     */
    middle5: function(value, year, years, image, prefix) {
      var position = years.indexOf(year);
      var year1 = image.select(prefix + '_' + years[position - 1]);
      var year2 = image.select(prefix + '_' + year);
      var year3 = image.select(prefix + '_' + years[position + 1]);
      var year4 = image.select(prefix + '_' + years[position + 2]);
      var year5 = image.select(prefix + '_' + years[position + 3]);
      
      var mask = year1.eq(value)
        .and(year2.neq(value))
        .and(year3.neq(value))
        .and(year4.neq(value))
        .and(year5.eq(value));
      
      var remapped0 = year2.mask(mask.eq(1)).where(mask.eq(1), value);
      var remapped1 = year3.mask(mask.eq(1)).where(mask.eq(1), value);
      var remapped2 = year4.mask(mask.eq(1)).where(mask.eq(1), value);
      
      return year2.blend(remapped0).blend(remapped1).blend(remapped2);
    },
    
    /**
     * First 3-year pattern: X X Y -> changes Y to X (for beginning of time series)
     */
    first3: function(value, years, image, prefix) {
      var baseYear = years[0];
      var year1 = image.select(prefix + '_' + baseYear);
      var year2 = image.select(prefix + '_' + (baseYear + 1));
      var year3 = image.select(prefix + '_' + (baseYear + 2));
      
      var mask = year1.neq(value)
        .and(year2.eq(value))
        .and(year3.eq(value));
      
      var outputBands = image.bandNames().slice(1);
      var remapped = year1.mask(mask.eq(1)).where(mask.eq(1), value);
      var output = year1.blend(remapped);
      
      return output.addBands(image.select(outputBands));
    },
    
    /**
     * Last 3-year pattern: Y X X -> changes Y to X (for end of time series)
     */
    last3: function(value, years, image, prefix) {
      var baseYear = years.slice(-3)[0];
      var year1 = image.select(prefix + '_' + baseYear);
      var year2 = image.select(prefix + '_' + (baseYear + 1));
      var year3 = image.select(prefix + '_' + (baseYear + 2));
      
      var mask = year1.eq(value)
        .and(year2.eq(value))
        .and(year3.neq(value));
      
      var bands = image.bandNames();
      var firstBand = ee.String(bands.get(0));
      var outputBands = bands.slice(1, years.length - 1);
      
      var remapped = year3.mask(mask.eq(1)).where(mask.eq(1), value);
      var output = image.select(firstBand).addBands(image.select(outputBands));
      
      return output.addBands(year3.blend(remapped));
    },
  };
  
  /**
   * --------------------------------------------------------------------------
   * TEMPORAL WINDOWS - Apply masks across the time series
   * --------------------------------------------------------------------------
   */
  this.windows = {
    middle3: function(image, value, years, prefix) {
      var start = years[0];
      var finish = years.slice(-1)[0];
      
      var output = image.select(prefix + '_' + start);
      
      years.slice(1).forEach(function(year) {
        output = year < finish
          ? output.addBands(_this.masks.middle3(value, year, years, image, prefix))
          : output.addBands(image.select(prefix + '_' + year));
      });
      
      return output;
    },
    
    middle4: function(image, value, years, prefix) {
      var start = years[0];
      var finish = years.slice(-2)[0];
      
      var output = image.select(prefix + '_' + start);
      
      years.slice(1).forEach(function(year) {
        output = year < finish
          ? output.addBands(_this.masks.middle4(value, year, years, image, prefix))
          : output.addBands(image.select(prefix + '_' + year));
      });
      
      return output;
    },
    
    middle5: function(image, value, years, prefix) {
      var start = years[0];
      var finish = years.slice(-3)[0];
      
      var output = image.select(prefix + '_' + start);
      
      years.slice(1).forEach(function(year) {
        output = year < finish
          ? output.addBands(_this.masks.middle5(value, year, years, image, prefix))
          : output.addBands(image.select(prefix + '_' + year));
      });
      
      return output;
    },
    
    last3: function(image, value, years, prefix) {
      return _this.masks.last3(value, years, image, prefix);
    },
    
    first3: function(image, value, years, prefix) {
      return _this.masks.first3(value, years, image, prefix);
    },
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
    
    original = original.select(bandsToAdd);
    image = image.addBands(original);
    
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
      image: image.byte()
              .reproject('EPSG:4326', null, 30)
              .set({
                step: 'temporal-filter',
                version: config.outputVersion
              }),
      description: filename,
      assetId: imageId,
      scale: config.scaleNumber,
      pyramidingPolicy: { '.default': 'mode' },
      maxPixels: 1e13,
      region: region.geometry().bounds()
    });
  };
  
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
  
  var makeRow = function(color, name) {
    // Create the label that is actually the colored box.
    var colorBox = ui.Label({
      style: {
        backgroundColor: color,
        margin: '5px 0 0 0',
        height: "12px",
        width: "12px"
      }
    });
  
    // Create the label filled with the description text.
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
  
    // return the panel
    return ui.Panel({
      widgets: [colorBox, description],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {
        backgroundColor: "#ffffff00"
      }
    });
  };
  
  // generate legend
  for (var i = 0; i < labels.length; i++) {
    legend.add(makeRow(colors[i], labels[i]));
  }
  
  map.add(legend);
}
  
  
  return this.init(param);
};

// Execute the temporal filter
new TemporalFilter(param);