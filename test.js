var cliks = require('./index')
  , util  = require('util')
  ;

var accel = new cliks.accel.board(function(err) {
  if (!!err) return console.log('cliks.accel=' + err.message);

  accel.accelScaleFactor = [ 0.0371299982 , -0.0374319982, 0.0385979986 ];
  accel.computeAccelBias(function() {
    var measureAccel = function() {
      accel.measureAccel(function(err) {
        if (!!err) return console.log('accel.measureAccel=' + err.message);

        console.log(util.inspect(accel.meterPerSecSec, { depth: null }));
        setTimeout(measureAccel, 500);
      });
    };

    setTimeout(measureAccel, 500);
  });
});


var gyro = new cliks.gyro.board(function(err) {
  if (!!err) return console.log('cliks.gyro=' + err.message);

  var measureGyro = function() {
    gyro.measureGyro(function(err, results) {
      if (!!err) return console.log('gyro.measureGyro=' + err.message);

      console.log(util.inspect(results, { depth: null }));
      setTimeout(measureGyro, 500);
    });
  };

  setTimeout(measureGyro, 500);
});
