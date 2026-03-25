var Remap_3to21 = /* color: #98ff00 */ee.Feature(
        ee.Geometry({
          "type": "GeometryCollection",
          "geometries": [
            {
              "type": "Polygon",
              "coordinates": [
                [
                  [
                    -76.57759772366644,
                    -0.8385058857044417
                  ],
                  [
                    -76.60266075040563,
                    -0.9468976709289508
                  ],
                  [
                    -76.4733972290332,
                    -0.95161873925491
                  ],
                  [
                    -76.45914857850144,
                    -0.9033876237553925
                  ],
                  [
                    -76.45880524508213,
                    -0.8999546509219261
                  ],
                  [
                    -76.48910497289594,
                    -0.8754946799514554
                  ],
                  [
                    -76.49897597538208,
                    -0.8772111719013356
                  ]
                ]
              ],
              "geodesic": true,
              "evenOdd": true
            },
            {
              "type": "Point",
              "coordinates": [
                -76.52248047694685,
                -0.914755053970163
              ]
            }
          ],
          "coordinates": []
        }),
        {
          "system:index": "0",
          "original": "3,",
          "new": "21,",
          "t0": 1985,
          "t1": 2024
        }),
    mask_ID29_EC_col3 = ee.FeatureCollection("projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-3/mask-id9-col3"),
    mascara_ID23_EC_col3 = ee.FeatureCollection("projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-3/mask-id23-col3"),
    mascara_ID29_EC_col3 = ee.FeatureCollection("projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-3/mask-id29-col3"),
    mascara_ID31_EC_col3 = ee.FeatureCollection("projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-3/mask-id31-col3"),
    mascara_ID68_EC_col3 = ee.FeatureCollection("projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-3/mask-id68-col3");

/**
 * @name
 *     03-5-mask-filter-ecuador.js
 * 
 * @description 
 *     Mask filter or remapping: uses a vector file to perform land cover 
 *     remapping (example: aquaculture).
 * 
 * @author
 *     Adrián Rodríguez
 *
 * @Date
 *     01/21/2025
 *     05/06/2025    Modified by Fabricio Garces
 */

/**
 * USER PARAMETERS
 */
// - Rocky Outcrop ID29 -- applied nationwide -- ID25 to ID29
// - Aquaculture ID31 -- RAISG applied nationwide -- Non-RAISG applied by classification region -- ID33 to ID31
// - Beaches, dunes and sands ID23 -- applied by classification region -- ID21 + ID25 to ID23
// - Other non-vegetated natural areas ID68 -- applied regionally -- ID25 to ID68
// - Silviculture ID9 -- applied only to classification regions of col. 2 -- ID3 to ID9 (same mask as previous collection)

var param = {
  // Directory module
  dirPath: require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths,
  regionId : 40201,
  inputVersion : 32142,
  outputVersion : 32141,
  country : 'ECUADOR',
  yearsPreview: [
    //1985,
    //1986,1987,1988,1989,
    //1990,1991,1992,1993,1994,
    //1995,1996,1997,1998,1999,
    //2000,2001,2002,2003,2004,
    //2005,2006,2007,2008,2009,
    //2010,2011,2012,2013,2014,
    //2015,2016,2017,2018,2019,
    //2020,2021,2022, 
      2023,2024,2025
    ],
  addMosaic: true,

  resamplePolygons: { // NON-STABLE SAMPLES Sample24_1985_1990, Sample27_1985_1990, Sample27_1985
    polygons: [],     // Remap_3to21, Remap_4to3_14to22, Remap_14_22, remap_14to3
  },
  
  resampleSHP: {
    vector: [mask_ID29_EC_col3],        // Vector file must be loaded in imports panel
    Original: [[25],],                // Create list (from) of remap, one list per vector loaded
    New:[[29],],                      // Create list (to) of remap, one list per vector loaded
    t0: [1985,],                      // Start year for change
    t1: [2025,],                      // End year for change
  },
  
  //yearIgnore: [2018],
};

