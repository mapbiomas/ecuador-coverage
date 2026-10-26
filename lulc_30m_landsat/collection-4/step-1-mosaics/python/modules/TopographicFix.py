#!/usr/bin/env python


# Import and initialize python modules
import ee
import math



def to_radians(image):
    return image.multiply(ee.Number(math.pi).divide(180.0))
        
        

def scs_ccorr(band, img_and_illumination_condition_mask):
    # Reduce the region using linearFit to compute coefficients (a, b, c)
    scale = 300
    pixels = 1000000000
    
    out = img_and_illumination_condition_mask \
        .select(['IC', band]) \
        .reduceRegion(
            reducer=ee.Reducer.linearFit(),
            geometry=img_and_illumination_condition_mask.geometry().buffer(-3000),
            scale=scale,
            maxPixels=pixels
        )

    if out is None or out is ee.Dictionary({}):
        # If the result is null or undefined, return the original band
        return img_and_illumination_condition_mask.select(band)
    else:
        out_a = ee.Number(out.get('scale'))
        out_b = ee.Number(out.get('offset'))
        out_c = ee.Algorithms.If(
            ee.Algorithms.IsEqual(out_b, None),
            0,
            out_b.divide(out_a)
        )
    	# Apply the SCSc correction
        scsc_output = img_and_illumination_condition_mask.expression(
            "((image * (cosB * cosZ + cvalue)) / (ic + cvalue))",
            {
                'image': img_and_illumination_condition_mask.select(band),
                'ic': img_and_illumination_condition_mask.select('IC'),
                'cosB': img_and_illumination_condition_mask.select('cosS'),
                'cosZ': img_and_illumination_condition_mask.select('cosZ'),
                'cvalue': ee.Number(out_c)
            }
        )

        return scsc_output




def topographic_correction(img, illumination_condition):
    # Get the system time start
    st = img.get('system:time_start')

    # Create masks based on illumination conditions
    mask = illumination_condition.select('slope').gte(5) \
        .And(illumination_condition.select('IC').gte(0)) \
        .And(illumination_condition.select('nir').gt(-0.1))

    # Apply masks to the illumination condition image
    img_and_illumination_mask = illumination_condition.updateMask(mask)

    # Specify Bands to topographically correct
    band_list = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2']
    band_list_ic = ee.List(band_list).add('IC').flatten()

    composite_bands = img.bandNames()
    non_correct_bands = img.select(composite_bands.removeAll(band_list))

    # Apply topographic correction to each band
    img_scs_ccorr = [scs_ccorr(band, img_and_illumination_mask) for band in band_list]

    # Convert the list of images to a single image with multiple bands
    img_scs_ccorr = ee.ImageCollection(img_scs_ccorr) \
        .toBands() \
        .rename(band_list) \
        .addBands(illumination_condition.select('IC'))\
        .unmask(illumination_condition.select(band_list_ic)) \
        .select(band_list)\
        .set('system:time_start', st)

    return img_scs_ccorr.toInt32()



def get_illumination_condition(img, region):
    dem_url = "USGS/SRTMGL1_003"
    sun_elevation = ee.Number(img.get('SUN_ELEVATION'))
    sun_azimuth = ee.Number(img.get('SUN_AZIMUTH'))

    # Extract image metadata about solar position
    sz_rad = to_radians(ee.Image(sun_elevation))
    sa_rad = to_radians(ee.Image(sun_azimuth))

    # Terrain layers
    dem = ee.Image(dem_url)
    slp = ee.Terrain.slope(dem).clip(region)
    slp_rad = to_radians(ee.Terrain.slope(dem))
    asp_rad = to_radians(ee.Terrain.aspect(dem))

    # Calculate the slope part of the illumination condition
    cos_z = sz_rad.cos()
    cos_s = slp_rad.cos()
    slope_param = {'cosZ': cos_z, 'cosS': cos_s.select('slope')}
    slope_illumination = cos_s.expression("cosZ * cosS", slope_param)

    # Calculate the aspect part of the illumination condition
    sin_z = sz_rad.sin()
    sin_s = slp_rad.sin()
    cos_azi_diff = (sa_rad.subtract(asp_rad)).cos()
    aspect_param = {'sinZ': sin_z, 'sinS': sin_s, 'cosAziDiff': cos_azi_diff}
    aspect_illumination = sin_z.expression("sinZ * sinS * cosAziDiff", aspect_param)

    # Calculate full illumination condition (IC) and add it to the original image
    ic = slope_illumination.add(aspect_illumination)

    return img \
        .addBands(ic.rename('IC')) \
        .addBands(cos_z.rename('cosZ')) \
        .addBands(cos_s.rename('cosS')) \
        .addBands(slp.rename('slope'))
