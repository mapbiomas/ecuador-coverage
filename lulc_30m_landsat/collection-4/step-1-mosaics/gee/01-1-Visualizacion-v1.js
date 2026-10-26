/**
 * @name
 *      01-1-Visualizacion-v1.js
 *
 * @description
 *      Visual quality check of the annual Landsat mosaics already generated
 *      for MapBiomas Ecuador - Collection 4.
 *
 *      Ecuador's mosaics are produced in two ways, and this script displays
 *      both for a selected year:
 *        - Amazon region: mosaics stored by map sheet ("carta", RAISG
 *          1:250,000 grid) and mosaic region.
 *        - Pacific / Andes region: mosaics stored by Landsat WRS-2 tile
 *          (path/row), optionally with topographic correction.
 *      As reference, it can also display the previous land-cover map
 *      (MapBiomas Ecuador Collection 3, integrated map) with its legend.
 *
 *      Version 1 (this script) shows whole map sheets and path/row tiles.
 *      Version 2 shows the mosaics clipped by classification region and
 *      allows several years and satellites at once.
 *
 * @usage
 *      1. Open this script in the Google Earth Engine Code Editor.
 *      2. Edit PARAMS (year, map sheets and/or path/row tiles to display).
 *      3. Run it. All layers are added hidden; turn them on in the
 *         Layers panel.
 *
 * @inputs
 *      - Amazon mosaics:  projects/mapbiomas-raisg/MOSAICOS/mosaics-2
 *      - Pacific mosaics: projects/mapbiomas-raisg/MOSAICOS/mosaics-pathrow-2
 *        (or the topographically corrected collection, see PARAMS).
 *      - MapBiomas Ecuador Collection 3 integrated land-cover map.
 *      - Auxiliary vectors: boundaries, RAISG map sheets, path/row grid,
 *        mosaic regions.
 *      - Helper modules: legend (mapLegend) and Collection 4 color palette
 *        (COLECCION4/modules/Palettes.js).
 *
 * @outputs
 *      Nothing is exported. Map layers and console output only.
 *
 * @author
 *      Adrián Rodríguez - EcoCiencia
 *
 * @version
 *      1.0.0 (2025-01-13)
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {
  country: 'ECUADOR',
  year: 2000,

  // Only used for 2022, when both Landsat 8 and Landsat 9 mosaics exist.
  // Options: 'l8' or 'l9'. Ignored for any other year.
  satellite: 'l8',

  // Amazon mosaics, by RAISG map sheet.
  cartas: {
    activate: false,  // true: add the selected mosaics and the map-sheet grid
    // Map sheet names and their mosaic region code (401, 402 or 406).
    // Both lists must have the same length: n_carta[k] is paired with region[k].
    // A sheet that crosses two regions is listed once per region.
    n_carta: ['NA-17-Z-D', 'NA-18-Y-C', 'SA-17-Z-D', 'SA-17-Z-D'],
    region:  [        406,         402,         406,         401]
  },

  // Pacific / Andes mosaics, by Landsat path/row.
  pathrow: {
    activate: true,          // true: add the selected mosaics and the path/row grid
    correccionTopo: false,   // true: use the topographically corrected mosaics
    // Tile names as stored in the mosaic collection: '_' + PPPRRR.
    grid_name: ['_010063']
  },

  // true: add the MapBiomas Ecuador Collection 3 land-cover map for `year`.
  LulcColAnt: true
};


// =============================================================================
// 2. ASSETS AND MODULES
// =============================================================================

var ASSETS = {
  amazonMosaics:
    'projects/mapbiomas-raisg/MOSAICOS/mosaics-2',
  pacificMosaics:
    'projects/mapbiomas-raisg/MOSAICOS/mosaics-pathrow-2',
  pacificMosaicsTopoCorrected:
    'projects/mapbiomas-raisg/MAPBIOMAS-ECUADOR/MOSAICOS/mosaics-pathrow-c-topografica',
  lulcCollection3:
    'projects/mapbiomas-ecuador/assets/MAPBIOMAS-LULC/COLLECTION3/INTEGRATION/ECUADOR-7',
  boundaries:
    'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-3/nivel_politico_1_ECU_col3',
  mapSheets:
    'projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/cartas-raisg',
  pathRowGrid:
    'projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/ECUADOR/path-row-pacifico-grid',
  mosaicRegions:
    'projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/ECUADOR/RegionesMosaicos'
};

// mapLegend(map, title, colors, labels, position): draws a legend panel.
var mapLegend = require('users/adrrod44/Mapbiomas_Ecuador:COLECCION2/api').functions.mapLegend;

// MapBiomas Ecuador Collection 4 palette, indexed by class ID
// (palette[3] = color of class 3, ...).
var palette = require('users/mapbiomasecuador/LULC:COLECCION4/modules/Palettes.js')
  .get('EcuadorCol4');

// False-color composite (SWIR1, NIR, red) of the median mosaic bands.
var MOSAIC_VIS = {
  bands: ['swir1_median', 'nir_median', 'red_median'],
  gain: [0.09, 0.06, 0.30],
  gamma: 0.6
};


// =============================================================================
// 3. LOAD DATA
// =============================================================================

var boundaries = ee.FeatureCollection(ASSETS.boundaries);
var mapSheets = ee.FeatureCollection(ASSETS.mapSheets).filterBounds(boundaries);
var pathRowGrid = ee.FeatureCollection(ASSETS.pathRowGrid);
var mosaicRegions = ee.FeatureCollection(ASSETS.mosaicRegions);

/**
 * Filters a mosaic collection by country and year and, for 2022, by
 * satellite (the only year with both Landsat 8 and Landsat 9 mosaics).
 *
 * @param {string} assetId
 * @returns {ee.ImageCollection}
 */
