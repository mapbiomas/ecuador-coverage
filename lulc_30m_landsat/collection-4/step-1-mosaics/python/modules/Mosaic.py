#
import ee
from modules.BandNames import getBandNames



def getMosaic(
        collection,
        percentileDry=25,
        percentileWet=75,
        percentileBand='ndvi',
        dateStart='2020-01-01',
        dateEnd='2020-12-31'):
    

    # get band names and create its suffix
    bands = ee.Image(collection.first()).bandNames()

    bandsDry = bands.map(lambda band:
                         ee.String(band).cat('_dry')
                         )

    bandsWet = bands.map(lambda band:
                         ee.String(band).cat('_wet')
                         )

    bandsAmp = bands.map(lambda band:
                         ee.String(band).cat('_amp')
                         )

    # New bands
    bandsDryMin = bands.map(lambda band: ee.String(band).cat('_dry_min'))
    bandsDryMed = bands.map(lambda band: ee.String(band).cat('_dry_median'))
    bandsDryMax = bands.map(lambda band: ee.String(band).cat('_dry_max'))
    bandsDryQmo = bands.map(lambda band: ee.String(band).cat('_dry_qmo'))
    bandsDryStDev = bands.map(lambda band: ee.String(band).cat('_dry_stDev'))
    bandsWetMin = bands.map(lambda band: ee.String(band).cat('_wet_min'))
    bandsWetMed = bands.map(lambda band: ee.String(band).cat('_wet_median'))
    bandsWetMax = bands.map(lambda band: ee.String(band).cat('_wet_max'))
    bandsWetAmp = bands.map(lambda band: ee.String(band).cat('_wet_amp'))
    bandsWetQmo = bands.map(lambda band: ee.String(band).cat('_wet_qmo'))
    bandsWetStDev = bands.map(lambda band: ee.String(band).cat('_wet_stDev'))


    # get dry season collection
    dry = collection\
        .select([percentileBand])\
        .reduce(ee.Reducer.percentile([percentileDry]))

    collectionDry = collection.map(
        lambda image:
            image.mask(image.select([percentileBand]).lte(dry))
    )
    # Agriculture view
    ndviDryAgri = collection \
        .select(['ndvi']) \
        .reduce(ee.Reducer.percentile([percentileDry]))

    collectionDryAgri = collection.map(
        lambda image: image.mask(image.select(['ndvi']).lte(ndviDryAgri))
    )

    # get wet season collection
    wet = collection\
        .select([percentileBand])\
        .reduce(ee.Reducer.percentile([percentileWet]))

    collectionWet = collection.map(
        lambda image:
            image.mask(image.select([percentileBand]).gte(wet))
    )

    ndviWetAgri = collection \
        .select(['ndvi']) \
        .reduce(ee.Reducer.percentile([percentileWet]))
    collectionWetAgri = collection.map(
        lambda image: image.mask(image.select(['ndvi']).gte(ndviWetAgri))
    )

    # Reduce collection to median mosaic
    mosaic = collection.filter(
        ee.Filter.date(dateStart, dateEnd)
    ).reduce(ee.Reducer.median())

    # get dry median mosaic
    mosaicDry = collectionDry.reduce(ee.Reducer.median())\
        .rename(bandsDry)

    # get wet median mosaic
    mosaicWet = collectionWet.reduce(ee.Reducer.median())\
                             .rename(bandsWet)

    # get minimum mosaic
    mosaicMin = collection.reduce(ee.Reducer.min())

    # get maximum mosaic
    mosaicMax = collection.reduce(ee.Reducer.max())

    # get amplitude mosaic
    mosaicAmp = mosaicMax.subtract(mosaicMin)\
        .rename(bandsAmp)

    # get stdDev mosaic
    mosaicStdDev = collection.reduce(ee.Reducer.stdDev())


    # ----- Empezando a editar para Agri
    # get Dry min mosaic
    mosaicDryMin = collectionDryAgri.reduce(ee.Reducer.min()) \
                   .rename(bandsDryMin)

    # # get Dry median mosaic
    mosaicDryMed = collectionDryAgri.reduce(ee.Reducer.median()) \
                                    .rename(bandsDryMed)

    # get Dry max mosaic
    mosaicDryMax = collectionDryAgri.reduce(ee.Reducer.max()) \
                                    .rename(bandsDryMax)

    mosaicDryQmo = collectionDryAgri.qualityMosaic('evi2') \
                                    .rename(bandsDryQmo)
       
    # get Dry stDev mosaic
    mosaicDryStDev = collectionDryAgri.reduce(ee.Reducer.stdDev()) \
        .rename(bandsDryStDev)
    
    # get Wet min mosaic
    mosaicWetMin = collectionWetAgri.reduce(ee.Reducer.min()) \
        .rename(bandsWetMin)
        
    # # get Wet median mosaic
    mosaicWetMed = collectionWetAgri.reduce(ee.Reducer.median()) \
        .rename(bandsWetMed)

    # get Wet max mosaic
    mosaicWetMax = collectionWetAgri.reduce(ee.Reducer.max()) \
        .rename(bandsWetMax)
                
    # MaxEvi2 = CalcEvi2(mosaicMax)
                
    # get Wet qmo mosaic
    #mosaicWetQmo = collectionWet.addBands(MaxEvi2)        
    #mosaicWetQmo = collectionWet.map(CalcEvi2)
    mosaicWetQmo = collectionWetAgri.qualityMosaic('evi2') \
        .rename(bandsWetQmo)
    
    # get Wet stDev mosaic
    mosaicWetStDev = collectionWetAgri.reduce(ee.Reducer.stdDev()) \
        .rename(bandsWetStDev)
    
    # ----- editando hasta aqui 

    mosaic = mosaic\
        .addBands(mosaicDry)\
        .addBands(mosaicWet)\
        .addBands(mosaicMin)\
        .addBands(mosaicMax)\
        .addBands(mosaicAmp)\
        .addBands(mosaicStdDev)\
        .addBands(mosaicStdDev) \
        .addBands(mosaicDryMin) \
        .addBands(mosaicDryMax) \
        .addBands(mosaicDryQmo) \
        .addBands(mosaicDryStDev) \
        .addBands(mosaicWetMin) \
        .addBands(mosaicWetMax) \
        .addBands(mosaicWetQmo) \
        .addBands(mosaicWetMed) \
        .addBands(mosaicDryMed) \
        .addBands(mosaicWetStDev) 
        # .addBands(dry)\
        # .addBands(wet)\
        
    return mosaic


