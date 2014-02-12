// http://www.mikroe.com/click/altitude/
// MPL3115A2

var async   = require('async')
  , events  = require('events')
  , helpers = require('./helpers')
  , i2c     = require('i2c')
  , util    = require('util')
  ;


var _OUT_P_MSB      = 0x01
  , _ALTITUDE_DATA  = _OUT_P_MSB    // P_MSB, P_CSB, P_LSB, T_MSG, T_LSB
  , _WHO_AM_I       = 0x0c
  , _BAR_IN_MSB     = 0x14
  , _BAROMETER_DATA = _BAR_IN_MSB
  , _CTRL_REG1      = 0x26
  , _CTRL_REG4      = 0x29
  ;


var altitude = function(options) {
  var self = this;

  if (!(self instanceof altitude)) return new altitude(options);

  self.options = helpers.options(options, { address        : 0x60
                                          , device         : '/dev/i2c-1'
                                          , start_altitude : 89
                                          });
  self.wire    = new i2c(self.options.address, { device : self.options.device });

  async.waterfall(
    [ // 0x80: altimeter enabled
      // 0x40: raw output mode
      // 0x38: oversampling:  2^n
      // 0x04: reset
      // 0x02: oneshot measurement
      // 0x01: active
      function(callback) { self.wire.writeBytes(_CTRL_REG1, [ 0x80 | 0x38 | 0x01 ], callback); }

      // 0x80: data ready interrupts
      // 0x40: fifo interrupts
      // 0x20: pressure window interrupts
      // 0x10: temperature window interrupt
      // 0x08: pressure threshold interrupts
      // 0x04: temperature threshold interrupts
      // 0x02: pressure change interrupts
      // 0x01: temperature change interrupts
    , function(callback) { self.wire.writeBytes(_CTRL_REG4, [ 0x00 ], callback); }

      // who am i?
    , function(callback) {
        self.wire.readBytes(_WHO_AM_I, 1, function(err, buf) {
          if (!!err) return callback(err);

          self.whoami = buf.toString('hex');
          callback();
        });
      }

    , function(callback) { self._computeAltitudeBias(callback); }
    ],
  function(err, results) {
    if (!!err) return self.emit('error', err);

    self.emit('ready', results);
  });
};
util.inherits(altitude, events.EventEmitter);


altitude.prototype._computeAltitudeBias = function(callback) {
  var self     = this
    , count    = 8
    , iter     = count
    , pressure = 0;

  var getSamples = function() {
    if (iter-- > 0) {
      return self.wire.writeBytes(_CTRL_REG1, [ 0x38 | 0x02 | 0x01 ], function(err) {
        if (!!err) return callback(err);

        setTimeout(function() {
          self.wire.readBytes(_ALTITUDE_DATA, 3, function(err, buf) {
            if (!!err) return callback(err);

            pressure += ((buf.readInt16BE(0) < 16) | (buf.readUInt8(2) & 0xf0)) / 65535;
            setTimeout(getSamples, 2.5);
          });
        }, 550);
      });
    }

    pressure /= count * Math.pow(1 - self.options.start_altitude * 0.0000225577, 5.255877);
    self.wire.writeBytes(_BAROMETER_DATA, [ (pressure >> 9) & 0xff, pressure & 0xff], function(err) {
      if (!!err) return callback(err);

      setTimeout(function() { callback(null, { whoami: self.whoami, pressure: pressure }); }, 10);
    });
  };

  getSamples();
};


altitude.prototype.measureAltitude = function(callback) {
  var self = this;

  self.wire.writeBytes(_CTRL_REG1, [ 0x80 | 0x38 | 0x02 | 0x01 ], function(err) {
    if (!!err) return callback(err);

    setTimeout(function() {
      self.wire.readBytes(_ALTITUDE_DATA, 5, function(err, buf) {
        var result;

        if (!!err) return callback(err);

        result = { altitude    : ((buf.readInt16BE(0) < 16) | (buf.readUInt8(2) & 0xf0)) / 65535
                 , temperature : buf.readInt16BE(3) / 256
                 };

        callback(null, result);
      });
    }, 550);
  });

  return self;
};


exports.board = altitude;