var loadMosaics = function (assetId) {
  var collection = ee.ImageCollection(assetId).filter(
    ee.Filter.and(
      ee.Filter.eq('country', PARAMS.country),
      ee.Filter.eq('year', PARAMS.year)
    )
  );

  if (PARAMS.year === 2022) {
    collection = collection.filter(ee.Filter.eq('satellite', PARAMS.satellite));
  }

  return collection;
};

var amazonMosaics = loadMosaics(ASSETS.amazonMosaics);

var pacificMosaics = loadMosaics(
  PARAMS.pathrow.correccionTopo
    ? ASSETS.pacificMosaicsTopoCorrected
    : ASSETS.pacificMosaics
);

print('Amazon mosaics', amazonMosaics);
print('Pacific mosaics', pacificMosaics);


// =============================================================================
// 4. MAP LAYERS
// =============================================================================

Map.setOptions('SATELLITE');

// Reference land-cover map (MapBiomas Ecuador Collection 3).
if (PARAMS.LulcColAnt) {
  Map.addLayer(
    ee.Image(ASSETS.lulcCollection3),
    {
      bands: ['classification_' + PARAMS.year],
      min: 0,
      max: palette.length - 1,
      palette: palette
    },
    'MapBiomas Ecuador Col3 ' + PARAMS.year,
    false
  );
}

// Amazon mosaics, one layer per map sheet and region.
if (PARAMS.cartas.activate) {
  PARAMS.cartas.n_carta.forEach(function (sheetName, k) {
    var regionCode = PARAMS.cartas.region[k];

    var mosaic = amazonMosaics.filter(
      ee.Filter.and(
        ee.Filter.eq('grid_name', sheetName),
        ee.Filter.eq('region_code', regionCode)
      )
    );

    Map.addLayer(
      mosaic, MOSAIC_VIS,
      'Amazon mosaic ' + PARAMS.year + ' ' + sheetName + ' ' + regionCode,
      false
    );
  });
}

// Pacific mosaics, one layer per path/row tile.
if (PARAMS.pathrow.activate) {
  PARAMS.pathrow.grid_name.forEach(function (gridName) {
    var mosaic = pacificMosaics.filter(ee.Filter.eq('grid_name', gridName));

    Map.addLayer(
      mosaic, MOSAIC_VIS,
      'Pacific mosaic ' + PARAMS.year + ' ' + gridName,
      false
    );
  });
}

// Reference vectors (outlines only).
Map.addLayer(
  boundaries.style({ color: 'red', fillColor: 'ffffff00' }),
  {}, 'Administrative boundaries', false
);

if (PARAMS.cartas.activate) {
  Map.addLayer(
    mapSheets.style({ color: 'black', fillColor: 'ffffff00', width: 1 }),
    {}, 'Map sheets (RAISG)', false
  );
}

if (PARAMS.pathrow.activate) {
  Map.addLayer(
    pathRowGrid.style({ color: 'white', fillColor: 'ffffff00' }),
    {}, 'Landsat path/row', false
  );
}

Map.addLayer(
  mosaicRegions.style({ color: 'DarkOrange', fillColor: 'ffffff00' }),
  {}, 'Mosaic regions', false
);


// =============================================================================
// 5. LEGEND
// =============================================================================
// Legend colors are taken from `palette`, so they always match the map.
// LEGEND_CLASSES and the labels below must be in the same order.

var LEGEND_CLASSES = [3, 4, 11, 13, 14, 22, 33];

mapLegend(
  Map,
  'Land cover',
  LEGEND_CLASSES.map(function (classId) { return palette[classId]; }),
  [
    '3. Forest formation',
    '4. Open forest',
    '11. Wetland (flooded non-forest natural formation)',
    '13. Other non-forest natural formation',
    '14. Farming and silviculture',
    '22. Non-vegetated area',
    '33. River, lake or ocean'
  ],
  'bottom-right'
);
