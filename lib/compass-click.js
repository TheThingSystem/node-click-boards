// http://www.mikroe.com/click/compass/
// LSM303DLHC

var async   = require('async')
  , events  = require('events')
  , helpers = require('./helpers')
  , i2c     = require('i2c')
  , util    = require('util')
  ;


var _CTRL_REG1_A   = 0x20
  , _CTRL_REG4_A   = 0x23
  , _OUT_X_L_A     = 0x28
  , _ACCEL_DATA    = _OUT_X_L_A    // X_L, X_H, Y_L, Y_H, Z_L, Z_A
  , _CRA_REG_M     = 0x00
  , _CRB_REG_M     = 0x01
  , _OUT_X_H_M     = 0x03
  , _MAGNO_DATA    = _OUT_X_H_M    // X_H, X_L, Z_H, Z_L, Y_H, Y_L
  , _TEMP_OUT_H_M  = 0x31
  , _TEMP_DATA     = _TEMP_OUT_H_M // T_H, T_L
  ;


var compass = function(options) {
  var self = this;

  if (!(self instanceof compass)) return new compass(options);

  self.options = options || {};
  if (!self.options.address) self.options.accel_address = 0x19;
  if (!self.options.address) self.options.magno_address = 0x1e;
  if (!self.options.device) self.options.device = '/dev/i2c-1';
  if (!self.options.accel_device) self.options.accel_device = self.options.device;
  if (!self.options.magno_device) self.options.magno_device = self.options.device;
  if ((!self.options.sample_count) || (isNaN(self.options.sample_count)) || (self.options.sample_count < 100))
    self.options.sample_count = 100;
  if ((!self.options.steady_threshold) || (isNaN(self.options.steady_threshold)) || (self.options.steady_threshold < 1250))
    self.options.steady_threshold = 1250;

  self.wire_accel = new i2c(self.options.accel_address, { device : self.options.accel_device });
  self.wire_magno = new i2c(self.options.magno_address, { device : self.options.magno_device });

  async.waterfall(
    [ // 0xf0: output data rate
      //       0x80: 1620Hz (low-power mode),         0x81: 1344Hz (normal mode) / 5376Hz (low-power mode)
      //       0x07: 400Hz, 0x06: 200Hz, 0x05: 100Hz, 0x04: 50Hz, 0x03: 25Hz, 0x02: 10Hz, 0x01: 1Hz, 0x00: power off
      // 0x08: low-power enabled
      // 0x04: Z-axis enabled
      // 0x02: Y-axis enabled
      // 0x01: X-axis enabled
      function(callback) { self.wire_accel.writeBytes(_CTRL_REG1_A, [(0x02 << 4) | 0x07], callback); }

      // 0x80: block data update enabled
      // 0x40: LE-enabled
      // 0x30: fullscale
      //       0x03: +/-16g, 0x02: +/-8g, 0x01: +/-4g, 0x00: +/-2g
      // 0x08: high resolution enable
      // 0x06: must be zero
      // 0x01: SPI interface mode selection (0: 4-wire, 1: 3-wire)
    , function(callback) { self.wire_accel.writeBytes(_CTRL_REG4_A, [0x08], callback); }

      // 0x80: temperature enabled
      // 0x60: must be zeroes
      // 0x1c: output data rate
      //       0x07: 220Hz, 0x06: 75Hz, 0x05: 30Hz, 0x04: 15Hz, 0x03: 7.5Hz, 0x02: 3Hz, 0x01: 1.5Hz, 0x00: .75Hz
      // 0x02: must be zeroes
    , function(callback) { self.wire_magno.writeBytes(_CRA_REG_M, [(0x01 << 7) | (0x07 << 2)], callback); }

      // 0xe0: gain
      //       0x07: 230, 0x06: 330, 0x05: 400, 0x04: 450, 0x03: 670, 0x02: 855, 0x01: 1100
    , function(callback) { self.wire_magno.writeBytes(_CRB_REG_M, [(0x01 << 5)], callback); }

    , function(callback) { self._calibrateCompass(callback); }
    ],
  function(err, results) {/* jshint unused: false */
    if (!!err) return self.emit('error', err);

    setTimeout(function() { self.emit('ready', { runTimeMagnoMax : self.runTimeMagnoMax
                                               , runTimeMagnoMin : self.runTimeMagnoMin }); }, 10);
  });
};
util.inherits(compass, events.EventEmitter);


