<p align="center">
  <img src="https://github.com/user-attachments/assets/da7fdaf6-597c-481a-a477-dcc8f228b86f" width="220" style="margin-right: 20px;"/>
  <img src="https://github.com/user-attachments/assets/52c8495f-1446-4b26-9025-f2393127f6e5" width="220"/>
</p>

# 🌿 MapBiomas Ecuador – Land Cover Classification Scripts

MapBiomas Ecuador monitors land use changes at a national scale using multitemporal mapping, 
allowing the analysis of ecosystem pressures and human expansion.  
To produce annual historical land use and land cover maps, the initiative uses tools such as Google Earth Engine and collaborates with experts.  
By 2025, Ecuador developed Collection 3.0, covering the entire national territory (including the Galápagos Islands), going beyond the Amazon region.

## 📂 Repository Structure
```
collection-3/
├── modules/                                           # Reusable helper modules
│   ├── BandName.js                                    # Band renaming across sensors
│   ├── DataType.js                                    # Data type conversions
│   ├── Miscellaneous.js                               # Utility functions
│   ├── Mosaic.js                                      # Annual mosaic generation
│   ├── SmaAndNdfi.js                                  # Spectral Mixing Analysis (SMA) and NDFI
│   └── SpectralIndexes.js                             # Spectral indices (NDVI, EVI2, NDWI, etc.)
├── step-1-mosaics/                                    # Annual Landsat mosaic generation
│   ├── 01-01-blacklistMosaics.js                      # Blacklist
│   ├── 01-02-multipanelMosaics.js                     # Mosaic generation
│   └── 01-03-visualizateMosaics.js                    # Mosaic visualization
├── step-2-samples/                                    # Training sample collection
│   ├── 02-01-stablePixels.js                          # Stable pixel identification
│   ├── 02-02-trainingAreas.js                         # Class area sampling
│   └── 02-03-randomPoints.js                          # Training point generation
├── step-3-classifications/                            # Random Forest classification
│   ├── 03-01-classification.js                        # Classification process
│   └── 03-02-stackMultiband.js                        # Multiband stacking
├── step-4-filters/                                    # Post-classification filters
│   ├── 04-01-gapfill.js                               # Gap filling
│   ├── 04-02-temporalFilter.js                        # Temporal filter
│   ├── 04-03-frequencyFilter.js                       # Frequency filter
│   ├── 04-04-spatialFilter.js                         # Spatial filter
│   ├── 04-05-maskFilter.js                            # Mask filter
│   └── 04-06-selectFilter.js                          # Selection filter
├── step-5-integration/                                # Final integration
│   └── 05-01-integration.js                           # Map integration
└── step-6-extras/                                     # Additional processes
    └── 06-01-integrationColAnt.js                     # Previous collection integration
```
## 🥸 General Features

MapBiomas Ecuador maps are generated using machine learning in Google Earth Engine through pixel-by-pixel classification of Landsat imagery.  

## 🚀 Methodological Description and Steps
- Landsat data collection  
- Pixel-by-pixel processing (30m x 30m)  
- Organized by tiles (1° x 1.5° Lat/Long)  
- Cloud-based processing  

## 🎋 Cross-cutting Themes
| Region | Cross-cutting theme |
|--------|---------------------|
| Amazon | Mining, Urban Infrastructure, Flooded Forest |
| Andes | Mining, Urban Infrastructure, Glaciers |
| Pacific Tropical Rainforest | Mangrove, Mining, Urban Infrastructure, Flooded Forest |
| Equatorial Dry Forest | Mangrove, Mining, Urban Infrastructure |
| Galápagos | Mangrove, Mining, Urban Infrastructure |

## 🧩 Results
The processed outputs are integrated into MapBiomas land use and land cover collections, enabling:
- Environmental monitoring  
- Public policy development  
- Scientific research  
- Territorial planning and management  

### Contact and More Information
This initiative is part of the MapBiomas Network, coordinated by MapBiomas Ecuador with the participation of national research institutions and collaborators.  

For more information, visit (*https://ecuador.mapbiomas.org/*)
