"""
MosaicProcessing.py

Helper functions shared by generate_mosaics_pathrow.py and
generate_mosaics_cartas.py (MapBiomas Ecuador - Collection 4).
"""

from datetime import datetime

import ee

from modules.BandNames import getBandNames
from modules.CloudAndShadowMaskC2 import getMasks
from modules.SmaAndNdfi import (getFractions, getNDFI, getNDFIb, getSEFI,
                                getWEFI, getFNS)
from modules.SpectralIndexes import (getHallCover, getNDVI, getEVI2,
                                     getNDWIGao, getNDWI_mcfeeters, getNDSI,
                                     getPRI, getSAVI, getGCVI, getNUACI,
                                     getNDBI, getCAI, getNDSI2, getNDMI,
                                     getGLI, getMNDWI, getNDMIR, getNDRB,
                                     getNDGB)

# Landsat Collection 2, Tier 1, Level-2 collections.
COLLECTION_IDS = {
    'l4': 'LANDSAT/LT04/C02/T1_L2',
    'l5': 'LANDSAT/LT05/C02/T1_L2',
    'l7': 'LANDSAT/LE07/C02/T1_L2',
    'l8': 'LANDSAT/LC08/C02/T1_L2',
    'l9': 'LANDSAT/LC09/C02/T1_L2',
}

# Satellite codes accepted in the SATELLITE column of the parameter tables:
#   'l4', 'l5', 'l7', 'l8', 'l9' -> a single sensor
#   'lx' -> Landsat 5 + Landsat 7
#   'ly' -> Landsat 8 + Landsat 9
SATELLITE_GROUPS = {
    'l4': ['l4'], 'l5': ['l5'], 'l7': ['l7'], 'l8': ['l8'], 'l9': ['l9'],
    'lx': ['l5', 'l7'],
    'ly': ['l8', 'l9'],
}

# Endmembers (see SmaAndNdfi.ENDMEMBERS) used for each satellite code.
ENDMEMBER_KEYS = {
    'l4': 'landsat-4', 'l5': 'landsat-5', 'l7': 'landsat-7',
    'l8': 'landsat-8', 'l9': 'landsat-9',
    'lx': 'landsat-5', 'ly': 'landsat-8',
}

REFLECTANCE_BANDS = ['blue', 'red', 'green', 'nir', 'swir1', 'swir2']

# Bands multiplied by 10000 before building the mosaic.
BANDS_TO_SCALE = REFLECTANCE_BANDS + [
    'cai', 'evi2', 'gcvi', 'hallcover', 'ndvi', 'pri', 'savi',
    'ndwi_gao', 'ndwi_mcfeeters', 'ndsi', 'ndsi2', 'ndbi', 'ndmi',
    'gli', 'mndwi', 'ndmir', 'ndrb', 'ndgb',
]


# -----------------------------------------------------------------------------
# Parameter table helpers
# -----------------------------------------------------------------------------

def parseBlacklist(text):
    """Splits the BLACKLIST column into a list of scene IDs.

    Accepted separators: '-', '--', ';' and ','. Spaces, line breaks and
    quotes are ignored. Scene IDs only contain '_', so '-' is a safe
    separator.
    """
    text = str(text).replace(' ', '').replace('\n', '').replace("'", '')

    for separator in ['--', '-', ';']:
        text = text.replace(separator, ',')

    return [sceneId for sceneId in text.split(',') if sceneId and sceneId != 'nan']


def toIsoDate(text):
    """Converts 'd/m/YYYY' (as written in the CSV) to 'YYYY-MM-DD'."""
    return datetime.strptime(text, '%d/%m/%Y').strftime('%Y-%m-%d')


# -----------------------------------------------------------------------------
# Image collection helpers
# -----------------------------------------------------------------------------

def getValidTiles(masksAsset):
    """Returns the IDs (path * 1000 + row) of the Landsat tiles that have a
    mask in `masksAsset`."""
    return ee.ImageCollection(masksAsset) \
        .reduceColumns(ee.Reducer.toList(), ['tile']).get('list').getInfo()


def getTiles(collection):
    """Returns the distinct WRS-2 tiles of a collection as a list of
    {'path', 'row', 'id'} dictionaries, where id = path * 1000 + row."""
    collection = collection.map(
        lambda image: image.set(
            'tile', {
                'path': image.get('WRS_PATH'),
                'row': image.get('WRS_ROW'),
                'id': ee.Number(image.get('WRS_PATH'))
                        .multiply(1000).add(image.get('WRS_ROW')).int32()
            }
        )
    )

    tiles = collection.distinct(['tile']).reduceColumns(
        ee.Reducer.toList(), ['tile']).get('list')

    return tiles.getInfo()


