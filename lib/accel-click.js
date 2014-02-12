// http://www.mikroe.com/click/accel/
// ADXL345

/*
   https://github.com/timbit123/ADXL345 provides the template that was used for this driver,
   which in turn is used by all the other drivers.

   thank you @timbit123 !

*/

var async   = require('async')
  , events  = require('events')
  , helpers = require('./helpers')
  , i2c     = require('i2c')
  , util    = require('util')
  ;


var _BW_RATE     = 0x2c
  , _POWER_CTL   = 0x2d
  , _DATA_FORMAT = 0x31
  , _DATAX0      = 0x32
  , _AXES_DATA   = _DATAX0    // X_L, X_H, Y_L, Y_H, Z_L, Z_H
  ;


var accel = function(options) {
  var self = this;

  if (!(self instanceof accel)) return new accel(options);

  self.options = helpers.options(options, { address      : 0x1d
                                          , device       : '/dev/i2c-1'
                                          , sample_count : 400
                                          , scale_factor : [ 0, 0, 0 ]
                                          });
  self.wire    = new i2c(self.options.address, { device : self.options.device });

  async.waterfall(
    [ // 0xc0: must be zeroes
      // 0x20: inactivity enabled
      // 0x10: auto-sleep enabled
      // 0x08: measurements enabled
      // 0x04: sleep enabled
      // 0x03: wakeup enabled
      function(callback) { self.wire.writeBytes(_POWER_CTL, [0x08], callback); }

      // 0x80: self-test
      // 0x40: SPI interface mode selection (0: 4-wire, 1: 3-wire)
      // 0x20: invert interrupts
      // 0x10: must be zero
      // 0x08: full resolution enabled
      // 0x04: BE-enabled
      // 0x03: range
      //       0x03: +/-16g, 0x02: +/-8g, 0x01: +/-4g, 0x00: +/-2g
    , function(callback) { self.wire.writeBytes(_DATA_FORMAT, [0x08 | 0x01], callback); }

      // 0xe0: must be zeroes
      // 0x10: low-power enabled
      // 0x0f: data rate
      //       0x0f: 1600Hz, 0x0e: 800Hz, 0x0d: 400Hz, 0x0c: 200Hz, 0x0b: 100Hz, 0x0a: 50Hz, 0x09: 25Hz
    , function(callback) { self.wire.writeBytes(_BW_RATE, [0x0b], callback); }

    , function(callback) { self._computeAccelBias(callback); }
    ],
  function(err, results) {
    if (!!err) return self.emit('error', err);

    self.emit('ready', results);
  });
};
util.inherits(accel, events.EventEmitter);


accel.prototype._computeAccelBias = function(callback) {
  var self  = this
    , count = self.options.sample_count
    , iter  = count
    , sums  = [ 0, 0, 0 ]
    ;

  self.runTimeAccelBias = [ 0, 0, 0 ];

  var getSamples = function() {
    var axis, bias;

    if (iter-- > 0) {
      return self.wire.readBytes(_AXES_DATA, 6, function(err, buf) {
        var axis;

        if (!!err) return callback(err);

        for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) sums[axis] += buf.readInt16LE(axis * 2);

        setTimeout(getSamples, 2.5);
      });
    }

    bias = {};
    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
      self.runTimeAccelBias[axis] = -((sums[axis] / count) * self.options.scale_factor[axis]);
      bias[helpers.axes[axis]] = self.runTimeAccelBias[axis];
    }

    setTimeout(function() { callback(null, { accelOneG: 9.8065, runTimeAccelBias: bias }); }, 10);
  };

  getSamples();
};


accel.prototype.measureAccel = function(callback) {
  var self = this;

  self.wire.readBytes(_AXES_DATA, 6, function(err, buf) {
    var axis, result;

    if (!!err) return callback(err);

    result = {};
    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
      result[helpers.axes[axis]] = buf.readInt16LE(axis * 2) * self.options.scale_factor[axis] + self.runTimeAccelBias[axis];
    }

    callback(null, result);
  });

  return self;
};


exports.board = accel;
