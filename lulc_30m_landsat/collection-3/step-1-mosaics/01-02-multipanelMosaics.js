/***** End of imports. If edited, may not auto-convert in the playground. *****/

// Configuration parameters for the visualization
var param = {
    'code_region': 40201,      // Region code for filtering
    'country': 'ECUADOR',      // Country name
};

var pais = 'Ecuador'           // Country name in Spanish (for display purposes)

// Load region classification boundaries
var regionesclass = ee.FeatureCollection('projects/mapbiomas-ecuador/assets/AUXILIAR-DATA/VECTOR/regionesClassif_Col3_v1'); 

// Define the years for which we have mosaic data (1985-2024)
var years = [1985, 1986, 1987, 1988, 1989, 1990, 
             1991, 1992, 1993, 1994, 1995, 1996, 
             1997, 1998, 1999, 2000, 2001, 2002, 
             2003, 2004, 2005, 2006, 2007, 2008, 
             2009, 2010, 2011, 2012, 2013, 2014, 
             2015, 2016, 2017, 2018, 2019, 2020, 
             2021, 2022, 2023, 2024];

// Paths to the mosaic collections (MapBiomas RAISG mosaics)
var mosaics = [
    'projects/mapbiomas-raisg/MOSAICOS/mosaics-2',
    'projects/mapbiomas-raisg/MOSAICOS/mosaics-pathrow-2'
];

// Filter region classification to the specified region code
var regionclas = regionesclass.filterMetadata('id_regionC', 'equals', param.code_region);

// Load and merge mosaic collections
var collectionMosaic = ee.ImageCollection(mosaics[0])
    .merge(ee.ImageCollection(mosaics[1]))
    .filter(ee.Filter.eq('country', pais.toUpperCase()))  // Filter by country
    .filterBounds(regionclas);                             // Filter by region bounds

// Clip all images in the collection to the region boundaries
collectionMosaic = collectionMosaic.map(function(image) {
    return image.clip(regionclas);
});

// Initialize arrays to store map objects
var maps = [],
    map,
    mosaic2;

// Create individual maps for each year
for (var i = 0; i < years.length; i++) {
    // Filter mosaics for the current year
    mosaic2 = collectionMosaic.filterMetadata('year', 'equals', years[i]);
    
    // Create a new map instance
    map = ui.Map();
    
    // Enable synchronized drawing tools across all maps
    map.drawingTools().setLinked(true);
    
    // Add year label to the bottom-left corner of each map
    map.add(ui.Label(String(years[i]), {
        'position': 'bottom-left',
        'fontWeight': 'bold'
    }));
    
    // Add three different band combinations as visualization layers:
    
    // 1. SWIR1, NIR, Red (Green vegetation visualization)
    map.addLayer(mosaic2.mean().clip(regionclas), {
        'bands': ['swir1_median', 'nir_median', 'red_median'],
        'gain': [0.08, 0.06, 0.2],
    }, years[i] + ' green', true);  // Set as default visible layer
    
    // 2. NIR, SWIR1, Red (Red vegetation visualization)
    map.addLayer(mosaic2.mean().clip(regionclas), {
        'bands': ['nir_median', 'swir1_median', 'red_median'],
        'gain': [0.06, 0.08, 0.2],
    }, years[i] + ' red', false);   // Initially hidden
    
    // 3. SWIR2, SWIR1, Red (Beta visualization)
    map.addLayer(mosaic2.mean().clip(regionclas), {
        'bands': ['swir2_median', 'swir1_median', 'red_median'],
        'gain': [0.1, 0.06, 0.1],
    }, years[i] + ' beta', false);  // Initially hidden
    
    // Add region boundaries as a transparent overlay
    map.addLayer(regionclas.style({
        fillColor: '00000000',  // Transparent fill
        color: 'blue'           // Blue boundary lines
    }), {}, 'regiones', true);
    
    // Add the map to the maps array
    maps.push(map);
}

// Add a blank map at the end (for layout purposes)
maps.push(ui.Map());

// Link all maps for synchronized navigation (pan/zoom)
var linker = ui.Map.Linker(maps);

// Create a title panel for the dashboard
var title = ui.Label('Mosaic Collection 3 - Mapbiomas Ecuador - ' + param.code_region, {
    stretch: 'horizontal',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: '24px',
});

// Create a grid layout for displaying all maps
// Organizes 40 maps into 6 rows (7 maps in first 5 rows, 5 maps in last row)
var mapGrid = ui.Panel([
    // Row 1: Years 1985-1991
    ui.Panel([maps[0], maps[1], maps[2], maps[3], maps[4], maps[5], maps[6]],
            ui.Panel.Layout.Flow('horizontal'), {
                stretch: 'both'
            }),
    // Row 2: Years 1992-1998
    ui.Panel([maps[7], maps[8], maps[9], maps[10], maps[11], maps[12], maps[13]],
            ui.Panel.Layout.Flow('horizontal'), {
                stretch: 'both'
            }),
    // Row 3: Years 1999-2005
    ui.Panel([maps[14], maps[15], maps[16], maps[17], maps[18], maps[19], maps[20]],
            ui.Panel.Layout.Flow('horizontal'), {
                stretch: 'both'
            }),
    // Row 4: Years 2006-2012
    ui.Panel([maps[21], maps[22], maps[23], maps[24], maps[25], maps[26], maps[27]],
            ui.Panel.Layout.Flow('horizontal'), {
                stretch: 'both'
            }),
    // Row 5: Years 2013-2019
    ui.Panel([maps[28], maps[29], maps[30], maps[31], maps[32], maps[33], maps[34]],
            ui.Panel.Layout.Flow('horizontal'), {
                stretch: 'both'
            }),
    // Row 6: Years 2020-2024
    ui.Panel([maps[35], maps[36], maps[37], maps[38], maps[39]],
            ui.Panel.Layout.Flow('horizontal'), {
                stretch: 'both'
            }),
  ],
  ui.Panel.Layout.Flow('vertical'), {
      stretch: 'both'
  }
);

// Assemble the final interface
ui.root.widgets().reset([title, mapGrid]);
ui.root.setLayout(ui.Panel.Layout.Flow('vertical'));

// Center the first map on the region of interest
maps[0].centerObject(regionclas, 7);