def keepValidTilesAndRename(collection, satellite, validTiles):
    """Keeps only images from tiles listed in `validTiles` and renames the
    bands to common names (blue, green, red, nir, swir1, swir2, ...).

    Returns an empty collection if no image belongs to a valid tile
    (e.g. Landsat 5 after 2011 when satellite = 'lx').
    """
    tiles = [tile for tile in getTiles(collection) if tile['id'] in validTiles]

    if not tiles:
        print('  No {} images in a valid tile.'.format(satellite))
        return ee.ImageCollection([])

    subcollections = [
        collection
            .filter(ee.Filter.eq('WRS_PATH', tile['path']))
            .filter(ee.Filter.eq('WRS_ROW', tile['row']))
        for tile in tiles
    ]

    collection = ee.ImageCollection(
        ee.List(subcollections).iterate(
            lambda subcollection, merged:
                ee.ImageCollection(merged).merge(subcollection),
            ee.ImageCollection([])
        )
    )

    bands = getBandNames(satellite + 'c2')

    return collection.select(bands['bandNames'], bands['newNames'])


# -----------------------------------------------------------------------------
# Masks and indexes
# -----------------------------------------------------------------------------

def applyCloudAndShadowMask(collection, shadowSum, cloudThresh, tempMax, tempMin):
    """Masks clouds and cloud shadows.

    A pixel is removed if any of these masks flags it: QA_PIXEL cloud,
    cloud score, QA_PIXEL cloud shadow, or TDOM cloud shadow.

    Args:
        collection (ee.ImageCollection): images with common band names.
        shadowSum (int): darkness threshold for shadow detection (x 10000).
        cloudThresh (int): cloud score threshold (0-100).
        tempMax, tempMin (float): TEMP_MAX and TEMP_MIN columns (Kelvin).
            The cloud score rescales temperature from TEMP_MIN (score 0) to
            TEMP_MAX (score 1). For cold pixels to count as clouds,
            TEMP_MIN must be the warmer value (e.g. TEMP_MIN=330,
            TEMP_MAX=290).
    """
    collectionWithMasks = getMasks(
        collection,
        cloudThresh=cloudThresh,
        cloudFlag=True,
        cloudScore=True,
        cloudShadowFlag=True,
        cloudShadowTdom=True,
        zScoreThresh=-1,
        shadowSumThresh=shadowSum,
        dilatePixels=4,
        cloudHeights=[2000, 10000, 500],
        cloudBand='cloudScoreMask',
        temp_max=tempMax,
        temp_min=tempMin
    )

    return collectionWithMasks.map(
        lambda image: image.mask(
            image.select([
                'cloudFlagMask',
                'cloudScoreMask',
                'cloudShadowFlagMask',
                'cloudShadowTdomMask'
            ]).reduce(ee.Reducer.anyNonZero()).eq(0)
        )
    )


def multiplyBy10000(image):
    """Scales reflectance and spectral index bands by 10000."""
    return image.addBands(
        srcImg=image.select(BANDS_TO_SCALE).multiply(10000),
        names=BANDS_TO_SCALE,
        overwrite=True
    )


def divideBy10000(image):
    """Converts reflectance bands from (x 10000) to (0-1)."""
    return image.addBands(
        srcImg=image.select(REFLECTANCE_BANDS).divide(10000),
        names=REFLECTANCE_BANDS,
        overwrite=True
    )


def addSmaAndIndexes(collection, endmember, extraIndexes=()):
    """Adds spectral mixture fractions, NDFI-family indexes and spectral
    indexes to every image.

    Args:
        collection (ee.ImageCollection): masked images (reflectance x 10000).
        endmember (list): endmembers from SmaAndNdfi.ENDMEMBERS.
        extraIndexes (iterable): additional index functions (ee.Image ->
            ee.Image), computed on 0-1 reflectance.
    """
    # Spectral mixture analysis and NDFI-family indexes.
    collection = collection \
        .map(lambda image: image.addBands(getFractions(image, endmember[:4]))) \
        .map(lambda image: getNDFIb(image, endmember)) \
        .map(getNDFI) \
        .map(getSEFI) \
        .map(getWEFI) \
        .map(getFNS)

    # Spectral indexes, computed on 0-1 reflectance.
    indexFunctions = [
        getHallCover, getNDVI, getEVI2, getNDWIGao, getNDWI_mcfeeters,
        getNDSI, getPRI, getSAVI, getGCVI, getNUACI, getNDBI, getCAI,
        getNDSI2, getNDMI, getGLI, getMNDWI, getNDMIR, getNDRB, getNDGB,
    ] + list(extraIndexes)

    collection = collection.map(divideBy10000)

    for indexFunction in indexFunctions:
        collection = collection.map(indexFunction)

    return collection.map(multiplyBy10000)
