#!/usr/bin/env python

# Import earthengine API
import ee
from datetime import date



def setProperties(image):
    """Normaliza algumas propriedades entre imagens Landsat e Sentinel-2

    Parameters:
        image (ee.Image): ...

    Returns:
        ee.Image: ...
    """
    cloudCover = ee.Algorithms.If(image.get('SPACECRAFT_NAME'),
                                  image.get('CLOUDY_PIXEL_PERCENTAGE'),
                                  image.get('CLOUD_COVER'))

    date = ee.Algorithms.If(image.get('DATE_ACQUIRED'),
                            image.get('DATE_ACQUIRED'),
                            ee.Algorithms.If(image.get('SENSING_TIME'),
                                             image.get('SENSING_TIME'),
                                             image.get('GENERATION_TIME')))

    satellite = ee.Algorithms.If(image.get('SPACECRAFT_ID'),
                                 image.get('SPACECRAFT_ID'),
                                 ee.Algorithms.If(image.get('SATELLITE'),
                                                  image.get('SATELLITE'),
                                                  image.get('SPACECRAFT_NAME')))

    azimuth = ee.Algorithms.If(image.get('SUN_AZIMUTH'),
                               image.get('SUN_AZIMUTH'),
                               ee.Algorithms.If(image.get('SOLAR_AZIMUTH_ANGLE'),
                                                image.get(
                                                    'SOLAR_AZIMUTH_ANGLE'),
                                                image.get('MEAN_SOLAR_AZIMUTH_ANGLE')))

    elevation = ee.Algorithms.If(image.get('SUN_ELEVATION'),
                                 image.get('SUN_ELEVATION'),
                                 ee.Algorithms.If(image.get('SOLAR_ZENITH_ANGLE'),
                                                  ee.Number(90).subtract(
                                                      image.get('SOLAR_ZENITH_ANGLE')),
                                                  ee.Number(90).subtract(image.get('MEAN_SOLAR_ZENITH_ANGLE'))))

    # reflectance = ee.Algorithms.If(ee.String(ee.Dictionary(
    #     ee.Algorithms.Describe(image)).get('id')).match('SR').length(), 'SR', 'TOA')

    return image \
        .set('cloud_cover', cloudCover) \
        .set('satellite_name', satellite) \
        .set('sun_azimuth_angle', azimuth) \
        .set('sun_elevation_angle', elevation) \
        .set('date', ee.Date(date).format('Y-MM-dd'))
        # .set('reflectance', reflectance) \


def applyScaleFactors(image):
    """Apply Landsat Collection 2 scale factors"""

    opticalBands = image.select('SR_B.')\
        .multiply(0.0000275)\
        .add(-0.2)\
        .multiply(10000)

    thermalBands = image.select('ST_B.*')\
        .multiply(0.00341802)\
        .add(149.0)\
        #.multiply(10)

    image = image.addBands(opticalBands, None, True)
    image = image.addBands(thermalBands, None, True)

    return image \
        .copyProperties(image)\
        .copyProperties(image, ['system:time_start'])\
        .copyProperties(image, ['system:index'])\
        .copyProperties(image, ['system:footprint'])


def getCollection(collectionId,
                  collectionType='SR',
                  dateStart='1970-01-01',
                  dateEnd=None,
                  cloudCover=100,
                  blacklist=None,
                  geometry=None,
                  region=None):
    """Create an image collection

    Parameters:
        collectionId (str): ...
        dateStart (str): ...
        dateEnd (str): ...
        blacklist (list)...
        cloudCover (float): ...
        geometry (ee.Geometry): ...

    Returns:
        ee.ImageCollection: ...
    """

    if dateEnd == None:
        dateEnd = str(date.today())

    collection = ee.ImageCollection(collectionId)\
        .filter(ee.Filter.date(dateStart, dateEnd))\
        .map(applyScaleFactors) \
        .map(setProperties) \
        .map(
            lambda image: image.set('reflectance', collectionType)
        )
    
    if geometry != None:
        collection = collection.filterBounds(geometry)
    
    if region != None:
        collection = collection.filterBounds(region)
        
    if blacklist != None:
        collection = collection.filter(
            ee.Filter.inList('system:index', blacklist).Not()
        )

    # collection = collection.filterMetadata(
    #     'cloud_cover', 'less_than', cloudCover)

    collection = collection.filter(
        ee.Filter.lte('cloud_cover', cloudCover)
    )
    
    return collection


def getCollectionByPathRow(
    collectionId,
    collectionType='SR',
    dateStart='1970-01-01',
    dateEnd=None,
    cloudCover=100,
    blacklist=None,
    path=None,
    row=None,
    filterPathRow = False,
    geometry=None
):
    """Create an image collection

    Parameters:
        collectionId (str): ...
        dateStart (str): ...
        dateEnd (str): ...
        blacklist (list)...
        cloudCover (float): ...
        geometry (ee.Geometry): ...

    Returns:
        ee.ImageCollection: ...
    """

    if dateEnd == None:
        dateEnd = str(date.today())

    collection = ee.ImageCollection(collectionId)\
        .filter(ee.Filter.date(dateStart, dateEnd))\
        .map(applyScaleFactors) \
        .map(setProperties) \
        .map(
            lambda image: image.set('reflectance', collectionType)
        )
    if filterPathRow:
        if path != None:
            collection = collection.filterMetadata('WRS_PATH', 'equals', path)

        if row != None:
            collection = collection.filterMetadata('WRS_ROW', 'equals', row)

    if blacklist != None:
        collection = collection.filter(
            ee.Filter.inList('system:index', blacklist).Not()
        )

    if geometry != None:
        collection = collection.filterBounds(geometry)


    collection = collection.filterMetadata('cloud_cover', 'less_than', cloudCover)
    
    return collection
