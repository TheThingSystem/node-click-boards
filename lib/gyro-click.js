// http://www.mikroe.com/click/gyro/
// L3GD20

var async   = require('async')
  , events  = require('events')
  , helpers = require('./helpers')
  , i2c     = require('i2c')
  , util    = require('util')
  ;


var _WHO_AM_I = 0x0f
  , _CTRL_REG1 = 0x20
  , _CTRL_REG4 = 0x23
  , _OUT_X_L   = 0x28
  , _AXES_DATA = _OUT_X_L    // X_L, X_H, Y_L, Y_H, Z_L, Z_H
  ;


var gyro = function(options) {
  var self = this;

  if (!(self instanceof gyro)) return new gyro(options);

  self.options = options || {};
  if (!self.options.address) self.options.address = 0x6b;
  if (!self.options.device) self.options.device = '/dev/i2c-1';
  if ((!self.options.sample_count) || (isNaN(self.options.sample_count)) || (self.options.sample_count < 64))
    self.options.sample_count = 64;
  if ((!self.options.threshold) || (isNaN(self.options.threshold)) || (self.options.threshold < 50))
    self.options.threshold = 50;

  self.degrees         = { x: 0.0, y: 0.0, z: 0.0 };
  self.gyroSampleCount =                        0  ;

  self.wire = new i2c(self.options.address, { device : self.options.device });

  async.waterfall(
    [ // who am i?
      function(callback) {
        self.wire.readBytes(_WHO_AM_I, 1, function(err, res) {
          if (!!err) return callback(err);

          self.whoami = res.toString('hex');
          callback();
        });
      }

      // 0xc0: output data rate/bandwidth
      //            0x03: 760Hz, 0x02: 380Hz, 0x01: 190Hz, 0x00: 95Hz
      // 0x30: 0x03:      100           100          70          25
      //       0x02:       50            50          50          n/a
      //       0x01:       35            25          25          n/a
      //       0x00:       30            20          12.5        n/a
      // 0x08: normal mode
      // 0x04: z-enabled
      // 0x02: x-enabled
      // 0x01: y-enabled
    , function(callback) { self.wire.writeBytes(_CTRL_REG1, [0x08 | 0x07], callback); }

      // degrees/sec 250
      // 0x80: block data update enabled
      // 0x40: LE-enabled
      // 0x30: fullscale
      //       0x03: +/-16g, 0x02: +/-8g, 0x01: +/-4g, 0x00: +/-2g
      // 0x0e: must be zeroes
      // 0x01: SPI interface mode selection (0: 4-wire, 1: 3-wire)
    , function(callback) { self.wire.writeBytes(_CTRL_REG4, [0x00], callback); }

    , function(callback) { self._computeGyroBias(callback); }
    ],
  function(err, results) {/* jshint unused: false */
    if (!!err) return self.emit('error', err);

    setTimeout(function() { self.emit('ready', { whoami: self.whoami, runTimeGyroBias: self.runTimeGyroBias }); }, 10);
  });
};
util.inherits(gyro, events.EventEmitter);


gyro.prototype._measureGyro = function(callback) {
  var self = this;

  self.wire.readBytes(_AXES_DATA, 6, function(err, res) {
    var axis, result;

    if (!!err) return callback(err);

    result = {};
    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) result[axis] = res.readInt16LE(axis * 2);
    callback(null, result);
  });
};

gyro.prototype._computeGyroBias = function(callback) {
  var self = this
    , sums = [ 0, 0, 0]
    ;

  var getSamples = function() {
    var axis;

    if (self.gyroSampleCount++ < self.options.sample_count) {
      return self._measureGyro(function(err, result) {
        var axis;

        if (!!err) return self.emit('error', err);

        for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) sums[axis] += result[axis];

        setTimeout(getSamples, 2.5);
      });
    }

    self.runTimeGyroBias = [];
    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
      self.runTimeGyroBias[axis] = sums[axis] / self.options.sample_count;
    }
    callback();
  };

  getSamples();
};

gyro.prototype.measureGyro = function(callback) {
  var self = this;

  self._measureGyro(function(err, result) {
    var axis, value;

    if (!!err) callback(err);

    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
      value = result[axis] - self.runTimeGyroBias[axis];

      // 250 degrees/second at 8.75M degrees/second (according to Gyro_click.c)
      if (Math.abs(value) > self.options.threshold) self.degrees[helpers.axes[axis]] += value * 0.000875 / 94.8 * 3.0;
    }

    callback(null, self.degrees);
  });
};


exports.board = gyro;