compass.prototype._calibrateCompass = function(callback) {
  var self = this;

  self._averageMeasurement(self._measureMagnetism.bind(self), 8, function(err, result) {/* jshint unused: false */
    var max, min, x;

    if (!!err) return callback(err);

    self.runTimeMagnoMax = [ -100, -100, -100 ];
    self.runTimeMagnoMin = [  100,  100,  100 ];

    x = self.options.sample_count;
    var getSamples = function() {
      self._steadyAcceleration(function(err, steadyP) {
        var axis;

        if (!!err) return callback(err);

        if (!steadyP) return setTimeout(getSamples, 2.5);

        self._averageMeasurement(self._measureMagnetism.bind(self), 8, function(err, result) {
          var axis;

          if (!!err) return self.emit('error', err);

          for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
            if (result[axis] > self.runTimeMagnoMax[axis]) self.runTimeMagnoMax[axis] = result[axis];
            if (result[axis] < self.runTimeMagnoMin[axis]) self.runTimeMagnoMin[axis] = result[axis];
          }
        });

        if (x-- > 0) return setTimeout(getSamples, 2.5);

        for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
          if (self.runTimeMagnoMax[axis] == self.runTimeMagnoMin[axis]) self.runTimeMagnoMax[axis]++;
        }

        callback(null);
      });
    };

    getSamples();
  });
};

compass.prototype._steadyAcceleration = function(callback) {
  var self = this;

  self._averageMeasurement(self._measureAcceleration.bind(self), 8, function(err, result) {
    if (!!err) return callback(err);
    
    callback(null, helpers.v_magnitude(result) < self.options.steady_threshold);
  });
};

compass.prototype._averageMeasurement = function(measure, count, callback) {
  var results, x;

  if (count < 1) count = 8;

  results = [ 0, 0, 0 ];
  x = count;
  var getSamples = function() {
    measure(function(err, result) {
      var axis;

      if (!!err) return callback(err);

      for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) results[axis] += result[axis];
      if (x-- > 0) return setTimeout(getSamples, 2.5);

      for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) results[axis] /= count;
      callback(null, results);
    });
  };

  getSamples();
};

compass.prototype._measureAcceleration = function(callback) {
  var self = this;

  self.wire_accel.readBytes(_ACCEL_DATA, 6, function(err, res) {
    var axis, result;

    if (!!err) return callback(err);

    result = [];
    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) result[axis] = res.readInt16LE(axis * 2) / 16;

    callback(null, result);
  });
};

compass.prototype._measureMagnetism = function(callback) {
  var self = this;

  self.wire_magno.readBytes(_MAGNO_DATA, 6, function(err, res) {
    var result;

    if (!!err) return callback(err);

    result = [];
    result[0] = res.readInt16BE(0);
    result[1] = res.readInt16BE(4);
    result[2] = res.readInt16BE(2);

    callback(null, result);
  });
};


compass.prototype.measureHeading = function(callback) {
  var self = this;

  self._averageMeasurement(self._measureAcceleration.bind(self), 8, function(err, accel) {
    if (!!err) return callback(err);

    self._averageMeasurement(self._measureMagnetism.bind(self), 8, function(err, magno) {
      var axis, degrees, earth, north;

      if (!!err) return callback(err);

      for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
        magno[axis] = (((magno[axis] - self.runTimeMagnoMin[axis]) * 2)
                           / (self.runTimeMagnoMax[axis] - self.runTimeMagnoMin[axis])) - 1;
      }
      accel = helpers.v_normalize(accel);
      earth = helpers.v_cross_product(magno, accel);
      north = helpers.v_normalize(helpers.v_cross_product(accel, earth));
      earth = helpers.v_normalize(earth);

console.log('1: ' + JSON.stringify(helpers.v_dot_product(earth, [ 0, 1, 0 ])));
console.log('2: ' + JSON.stringify(helpers.v_dot_product(north, [ 0, 1, 0 ])));
      degrees = Math.ceil(Math.atan2(helpers.v_dot_product(earth, [ 0, 1, 0 ]),
                                     helpers.v_dot_product(north, [ 0, 1, 0 ])) * (180 / Math.PI));
      if (degrees < 0) degrees += 360;

      callback(degrees);
    });
  });
};


compass.prototype.measureTemperature = function(callback) {
  var self = this;

  self.wire_magno.readBytes(_TEMP_DATA, 2, function(err, res) {
    if (!!err) return callback(err);

    callback(null, { temperature: res.readInt16BE(0) >> 4 });
  });
};

exports.board = compass;
