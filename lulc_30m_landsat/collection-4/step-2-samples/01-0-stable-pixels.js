/**
 * @name
 *      01-0-stable-pixels.js
 *
 * @description
 *      Generates the stable-pixel map of one classification region for
 *      MapBiomas Ecuador - Collection 4. Stable pixels are the reference
 *      from which training samples are later drawn (next scripts of step 2).
 *
 *      1. A pixel is "stable" when it has the same class in every year of
 *         the previous collection (Collection 3 integrated map), after
 *         grouping classes with `remap` and leaving out `exclusion.years`.
 *      2. Optionally, the result is refined with other sources. A source
 *         keeps a stable pixel only where both agree on the class:
 *           - previous stable-pixel maps and corrections,
 *           - canopy height thresholds,
 *           - national land-cover maps (2022 and MAG 2024),
 *           - ecosystem maps (MapBiomas, Galápagos).
 *      3. Areas can be excluded with a shapefile, and classes can be
 *         changed or removed inside polygons drawn by the analyst.
 *      4. The result is exported as an asset, one image per region.
 *
 * @usage
 *      1. Open this script in the Google Earth Engine Code Editor.
 *      2. Set `regionId` and the other options in PARAMS.
 *      3. (Optional) Draw remap/exclusion polygons (see PARAMS.exclusion).
 *      4. Run. Compare the layers "Stable pixels - before refinement" and
 *         "Stable pixels - to export" against the mosaics.
 *      5. Start the export task from the Tasks tab.
 *
 * @inputs
 *      Asset paths come from the CollectionDirectories.js module (`paths`):
 *      classification regions, Collection 3 integrated map, previous
 *      stable-pixel maps, reference land-cover maps, canopy height, mosaics.
 *
 * @outputs
 *      Image asset  <paths.stablesPixelsAct>/ME-<COUNTRY>-<regionId>-<outputVersion>
 *      (one band, class IDs; non-stable pixels are masked).
 *
 * @author
 *      João Siqueira, Emanuel Valero, Adrián Rodríguez, Fabricio Garcés
 *
 * @collection
 *      4
 *
 * @version
 *      2024-11-08  First version
 *      2025-01-29  Updated by Fabricio Garcés
 *      2025-03-21  Update
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {

  // Classification region (field `id_regionC` of the regions asset).
  regionId: 40201,
  country: 'ECUADOR',

  // Years whose mosaic and classification are added to the map for review.
  yearsPreview: [2023, 2024, 2025, 2026],

  // Version of the exported asset.
  outputVersion: 999,

  // --- Refinement sources (true = use) --------------------------------------
  // Keep only pixels that are also stable in...
  MPxECAnt: false,            // ...the previous MapBiomas Ecuador stable-pixel map
  MPxECAmzAnt: false,         // ...the previous MapBiomas Amazonía stable-pixel map
  CorreccionPxColAnt: false,  // ...the corrected stable pixels of the previous collection

  // Keep only pixels whose class agrees with...
  LULC2022: true,             // ...the 2022 national land-cover map (Ministry of Environment)
  LULC2024: true,             // ...the 2024 land-cover map (MAG, CUT 2024)
  ecosistemasMB: false,       // ...the MapBiomas ecosystems map
  ecosistemasGPS: false,      // ...the Galápagos ecosystems map (USFQ)
  agroecosistemasGPS: false,  // ...the Galápagos agro-ecosystems map

  // Use an already exported stable-pixel map (e.g. after a spatial filter)
  // instead of computing it: <paths.stablesPixelsAct>/ME-<COUNTRY>-<regionId>-<version>
  filtroEspacial: {
    use: false,
    version: 999
  },

  // Class grouping applied to every year before looking for stable pixels.
  // Classes not listed in `from` are discarded (e.g. 27 = not observed).
  remap: {
    from: [3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 18, 21, 22, 23, 24, 25, 29, 30, 31, 33, 34, 35, 68],
    to:   [3, 4, 5, 3, 7, 3, 11, 12, 13, 21, 21, 21, 21, 22, 25, 25, 25, 25, 25, 33, 33, 34, 21, 25]
  },

  exclusion: {
    // Years of the previous collection ignored when looking for stable pixels.
    years: [1989, 1990, 1991],

    // Classes (after remap) that can never be stable. Main class IDs:
    //   3 forest, 4 open forest, 5 mangrove, 11 wetland, 12 grassland,
    //   13 other non-forest natural formation, 21 mosaic of uses,
    //   25 other non-vegetated area, 33 water, 34 glacier.
    classes: [],

    // Polygons to change or remove classes in specific areas.
    // Each item is a FeatureCollection whose features have two string
    // properties with comma-separated class IDs, e.g.
    //   original: '3,13'   new: '13,27'   (27 = remove the pixel)
    // Draw them in the Code Editor (as FeatureCollection imports) and list
    // their names here, e.g. [exclude3, remap3to11]. Order matters: later
    // polygons are applied on top of earlier ones.
    polygons: {
      geometries: [],
      layer: ''  // Optional asset ID with more polygons (same properties).
    },

    // Optional shapefile asset: stable pixels inside it are removed,
    // except for the classes in `ignoreClasses`.
    pathShape: '',      // folder, e.g. 'projects/.../assets/'
    shape: '',          // asset name, e.g. 'TIERRA_AGROPECUARIA_2018_40202'
    ignoreClasses: []
  },

  // Canopy height filters. Each rule [classId, 'gte'|'lte', meters] keeps a
  // stable pixel of that class only where canopy height meets the rule.
  canopy_height: {            // Global canopy height 2020 (used in Collection 1)
    use: false,
    canopy_umbrales: [
      [12, 'lte', 1],
      [3, 'gte', 15],
      [6, 'gte', 15],
      [21, 'lte', 1]
    ],
    addlayer: true
  },
  canopy_ht: {                // Meta 1 m canopy height
    use: false,
    canopy_umbrales: [
      [12, 'lte', 1],
      [3, 'gte', 15],
      [6, 'gte', 15],
      [21, 'lte', 1]
    ],
    addlayer: true
  },

  // Monthly Planet NICFI basemaps for visual review (requires NICFI access).
  planetData: {
    activate: false,
    dates: [
      ['January',  '2024-01-01', '2024-02-01'],
      ['February', '2024-02-01', '2024-03-01'],
      ['March',    '2024-03-01', '2024-04-01']
    ]
  }
};


// =============================================================================
// 2. MODULES, ASSETS AND CONSTANTS
// =============================================================================

// Asset paths of Collection 4 (regions, maps, mosaics, outputs...).
var paths = require('users/mapbiomasecuador/LULC:COLECCION4/05-modules/CollectionDirectories.js').paths;

// Collection 4 palette, indexed by class ID.
var palette = require('users/mapbiomasecuador/LULC:MODULES/Palettes.js').get('EcuadorCol4');

var CUT2024_VECTOR_ASSET = 'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/COLLECTION-4/CUT24-MAG';
var GRID_5KM_ASSET = 'projects/mapbiomas-raisg/DATOS_AUXILIARES/VECTORES/ECUADOR/grillaEcuador5km';
var NICFI_COLLECTION = 'projects/planet-nicfi/assets/basemaps/americas';

// Temporary values used while combining sources.
var REMOVE = 27;     // pixel is not stable
var CONFLICT = 88;   // sources disagree: pixel is removed

var CLASS_VIS = { min: 0, max: palette.length - 1, palette: palette };
var CANOPY_VIS = { min: 1, max: 35, palette: ['ff0000', 'ff9e0f', 'fcff0c', '4fff13', '08cc16'] };
var MOSAIC_VIS = { bands: ['swir1_median', 'nir_median', 'red_median'], gain: [0.085, 0.053, 0.29], gamma: [0.75] };


// =============================================================================
// 3. HELPER FUNCTIONS
// =============================================================================

/**
 * Removes the bands of the given years ('classification_<year>').
 */
