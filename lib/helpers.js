// a little help with geometry


exports.XAXIS = 0;
exports.YAXIS = 1;
exports.ZAXIS = 2;

exports.axes = [ 'x', 'y', 'z' ];

exports.v_cross_product = require('vectors/cross')(3);
exports.v_dot_product   = require('vectors/dot')(3);
exports.v_magnitude     = require('vectors/mag')(3);
exports.v_normalize     = require('vectors/normalize')(3);