def getMosaicAgriculture(
        collection,
        percentiles=[20,75],
        qualityBand='evi2'):

    # get band names and create its suffix
    bands = ee.Image(collection.first()).bandNames()
    
    mosaicPercentil = collection\
        .reduce(ee.Reducer.percentile(percentiles))

    # Reduce collection to median mosaic
    mosaicMedian = collection\
        .reduce(ee.Reducer.median())

    # Reduce collection to minimum mosaic
    mosaicMin = collection\
        .reduce(ee.Reducer.min())

    # Reduce collection to maximum mosaic
    mosaicMax = collection\
        .reduce(ee.Reducer.max())

    # Reduce collection to stdDev mosaic
    mosaicStdDev = collection\
        .reduce(ee.Reducer.stdDev())

    # Reduce collection to quality mosaic
    mosaicQmo = collection\
        .qualityMosaic(qualityBand)
    
    bandsQmo = bands.map(lambda band:
                      ee.String(band).cat('_qmo')
                      )
    
    mosaicQmo = mosaicQmo.rename(bandsQmo)

    mosaic = mosaicMedian\
        .addBands(mosaicPercentil)\
        .addBands(mosaicMin)\
        .addBands(mosaicMax)\
        .addBands(mosaicStdDev)\
        .addBands(mosaicQmo)

    return mosaic


def getMosaicUrban(
        collection,
        percentiles=[1, 99],
        percentilesSlice=[25, 75],
        sliceBand='ndvi'):

    # get band names and create its suffix
    bands = ee.Image(collection.first()).bandNames()
    
    bandsSlice1 = bands.map(lambda band:
                            ee.String(band).cat(
                                '_median_p{}'.format(percentilesSlice[0]))
                            )

    bandsSlice2 = bands.map(lambda band:
                            ee.String(band).cat(
                                '_median_p{}'.format(percentilesSlice[1]))
                         )

    mosaicPercentil = collection\
        .reduce(ee.Reducer.percentile(percentiles))

    percentilSlice = collection\
        .select([sliceBand])\
        .reduce(ee.Reducer.percentile(percentilesSlice))

    collectionPercentilSlice1 = collection.map(
        lambda image:
            image.mask(image.select([sliceBand]).lte(
                percentilSlice.select([0])))
    )

    collectionPercentilSlice2 = collection.map(
        lambda image:
            image.mask(image.select([sliceBand]).gte(
                percentilSlice.select([1])))
    )

    mosaicPercentilSlice1 = collectionPercentilSlice1\
        .reduce(ee.Reducer.median())\
        .rename(bandsSlice1)

    mosaicPercentilSlice2 = collectionPercentilSlice2\
        .reduce(ee.Reducer.median())\
        .rename(bandsSlice2)

    # Reduce collection to median mosaic
    mosaicMedian = collection\
        .reduce(ee.Reducer.median())

    # Reduce collection to minimum mosaic
    mosaicMin = collection\
        .reduce(ee.Reducer.min())

    # Reduce collection to maximum mosaic
    mosaicMax = collection\
        .reduce(ee.Reducer.max())

    mosaic = mosaicMedian\
        .addBands(mosaicPercentil)\
        .addBands(mosaicPercentilSlice1)\
        .addBands(mosaicPercentilSlice2)\
        .addBands(mosaicMin)\
        .addBands(mosaicMax)

    return mosaic
