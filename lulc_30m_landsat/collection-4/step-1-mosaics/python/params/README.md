# Parameter tables

Each mosaic is defined by one row of a CSV file. The scripts only process rows with `PROCESS = 1`, so a single table can hold every tile and year and you switch rows on or off.

- `pathrow_example.csv` – used by `generate_mosaics_pathrow.py` (Pacific coast and Andes).
- `cartas_example.csv` – used by `generate_mosaics_cartas.py` (Amazon).

## Columns

| Column | Description | Example |
|---|---|---|
| `PROCESS` | `1` = generate this mosaic, `0` = skip it. | `1` |
| `COUNTRY` | Country name, used in the asset name and properties. | `ECUADOR` |
| `YEAR` | Mosaic year. | `2025` |
| `GRID_NAME` | Path/row tables: `_PPPRRR` (path and row with 3 digits each, preceded by `_`). Map sheet tables: RAISG sheet name. | `_010059`, `SA-18-V-A` |
| `PATH`, `ROW` | *Path/row tables only.* WRS-2 path and row as integers. | `10`, `59` |
| `REGION_CODE` | Mosaic region code. | `409` |
| `REGION_NAME` | Mosaic region name. | `Pacifico` |
| `T0_P`, `T1_P` | Mosaic period, `d/m/YYYY`. Start inclusive, end exclusive. | `1/1/2025`, `1/1/2026` |
| `T0_S`, `T1_S` | Image search period, `d/m/YYYY`. Can be wider than the mosaic period to improve cloud-shadow statistics (TDOM). | `1/1/2025`, `1/1/2026` |
| `CLOUD_COVER` | Maximum scene cloud cover (%) from the image metadata. | `90` |
| `SATELLITE` | `L4`, `L5`, `L7`, `L8`, `L9`, `LX` (Landsat 5 + 7) or `LY` (Landsat 8 + 9). | `L8` |
| `BLACKLIST` | Scene IDs to exclude, separated by `--`. Build it with `tools/select_blacklist.py` or `gee/01-0-mapbiomas-ecu-blacklist-path-row.js`. | `LC08_010059_20251231--LC08_010059_20250113` |
| `SHADOWSUM` (path/row) / `SHADOW_SUM` (map sheets) | Darkness threshold for cloud-shadow detection, in reflectance × 10,000. | `3500` |
| `CLOUD_THRESH` | Cloud-score threshold (0–100). Lower values mask more pixels. | `10` |
| `TEMP_MIN`, `TEMP_MAX` | Surface temperature range (Kelvin) used by the cloud score: temperature is rescaled from `TEMP_MIN` (score 0) to `TEMP_MAX` (score 1). | `330`, `290` |

> `TODO:` confirm the `TEMP_MIN` / `TEMP_MAX` values. With `TEMP_MIN=330, TEMP_MAX=290` (map sheet tables) cold pixels get a high cloud score. With `TEMP_MIN=290, TEMP_MAX=320` (path/row tables) the thermal test favours warm pixels instead.