function dropYears(image, years) {
  var bandNames = years.map(function (year) { return 'classification_' + year; });
  return image.select(image.bandNames().removeAll(bandNames));
}

/**
 * Applies the same class remap to every band, keeping band names.
 * Classes not in `from` become masked.
 */
function remapBands(image, from, to) {
  var bands = image.bandNames().getInfo().map(function (bandName) {
    return image.select(bandName).remap(from, to).int8().rename(bandName);
  });
  return ee.Image.cat(bands);
}

/**
 * Returns an image where a pixel has value `classId` if it belongs to that
 * class in every band, for each class in `classes`; other pixels are masked.
 */
function getStablePixels(image, classes) {
  var bandNames = image.bandNames();
  var allStable = ee.Image();

  classes.forEach(function (classId) {
    var firstBand = image.select([bandNames.get(0)]).eq(classId);

    var sameClassAllYears = ee.Image(
      bandNames.slice(1).iterate(function (bandName, previous) {
        return image.select(ee.String(bandName)).eq(classId).multiply(previous);
      }, firstBand)
    );

    allStable = allStable.blend(
      sameClassAllYears.updateMask(sameClassAllYears.eq(1)).multiply(classId)
    );
  });

  return allStable;
}

/**
 * Sets the region mask to 0 inside the exclusion shapefile, if one is given.
 */
