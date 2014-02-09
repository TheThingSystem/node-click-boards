/* this fails to read, leating me to believe that _ACC_I2C_ADDR is wrong
 */

// http://www.mikroe.com/click/compass/
// LSM303DLHC

var async  = require('async')
  , events = require('events')
  , i2c    = require('i2c')
  , util   = require('util')
  ;

var _ACC_I2C_ADDR    = 0x32
  , _ACC_CTRL_REG1   = 0x20
  , _ACC_CTRL_REG4   = 0x23
  , _ACCEL_DATA      = 0x28
  , _MAG_I2C_ADDR    = 0x3c
  , _MAG_CTRL_REG1   = 0x00
  , _MAG_CTRL_REG2   = 0x00
  , _MAGNO_DATA      = 0x03
  , _TEMP_DATA       = 0x31
  ;

var XAXIS = 0
//, YAXIS = 1
  , ZAXIS = 2
  , axes = [ 'x', 'y', 'z' ];


var compass = function(options) {
  var self = this;

  if (!(self instanceof compass)) return new compass(options);

  self.options = options || {};
  if (!self.options.address) self.options.accel_address = _ACC_I2C_ADDR;
  if (!self.options.address) self.options.magno_address = _MAG_I2C_ADDR;
  if (!self.options.device) self.options.device = '/dev/i2c-1';
  if (!self.options.sample_count) self.options.sample_count = 400;

  self.wire_accel = new i2c(self.options.accel_address, { device : self.options.device });
  self.wire_magno = new i2c(self.options.magno_address, { device : self.options.device });

  async.waterfall(
    [ // 0xf0: output data rate
      //       0x07: 400Hz, 0x06: 200Hz, 0x05: 100Hz, 0x04: 50Hz, 0x03: 25Hz, 0x02: 10Hz, 0x01: 1Hz
      // 0x08: LPEN
      // 0x07: axes enabled: 0x01: X, 0x02: Y, 0x04: Z
      function(callback) { self.wire_accel.writeBytes(_ACC_CTRL_REG1, [(0x02 << 4) | 0x07], callback); }

      // 0x80: BDU
      // 0x40: BLE
      // 0x30: fullscale
      //       0x03: 16, 0x02: 8, 0x01: 4, 0x00: 2
      // 0x08: high resolution
      // 0x06: ST
      // 0x01: SIM
    , function(callback) { self.wire_accel.writeBytes(_ACC_CTRL_REG4, [0x08], callback); }

      // 0x1c: output data rate
      //       0x07: 220Hz, 0x06: 75Hz, 0x05: 30Hz, 0x04: 15Hz, 0x03: 7.5Hz, 0x02: 3Hz, 0x01: 1.5Hz, 0x00: .75Hz
    , function(callback) { self.wire_magno.writeBytes(_MAG_CTRL_REG1, [(0x07 << 2)], callback); }

      // 0x03: mode
      //       0x02: sleep, 0x01: single, 0x00: continuous
    , function(callback) { self.wire_magno.writeBytes(_MAG_CTRL_REG1, [(0x00 << 0)], callback); }

      // 0xe0: gain
      //       0x07: 230, 0x06: 330, 0x05: 400, 0x04: 450, 0x03: 670, 0x02: 855, 0x01: 1100
    , function(callback) { self.wire_magno.writeBytes(_MAG_CTRL_REG2, [(0x01 << 5)], callback); }

    , function(callback) { self._calibrateCompass(callback); }
    ],
  function(err, results) {/* jshint unused: false */
    if (!!err) return self.emit('error', err);

    setTimeout(function() { self.emit('ready'); }, 10);
  });
};
util.inherits(compass, events.EventEmitter);


compass.prototype._calibrateCompass = function(callback) {
  var self = this;

  self._averageMeasurement(self.measureMagnetism, 8, function(err, result) {/* jshint unused: false */
    var max, min, x;

    if (!!err) return callback(err);

    max = { x: -100, y: -100, z: -100 };
    min = { x:  100, y:  100, z:  100 };

    x = self.options.sample_count;
    var getSamples = function() {
      self.steadyAcceleration(function(err, steadyP) {
        if (!!err) return callback(err);

        if (steadyP) {
          self._averageMeasurement(self.measureMagnetism, 8, function(err, result) {
            var value;

            if (!!err) return self.emit('error', err);

            for (value in result) {
              if (!result.hasOwnProperty(value)) continue;

              if (result[value] > max[value]) max[value] = result[value];
              if (result[value] < min[value]) min[value] = result[value];
            }
          });
        }

        if (x-- > 0) return setTimeout(getSamples, 2.5);
        self.runTimeMagnoMax = max;
        self.runTimeMagnoMin = min;
        callback(null);
      });
    };

    getSamples();
  });
};

