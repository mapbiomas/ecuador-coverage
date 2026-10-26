"""
generate_mosaics_pathrow.py

Generates the annual Landsat mosaics of MapBiomas Ecuador - Collection 4 for
the Pacific coast and the Andes: one mosaic per Landsat WRS-2 tile
(path/row), satellite and year, exported as an Earth Engine asset.

For each row of the parameter table (CSV) with PROCESS = 1 the script:
  1. Loads the Landsat Collection 2, Level-2 images of the tile for the
     search period, excluding the scenes listed in BLACKLIST.
  2. Masks clouds and cloud shadows (QA_PIXEL flags, cloud score and TDOM).
  3. Optionally applies a topographic (illumination) correction.
  4. Adds spectral mixture fractions, NDFI-family indexes and spectral
     indexes.
  5. Builds the annual mosaic (median and dry/wet-season percentiles).
  6. Exports it to the output collection. Mosaics that already exist are
     skipped; delete them first to regenerate (see gee/01-2-delete_mosaics.js).

Usage:
    python generate_mosaics_pathrow.py [path/to/parameters.csv]

    Without arguments, params/pathrow_example.csv is used.
    The columns are described in params/README.md.

Requirements:
    - Python packages in requirements.txt.
    - An authenticated Earth Engine account (`earthengine authenticate`).
    - Write access to the output collection.

Author:  Adrián Rodríguez - EcoCiencia (MapBiomas Ecuador)
"""

import os
import sys
from datetime import date

import ee
import pandas as pd

# =============================================================================
# 1. SETTINGS
# =============================================================================

# Google Cloud project used to run Earth Engine.
EE_PROJECT = 'mapbiomas-ecuador'

# True: apply topographic correction and export to OUTPUT_COLLECTION_TOPO.
TOPOGRAPHIC_CORRECTION = False

# Mosaic version, used in the asset name and properties.
VERSION = '4'

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CSV = os.path.join(SCRIPT_DIR, 'params', 'pathrow_example.csv')

# Input assets.
GRIDS_ASSET = 'projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/ec-landsat-grid'
LANDSAT_MASKS_ASSET = 'projects/mapbiomas-workspace/AUXILIAR/landsat-mask'

# Output image collections.
OUTPUT_COLLECTION = 'projects/mapbiomas-raisg/MOSAICOS/mosaics-pathrow-2'
OUTPUT_COLLECTION_TOPO = 'projects/mapbiomas-raisg/MAPBIOMAS-ECUADOR/MOSAICOS/mosaics-pathrow-c-topografica'


# =============================================================================
# 2. EARTH ENGINE AND MODULES
# =============================================================================
# Earth Engine must be initialized before importing the modules.

ee.Initialize(project=EE_PROJECT)

sys.dont_write_bytecode = True
sys.path.append(SCRIPT_DIR)

from modules.Collection import getCollectionByPathRow
from modules.DataType import setBandTypes
from modules.Miscellaneous import getEntropyG
from modules.Mosaic import getMosaic
from modules.MosaicProcessing import (COLLECTION_IDS, SATELLITE_GROUPS,
                                      ENDMEMBER_KEYS, parseBlacklist,
                                      toIsoDate, getValidTiles,
                                      keepValidTilesAndRename,
                                      applyCloudAndShadowMask,
                                      addSmaAndIndexes)
from modules.SmaAndNdfi import ENDMEMBERS
from modules.TopographicFix import (get_illumination_condition,
                                    topographic_correction)


# =============================================================================
# 3. RUN
# =============================================================================

csvFile = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV

table = pd.read_csv(csvFile)
table = table[table.PROCESS == 1]
print('Mosaics to process:', len(table))

outputCollection = OUTPUT_COLLECTION_TOPO if TOPOGRAPHIC_CORRECTION else OUTPUT_COLLECTION

grids = ee.FeatureCollection(GRIDS_ASSET)
validTiles = getValidTiles(LANDSAT_MASKS_ASSET)

