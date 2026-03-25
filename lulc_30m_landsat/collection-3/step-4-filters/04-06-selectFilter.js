/**
 * @name
 *     03-6-select-2024.js
 *  
 * @description
 *     Script that selects the last year as 2024 ('classification_2024' or 'classification_2025')
 *     and remaps to ensure all land cover classes are consistent in the general map.
 * 
 * @author
 *      Adrián Rodríguez
 *
 * @Date
 *      01/21/2025
 *      05/16/2025    Modified by Fabricio Garcés
 *      
 */

/**
 * USER PARAMETERS
 */

// Define classes and their new values
var param = {
  // Directory module
  dirPath: require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths,
  inputVersion: 32141,
  lastYearVersionBand: [32141, 'classification_2024'], // Enter version and band (classification_2024 or classification_2025)
  outputVersion: 32140,
  regionId: 40201,
  country: 'ECUADOR',
  mbCollectionId: 'COLECCION3',
  yearsPreview: [
    //1985, 
    //1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
    //1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 
    //2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
    2018, 2019, 2020, 2021, 2022, 2023, 2024    
    ],
  // Mosaic parameters
  satellites: ['l4', 'l5', 'l7', 'lx', 'l8'], //'l9', 'l4', 'l5', 'l7', 'lx', 'l8'
  remap: {
    from: [3, 4, 5, 6, 11, 12, 29, 13, 14, 15, 18, 21, 9, 22, 24, 30, 25, 33, 31, 34, 35, 68, 23, 27],
    to:   [3, 4, 5, 6, 11, 12, 29, 13, 14, 15, 18, 21, 9, 25, 24, 30, 25, 33, 31, 34, 35, 68, 23, 27]
  },
  years: ee.List.sequence(1985, 2024).getInfo()
};

// parameters
var years            = param.years;
var country          = param.country;
var regionId         = param.regionId;
var remapTo          = param.remap.to;
var remapFrom        = param.remap.from;
var yearsView        = param.yearsPreview;
var inputVersion     = param.inputVersion;
var outputVersion    = param.outputVersion;
var mbCollectionId   = param.mbCollectionId;
var inputCollection  = param.inputCollection;
var lastYearVersion  = param.lastYearVersionBand;
var palette          = require('users/mapbiomas/modules:Palettes.js').get('ecuador2');
var vis              = {bands:["classification_" + 2024] ,min: 0, max: palette.length - 1, palette: palette};
var basePath         = param.dirPath.pathClassificationActFilter;//'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION3/GENERAL_MAP/CLASSIFICATION/classification-ft/';
var regionsPath      = param.dirPath.regionVectorAct;//'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/regionesClassif_BUF50M_Col2';

// get images
var filename   = country + '-' + regionId + '-' + inputVersion;
var lyName     = country + '-' + regionId + '-' + lastYearVersion[0];
var outputName = country + '-' + regionId + '-' + outputVersion;

var image   = ee.Image(basePath + filename);
var lyImage = ee.Image(basePath + lyName);

// Load region of interest
var region = ee.FeatureCollection(param.dirPath.regionVectorAct)
  .filterMetadata('id_regionC', 'equals', param.regionId);

// Create region mask
var setVersion = function(item) { return item.set('version', 1); };
var regionMask = region
  .map(setVersion)
  .reduceToImage(['version'], ee.Reducer.first());

// Load mosaic collection for visualization
var mosaics = ee.ImageCollection(param.dirPath.mosaicRaisgAct)
  .merge(ee.ImageCollection(param.dirPath.mosaicPacificoAct))
  .filterBounds(region);
  
  mosaics = mosaics.filter(ee.Filter.inList('satellite', param.satellites));

// rebuild stack
var inputBandNames = years.map(function(year) { return 'classification_' + year });
var lastYearName   = lastYearVersion[1];
var lastYearOutput = inputBandNames[inputBandNames.length - 1];

var lastBand = lyImage
  .select(lastYearName)
  .rename(lastYearOutput);

var inputImage = image
  .select(inputBandNames)
  .addBands(lastBand, [lastYearOutput], true);

// convert dictionary to image
var outputImage = ee.ImageCollection(
  inputBandNames
    .map(function(band) {
      var input  = inputImage.select(ee.String(band));
      var output = input.remap(remapFrom, remapTo).rename([band]);
      return output;
    })
  )
  .toBands()
  .rename(inputBandNames);

// display result
var outputInfo = [
  ['PARENT COLLECTION', basePath.slice(0, -1)],
  ['INPUT', inputImage.get('system:index')],
  ['LAST YEAR FROM', lyImage.get('system:index')],
  ['OUTPUT', outputImage]
];

outputInfo.forEach(function(item) { print(item[0], item[1]) });

//Map.addLayer(region);
var addMosaic = function(collection, year, mask) {
    var collectionAdd =  collection.filter(ee.Filter.eq('year', year)).mosaic();
        collectionAdd = collectionAdd.updateMask(mask);
    Map.addLayer(
      collectionAdd,
      {
        bands: ['swir1_median', 'nir_median', 'red_median'],
        gain: [0.08, 0.06, 0.2]
      },
      'MOSAIC ' + year.toString(),
      false
    );
  };

var addClassification = function(image, year, palette, name, regionID) {
    Map.addLayer(
      image.select('classification_' + year),
      {
        min: 0,
        max: palette.length - 1,
        palette: palette
      },
      name + '_' + year + '_' + regionID,
      false
    );
  };

var mask = image.select('classification_2022').multiply(0).add(1);
for (var pY in yearsView) {
  var year = yearsView[pY];
  addMosaic(mosaics, year, mask);
  addClassification(outputImage, year, palette, 'CLASIFICACION ', regionId);
}

Map.addLayer(image, vis, "ORIGINAL ");
Map.addLayer(outputImage, vis, "OUTPUT ");

// export
Export.image.toAsset({
  image: outputImage.byte()
      .reproject('EPSG:4326', null, 30)
      .set({
          step: 'select-filter', 
          version: param.outputVersion
        }),
  description: outputName,
  assetId: basePath + outputName,
  region: region.geometry().bounds(),
  pyramidingPolicy: {
    '.default': 'mode'
  },
  scale: 30,
  crs: 'EPSG:4326', 
  maxPixels: 1e13
});