compass.prototype._averageMeasurement = function(measure, count, callback) {
  var results, x;

  if (count < 1) count = 8;

  x = count;
  var getSamples = function() {
    measure(function(err, result) {
      var value;

      if (!!err) return callback(err);

      for (value in result) if (result.hasOwnProperty(value)) {
        if (!results[value]) results[value] = 0;
        results[value] += result[value];
      }
      if (x-- > 0) return setTimeout(getSamples, 2.5);

      for (value in results) if (results.hasOwnProperty(value)) results[value] /= count;
      callback(null, results);
    });
  };

  getSamples();
};

var v_cross_product = function(a, b) {
  return { x: (a.y * b.z) - (a.z * b.y), y: (a.z * b.x) - (a.x * b.z), z: (a.x * b.y) - (a.y * b.x) };
};

var v_dot_product = function(a, b) {
  var result, value;

  result = 0;
  for (value in a) if (a.hasOwnProperty(value) && b.hasOwnProperty(value)) result += a[value] * b[value];
  return result;
};

var v_magnitude = function(a) {
  return Math.sqrt(v_dot_product(a, a));
};

var v_normalize = function(a) {
  var magnitude = v_magnitude(a);

  return { x: a.x / magnitude, y: a.y / magnitude, z: a.z / magnitude };
};


compass.prototype.currentHeading = function(callback) {
  var self = this;

  self._average_measurement(self.measureAcceleration, 8, function(err, accel) {
    if (!!err) return callback(err);

    self._average_measurement(self.measureMagnetism, 8, function(err, magno) {
      var degrees, earth, north, value;

      if (!!err) return callback(err);

      for (value in magno) {
        if (!magno.hasOwnProperty(value)) continue;

        magno[value] = (((magno[value] - self.runTimeMagnoMin[value]) * 2)
                           / (self.runTimeMagnoMax[value] - self.runTimeMagnoMin[value])) - 1;
      }
      accel = v_normalize(accel);
      earth = v_cross_product(magno, accel);
      north = v_normalize(v_cross_product(accel, earth));
      earth = v_normalize(earth);

      degrees = Math.ceil(Math.atan2(v_dot_product(earth, { x: 0, y: 1, z: 0 }), v_dot_product(north, { x: 0, y: 1, z: 0 }))
                          * 180 / Math.PI);
      if (degrees < 0) degrees += 360;

      callback(degrees);
    });
  });
};


compass.prototype.measureAcceleration = function(callback) {
  var self = this;

  self.wire_accel.readBytes(_ACCEL_DATA, 6, function(err, res) {
    var axis, result;

    if (!!err) return callback(err);

    result = {};
    for (axis = XAXIS; axis <= ZAXIS; axis++) result[axes[axis]] += res.readInt16LE(axis * 2) / 16;

    callback(null, result);
  });
};

compass.prototype.measureMagnetism = function(callback) {
  var self = this;

  self.wire_magno.readBytes(_MAGNO_DATA, 6, function(err, res) {
    var axis, result;

    if (!!err) return callback(err);

    result = {};
    for (axis = XAXIS; axis <= ZAXIS; axis++) result[axes[axis]] += res.readInt16LE(axis * 2);

    callback(null, result);
  });
};

compass.prototype.measureTemperature = function(callback) {
  var self = this;

  self.wire_magno.readBytes(_TEMP_DATA, 1, function(err, res) {
    if (!!err) return callback(err);

    callback(null, { temperature: res.readInt16LE(0) + 25 });
  });
};

compass.prototype.steadyAcceleration = function(callback) {
  var self = this;

  self._averageMeasurement(self.measureAcceleration, 8, function(err, result) {
    if (!!err) return callback(err);
    
    callback(null, v_magnitude(result) < 1250);
  });
};

exports.board = compass;
