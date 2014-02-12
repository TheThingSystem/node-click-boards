// http://www.mikroe.com/click/gyro/
// L3GD20

var async   = require('async')
  , events  = require('events')
  , helpers = require('./helpers')
  , i2c     = require('i2c')
  , util    = require('util')
  ;


var _WHO_AM_I  = 0x0f
  , _CTRL_REG1 = 0x20
  , _CTRL_REG4 = 0x23
  , _OUT_X_L   = 0x28
  , _AXES_DATA = _OUT_X_L    // X_L, X_H, Y_L, Y_H, Z_L, Z_H
  ;


var gyro = function(options) {
  var self = this;

  if (!(self instanceof gyro)) return new gyro(options);

  self.options = helpers.options(options, { address      : 0x6b
                                          , device       : '/dev/i2c-1'
                                          , sample_count : 64
                                          , threshold    : 50
                                          });
  self.degrees = [ 0, 0, 0 ];
  self.wire    = new i2c(self.options.address, { device : self.options.device });

  async.waterfall(
    [ // 0xc0: output data rate/bandwidth
      //            0x03: 760Hz, 0x02: 380Hz, 0x01: 190Hz, 0x00: 95Hz
      // 0x30: 0x03:      100           100          70          25
      //       0x02:       50            50          50          n/a
      //       0x01:       35            25          25          n/a
      //       0x00:       30            20          12.5        n/a
      // 0x08: normal mode
      // 0x04: z-enabled
      // 0x02: x-enabled
      // 0x01: y-enabled
     function(callback) { self.wire.writeBytes(_CTRL_REG1, [ 0x10 | 0x08 | 0x07 ], callback); }

      // degrees/sec 250
      // 0x80: block data update enabled
      // 0x40: LE-enabled
      // 0x30: fullscale
      //       0x03: +/-16g, 0x02: +/-8g, 0x01: +/-4g, 0x00: +/-2g
      // 0x0e: must be zeroes
      // 0x01: SPI interface mode selection (0: 4-wire, 1: 3-wire)
    , function(callback) { self.wire.writeBytes(_CTRL_REG4, [ 0x00 ], callback); }

      // who am i?
    , function(callback) {
        self.wire.readBytes(_WHO_AM_I, 1, function(err, buf) {
          if (!!err) return callback(err);

          self.whoami = buf.toString('hex');
          callback();
        });
      }

    , function(callback) { self._computeGyroBias(callback); }
    ],
  function(err, results) {
    if (!!err) return self.emit('error', err);

    self.emit('ready', results);
  });
};
util.inherits(gyro, events.EventEmitter);


gyro.prototype._computeGyroBias = function(callback) {
  var self  = this
    , count = self.options.sample_count
    , iter  = count
    , sums  = [ 0, 0, 0]
    ;

  self.runTimeGyroBias = [ 0, 0, 0 ];

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
      self.runTimeGyroBias[axis] = sums[axis] / count;
      bias[helpers.axes[axis]] = self.runTimeGyroBias[axis];
    }

    setTimeout(function() { callback(null, { whoami: self.whoami, runTimeGyroBias: bias }); }, 10);
  };

  getSamples();
};


gyro.prototype.measureGyro = function(callback) {
  var self = this;

  self.wire.readBytes(_AXES_DATA, 6, function(err, buf) {
    var axis, diff, result;

    if (!!err) callback(err);

    result = {};
    for (axis = helpers.XAXIS; axis <= helpers.ZAXIS; axis++) {
      diff = buf.readInt16LE(axis * 2) - self.runTimeGyroBias[axis];

      // 250 degrees/second at 8.75M degrees/second (according to Gyro_click.c)
      if (Math.abs(diff) > self.options.threshold) self.degrees[axis] += diff * 0.00875 / 94.8 * 3.0;
      result[helpers.axes[axis]] = self.degrees[axis];
    }

    callback(null, result);
  });

  return self;
};


exports.board = gyro;
