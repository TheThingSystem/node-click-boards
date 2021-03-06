var cliks = require('./index')
  , util  = require('util')
  ;

new cliks.accel.board({ scale_factor: [ 0.0371299982 , -0.0374319982, 0.0385979986 ] }).on('ready', function(data) {
  var self = this
    , x    = 3
    ;

  console.log('accel: ready');
  console.log(util.inspect(data, { depth: null }));

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


new cliks.gyro.board().on('ready', function(data) {
  var self = this
    , x    = 3
    ;

  console.log('gyro: ready');
  console.log(util.inspect(data, { depth: null }));

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


new cliks.compass.board().on('ready', function(data) {
  var self = this
    , x    = 3
    ;

  console.log('compass: ready');
  console.log(util.inspect(data, { depth: null }));

  var measureCompass = function() {
    self.measureHeading(function(err, results) {
      if (!!err) return console.log('compass.measureHeading=' + err.message);

      console.log('>>> heading=' + results);
      if (x-- > 0) setTimeout(measureCompass, 500);
    });
  };

  setTimeout(measureCompass, 500);
}).on('error', function(err) {
  console.log('compass: ' + err.message);
});


new cliks.altitude.board().on('ready', function(data) {
  var self = this
    , x    = 3
    ;

  console.log('altitude: ready');
  console.log(util.inspect(data, { depth: null }));

  var measureAltitude = function() {
    self.measureAltitude(function(err, results) {
      if (!!err) return console.log('altitude.measureAltitude=' + err.message);

      console.log(util.inspect(results, { depth: null }));
      if (x-- > 0) setTimeout(measureAltitude, 500);
    });
  };

  setTimeout(measureAltitude, 500);
}).on('error', function(err) {
  console.log('altitude: ' + err.message);
});
