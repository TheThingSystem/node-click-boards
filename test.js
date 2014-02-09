var cliks = require('./index')
  , util  = require('util')
  ;

new cliks.accel.board({ scale_factor: [ 0.0371299982 , -0.0374319982, 0.0385979986 ] }).on('ready', function() {
  var self = this
    , x    = 3
    ;

  console.log('accel: ready');
  var measureAccel = function() {
    self.measureAccel(function(err, result) {
      if (!!err) return console.log('accel.measureAccel=' + err.message);

      console.log('>>> accel');
      console.log(util.inspect(result, { depth: null }));
      if (x-- > 0) setTimeout(measureAccel, 500);
    });
  };

  setTimeout(measureAccel, 500);
}).on('error', function(err) {
  console.log('accel: ' + err.message);
});


new cliks.gyro.board().on('ready', function() {
  var self = this
    , x    = 3
    ;

  console.log('gyro: ready');
  var measureGyro = function() {
    self.measureGyro(function(err, results) {
      if (!!err) return console.log('gyro.measureGyro=' + err.message);

      console.log('>>> gyro');
      console.log(util.inspect(results, { depth: null }));
      if (x-- > 0) setTimeout(measureGyro, 500);
    });
  };

  setTimeout(measureGyro, 500);
}).on('error', function(err) {
  console.log('gyro: ' + err.message);
});


new cliks.compass.board().on('ready', function() {
  var self = this
    , x    = 3
    ;

  console.log('compass: ready');
  var measureCompass = function() {
    self.measureAcceleration(function(err, results) {
      if (!!err) return console.log('compass.measureAcceleration=' + err.message);

      console.log('>>> acceleration');
      console.log(util.inspect(results, { depth: null }));
      if (x-- > 0) setTimeout(measureCompass, 500);
    });

    self.measureMagnetism(function(err, results) {
      if (!!err) return console.log('compass.measureMagnetism=' + err.message);

      console.log('>>> magnetism');
      console.log(util.inspect(results, { depth: null }));
    });

    self.measureTemperature(function(err, results) {
      if (!!err) return console.log('compass.measureTemperature=' + err.message);

      console.log('>>> temperature');
      console.log(util.inspect(results, { depth: null }));
    });
  };

  setTimeout(measureCompass, 500);
}).on('error', function(err) {
  console.log('compass: ' + err.message);
});