function excludeAreas(regionMask, shapePath, shapeName) {
  if (shapePath === '' || shapeName === '') {
    return regionMask;
  }

  var exclusionRegions = ee.FeatureCollection(shapePath + shapeName);
  Map.addLayer(exclusionRegions, { color: 'pink' }, 'Exclusion shapefile');

  var exclusionMask = exclusionRegions
    .map(function (f) { return f.set('version', 1); })
    .reduceToImage(['version'], ee.Reducer.first())
    .eq(1);

  return regionMask.where(exclusionMask, 0);
}

/**
 * Keeps the stable pixels of `classes` only where `reference` is set
 * (non-zero and unmasked). Other classes are removed.
 */
function keepWhereReferenceIsSet(stable, reference, classes) {
  var result = ee.Image(REMOVE).updateMask(reference);

  classes.forEach(function (classId) {
    result = result.where(stable.eq(classId).and(reference), classId);
  });

  return result.updateMask(result.neq(REMOVE));
}

/**
 * Combines the stable pixels with a reference map using agreement rules.
 * Each rule [stableClass, referenceClass, newClass] assigns `newClass`
 * where the stable pixel is `stableClass` and the reference is
 * `referenceClass`. Rules are applied in order; pixels matched by no rule
 * are removed. `newClass` = CONFLICT marks pixels to remove later.
 *
 * @param {ee.Image} stable
 * @param {ee.Image} reference
 * @param {Array} rules
 * @param {ee.Image} [baseMask]  Area where rules apply (default: reference).
 */
function applyAgreementRules(stable, reference, rules, baseMask) {
  var result = ee.Image(REMOVE).updateMask(baseMask || reference);

  rules.forEach(function (rule) {
    result = result.where(stable.eq(rule[0]).and(reference.eq(rule[1])), rule[2]);
  });

  return result.updateMask(result.neq(REMOVE));
}

/**
 * Removes stable pixels of a class where canopy height does not meet the
 * rule [classId, 'gte'|'lte', meters].
 */
function applyCanopyThresholds(stable, canopy, rules) {
  rules.forEach(function (rule) {
    var meetsRule = rule[1] === 'gte' ? canopy.gte(rule[2]) : canopy.lte(rule[2]);
    stable = stable.where(stable.eq(rule[0]).and(meetsRule.neq(1)), REMOVE);
    stable = stable.updateMask(stable.neq(REMOVE));
  });
  return stable;
}

/**
 * Changes classes inside polygons. Each feature has comma-separated
 * 'original' and 'new' class lists; new = 27 removes the pixel.
 */
function remapWithPolygons(stable, polygons, customLayer) {
  var layers = polygons.slice();

  if (customLayer !== '') {
    layers.push(ee.FeatureCollection(customLayer));
  }

  layers.forEach(function (layer) {
    var remapped = layer.map(function (feature) {
      var toNumber = function (item) { return ee.Number.parse(item); };
      var from = ee.String(feature.get('original')).split(',').map(toNumber);
      var to = ee.String(feature.get('new')).split(',').map(toNumber);

      return stable.clip(feature).remap(from, to).byte();
    });

    stable = ee.ImageCollection(remapped).mosaic().unmask(stable).rename('reference');
    stable = stable.updateMask(stable.neq(REMOVE));
  });

  return stable;
}

