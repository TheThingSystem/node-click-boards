// https://www.tigal.com/product/3321
// L3GD20

var async = require('async')
  , i2c   = require('i2c')
  ;

var async = require('async')
  , i2c   = require('i2c')
  ;

var _I2C_ADDR    = 0x6B
  , _POWER_CTL   = 0x20
  , _DATA_FORMAT = 0x23
  , _AXES_DATA   = 0x28
  ;

var XAXIS = 0
//, YAXIS = 1
  , ZAXIS = 2
  , axes = [ 'roll', 'pitch', 'yaw' ];


var gyro = function(options, callback) {
  var self = this;

  if (!(self instanceof gyro)) return new gyro(options, callback);

  if ((!callback) && (typeof options === 'function')) {
    callback = options;
    options = {};
  }

  self.options = (typeof options === 'function') ? options() : options;
  if (!self.options.address) self.options.address = _I2C_ADDR;
  if (!self.options.device) self.options.device = '/dev/i2c-1';
  if (!self.options.SAMPLECOUNT) self.options.SAMPLECOUNT = 400;
  
  self.wire = new i2c(self.options.address, { device : self.options.device });

  async.waterfall([ // power up
                    function(cb) { self.wire.writeBytes(_POWER_CTL,   [0x0F], cb); }

                    // degrees/sec 250
                  , function(cb) { self.wire.writeBytes(_DATA_FORMAT, [0x00], cb); }
                  ],
                  function(err) {
                    if (!!err) return callback(err);

                    setTimeout(function() { callback(null); }, 10);
                  });
};

gyro.prototype.measureGyro = function(callback) {
  var self = this;

  self.wire.readBytes(_AXES_DATA, 6, function(err, res) {
    var result = {};

    if (!!err) return callback(err);

    for (var axis = XAXIS; axis <= ZAXIS; axis++) result[axes[axis]] = res.readInt16LE(axis * 2);
    callback(null, result);
  });
};


exports.board = gyro;
