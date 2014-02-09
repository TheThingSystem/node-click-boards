// https://www.tigal.com/product/2855
// module derived from https://github.com/timbit123/ADXL345

var async = require('async')
  , i2c   = require('i2c')
  ;

var _I2C_ADDR    = 0x1D
  , _POWER_CTL   = 0x2D
  , _DATA_FORMAT = 0x31
  , _BW_RATE     = 0x2C
  , _AXES_DATA   = 0x32
/*
  , _FIFO_CTL    = 0x38
 */
  ;

var XAXIS = 0
  , YAXIS = 1
  , ZAXIS = 2
  , axes = [ 'roll', 'pitch', 'yaw' ];


var accel = function(options, callback) {
  var self = this;

  if (!(self instanceof accel)) return new accel(options, callback);

  if ((!callback) && (typeof options === 'function')) {
    callback = options;
    options = {};
  }

  self.options = (typeof options === 'function') ? options() : options;
  if (!self.options.address) self.options.address = _I2C_ADDR;
  if (!self.options.device) self.options.device = '/dev/i2c-1';
  if (!self.options.SAMPLECOUNT) self.options.SAMPLECOUNT = 400;
  

  self.accelScaleFactor = [0.0, 0.0, 0.0];
  self.runTimeAccelBias = [0, 0, 0];
  self.accelOneG        = 0.0;
  self.meterPerSecSec   = { roll: 0.0, pitch: 0.0, yaw: 0.0 };
  self.accelSample      = [0, 0, 0];
  self.accelSampleCount = 0;

  self.wire = new i2c(self.options.address, { device : self.options.device });

  async.waterfall([ // measurement mode
                    function(cb) { self.wire.writeBytes(_POWER_CTL,   [0x08], cb); }

                    // resolution = 0x03: 16G, 0x02: 8G, 0x01: 4G, 0x00: 2G
                  , function(cb) { self.wire.writeBytes(_DATA_FORMAT, [0x08 | 0x01], cb); }

                    // data rate = 0x0f: 1600Hz, 0x0e: 800Hz, 0x0d: 400Hz, 0x0c: 200Hz, 0x0b: 100Hz, 0x0a: 50Hz, 0x09: 25Hz
                  , function(cb) { self.wire.writeBytes(_BW_RATE,     [0x0b], cb); }
                  ],
                  function(err) {
                    if (!!err) return callback(err);

                    setTimeout(function() { callback(null); }, 10);
                  });
};

accel.prototype.measureAccel = function(callback) {
  var self = this;

  self.wire.readBytes(_AXES_DATA, 6, function(err, res) {
    if (!!err) return callback(err);

    for (var axis = XAXIS; axis <= ZAXIS; axis++) {
      self.meterPerSecSec[axes[axis]] = (res.readInt16LE(axis * 2) & 0x3ff) * self.accelScaleFactor[axis]
                                            + self.runTimeAccelBias[axis];
    }
    callback(null);
  });
};

accel.prototype.measureAccelSum = function(callback) {
  var self = this;

//get values from sensor here
  self.wire.readBytes(_AXES_DATA, 6, function(err, res) {
    if (!!err) return callback(err);

    for (var axis = XAXIS; axis <= ZAXIS; axis++) self.accelSample[axis] += (res.readInt16LE(axis * 2) & 0x3ff);
    self.accelSampleCount++;
    callback(null);
  });
};

accel.prototype.evaluateMetersPerSec = function() {
  var self = this;

  for (var axis = XAXIS; axis <= ZAXIS; axis++) {
    self.meterPerSecSec[axes[axis]] = (self.accelSample[axis] / self.accelSampleCount) * self.accelScaleFactor[axis]
                                    + self.runTimeAccelBias[axis];
    self.accelSample[axis] = 0;
  }
  self.accelSampleCount = 0;
};

accel.prototype.computeAccelBias = function(callback) {
  var self = this;

  function getSamples() {
    if (self.accelSampleCount < self.options.SAMPLECOUNT) {
      self.measureAccelSum(function() { setTimeout(getSamples, 2.5); });
      return;
    }

    for (var axis = 0; axis < 3; axis++) {
      self.meterPerSecSec[axes[axis]] = (self.accelSample[axis] / self.options.SAMPLECOUNT) * self.accelScaleFactor[axis];
      self.accelSample[axis] = 0;
    }
    self.accelSampleCount = 0;

    self.runTimeAccelBias[XAXIS] = -self.meterPerSecSec[axes[XAXIS]];
    self.runTimeAccelBias[YAXIS] = -self.meterPerSecSec[axes[YAXIS]];
    self.runTimeAccelBias[ZAXIS] = -9.8065 - self.meterPerSecSec[axes[ZAXIS]];

    self.accelOneG = Math.abs(self.meterPerSecSec[axes[ZAXIS]] + self.runTimeAccelBias[axes[ZAXIS]]);
    callback();
  }

  getSamples();
};


exports.board = accel;