/**
 * Adds the review layers: mosaics and classifications of the preview
 * years, 5 km grid, region outline and both stable-pixel maps.
 */
function addLayersToMap(stableBefore, stableFinal, mosaics, classification, region, years) {
  Map.setOptions({ mapTypeId: 'SATELLITE' });

  years.forEach(function (year) {
    var yearMosaic;

    if (year === 2026) {
      // TODO: no 2026 mosaic yet; the 2025 Landsat 9 mosaic is shown instead.
      yearMosaic = mosaics.filter(ee.Filter.eq('year', 2025))
        .filter(ee.Filter.eq('satellite', 'l9'));
    } else {
      yearMosaic = mosaics.filter(ee.Filter.eq('year', year));
      // From 2022 on there are L8 and L9 mosaics; L8 is shown.
      if (year >= 2022) {
        yearMosaic = yearMosaic.filter(ee.Filter.eq('satellite', 'l8'));
      }
    }

    Map.addLayer(yearMosaic.mosaic(), MOSAIC_VIS, 'Mosaic ' + year, false);

    // The previous collection covers up to 2024.
    if (year <= 2024) {
      Map.addLayer(
        classification,
        { bands: 'classification_' + year, min: 0, max: palette.length - 1, palette: palette },
        'Collection 3 ' + year,
        false
      );
    }
  });

  Map.addLayer(
    ee.FeatureCollection(GRID_5KM_ASSET).style({ color: 'white', fillColor: '00000000' }),
    {}, '5 km grid', false
  );

  Map.addLayer(
    region.style({ fillColor: '00000066', color: 'FCBA03' }),
    {}, 'Region ' + PARAMS.regionId, false
  );

  Map.addLayer(stableBefore, CLASS_VIS, 'Stable pixels - before refinement', false);
  Map.addLayer(stableFinal, CLASS_VIS, 'Stable pixels - to export');
}

/**
 * Adds monthly Planet NICFI basemaps clipped to the region.
 */
function addPlanetBasemaps(region, dates) {
  var nicfi = ee.ImageCollection(NICFI_COLLECTION).filterBounds(region);
  var vis = { bands: ['R', 'G', 'B'], min: 350, max: 3000, gamma: 2.25 };

  dates.forEach(function (date) {
    var basemap = nicfi.filter(ee.Filter.date(date[1], date[2])).first();
    Map.addLayer(
      ee.Image(basemap).clip(region.geometry().bounds()),
      vis, 'Planet ' + date[0] + ' ' + date[1].slice(0, 4), false
    );
  });
}


// =============================================================================
// 4. STABLE PIXELS
// =============================================================================

var region = ee.FeatureCollection(paths.regionVectorAct)
  .filter(ee.Filter.eq('id_regionC', PARAMS.regionId));

// 1 inside the region, 0 inside the exclusion shapefile, masked outside.
var regionMask = region
  .map(function (f) { return f.set('version', 1); })
  .reduceToImage(['version'], ee.Reducer.first());

var analysisMask = excludeAreas(regionMask, PARAMS.exclusion.pathShape, PARAMS.exclusion.shape);

// Previous collection: drop excluded years and group classes.
var classification = ee.Image(paths.integrationGMcol3).clip(region);
var classificationRemapped = remapBands(
  dropYears(classification, PARAMS.exclusion.years),
  PARAMS.remap.from,
  PARAMS.remap.to
);
print('Years used', classificationRemapped.bandNames());

var classes = ee.List.sequence(1, 34).removeAll(PARAMS.exclusion.classes).getInfo();
var stableBefore = getStablePixels(classificationRemapped, classes);

// Classes kept inside the exclusion shapefile.
var ignoreClasses = PARAMS.exclusion.ignoreClasses;
if (ignoreClasses.length > 0) {
  var keptClasses = stableBefore.remap(ignoreClasses, ee.List.repeat(1, ignoreClasses.length), 0);
  analysisMask = analysisMask.where(keptClasses.eq(1), 1);
}

var stablePixels = stableBefore.updateMask(analysisMask);

if (PARAMS.filtroEspacial.use) {
  stablePixels = ee.Image(paths.stablesPixelsAct + '/ME-' + PARAMS.country + '-' +
    PARAMS.regionId + '-' + PARAMS.filtroEspacial.version);
}


