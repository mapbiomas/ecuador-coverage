/**
 * @name
 *      02-4-temporal-gap-fill-ecuador.js
 * 
 * @description
 *      TEMPORAL GAP FILLING
 *      Script to apply temporal gap filling to annual classifications.
 *      Fills missing pixels in each year using information from adjacent years.
 * 
 * @authors
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @date
 *      20/01/2025
 *      15/04/2025
 */

/**
 * USER PARAMETERS
 */
var param = {
  // Classification region and country
  regionId: 40201,
  country: 'ECUADOR',
  inputCollection: 'classification', // 'classification' or 'classification-ft'
  
  // Years to process
  years: ee.List.sequence(1985, 2025).getInfo(),

  // Years to preview on map
  yearsPreview: [
    1985, 1986, 1987, 1988, 1990, 1991, 2005,
    2022, 2023, 2024, 2025
  ],
  
  // Versions
  inputVersion: 32146,
  outputVersion: 32145,
  
  // If true, applies gap fill again to already filled image
  refill: false,
  
  exclusion: {
    classes: [],  // List of classes to exclude in all years
    years: [],    // Years that don't contribute to others (only receive)
  },
  
  fillOrder: 't0tn_tnt0', // 't0tn_tnt0' or 'tnt0_t0tn'
  
  addRegion: true,
  addMosaic: true,
  
  // Directory paths module
  dirPath: require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths,
};

// Load color palette
var palette = require('users/kahuertas/mapbiomas-colombia:mapbiomas-colombia/collection-3/modules/Palettes.js').get('ColombiaCol3');
palette[4] = '#7dc975';

// Set input and output paths
param.inputPath = param.dirPath.pathClasificationGeneralMap + param.inputCollection + '/';
param.outputPath = param.dirPath.pathClassificationActFilter;

/**
 * ----------------------------------------------------------------------------
 * REGION SETUP
 * ----------------------------------------------------------------------------
 */
var region = ee.FeatureCollection(param.dirPath.regionVectorAct)
  .filterMetadata('id_regionC', 'equals', param.regionId);

var setVersion = function(item) { return item.set('version', 1); };

var regionMask = region
  .map(setVersion)
  .reduceToImage(['version'], ee.Reducer.first());

// Load mosaic collection for visualization
var mosaic = ee.ImageCollection(param.dirPath.mosaicRaisgAct)
  .merge(ee.ImageCollection(param.dirPath.mosaicPacificoAct))
  .filterBounds(region);

/**
 * ----------------------------------------------------------------------------
 * LOAD AND PREPARE CLASSIFICATION IMAGES
 * ----------------------------------------------------------------------------
 */
var filledMissingBands = fillMissingBands(param);
var originalImage = filledMissingBands.original;
var inputImage = filledMissingBands.classification;

// Apply class exclusion mask if specified
var bands = inputImage.bandNames().getInfo();
if (param.exclusion.classes && param.exclusion.classes.length > 0) {
  bands.forEach(function(bandName) {
    var bandImage = inputImage.select(bandName);
    
    // Create mask excluding specified classes
    var mask = param.exclusion.classes.reduce(function(mask, classValue) {
      var singleMask = bandImage.neq(classValue);
      return mask.and(singleMask);
    }, ee.Image.constant(1));
    
    var maskedBand = bandImage.updateMask(mask);
    inputImage = inputImage.addBands(maskedBand, null, true);
  });
}

// Display original and masked images
var yearTitle = ee.List(param.yearsPreview).get(0).getInfo();
Map.addLayer(
  originalImage,
  { bands: ["classification_" + yearTitle], min: 0, max: palette.length - 1, palette: palette },
  'Original Classification',
  false
);

Map.addLayer(
  inputImage,
  { bands: ["classification_" + yearTitle], min: 0, max: palette.length - 1, palette: palette },
  'Masked Image',
  false
);

/**
 * ----------------------------------------------------------------------------
 * GAP FILLING FUNCTIONS
 * ----------------------------------------------------------------------------
 */
