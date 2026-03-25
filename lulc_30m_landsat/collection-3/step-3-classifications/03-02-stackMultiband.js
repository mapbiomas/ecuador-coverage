/**
 * @name 
 *      02-3-stack-to-multiband-ecuador.js
 * 
 * @description
 *      Script to merge all classifications into a single image
 *      where each annual classification is stored in its respective band.
 * 
 * @authors
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @date
 *      20/01/2025
 *      15/04/2052
 */

/**
 * USER PARAMETERS
 */
var param = {
  inputVersion: 1,
  outputVersion: 32148,
  regionId: 40201,
  country: 'ECUADOR',
  newYears: [
    // 1985,1986,1987,1988,1989,
    // //1990,
    // 1991, 
    // //1992,
    // 1993,1994,
    // 1995,
    // 1996,1997,
    // 1998,
    // 1999,
    // 2000,2001,2002,2003,2004,
    // 2005,2006,2007,2008,2009,
    // 2010,2011,2012,2013,2014,
    // 2015,2016,2017,2018,2019,
    // 2020,2021,2022,
    //2024
    2024, 2025
  ],
  yearsColAnt: [
    //1985,
    1986, 1987,
    1988,
    1989,
    1990,
    1991, 1992, 1993, 1994, 1995,
    1996, 1997,
    1998,
    1999,
    2000, 2001, 2002, 2003, 2004,
    2005, 2006, 2007, 2008, 2009,
    2010, 2011, 2012, 2013, 2014,
    2015, 2016, 2017, 2018, 2019,
    2020, 2021, 2022, 2023
    //,2023
  ],
  //Show mosaics
  view_mosaic: true,
  //Module containing directory paths
  dirPath: require('users/mapbiomasecuador/LULC:COLECCION3/05-modules/CollectionDirectories.js').paths
};

param.legendTitle = 'Land cover';
param.legendPosition = 'bottom-right';
param.legendColors = [ 
  '006400', 
  '00ff00', 
  '45c2a5', 
  'f1c232', 
  'ffffb2', 
  'dd7e6b', 
  '0000ff'
];
param.legendLabels = [
  '3. Forest formation',
  '4. Open forest',
  '11. Flooded natural non-forest formation',
  '13. Other natural non-forest formations',
  '14. Agricultural and forestry use',
  '22. Area without vegetation',
  '33. Rivers, Lakes or Oceans'
];

param.inputPath = param.dirPath.pathClasificationPreAct;
param.outputPath = param.dirPath.pathClassificationAct;

var palette = require('users/kahuertas/mapbiomas-colombia:mapbiomas-colombia/collection-3/modules/Palettes.js').get('ColombiaCol3');

palette[4] = '#7dc975';

var region = ee.FeatureCollection(param.dirPath.regionVectorAct)
  .filterMetadata('id_regionC', 'equals', param.regionId);

var setVersion = function(item) { return item.set('version', 1) };

var regionMask = region
  .map(setVersion)
  .reduceToImage(['version'], ee.Reducer.first());

var mosaic = ee.ImageCollection(param.dirPath.mosaicRaisgAct)
  .merge(ee.ImageCollection(param.dirPath.mosaicPacificoAct))
  .filterBounds(region);

var multiband = makeMultiband(param);

if (param.yearsColAnt.length > 0) {
  var colAntPath = param.dirPath.pathIntegrationColAntNotFilters; //'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION3/GENERAL_MAP/CLASSIFICATION/Integration_pre_filter_col2';
  var clasificacionColAnt = ee.Image(colAntPath).updateMask(regionMask);
  var bandsColAnt = param.yearsColAnt.map(function(year) {
    return "classification_" + year;
  });
  multiband = clasificacionColAnt.select(bandsColAnt).addBands(multiband, null, true);
  print('Images for Stack', multiband);
}

// display to map
var years = param.yearsColAnt.concat(param.newYears);

var maps = [],
    map,
    year;
    
for (var i = 0; i < years.length; i++) {
  year = years[i];
  map = ui.Map();
  map.style().set({
    margin: '2px',
    width: '300px',
    //height: '100px'
  });

  map.drawingTools().setLinked(true);
  map.add(ui.Label(String(year), {
    'position': 'bottom-right',
    'fontWeight': 'bold'
  }));
  
  if (param.view_mosaic) {
    addMosaic(mosaic, year, regionMask, map);
  }
  addClassification(multiband, year, palette, map);
  maps.push(map);
}

