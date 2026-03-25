
/**
 * 
 * @name
 *      02-02-Integration-NO-RAISG.js 
 * 
 * @description
 *      Script for integrating the general map for NON-RAISG areas
 *      This script takes the assets from classification regions found in the parameters table: https://docs.google.com/spreadsheets/d/1q9U4npq32bUtccxs0CiPXjUxptdsaJ0WQDeVIcqlpzA/edit?usp=sharing
 * 
 * @authors
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez
 *
 * @version
 *      1.0.0
 *
 * @Date
 *      01/08/2025
 */

var param = {
  
    country: 'ECUADOR',
    
    collection: '3.0',
    
    outputVersion: 1,
    
    source: 'EcoCiencia',
    
    region: 'ECUADOR',
    
    outputPath: 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION3/INTEGRATION/integracion-norasig/',
    
    
    assets: [
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40601-9',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40602-8',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40603-10',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40604-18',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40605-12',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40606-9',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40607-10',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40608-11',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40609-9',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40901-13',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40902-17',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40903-16',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40904-16',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40905-12',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40906-11',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40907-14',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40908-11',
      // 'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLECCION2/MAPA_GENERAL/clasificacion-ft/ECUADOR-40909-13'
    ],
  
    years: ee.List.sequence(1985, 2024).getInfo(),
    
    vis: {
      
        classification: {
          
            min: 0,
            max: 62,
            palette: require('users/mapbiomas/modules:Palettes.js').get('ecuador2')
            
        }
      
    },
    
};




/**
 * Create integration
 */
//var raisgLimit = ee.Image(param.raisgLimit);
 
var integration = ee.ImageCollection(param.assets)
  .mosaic()
  .set(
      {
          version: param.outputVersion,
          collection: param.collection,
          country: param.country,
          source: param.source,
          theme: param.theme,
          region: param.region,
      }
  );




/**
 * Asset generation
 */
var outputName = 'ECUADOR-GENERAL-MAP-' + param.outputVersion;

Export.image.toAsset(
    {
        image: integration,
        description: outputName, 
        assetId: param.outputPath + '/' + outputName,
        pyramidingPolicy: {
           '.default': 'mode'
        }, 
        region: region,
        scale: 30, 
        maxPixels: 1e13
    }
);




/**
 * Preview
 */
param.years

    .forEach(function(year) {
      
        var selector = 'classification_' + year;
        
        var outputName = param.region.toUpperCase() + '-' + year;
      
        var selected = integration.select(selector);

        Map.addLayer(selected, param.vis.classification, outputName, false);
      
    });