var gapFillMethods = {
  
  /**
   * Fill forward (t0 to tn) then backward (tn to t0)
   */
  't0tn_tnt0': function(image, yearsToExclude) {
    var bands = image.bandNames();
    var original = image;
    
    // Create empty masks for excluded years
    if (yearsToExclude && yearsToExclude.length > 0) {
      yearsToExclude.forEach(function(year) {
        var bandName = 'classification_' + year;
        var emptyMask = ee.Image(27).neq(27).selfMask().rename(bandName);
        image = image.addBands(emptyMask, [bandName], true);
      });
    }
    
    // Forward fill: from first year to last
    var imageFilledForward = bands.slice(1).iterate(
      function(bandName, previousImage) {
        var currentImage = image.select(ee.String(bandName));
        previousImage = ee.Image(previousImage);
        currentImage = currentImage.unmask(previousImage.select([0]));
        return currentImage.addBands(previousImage);
      },
      ee.Image(image.select([bands.get(0)]))
    );
    
    imageFilledForward = ee.Image(imageFilledForward);
    
    // Backward fill: from last year to first
    var bandsReversed = bands.reverse();
    var imageFilledBackward = bandsReversed.slice(1).iterate(
      function(bandName, previousImage) {
        var currentImage = imageFilledForward.select(ee.String(bandName));
        previousImage = ee.Image(previousImage);
        
        currentImage = currentImage.unmask(
          previousImage.select(previousImage.bandNames().length().subtract(1))
        );
        
        return previousImage.addBands(currentImage);
      },
      ee.Image(imageFilledForward.select([bandsReversed.get(0)]))
    );
    
    imageFilledBackward = ee.Image(imageFilledBackward).select(bands);
    
    // Restore excluded years to original values
    var output = (yearsToExclude && yearsToExclude.length > 0)
      ? excludeYears(original, imageFilledBackward, yearsToExclude, 'classification')
      : imageFilledBackward;
    
    return output;
  },
  
  /**
   * Fill backward (tn to t0) then forward (t0 to tn)
   */
  'tnt0_t0tn': function(image, yearsToExclude) {
    var bands = image.bandNames();
    var original = image;
    
    // Create empty masks for excluded years
    if (yearsToExclude && yearsToExclude.length > 0) {
      yearsToExclude.forEach(function(year) {
        var bandName = 'classification_' + year;
        var emptyMask = ee.Image(27).neq(27).selfMask().rename(bandName);
        image = image.addBands(emptyMask, [bandName], true);
      });
    }
    
    // Backward fill: from last year to first
    var bandsReversed = bands.reverse();
    var imageFilledBackward = bandsReversed.slice(1).iterate(
      function(bandName, previousImage) {
        var currentImage = image.select(ee.String(bandName));
        previousImage = ee.Image(previousImage);
        
        currentImage = currentImage.unmask(
          previousImage.select(previousImage.bandNames().length().subtract(1))
        );
        
        return previousImage.addBands(currentImage);
      },
      ee.Image(image.select([bandsReversed.get(0)]))
    );
    
    imageFilledBackward = ee.Image(imageFilledBackward);
    
    // Forward fill: from first year to last
    var imageFilledForward = bands.slice(1).iterate(
      function(bandName, previousImage) {
        var currentImage = imageFilledBackward.select(ee.String(bandName));
        previousImage = ee.Image(previousImage);
        currentImage = currentImage.unmask(previousImage.select([0]));
        return currentImage.addBands(previousImage);
      },
      ee.Image(imageFilledBackward.select([bands.get(0)]))
    );
    
    imageFilledForward = ee.Image(imageFilledForward).select(bands);
    
    // Restore excluded years to original values
    var output = (yearsToExclude && yearsToExclude.length > 0)
      ? excludeYears(original, imageFilledBackward, yearsToExclude, 'classification')
      : imageFilledBackward;
    
    return output;
  }
};

/**
 * ----------------------------------------------------------------------------
 * APPLY GAP FILLING
 * ----------------------------------------------------------------------------
 */
var fillOrder = param.fillOrder;
var gapFilledImage;

// Apply gap fill with or without excluded years
if (param.exclusion.years && param.exclusion.years.length > 0) {
  gapFilledImage = gapFillMethods[fillOrder](inputImage, param.exclusion.years);
} else {
  gapFilledImage = gapFillMethods[fillOrder](inputImage, []);
}

// Apply refill if specified
if (param.refill) {
  gapFilledImage = gapFillMethods[fillOrder](gapFilledImage, []);
}

/**
 * ----------------------------------------------------------------------------
 * RESTORE EXCLUDED CLASSES FROM ORIGINAL IMAGE
 * ----------------------------------------------------------------------------
 */
var bandsGapfill = gapFilledImage.bandNames().getInfo();

if (param.exclusion.classes && param.exclusion.classes.length > 0) {
  bandsGapfill.forEach(function(bandName) {
    var originalBand = originalImage.select(bandName);
    
    param.exclusion.classes.forEach(function(classValue) {
      var gapfillBand = gapFilledImage.select(bandName);
      
      // Create mask for excluded class pixels in original image
      var classMask = originalBand.updateMask(originalBand.unmask().eq(classValue));
      
      // Blend original class pixels into gap-filled image
      var blendedBand = gapfillBand.blend(classMask);
      gapFilledImage = gapFilledImage.addBands(blendedBand, null, true);
    });
  });
}

// Display final gap-filled image
Map.addLayer(
  gapFilledImage,
  { bands: ["classification_" + yearTitle], min: 0, max: palette.length - 1, palette: palette },
  'Gap Filled',
  false
);

