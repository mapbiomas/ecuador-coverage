#
from re import S
import ee
# ee.Initialize()

def getNDVI(image):

    exp = '( b("nir") - b("red") ) / ( b("nir") + b("red") )'

    ndvi = image.expression(exp)\
        .rename(["ndvi"])\
        .add(1)

    return image.addBands(srcImg=ndvi, overwrite=True)


def getNDBI(image):

    exp = '( b("swir1") - b("nir") ) / ( b("swir1") + b("nir") )'

    ndbi = image.expression(exp)\
        .rename(["ndbi"])\
        .add(1)

    return image.addBands(srcImg=ndbi, overwrite=True)


def getUI(image):

    exp = '( b("swir2") - b("nir") ) / ( b("swir2") + b("nir") )'

    ui = image.expression(exp)\
        .rename(["ui"])\
        .add(1)

    return image.addBands(srcImg=ui, overwrite=True)


def getBU(image):
    
    exp = 'b("ndbi") - b("ndvi")'

    bu = image.expression(exp)\
        .rename(["bu"])

    return image.addBands(srcImg=bu, overwrite=True)


def getEBBI(image):
    
    # exp = '( b("swir1") - b("nir") ) / ( 0.1 * sqrt(b("swir1") + b("tir")) )'
    exp = '( b("swir1_dn") - b("nir_dn") ) / ( 10 * sqrt(b("swir1_dn") + b("tir_dn")) )'

    ebbi = image.expression(exp)\
        .rename(["ebbi"])

    return image.addBands(srcImg=ebbi, overwrite=True)

# def getNDWI(image):

#     exp = 'float(b("nir") - b("swir1"))/(b("nir") + b("swir1"))'

#     ndwi = image.expression(exp)\
#         .rename(["ndwi"])\
#         .add(1)

#     return image.addBands(srcImg=ndwi, overwrite=True)


def getNDWI(image):
    """Calculate NDWI using the formula
        ndwi = (nir - swir2) / (nir + swir2)
        Line 56 of generate_metrics_and_fractions.py

    Parameters:
        image (ee.Image): Fractions image containing the bands:
        nir, swir2

    Returns:
        ee.Image: Fractions image with ndwi band
    """

    ndwi = image.normalizedDifference(['nir', 'swir2'])\
                .rename(["ndwi"])\
                .add(1)

    return image.addBands(srcImg=ndwi, overwrite=True)


def getNDWIGao(image):
    """Calculate ndwi_gao using the formula
        ndwi_gao = (nir - swir1) / (nir + swir1)
    
    Parameters:
        image (ee.Image): Fractions image containing the bands:
        nir, swir1
    
    Returns:
        ee.Image: Fractions image with ndwi_gao band
    """

    ndwi_gao = image.normalizedDifference(['nir', 'swir1']) \
                    .rename(['ndwi_gao'])  \
                    .add(1)

    return image.addBands(srcImg=ndwi_gao, overwrite=True)


def getNDWI_mcfeeters(image):
    """Calculate ndwi_mcfeeters using the formula
        NDWI_mcfeeters = (green - swir1) / (green + swir1)

    Parameters:
        image (ee.Image): Fractions image containing the bands:
        green, swir1

    Returns:
        ee.Image: Fractions image with ndwi_mcfeeters band
    """

    ndwi_mcf = image.normalizedDifference(['green', 'nir'])\
                    .rename(['ndwi_mcfeeters'])\
                    .add(1)    

    return image.addBands(srcImg=ndwi_mcf, overwrite=True)


def getMNDWI(image):

    exp = 'float(b("green") - b("swir1"))/(b("green") + b("swir1"))'

    mndwi = image.expression(exp)\
        .rename(["mndwi"])\
        .add(1)

    return image.addBands(srcImg=mndwi, overwrite=True)

#  ver rango
def getSAVI(image):

    exp = '1.5 * (b("nir") - b("red")) / (0.5 + b("nir") + b("red"))'

    savi = image.expression(exp)\
        .rename(["savi"])\
        .add(1)

    return image.addBands(srcImg=savi, overwrite=True)


def getPRI(image):

    exp = 'float(b("blue") - b("green"))/(b("blue") + b("green"))'

    pri = image.expression(exp)\
        .rename(["pri"])\
        .add(1)

    return image.addBands(srcImg=pri, overwrite=True)

#  ver rango
def getCAI(image):

    exp = 'float( b("swir2") / b("swir1") )'

    cai = image.expression(exp)\
        .rename(["cai"])\
        .add(1)

    return image.addBands(srcImg=cai, overwrite=True)


