// a little help, please...


exports.XAXIS = 0;
exports.YAXIS = 1;
exports.ZAXIS = 2;

exports.axes = [ 'x', 'y', 'z' ];

exports.v_cross_product = require('vectors/cross')(3);
exports.v_dot_product   = require('vectors/dot')(3);
exports.v_magnitude     = require('vectors/mag')(3);
exports.v_normalize     = require('vectors/normalize')(3);


exports.options = function(args, defs) {
  var k, options, v1, v2;

  options = {};
  for (k in defs) if (defs.hasOwnProperty(k)) options[k] = defs[k];
  if (!args) return options;

  for (k in args) if (args.hasOwnProperty(k)) {
    v1 = options[k];
    v2 = args[k];

    if ((!v1) || (typeof v1 !== 'number')) {
      options[k] = v2;
      continue;
    }

    if (typeof v2 !== 'number') v2 = parseInt(v2, 10);
    if ((!isNaN(v2)) && (v1 < v2)) options[k] = v2;
  }

  return options;
};
