/**
 * @name
 *      Palettes.js
 *
 * @description
 *      Color palettes for MapBiomas Ecuador land-cover maps.
 *      Each palette is an array indexed by class ID: palette[3] is the color
 *      of class 3. Colors are hex strings without '#'. Class IDs not used in
 *      the legend are set to white (FFFFFF) so the array has no gaps.
 *
 *      Use it as the `palette` of a visualization with min: 0 and
 *      max: palette.length - 1, so that each pixel value maps to its class.
 *
 * @example
 *      var palettes = require('users/mapbiomasecuador/LULC:COLECCION4/modules/Palettes.js');
 *      var palette = palettes.get('EcuadorCol4');
 *
 *      Map.addLayer(image, { min: 0, max: palette.length - 1, palette: palette });
 *
 * @author
 *      MapBiomas Ecuador - EcoCiencia
 *
 * @version
 *      1.0.0 (2026-10-20)
 */

var PALETTES = {

  // MapBiomas Ecuador - Collection 4 (class IDs 0-82).
  EcuadorCol4: [
    'FFFFFF', '1F8D49', 'FFFFFF', '1F8D49', '7DC975',  // 0-4
    '04381D', '026975', 'FFFFFF', 'FFFFFF', '7A5900',  // 5-9
    'D6BC74', '519799', 'D6BC74', 'D89F5C', 'FFFFFF',  // 10-14
    'EDDE8E', 'FFFFB2', 'FFD966', 'E974ED', 'FFFFFF',  // 15-19
    'FFFFFF', 'FFEFC3', 'D4271E', 'FFA07A', 'D4271E',  // 20-24
    'DB4D4F', '2532E4', 'FFFFFF', 'FFFFFF', 'FFAA5F',  // 25-29
    '9C0027', '091077', 'FC8114', '2532E4', '93DFE6',  // 30-34
    '9065D0', 'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF',  // 35-39
    'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF',  // 40-44
    'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF', '02D659',  // 45-49
    'AD5100', 'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF',  // 50-54
    'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF',  // 55-59
    'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF',  // 60-64
    'FFFFFF', 'FFFFFF', 'FFFFFF', 'E97A7A', 'FFFFFF',  // 65-69
    'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF', 'BE83F7',  // 70-74
    'C12100', 'FFFFFF', 'FFFFFF', 'FFFFFF', 'FFFFFF',  // 75-79
    'FFFFFF', 'DFEB62', '6FC179'  // 80-82
  ]

};


/**
 * Returns a copy of the requested palette, so changes made by a script do
 * not affect other scripts that use the same palette.
 *
 * @param {string} name  Palette name, e.g. 'EcuadorCol4'.
 * @returns {Array<string>}
 */
exports.get = function (name) {
  if (!PALETTES.hasOwnProperty(name)) {
    throw new Error(
      'Unknown palette "' + name + '". Available: ' + Object.keys(PALETTES).join(', ')
    );
  }
  return PALETTES[name].slice();
};
