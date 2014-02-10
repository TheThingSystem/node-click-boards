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


var _POWER_CTL   = 0x2d
  , _DATA_FORMAT = 0x31
  , _BW_RATE     = 0x2c
  , _AXES_DATA   = 0x32
  ;


var accel = function(options) {
  var self = this;

  if (!(self instanceof accel)) return new accel(options);

  self.options = options || {};
  if (!self.options.address) self.options.address = 0x1d;
  if (!self.options.device) self.options.device = '/dev/i2c-1';
  if (!self.options.sample_count) self.options.sample_count = 400;
  if (!self.options.scale_factor) self.options.scale_factor = [0.0, 0.0, 0.0];

  self.accelScaleFactor = self.options.scale_factor;
  self.runTimeAccelBias = [      0,      0,      0 ];
  self.accelOneG        =                      0.0  ;
  self.meterPerSecSec   = { x: 0.0, y: 0.0, z: 0.0 };
  self.accelSample      = [      0,      0,      0 ];
  self.accelSampleCount =                        0  ;

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

    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) self.accelSample[axis] += (res.readInt16LE(axis * 2) & 0x3ff);
    self.accelSampleCount++;
    callback(null);
  });
};

/*
accel.prototype.evaluateMetersPerSec = function() {
  var axis;

  var self = this;

  for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
    self.meterPerSecSec[helpers.axes[axis]] = (self.accelSample[axis] / self.accelSampleCount) * self.accelScaleFactor[axis]
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

    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
      self.meterPerSecSec[helpers.axes[axis]] = (self.accelSample[axis] / self.options.sample_count)
                                                    * self.accelScaleFactor[axis];
      self.accelSample[axis] = 0;
    }
    self.accelSampleCount = 0;

    self.runTimeAccelBias[helpers.XAXIS] = -self.meterPerSecSec[helpers.axes[helpers.XAXIS]];
    self.runTimeAccelBias[helpers.YAXIS] = -self.meterPerSecSec[helpers.axes[helpers.YAXIS]];
    self.runTimeAccelBias[helpers.ZAXIS] = -self.meterPerSecSec[helpers.axes[helpers.ZAXIS]];

    self.accelOneG = Math.abs(self.meterPerSecSec[helpers.axes[helpers.ZAXIS]]
                                  + self.runTimeAccelBias[helpers.axes[helpers.ZAXIS]]);
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
      self.meterPerSecSec[helpers.axes[axis]] = (res.readInt16LE(axis * 2) & 0x3ff) * self.accelScaleFactor[axis]
                                                    + self.runTimeAccelBias[axis];
    }
    callback(null, self.meterPerSecSec);
  });
};


exports.board = accel;