/**
 * ----------------------------------------------------------------------------
 * ADD LAYERS TO MAP FOR PREVIEW YEARS
 * ----------------------------------------------------------------------------
 */
param.yearsPreview.forEach(function(year) {
  if (param.addMosaic) {
    addMosaic(mosaic, year, regionMask);
  }
  addClassification(originalImage, year, palette, 'Original');
  addClassification(gapFilledImage, year, palette, 'Gap Filled');
});

// Add region boundary if specified
if (param.addRegion) {
  Map.addLayer(region.style({ fillColor: '00000000', color: 'FF0000' }), {}, 'Region Boundary');
}

// Export asset
var filename = param.country + '-' + param.regionId + '-' + param.outputVersion;
var imageId = param.outputPath + filename;

Export.image.toAsset({
  image: gapFilledImage
        .reproject('EPSG:4326', null, 30)
        .byte()
  .set({
      step: 'gap-filter', 
      version: param.outputVersion
    }),
  description: filename,
  assetId: imageId,
  scale: 30,
  pyramidingPolicy: {
    '.default': 'mode'
  },
  maxPixels: 1e13,
  region: region.geometry().bounds()
});


/**
 * ----------------------------------------------------------------------------
 * FUNCTIONS
 * ----------------------------------------------------------------------------
 */

/**
 * Fill missing year bands in classification image
 */
function fillMissingBands(config) {
  var inputPath = config.inputPath;
  var country = config.country;
  var regionId = config.regionId;
  var inputVersion = config.inputVersion;
  var years = config.years;
  
  // Load base image
  var baseImage = ee.Image(inputPath + country + '-' + regionId + '-' + inputVersion);
  var expectedBandNames = ee.List(years.map(function(year) {
    return 'classification_' + year;
  }));
  
  var original = baseImage;
  
  // Check if this is a filtered collection or regular image
  if (inputPath.indexOf('-ft/') === -1) {
    // Get existing band names
    var existingBands = baseImage.bandNames();
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
    
    if (missingImages.size().getInfo() > 0) {
      print('Years without classification:', missingImages);
    }
    
    // Get valid classification images
    var validImages = ee.ImageCollection(
      existingBands.map(function(bandName) {
        var stringYear = ee.String(bandName).slice(-4);
        return baseImage.select([bandName]).set('year', stringYear);
      })
    );
    
    // Merge valid and missing images (with 27 unmasked)
    var classification_pre = missingImages
      .merge(validImages)
      .sort('year')
      .toBands()
      .updateMask(baseImage.select([existingBands.get(0)]));
    
    // Merge valid and missing images (with 27 masked)
    var classification = missingImages.merge(validImages)
      .map(function(image) {
        return image.updateMask(image.unmask().neq(27));
      })
      .sort('year')
      .toBands()
      .updateMask(baseImage.select([existingBands.get(0)]));
    
    return {
      classification: classification.rename(expectedBandNames),
      original: classification_pre.rename(expectedBandNames)
    };
  } else {
    // For filtered collections, return as is
    return {
      classification: baseImage,
      original: original
    };
  }
}

/**
 * Restore original values for excluded years
 */
function excludeYears(original, output, yearsToExclude, bandsPrefix) {
  var bandsToExclude = ee.List(
    yearsToExclude.map(function(year) {
      return bandsPrefix + '_' + year;
    })
  );
  
  var excludedBands = original.select(bandsToExclude);
  output = output.addBands(excludedBands, null, true);
  
  print('Unchanged years (original values preserved):', yearsToExclude);
  return output;
}

/**
 * Add mosaic layer to map for a specific year
 */
function addMosaic(mosaicCollection, year, regionMask) {
  var yearMosaic = mosaicCollection.filterMetadata('year', 'equals', year);
  
  // Filter by satellite for specific years
  if (year == 2022 || year == 2023 || year == 2024) {
    yearMosaic = yearMosaic.filterMetadata('satellite', 'equals', 'l8');
  }
  
  // For 2025, use 2024 L9 mosaic as placeholder
  if (year == 2025) {
    yearMosaic = mosaicCollection.filterMetadata('year', 'equals', 2024);
    yearMosaic = yearMosaic.filterMetadata('satellite', 'equals', 'l9');
    print('Using 2024 L9 mosaic as placeholder for 2025');
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
        'Mosaic ' + year.toString(),
        false
      );
    }
  });
}

/**
 * Add classification layer to map for a specific year
 */
function addClassification(image, year, palette, title) {
  ee.Number(year).evaluate(function(yearNum) {
    Map.addLayer(
      image,
      {
        min: 0,
        max: palette.length - 1,
        palette: palette,
        bands: ['classification_' + yearNum]
      },
      title + ' ' + yearNum,
      false
    );
  });
}