def getEVI(image):

    exp = '2.5 * ((b("nir") - b("red")) / (b("nir") + 6 * b("red") - 7.5 * b("blue") + 1))'

    evi = image.expression(exp)\
        .rename(["evi"])\
        .add(1)

    return image.addBands(srcImg=evi, overwrite=True)


def getEVI2(image):

    exp = '2.5 * (b("nir") - b("red")) / (b("nir") + (2.4 * b("red")) + 1)'

    evi2 = image.expression(exp)\
        .rename(["evi2"])\
        .add(1)

    return image.addBands(srcImg=evi2, overwrite=True)

# valores encima del millon revisar
def getHallCover(image):

    exp = '( (-b("red") * 0.017) - (b("nir") * 0.007) - (b("swir2") * 0.079) + 5.22 )'

    hallcover = image.expression(exp)\
                     .exp()\
                     .rename(["hallcover"])

    return image.addBands(srcImg=hallcover, overwrite=True)


def getHallHeigth(image):

    exp = '( (-b("red") * 0.039) - (b("nir") * 0.011) - (b("swir1") * 0.026) + 4.13 )'

    hallheigth = image.expression(exp)\
        .exp()\
        .rename(["hallheigth"])

    return image.addBands(srcImg=hallheigth, overwrite=True)

#  ver rango
def getGCVI(image):

    exp = 'b("nir") / b("green") - 1'

    gcvi = image.expression(exp)\
        .rename(["gcvi"])\
        .add(1)

    return image.addBands(srcImg=gcvi , overwrite=True)



# ///////////////////////////////////////////////////////////////////////////// 


# redundante con getMNDWI?
def getNDSI(image):
    """Calculate NDSI using the formula
        NDSI = (green - swir1) / (green + swir1)
        Line 61 of generate_metrics_and_fractions.py

    Parameters:
        image (ee.Image): Fractions image containing the bands:
        green, swir1

    Returns:
        ee.Image: Fractions image with NDSI band
    """

    ndsi = image.normalizedDifference(['green', 'swir1']) \
                .rename(['ndsi']) \
                .add(1)

    return image.addBands(srcImg=ndsi, overwrite=True)


def getNUACI(image):
    """Calculate nuaci using the formula
         = (GREEN - NIR) / (GREEN + NIR)
    Parameters:
        image (ee.Image): image containing the bands:
        
    Returns:
        ee.Image:  image with NUACI band
    """

    imageDMSP = ee.Image('NOAA/DMSP-OLS/NIGHTTIME_LIGHTS/F182013') \
                        .select('stable_lights')

    untl =imageDMSP.where(imageDMSP.gte(1), 1).rename('uNTL')
            
    ndvi = image.normalizedDifference(['nir', 'red'])

    ndwi = image.normalizedDifference(['green', 'nir'])

    ndbi = image.normalizedDifference(['swir1', 'nir'])

    # compute nuaci
    nuaci = image.expression(
        'float(untl) * (1.0 - sqrt(pow((ndwi + 0.05), 2) + (pow((ndwi + 0.1), 2) + (pow((ndbi + 0.1), 2)))))', 
        { 'untl': untl, 'ndvi': ndvi, 'ndbi': ndbi, 'ndwi': ndwi }
    )

    nuaci = nuaci.multiply(100).add(100).byte().rename(['nuaci'])

    return image.addBands(srcImg=nuaci , overwrite=True)


def getTextG(image):
    """Calculate textG using the formula
         = ('median_green').entropy(ee.Kernel.square({radius: 5}))
    Parameters:
        image (ee.Image): image containing the Green band:
        
    Returns:
        ee.Image:  image with textG band
    """

    green = image.select('green')

    textG = green.entropy(ee.Kernel.square(5))

    textG = textG.multiply(1000).toUint16().rename(['textG'])

    return image.addBands(srcImg=textG , overwrite=True)


def getNDSI2(image):
    """Calculate NDSI using the formula
        NDSI = (swir1 - nir) / (swir1 + nir)

    Parameters:
        image (ee.Image): Fractions image containing the bands:
        swir1, nir

    Returns:
        ee.Image: Fractions image with NDSI2 band
    """

    ndsi2 = image.normalizedDifference(['swir1', 'nir']) \
                 .rename(['ndsi2']) \
                 .add(1)

    return image.addBands(srcImg=ndsi2, overwrite=True)

# es lo mismo de getNDWIGao?
def getNDMI(image):
    """Calculate cai using the formula
        ndmi = (nir - swir1) / (nir + swir1).

    Parameters:
        image (ee.Image): image containing the bands:
        nir, swir1

    Returns:
        ee.Image: Fractions image with CEI bands
    """

    ndmi = image.normalizedDifference(['nir', 'swir1']) \
                .rename(['ndmi'])   \
                .add(1)

    return image.addBands(srcImg=ndmi, overwrite=True)