counter = 1

for row in table.itertuples():

    dateStartP = toIsoDate(row.T0_P)   # mosaic period
    dateEndP = toIsoDate(row.T1_P)
    dateStartS = toIsoDate(row.T0_S)   # image search period
    dateEndS = toIsoDate(row.T1_S)

    blacklist = parseBlacklist(row.BLACKLIST)
    satelliteId = row.SATELLITE.lower()
    gridName = row.GRID_NAME.replace('_', '')   # '_010059' -> '010059'

    outputName = '-'.join([
        row.COUNTRY, gridName, row.SATELLITE, str(row.YEAR),
        str(row.REGION_CODE), VERSION
    ])

    try:
        existing = ee.ImageCollection(outputCollection) \
            .filter(ee.Filter.eq('year', int(row.YEAR))) \
            .filter(ee.Filter.eq('country', row.COUNTRY)) \
            .reduceColumns(ee.Reducer.toList(), ['system:index']) \
            .get('list') \
            .getInfo()

        if outputName in existing:
            print('WARNING: ' + outputName + ' already exists. Skipping.')
            continue

        grid = ee.Feature(
            grids.filter(ee.Filter.eq('P_R', gridName)).first()
        ).geometry()

        # Load images of one or two sensors.
        collection = ee.ImageCollection([])

        for satellite in SATELLITE_GROUPS[satelliteId]:
            sensorCollection = getCollectionByPathRow(
                COLLECTION_IDS[satellite],
                dateStart=dateStartS,
                dateEnd=dateEndS,
                cloudCover=row.CLOUD_COVER,
                path=int(row.PATH),
                row=int(row.ROW),
                blacklist=blacklist,
                filterPathRow=True,
                geometry=grid
            )
            collection = collection.merge(
                keepValidTilesAndRename(sensorCollection, satellite, validTiles)
            )

        # Cloud and shadow masks.
        collection = applyCloudAndShadowMask(
            collection, row.SHADOWSUM, row.CLOUD_THRESH, row.TEMP_MAX, row.TEMP_MIN)

        # Topographic correction (optional).
        if TOPOGRAPHIC_CORRECTION:
            collection = collection.map(
                lambda img: topographic_correction(
                    img, get_illumination_condition(img, grid))
            )

        # Fractions and indexes.
        endmember = ENDMEMBERS[ENDMEMBER_KEYS[satelliteId]]
        collection = addSmaAndIndexes(collection, endmember)

        # Annual mosaic.
        mosaic = getMosaic(
            collection,
            percentileDry=25,
            percentileWet=75,
            dateStart=dateStartP,
            dateEnd=dateEndP
        )

        nImages = collection.filterDate(dateStartP, dateEndP).size().getInfo()

        mosaic = getEntropyG(mosaic)
        mosaic = setBandTypes(mosaic)

        mosaic = mosaic.set({
            'year': int(row.YEAR),
            'collection': 4.0,
            'grid_name': row.GRID_NAME,
            'version': VERSION,
            'country': row.COUNTRY,
            'satellite': satelliteId,
            'region': row.REGION_NAME,
            'region_code': int(row.REGION_CODE),
            'nimages': nImages,
            'dtstartp': dateStartP,
            'dtendp': dateEndP,
            'cloud_cover': row.CLOUD_COVER,
            'path': int(row.PATH),
            'row': int(row.ROW),
            'processed': date.today().strftime('%Y-%m-%d'),
        })

        task = ee.batch.Export.image.toAsset(
            image=mosaic.clip(grid),
            description=outputName,
            assetId=outputCollection + '/' + outputName,
            region=grid,
            scale=30,
            maxPixels=int(1e13)
        )
        task.start()

        print('{} - export task started: {}'.format(counter, outputName))
        counter += 1

    except Exception as error:
        print('ERROR in {}: {}'.format(outputName, error))
