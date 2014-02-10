// http://www.mikroe.com/click/gyro/
// L3GD20

var async   = require('async')
  , events  = require('events')
  , helpers = require('./helpers')
  , i2c     = require('i2c')
  , util    = require('util')
  ;


var _CTRL_REG1 = 0x20
  , _CTRL_REG4 = 0x23
  , _AXES_DATA = 0x28
  ;


var gyro = function(options) {
  var self = this;

  if (!(self instanceof gyro)) return new gyro(options);

  self.options = options || {};
  if (!self.options.address) self.options.address = 0x6b;
  if (!self.options.device) self.options.device = '/dev/i2c-1';

  self.wire = new i2c(self.options.address, { device : self.options.device });

  async.waterfall(
    [ // 0x0f: power up
      function(callback) { self.wire.writeBytes(_CTRL_REG1, [0x0f], callback); }

      // degrees/sec 250
    , function(callback) { self.wire.writeBytes(_CTRL_REG4, [0x00], callback); }

    , function(callback) { self._computeGyroBias(callback); }
    ],
  function(err, results) {/* jshint unused: false */
    if (!!err) return self.emit('error', err);

    setTimeout(function() { self.emit('ready'); }, 10);
  });
};
util.inherits(gyro, events.EventEmitter);


gyro.prototype._computeGyroBias = function(callback) {
// TBD

  callback();
};

gyro.prototype.measureGyro = function(callback) {
  var self = this;

  self.wire.readBytes(_AXES_DATA, 6, function(err, res) {
    var axis, result;

    if (!!err) return callback(err);

    result = {};
    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) result[helpers.axes[axis]] = res.readInt16LE(axis * 2);
    callback(null, result);
  });
};


exports.board = gyro;
