// a little help with geometry


exports.XAXIS = 0;
exports.YAXIS = 1;
exports.ZAXIS = 2;
exports.axes = [ 'x', 'y', 'z' ];


exports.v_cross_product = function(a, b) {
  return { x: (a.y * b.z) - (a.z * b.y), y: (a.z * b.x) - (a.x * b.z), z: (a.x * b.y) - (a.y * b.x) };
};

exports.v_dot_product = function(a, b) {
  var result, value;

  result = 0;
  for (value in a) if (a.hasOwnProperty(value) && b.hasOwnProperty(value)) result += a[value] * b[value];
  return result;
};

exports.v_magnitude = function(a) {
  return Math.sqrt(exports.v_dot_product(a, a));
};

exports.v_normalize = function(a) {
  var magnitude = exports.v_magnitude(a);

  return { x: a.x / magnitude, y: a.y / magnitude, z: a.z / magnitude };
};
