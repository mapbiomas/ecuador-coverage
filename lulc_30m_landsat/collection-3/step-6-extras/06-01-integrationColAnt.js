/**
 * @name
 *      02-2-integration-classifications-withoutFilters.js
 * 
 * @description
 *      Script that integrates classifications from past collections without filters,
 *      created because there are differences between classification regions,
 *      therefore a pre-filter integration was necessary
 * 
 * @author
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez
 *
 * @Date
 *      01/20/2025
 */

/**
 * USER PARAMETERS
 */

var param = {
  regions:    [40101, 40102, 40103, 40104, 40105, 40201, 40202, 40203, 40204, 40205, 40601, 40602, 40603, 40604, 40605, 40606, 40607, 40608, 40609, 40901, 40902, 40903, 40904, 40905, 40906, 40907, 40908, 40909, 40910],
  versions:   [ 2,      2,    2,      2,    1,      2,      2,    2,      1,    2,     2,     2,    2,        2,    2,    2,      2,    2,     2,     2,      2,    2,    4,      3,      1,    2,      2,    2,    3],
  years: [
    1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,
    1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,
    2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,
    2018,2019,2020,2021,2022,2023,2024
  ],
  classificationPaths: 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION3/GENERAL_MAP/CLASSIFICATION/classification-ft', // Path where pre-filter classifications are stored
  regionsPath: 'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/regionesClassif_Col3', // Classification regions vector
  palette: require("users/mapbiomas/modules:Palettes.js").get('ecuador2'), // Color palette for Ecuador
  assetExport: 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION4/GENERAL_MAP/CLASSIFICATION/' // Output asset path
};

// Load region features
var regionFeatures = ee.FeatureCollection(param.regionsPath);
Map.addLayer(regionFeatures.style({fillColor: '00000000', color: 'FF0000'}), {}, 'Classification Regions');

// Get combined geometry of all regions
var regionGeometry = regionFeatures.geometry().dissolve();

// Generate asset names correctly
var nameList = param.regions.map(function(region, index) {
  return 'ECUADOR-' + region + '-' + param.versions[index];
});
print('Asset name list:', nameList);

// Load all classifications at once
var classificationCollection = ee.ImageCollection(
  nameList.map(function(name) {
    return ee.Image(param.classificationPaths + '/' + name);
  })
);
print('Classification collection:', classificationCollection);

// Create integration image using proper iteration
var bandNames = param.years.map(function(year) {
  return 'classification_' + year;
});

// Process each year to create a mosaic of all regions
var yearImages = param.years.map(function(year) {
  var bandName = 'classification_' + year;
  
  // For each year, create a mosaic of all regions
  var yearMosaic = classificationCollection
    .map(function(img) {
      // Check if the band exists
      return img.select([bandName], [bandName]);
    })
    .mosaic()
    .rename(bandName);
  
  return yearMosaic;
});

// Create multi-band image correctly
var integrateImage = ee.Image.cat(yearImages);
print('Integrated image:', integrateImage);

// Visualization
Map.addLayer(
  integrateImage.select('classification_1985'), 
  {
    min: 0,
    max: param.palette.length - 1,
    palette: param.palette
  }, 
  'Year 1985'
);

Map.centerObject(regionFeatures, 6);

// Export
var imageName = 'Integration_nacional_pre_filter_col3';
Export.image.toAsset({
  image: integrateImage
    .byte()
    .reproject('EPSG:4326', null, 30)
    .set({
      step: 'classifier', 
      version: 1
    }),
  description: imageName,
  assetId: param.assetExport + imageName,
  region: regionGeometry.bounds(),
  pyramidingPolicy: {
    '.default': 'mode'
  },
  scale: 30,
  crs: 'EPSG:4326', 
  maxPixels: 1e13
});

// Final verification
print('Number of bands in final image:', integrateImage.bandNames().length());
print('Available bands:', integrateImage.bandNames());