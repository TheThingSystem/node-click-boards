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

  self.options = options || {};
  if (!self.options.address) self.options.address = 0x1d;
  if (!self.options.device) self.options.device = '/dev/i2c-1';
  if ((!self.options.sample_count) || (isNaN(self.options.sample_count)) || (self.options.sample_count < 400))
    self.options.sample_count = 400;
  if (!self.options.scale_factor) self.options.scale_factor = [0.0, 0.0, 0.0];

  self.accelScaleFactor = self.options.scale_factor;
  self.runTimeAccelBias = [      0,      0,      0 ];
  self.accelOneG        =                      0.0  ;
  self.meterPerSecSec   = { x: 0.0, y: 0.0, z: 0.0 };
  self.accelSample      = [      0,      0,      0 ];
  self.accelSampleCount =                        0  ;

  self.wire = new i2c(self.options.address, { device : self.options.device });

  async.waterfall(
    [ // 0xc0: must be zeroes
      // 0x20: inactivity enabled
      // 0x10: auto-sleep enabled
      // 0x08: measurements enabled
      // 0x04: sleep enabled
      // 0x03: wakeup enabled
      function(callback) { self.wire.writeBytes(_POWER_CTL,   [0x08],        callback); }

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
    , function(callback) { self.wire.writeBytes(_BW_RATE,     [0x0b],        callback); }

    , function(callback) { self._computeAccelBias(callback); }
    ],
  function(err, results) {/* jshint unused: false */
    if (!!err) return self.emit('error', err);

    setTimeout(function() { self.emit('ready', { accelOneG: self.accelOneG, runTimeAccelBias: self.runTimeAccelBias }); }, 10);
  });
};
util.inherits(accel, events.EventEmitter);


accel.prototype._computeAccelBias = function(callback) {
  var self = this;

  var getSamples = function() {
    var axis;

    if (self.accelSampleCount++ < self.options.sample_count) {
      return self.wire.readBytes(_AXES_DATA, 6, function(err, res) {
        var axis;

        if (!!err) return callback(err);

        for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) self.accelSample[axis] += (res.readInt16LE(axis * 2) >> 4);

        setTimeout(getSamples, 2.5);
      });
    }

    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
      self.meterPerSecSec[helpers.axes[axis]] = (self.accelSample[axis] / self.options.sample_count)
                                                    * self.accelScaleFactor[axis];
      self.accelSample[axis] = 0;
    }
    self.accelSampleCount = 0;

    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
      self.runTimeAccelBias[axis] = -self.meterPerSecSec[helpers.axes[axis]];
    }
    self.accelOneG = Math.abs(self.meterPerSecSec[helpers.axes[helpers.ZAXIS]]
                                  + self.runTimeAccelBias[helpers.ZAXIS]);
    callback();
  };

  getSamples();
};


accel.prototype.measureAccel = function(callback) {
  var self = this;

  self.wire.readBytes(_AXES_DATA, 6, function(err, res) {
    var axis;

    if (!!err) return callback(err);

    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
      self.meterPerSecSec[helpers.axes[axis]] = (res.readInt16LE(axis * 2) >> 4) * self.accelScaleFactor[axis]
                                                    + self.runTimeAccelBias[axis];
    }

    callback(null, self.meterPerSecSec);
  });

  return self;
};


exports.board = accel;