def getGLI(image):
    """Calculate cai using the formula
        gli = '((2 * green) - red - blue) / ((2 * green) + red + blue).

    Parameters:
        image (ee.Image): image containing the bands:
        red, green, blue

    Returns:
        ee.Image: Fractions image with GLI bands
    """

    gli = image.expression(
        '((2 * green) - red - blue) / ((2 * green) + red + blue)', {
            'green': image.select('green'),
            'red': image.select('red'),
            'blue': image.select('blue')
           })   \
           .rename(['gli'])  \
           .add(1)
    
    return image.addBands(srcImg=gli, overwrite=True)


def getMMRI(image):
    """Calculate mmri using the formula
        ndvi  = ((nir - red)/ (nir + red))
        mndvi = ((green - swir1) / (green + swir1))
        mmri  = (abs(mndwi) - abs(ndvi)) / (abs(mndwi) + abs(ndvi))

    Parameters:
        image (ee.Image): image containing the bands:
        red, green, blue

    Returns:
        ee.Image: image with MMRI bands
    """

    mndvi = image.expression(
        '((green - swir1) / (green + swir1))', {
            'green': image.select('green'),
            'swir1': image.select('swir1')
        }
    )

    ndvi = image.expression(
        '((nir - red)/ (nir + red))', {
            'nir': image.select('nir'),
            'red': image.select('red')
        }
    )

    abs_mndvi = ee.Image.abs(mndvi)

    abs_ndvi = ee.Image.abs(ndvi)

    mmri = abs_mndvi.subtract(abs_ndvi) \
        .divide(abs_mndvi.add(abs_ndvi)) \
        .rename(['mmri']) \
        .add(1)

    return image.addBands(srcImg = mmri.rename(['mmri']), overwrite = True)


# def getMNDWI(image):
#     """Calculate cai using the formula
#         mndwi = (green - nir) / (green + nir).

#     Parameters:
#         image (ee.Image): image containing the bands:
#         nir, green

#     Returns:
#         ee.Image: image with mndwi band
#     """

#     mndwi = image.normalizedDifference(['green', 'nir'])

#     mndwi = mndwi.multiply(100).add(100).byte().rename(['mndwi'])
    
#     image = image.addBands(mndwi)

#     return ee.Image(image.copyProperties(image) \
#                          .copyProperties(image, PROPERTIES) )



def getNDMIR(image):
    """Calculate cai using the formula
        mndwi = (swir1 - swir2) / (swir1 + swir2).

    Parameters:
        image (ee.Image): image containing the bands:
        swir1, swir2

    Returns:
        ee.Image: image with ndmirband
    """

    ndmir = image.normalizedDifference(['swir1', 'swir2'])  \
                 .rename(['ndmir']) \
                 .add(1)

    return image.addBands(srcImg=ndmir, overwrite=True)


def getNDRB(image):
    """Calculate cai using the formula
        ndrb = (red - blue) / (red + blue).

    Parameters:
        image (ee.Image): image containing the bands:
        red, blue

    Returns:
        ee.Image: image with ndrb band
    """

    ndrb = image.normalizedDifference(['red', 'blue'])  \
                .rename(['ndrb'])   \
                .add(1)

    return image.addBands(srcImg=ndrb, overwrite=True)


def getNDGB(image):
    """Calculate cai using the formula
        ndgb = (green - blue) / (green + blue).

    Parameters:
        image (ee.Image): image containing the bands:
        green, blue

    Returns:
        ee.Image: image with ndgb band
    """

    ndgb = image.normalizedDifference(['green', 'blue'])    \
                .rename(['ndgb'])   \
                .add(1)
    
    return image.addBands(srcImg=ndgb, overwrite=True)


def getLAI(image):
    """Calculate lai using the formula
    lai = 0.3977*exp(2.5556*(nir-red)/(nir+red)))
    alternativa a exp
    lai = 0.3977*pow(2.718281,2.5556*((nir-red)/(nir+red)))
    Line 57 of generate_metrics_and_fractions.py

    Parameters:
    image (ee.Image): Foliar area index from :
    nir, red

    Returns:
    ee.Image: Image with LAI bands
    """

    lai = image.expression(
    'float(0.3977*pow(2.718281,2.5556*((nir-red)/(nir+red))))', {
    'nir': image.select('nir'),
    'red': image.select('red')
    })

    lai = lai.multiply(100).add(100).byte().rename(['lai'])

    return  image.addBands(srcImg=lai, overwrite=True)

