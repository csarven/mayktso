var fs = require('fs');

var express = require('express');
var http = require('http');
var https = require('https');

// createServer is an oppinionated expres()-based server factor
exports.createServer = function(config){
  var app = express();
  // app.use(compress());

  if (config.sslKey && config.sslCert) {
    var options = {
      key: fs.readFileSync(config.sslKey),
      cert: fs.readFileSync(config.sslCert),
      requestCert: false
    };
    https.createServer(options, app).listen(config.port);
  }
  else {
    http.createServer(app).listen(config.port);
  }
  return app;
}