// =============================================================================
// 5. REFINEMENT WITH OTHER SOURCES
// =============================================================================

var PREVIOUS_STABLE_CLASSES = [3, 6, 11, 12, 13, 14, 21, 25, 33, 34];

if (PARAMS.MPxECAnt) {
  var previousStable = ee.Image(paths.pathMpxECAnt);
  Map.addLayer(previousStable, CLASS_VIS, 'Previous stable pixels - MB Ecuador', false);
  stablePixels = keepWhereReferenceIsSet(stablePixels, previousStable, PREVIOUS_STABLE_CLASSES);
}

if (PARAMS.MPxECAmzAnt) {
  var previousStableAmazon = ee.Image(paths.pathMpxAmzAnt);
  Map.addLayer(previousStableAmazon, CLASS_VIS, 'Previous stable pixels - MB Amazonía', false);
  stablePixels = keepWhereReferenceIsSet(stablePixels, previousStableAmazon, PREVIOUS_STABLE_CLASSES);
}

if (PARAMS.CorreccionPxColAnt) {
  var previousCorrections = ee.Image(paths.pathMpxCorrColAnt);
  Map.addLayer(previousCorrections, CLASS_VIS, 'Previous stable pixels - corrections', false);
  stablePixels = keepWhereReferenceIsSet(stablePixels, previousCorrections, PREVIOUS_STABLE_CLASSES);
}

if (PARAMS.canopy_height.use) {
  var canopyHeight = ee.Image(paths.canopy_height);
  stablePixels = applyCanopyThresholds(stablePixels, canopyHeight, PARAMS.canopy_height.canopy_umbrales);
  if (PARAMS.canopy_height.addlayer) {
    Map.addLayer(canopyHeight, CANOPY_VIS, 'Canopy height 2020', false);
  }
}

if (PARAMS.canopy_ht.use) {
  var canopyHeightMeta = ee.ImageCollection(paths.canopy_ht).mosaic();
  stablePixels = applyCanopyThresholds(stablePixels, canopyHeightMeta, PARAMS.canopy_ht.canopy_umbrales);
  if (PARAMS.canopy_ht.addlayer) {
    Map.addLayer(canopyHeightMeta, CANOPY_VIS, 'Canopy height Meta', false);
  }
}

// 2022 national land-cover map. Rule: [stable class, map class, result].
if (PARAMS.LULC2022) {
  var lulc2022 = ee.Image(paths.assetMinisterio);
  Map.addLayer(lulc2022, CLASS_VIS, 'Land cover 2022', false);

  stablePixels = applyAgreementRules(stablePixels, lulc2022, [
    [3, 3, 3], [4, 3, 4], [4, 4, 4], [13, 4, 4], [6, 3, 6],
    [11, 11, 11], [12, 12, 12], [13, 13, 13], [14, 14, 14], [21, 21, 21],
    [25, 25, 25], [25, 12, 25], [25, 13, 25], [33, 33, 33], [34, 34, 34]
  ]);
}

// 2024 land-cover map (MAG, CUT 2024). Rule: [stable class, map class, result].
if (PARAMS.LULC2024) {
  var lulc2024 = ee.Image(paths.assetMAG2024).clip(region);
  Map.addLayer(ee.FeatureCollection(CUT2024_VECTOR_ASSET), {}, 'Land cover 2024 (vector)', false);
  Map.addLayer(lulc2024, CLASS_VIS, 'Land cover 2024', false);

  stablePixels = applyAgreementRules(stablePixels, lulc2024, [
    // Forest
    [3, 3, 3], [4, 3, 4], [4, 4, 4], [5, 5, 5], [5, 3, 5],
    // Non-forest natural formations
    [11, 11, 11], [13, 13, 13], [25, 29, 25], [12, 81, 12],
    // Farming and silviculture (9 = forest plantation kept as forest)
    [14, 14, 14], [21, 21, 21], [3, 9, 3],
    // Non-vegetated areas
    [25, 25, 25], [25, 24, 25], [25, 30, 25], [25, 23, 25],
    // Water and glaciers
    [33, 33, 33], [34, 34, 34], [33, 31, 33]
  ]);
}