// blank map
maps.push(ui.Map());
var linker = ui.Map.Linker(maps);

// Select first and last row
var n = years.length;
print("Number of panels:", n);

//Add legend if user requires
mapLegend(maps[n], param.legendTitle, param.legendColors, param.legendLabels, param.legendPosition);

maps[n].drawingTools({
  all: true
});

var firstPanelMaps = maps.slice(0, n); // Get the first n maps
var lastPanelMaps = maps[n];

//Add region
maps[n].addLayer(region.style({ fillColor: 'FF000000', color: 'FF0000' }), {}, 'region');

// Remove icons and layers in firstPanelMaps
for (var j = 0; j < firstPanelMaps.length; j++) {
  firstPanelMaps[j].setControlVisibility({
    zoomControl: false,
    fullscreenControl: false,
    layerList: param.view_mosaic,
    mapTypeControl: false,
    drawingToolsControl: false
  });
}

var firstPanel_1 = ui.Panel(firstPanelMaps,
  ui.Panel.Layout.Flow('horizontal'), { stretch: 'both' });
firstPanel_1.style().set({
  width: '100%',
  height: '35%'
});

var secondPanel_2 = ui.Panel(lastPanelMaps,
  ui.Panel.Layout.Flow('horizontal'), { stretch: 'both' });
secondPanel_2.style().set({
  width: '100%',
  height: '65%'
});

var mapGrid = ui.SplitPanel({
  firstPanel: firstPanel_1,
  secondPanel: secondPanel_2,
  orientation: 'vertical',
  wipe: false,
  style: { stretch: 'both' }
});

// Add the maps and title to the ui.root.
maps[n].centerObject(region, 10);
ui.root.widgets().reset([mapGrid]);
ui.root.setLayout(ui.Panel.Layout.Flow('vertical'));

var filename = param.country + '-' + param.regionId + '-' + param.outputVersion;
var imageId = param.outputPath + filename;

maps[n].addLayer(multiband, {
bands: "classification_2024",
  min: 0,
  max: palette.length-1,
  palette: palette
}, 'classification_2024');

Export.image.toAsset({
  image: multiband.set({
      step: 'stack to multiband', 
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
 * FUNCTIONS
 */

function makeMultiband(config) {
  var inputPath = config.inputPath.slice(0, -1);
  var regionId = config.regionId;
  var inputVersion = config.inputVersion;
  var yearsFilter = config.newYears;
  
  var filteredCollection = ee.ImageCollection(inputPath);
  
  filteredCollection = filteredCollection.filter(
    ee.Filter.and(
      ee.Filter.stringContains('system:index', '-' + regionId.toString() + '-'),
      ee.Filter.stringContains('system:index', '-' + inputVersion.toString()),
      ee.Filter.eq('version', inputVersion),
      ee.Filter.inList('year', yearsFilter)
    )
  );
  
  print('Classification for this collection', filteredCollection);
  
  var bands = filteredCollection
    .toList(filteredCollection.size())
    .map(function(item) {
      return ee.Image(item).bandNames().get(0);
    });
  
  return filteredCollection
    .toBands()
    .rename(bands)
    .byte();
}

function addMosaic(mosaic, year, regionMask, map) {
  var yearMosaic = mosaic
    .filterMetadata('year', 'equals', year);
  
  if (year == 2022 || year == 2023 || year == 2024) {
    yearMosaic = yearMosaic.filterMetadata('satellite', 'equals', 'l8');
  }
  if (year == 2025) {
    yearMosaic = mosaic.filterMetadata('year', 'equals', 2024);
    yearMosaic = yearMosaic.filterMetadata('satellite', 'equals', 'l9');
  }
  
  map.addLayer(
    yearMosaic.median().updateMask(regionMask),
    {
      bands: ['swir1_median', 'nir_median', 'red_median'],
      gain: [0.08, 0.06, 0.2]
    },
    'MOSAIC ' + year.toString(),
    false
  );
}

function addClassification(image, year, palette, map) {
  map.addLayer(
    image.select('classification_' + year),
    {
      min: 0,
      max: palette.length - 1,
      palette: palette
    },
    'CLASSIFICATION ' + year,
    true
  );
}

function mapLegend(map, title, colors, labels, position) {
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