var Multiband = function(param) {
  
  var _this = this;
  
  this.init = function(param) {
    
    var config = {
      mosaicRegionId   :  '',
      mosaicVersion    :  4,
      collectionField  : 'id_regionC',
      functions        :  require('users/mapbiomasecuador/LULC:COLECCION3/api').functions,
      inputPath        : param.dirPath.pathClassificationActFilter,//'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION3/GENERAL_MAP/CLASSIFICATION/classification-ft/',
      outputPath       : param.dirPath.pathClassificationActFilter,//'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION3/GENERAL_MAP/CLASSIFICATION/classification-ft/',
      regionPath       : param.dirPath.regionVectorAct,//'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/regionesClassif_Col2',
      palette          : require('users/kahuertas/mapbiomas-colombia:mapbiomas-colombia/collection-3/modules/Palettes.js').get('ColombiaCol3'),
      legendTitle      : 'Land Cover',
      legendPosition   : 'bottom-right',
      legendColors     : [ 
                           '006400', 
                           '00ff00', 
                           '45c2a5',
                           'b8af4f',
                           'f1c232', 
                           'ffffb2', 
                           'FA8784',
                           'ffaa5f',
                           '0000ff'
                         ],
      legendLabels     : [
                           '3. Forest Formation',
                           '4. Open Forest',
                           '11. Floodable Non-Forest Natural Formation',
                           '12. Grassland',
                           '13. Other Non-Forest Natural Formations',
                           '21. Agriculture and Livestock',
                           '25. Non-Vegetated Area',
                           '29. Rocky Outcrop',
                           '33. Rivers, Lakes or Oceans'
                         ],

      regionId : param.regionId,
      inputVersion : param.inputVersion,
      outputVersion : param.outputVersion,
      country : param.country,
      yearsPreview: param.yearsPreview,
      addMosaic: param.addMosaic,
      resamplePolygons: param.resamplePolygons,
      resampleSHP: param.resampleSHP,
      variables: []
          
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
    
    // get classification and apply temporal filters
    var input = _this.getImage(config);
    var imageMask = _this.maskFilter(input, region, config, region);

    var yearTitle = ee.List(config.yearsPreview).get(0).getInfo();
    Map.addLayer(input, {bands:["classification_"+yearTitle], min: 0, max: config.palette.length-1, palette: config.palette}, 'Classification_original', false);
    Map.addLayer(imageMask, {bands:["classification_"+yearTitle], min: 0, max: config.palette.length-1, palette: config.palette}, 'Mask Filter', false);      
    
    
    // display to map
    config.yearsPreview
      .map(
        function(year){
          if (config.addMosaic){
            _this.addMosaic(mosaic, year, regionMask);
          }
          _this.addClassification(input, year, config.palette, 'Classification');
          _this.addClassification(imageMask, year, config.palette, 'Mask Filter');
        });
        
    mapLegend(Map, config.legendTitle, config.legendColors, config.legendLabels, config.legendPosition);
    
    // Export asset
    var filename = config.country + '-' + config.regionId + '-' + config.outputVersion;
    var imageId = config.outputPath + filename;
    
    Export.image.toAsset({
      image: imageMask.byte()
      .reproject('EPSG:4326', null, 30)
      .set({
          step: 'mask-filter', 
          version: config.outputVersion
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
    
  };
  
  
  /**
   * Get main image
   */
  this.getImage = function(config) {
    var inputPath = config.inputPath;
    var country = config.country;
    var regionId = config.regionId;
    var inputVersion = config.inputVersion;
    
    return ee.Image(inputPath + country + '-' + regionId + '-' + inputVersion);
  };

  /**
   * Apply mask filter
   */  
  this.maskFilter = function(image, region, config, vector){
    var polygons = config.resamplePolygons.polygons;
    
    polygons.forEach(function(polygon){
      print('Reclassifying based on manual polygons');

      var from = ee.String(polygon.get('original'))
        .split(',')
        .map( function( item ){ return ee.Number.parse( item ) });
      
      var to = ee.String(polygon.get('new'))
        .split(',')
        .map(function(item){ return ee.Number.parse( item ) });
      
      var t0 = ee.Number(polygon.get('t0'));
      var t1 = ee.Number(polygon.get('t1'));
      
      var polygonMask = ee.FeatureCollection(polygon)
        .map(function(feat) { return feat.set('version', 1) })
        .reduceToImage(['version'], ee.Reducer.first())
        .clipToBoundsAndScale(vector, null, null, null, 30);
          
      var imageClip = image.updateMask(polygonMask);

      var bandNames = ee.List.sequence(t0, t1)
        .getInfo()
        .map(function (year) { return 'classification_' + year });
        
      bandNames.forEach(function(band){
        var selected = image.select(band);
        var imageRemap = selected
          .where(polygonMask.eq(1), selected.remap(from, to))
          .rename(band);
          
        image = image.addBands(imageRemap, null, true);
      });
    });
    
    
    var evaluator = config.resampleSHP.vector.length;
    
    if (evaluator > 0){
      var vectors = config.resampleSHP.vector;
      var h = 0;
      var j = 0;
      
      vectors.forEach(function(vector){
        print('Entered vector files');
        Map.addLayer(vector, {}, 'vector_'+j);
        
        var from = config.resampleSHP.Original[j];
        var to = config.resampleSHP.New[j];
        var t0 = config.resampleSHP.t0[j];
        var t1 = config.resampleSHP.t1[j];
        
        var vectorMask = vector
          .map(function(feat) { return feat.set('version', 1) })
          .reduceToImage(['version'], ee.Reducer.first())
          .clipToBoundsAndScale(region.vector, null, null, null, 30);

        var bandNames = ee.List.sequence(t0, t1)
          .getInfo()
          .map(function (year) { return 'classification_' + year });
          
        bandNames.forEach(function(band){
          var selected = image.select(band);
          var imageRemap = selected
            .where(vectorMask.eq(1), selected.remap(from, to))
            .rename(band);
            
          image = image.addBands(imageRemap, null, true);
        });
        
        j++;
        
      });

    } 
    else {
      print('No reclassifications with geometries are being applied');
    }
    
    
    return image;
  };
  
  
  /**
   * Add mosaics to map
   */
  this.addMosaic = function(mosaic, year, regionMask) {
    print('mosaic', mosaic);
    var yearMosaic =  mosaic.filterMetadata('year', 'equals', year);
    if (year == 2022 || year == 2023 || year == 2024){
      yearMosaic = yearMosaic.filterMetadata('satellite', 'equals', 'l8');
      
    }
    if (year == 2025){
      yearMosaic = mosaic.filterMetadata('year', 'equals', 2024);
      yearMosaic = yearMosaic.filterMetadata('satellite', 'equals', 'l9');
      print('yearMosaic', yearMosaic);

    }
    
    yearMosaic
      .size()
      .evaluate(function(number) {
        if(number > 0) {
          yearMosaic = yearMosaic
            .median()
            .updateMask(regionMask);
          
          Map.addLayer(
            yearMosaic,
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
   * Add classification to map
   */
  this.addClassification = function(image, year, palette, title) {
    ee.Number(year)
      .evaluate(function(year) {
        Map.addLayer(
          image,
          {
            min: 0,
            max: palette.length-1,
            palette: palette,
            bands: ['classification_' + year]
          },
          title + ' ' + year, false
        );
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
  
  
  return _this.init(param);
  
};


new Multiband(param);