// MapBiomas ecosystems map. Stable classes 3, 21, 25 and 33 are kept
// unless a rule marks them as CONFLICT.
if (PARAMS.ecosistemasMB) {
  var ecosystems = ee.Image(paths.assetecosistemasMB);
  Map.addLayer(ecosystems, CLASS_VIS, 'Ecosystems MapBiomas', false);

  var keptClasses3_21_25_33 = stablePixels.updateMask(
    stablePixels.eq(25).or(stablePixels.eq(21)).or(stablePixels.eq(33)).or(stablePixels.eq(3))
  );

  var agreed = applyAgreementRules(stablePixels, ecosystems, [
    // Agreements to keep
    [4, 3, 4], [6, 3, 6], [11, 11, 11], [12, 12, 12], [13, 13, 13],
    [14, 14, 14], [34, 34, 34], [12, 4, 12], [3, 100, 3], [4, 100, 3], [13, 4, 13],
    // Disagreements to remove
    [21, 3, CONFLICT], [21, 4, CONFLICT], [25, 3, CONFLICT], [25, 4, CONFLICT], [3, 13, CONFLICT]
  ], stablePixels);

  stablePixels = keptClasses3_21_25_33.blend(agreed);
  stablePixels = stablePixels.updateMask(stablePixels.neq(CONFLICT));
}

// Galápagos ecosystem and agro-ecosystem maps (same rules).
var GALAPAGOS_RULES = [
  [3, 3, 3], [4, 4, 4], [6, 3, 6], [11, 11, 11], [12, 12, 12], [13, 13, 13],
  [14, 14, 14], [21, 21, 21], [25, 25, 25], [25, 12, 25], [25, 13, 25],
  [33, 33, 33], [34, 34, 34], [25, 29, 25],
  [21, 12, CONFLICT]
];

if (PARAMS.ecosistemasGPS) {
  var ecosystemsGalapagos = ee.Image(paths.assetecosistemasGP);
  Map.addLayer(ecosystemsGalapagos, CLASS_VIS, 'Ecosystems Galápagos', false);
  stablePixels = applyAgreementRules(stablePixels, ecosystemsGalapagos, GALAPAGOS_RULES);
  stablePixels = stablePixels.updateMask(stablePixels.neq(CONFLICT));
}

if (PARAMS.agroecosistemasGPS) {
  var agroecosystemsGalapagos = ee.Image(paths.assetagroecosistemasGP);
  Map.addLayer(agroecosystemsGalapagos, CLASS_VIS, 'Agro-ecosystems Galápagos', false);
  stablePixels = applyAgreementRules(stablePixels, agroecosystemsGalapagos, GALAPAGOS_RULES);
  stablePixels = stablePixels.updateMask(stablePixels.neq(CONFLICT));
}

// Manual changes inside polygons.
stablePixels = remapWithPolygons(
  stablePixels,
  PARAMS.exclusion.polygons.geometries,
  PARAMS.exclusion.polygons.layer
);


// =============================================================================
// 6. MAP
// =============================================================================

var mosaics = ee.ImageCollection(paths.mosaicRaisgAct)
  .merge(ee.ImageCollection(paths.mosaicPacificoAct))
  .filterBounds(region);

addLayersToMap(stableBefore, stablePixels, mosaics, classification, region, PARAMS.yearsPreview);

if (PARAMS.planetData.activate) {
  addPlanetBasemaps(region, PARAMS.planetData.dates);
}


// =============================================================================
// 7. EXPORT
// =============================================================================

var imageName = 'ME-' + PARAMS.country + '-' + PARAMS.regionId + '-' + PARAMS.outputVersion;

stablePixels = stablePixels.set({
  code_region: PARAMS.regionId,
  pais: PARAMS.country,
  version: PARAMS.outputVersion.toString(),
  paso: 'P02'
});

Export.image.toAsset({
  image: stablePixels.toInt8().reproject('EPSG:4326', null, 30),
  description: imageName,
  assetId: paths.stablesPixelsAct + '/' + imageName,
  scale: 30,
  pyramidingPolicy: { '.default': 'mode' },
  maxPixels: 1e13,
  region: region.geometry().bounds()
});
