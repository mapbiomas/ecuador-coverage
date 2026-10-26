/**
 * @name
 *      01-2-delete_mosaics.js
 *
 * @description
 *      Maintenance utility that DELETES annual mosaic assets of MapBiomas
 *      Ecuador - Collection 4, for one map sheet or Landsat path/row tile and
 *      one or more years. It is typically used before regenerating a mosaic
 *      (e.g. after updating its blacklist), since an existing asset cannot be
 *      overwritten.
 *
 *      WARNING: deleted assets cannot be recovered. Only users with write
 *      access to the MapBiomas Ecuador / RAISG projects can run the deletion.
 *
 * @usage
 *      1. Set PARAMS to identify the mosaic(s).
 *      2. Run with `deleteMosaic: false` (default). The console lists the
 *         asset IDs that would be deleted. Check them.
 *      3. Set `deleteMosaic: true` and run again to delete them.
 *      4. Set `deleteMosaic` back to false.
 *
 *      Asset IDs follow the pattern:
 *        <collection>/<COUNTRY>-<grid>-<SATELLITE>-<year>-<region_code>-<version>
 *      e.g. projects/mapbiomas-raisg/MOSAICOS/mosaics-pathrow-2/ECUADOR-010060-L9-2022-403-4
 *
 * @inputs
 *      Mosaic image collections (see MOSAIC_COLLECTIONS).
 *
 * @outputs
 *      None. Deletes assets when `deleteMosaic` is true.
 *
 * @author
 *      Adrián Rodríguez - EcoCiencia
 *
 * @version
 *      1.0.0 (2025-01-23)
 */


// =============================================================================
// 1. PARAMETERS
// =============================================================================

var PARAMS = {
  country: 'ECUADOR',
  years: [2022],           // One or more years, e.g. [2020, 2021, 2022]
  version: '4',            // Mosaic version (collection number)
  satellite: 'L9',         // 'LX' (Landsat 5 + 7), 'L8' or 'L9'

  // Mosaic type:
  //   'pathrow' -> Pacific / Andes mosaics, by Landsat path/row
  //   'cartas'  -> Amazon mosaics, by RAISG map sheet
  mosaicType: 'pathrow',

  // Tile or map sheet: 'PPPRRR' for path/row (e.g. '010060'),
  // or the sheet name for map sheets (e.g. 'SA-18-V-A').
  grid: '010060',

  // Mosaic region code, as used when the mosaic was generated
  // (e.g. 401, 402, 406 for map sheets; 409 for Pacific path/rows).
  region_code: '409',

  // Path/row only: true to delete topographically corrected mosaics.
  topoCorrected: false,

  // *** CAUTION *** true permanently deletes the assets.
  deleteMosaic: false
};


// =============================================================================
// 2. MOSAIC COLLECTIONS
// =============================================================================

var MOSAIC_COLLECTIONS = {
  pathrow: 'projects/mapbiomas-raisg/MOSAICOS/mosaics-pathrow-2',
  pathrowTopoCorrected: 'projects/mapbiomas-raisg/MAPBIOMAS-ECUADOR/MOSAICOS/mosaics-pathrow-c-topografica',
  cartas: 'projects/mapbiomas-raisg/MOSAICOS/mosaics-2'
};


// =============================================================================
// 3. RUN
// =============================================================================

var collectionId;

if (PARAMS.mosaicType === 'pathrow') {
  collectionId = PARAMS.topoCorrected
    ? MOSAIC_COLLECTIONS.pathrowTopoCorrected
    : MOSAIC_COLLECTIONS.pathrow;
} else if (PARAMS.mosaicType === 'cartas') {
  collectionId = MOSAIC_COLLECTIONS.cartas;
} else {
  throw new Error("mosaicType must be 'pathrow' or 'cartas'.");
}

PARAMS.years.forEach(function (year) {

  var imageId = collectionId + '/' + [
    PARAMS.country,
    PARAMS.grid,
    PARAMS.satellite,
    year,
    PARAMS.region_code,
    PARAMS.version
  ].join('-');

  if (!PARAMS.deleteMosaic) {
    print('Mosaic to delete (dry run):', imageId);
    return;
  }

  // Delete one asset at a time; an error (e.g. asset not found) is reported
  // and the script continues with the next year.
  try {
    ee.data.deleteAsset(imageId);
    print('Mosaic deleted:', imageId);
  } catch (error) {
    print('Could not delete ' + imageId + ': ' + error);
  }
});
