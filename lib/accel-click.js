// http://www.mikroe.com/click/accel/
// ADXL345

// module derived from https://github.com/timbit123/ADXL345

var async  = require('async')
  , events = require('events')
  , i2c    = require('i2c')
  , util   = require('util')
  ;

var _I2C_ADDR    = 0x1d
  , _POWER_CTL   = 0x2d
  , _DATA_FORMAT = 0x31
  , _BW_RATE     = 0x2c
  , _AXES_DATA   = 0x32
  ;

var XAXIS = 0
  , YAXIS = 1
  , ZAXIS = 2
  , axes = [ 'roll', 'pitch', 'yaw' ];


var accel = function(options) {
  var self = this;

  if (!(self instanceof accel)) return new accel(options);

  self.options = options || {};
  if (!self.options.address) self.options.address = _I2C_ADDR;
  if (!self.options.device) self.options.device = '/dev/i2c-1';
  if (!self.options.sample_count) self.options.sample_count = 400;
  if (!self.options.scale_factor) self.options.scale_factor = [0.0, 0.0, 0.0];

  self.accelScaleFactor = self.options.scale_factor;
  self.runTimeAccelBias = [         0,          0,        0 ];
  self.accelOneG        = 0.0;
  self.meterPerSecSec   = { roll: 0.0, pitch: 0.0, yaw: 0.0 };
  self.accelSample      = [         0,          0,        0 ];
  self.accelSampleCount = 0;

  self.wire = new i2c(self.options.address, { device : self.options.device });

  async.waterfall(
    [ // measurement mode
      function(callback) { self.wire.writeBytes(_POWER_CTL,   [0x08], callback); }

      // resolution = 0x03: 16G, 0x02: 8G, 0x01: 4G, 0x00: 2G
    , function(callback) { self.wire.writeBytes(_DATA_FORMAT, [0x08 | 0x01], callback); }

      // data rate = 0x0f: 1600Hz, 0x0e: 800Hz, 0x0d: 400Hz, 0x0c: 200Hz, 0x0b: 100Hz, 0x0a: 50Hz, 0x09: 25Hz
    , function(callback) { self.wire.writeBytes(_BW_RATE,     [0x0b], callback); }

    , function(callback) { self._computeAccelBias(callback); }
    ],
  function(err, results) {/* jshint unused: false */
    if (!!err) return self.emit('error', err);

    setTimeout(function() { self.emit('ready'); }, 10);
  });
};
util.inherits(accel, events.EventEmitter);


accel.prototype._measureAccelSum = function(callback) {
  var self = this;

  self.wire.readBytes(_AXES_DATA, 6, function(err, res) {
    var axis;

    if (!!err) return callback(err);

    for (axis = XAXIS; axis <= ZAXIS; axis++) self.accelSample[axis] += (res.readInt16LE(axis * 2) & 0x3ff);
    self.accelSampleCount++;
    callback(null);
  });
};

/*
accel.prototype.evaluateMetersPerSec = function() {
  var axis;

  var self = this;

  for (axis = XAXIS; axis <= ZAXIS; axis++) {
    self.meterPerSecSec[axes[axis]] = (self.accelSample[axis] / self.accelSampleCount) * self.accelScaleFactor[axis]
                                    + self.runTimeAccelBias[axis];
    self.accelSample[axis] = 0;
  }
  self.accelSampleCount = 0;
};
 */

accel.prototype._computeAccelBias = function(callback) {
  var self = this;

  var getSamples = function() {
    var axis;

    if (self.accelSampleCount < self.options.sample_count) {
      return self._measureAccelSum(function() { setTimeout(getSamples, 2.5); });
    }

    for (axis = 0; axis < 3; axis++) {
      self.meterPerSecSec[axes[axis]] = (self.accelSample[axis] / self.options.sample_count) * self.accelScaleFactor[axis];
      self.accelSample[axis] = 0;
    }
    self.accelSampleCount = 0;

    self.runTimeAccelBias[XAXIS] = -self.meterPerSecSec[axes[XAXIS]];
    self.runTimeAccelBias[YAXIS] = -self.meterPerSecSec[axes[YAXIS]];
    self.runTimeAccelBias[ZAXIS] = -9.8065 - self.meterPerSecSec[axes[ZAXIS]];

    self.accelOneG = Math.abs(self.meterPerSecSec[axes[ZAXIS]] + self.runTimeAccelBias[axes[ZAXIS]]);
    callback();
  };

  getSamples();
};


accel.prototype.measureAccel = function(callback) {
  var self = this;

  self.wire.readBytes(_AXES_DATA, 6, function(err, res) {
    var axis;

    if (!!err) return callback(err);

    for (axis = XAXIS; axis <= ZAXIS; axis++) {
      self.meterPerSecSec[axes[axis]] = (res.readInt16LE(axis * 2) & 0x3ff) * self.accelScaleFactor[axis]
                                            + self.runTimeAccelBias[axis];
    }
    callback(null, self.meterPerSecSec);
  });
};


exports.board = accel;
