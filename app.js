var SimpleRDF = require('simplerdf')
var N3Parser = require('rdf-parser-n3')
var JsonldParser = require('rdf-parser-jsonld')
var RdfaParser = require('rdf-parser-rdfa')
var SimpleRDFParse = require('simplerdf-parse')

var formats = {parsers: {}}
formats.parsers['text/turtle'] = N3Parser
formats.parsers['application/ld+json'] = JsonldParser
formats.parsers['application/xhtml+xml'] = RdfaParser
formats.parsers['text/html'] = RdfaParser
var parser = SimpleRDFParse(formats.parsers)

SimpleRDF.parse = parser.parse.bind(parser)
exports.SimpleRDF = SimpleRDF

var fs = require('fs');
var path = require('path');
var extname = path.extname;
var etag = require('etag');
var uuid = require('node-uuid');
var express = require('express');
var bodyParser = require('body-parser');
var app = module.exports = express();

const scheme = 'http';
const hostname = 'localhost';
const port = 3000;
const authority = scheme + '://' + hostname + ':' + port;
const inboxPath = 'inbox/';

// app.use(compress());

// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Access-Control-Allow-Origin, Authorization, Origin, X-Requested-With, Content-Type, Accept, ETag, Cache-Control, If-None-Match");
//   res.header("Access-Control-Expose-Headers", "Etag, Authorization, Origin, X-Requested-With, Content-Type, Accept, If-None-Match, Access-Control-Allow-Origin");
//   res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
//   next();
// });

var rawBodySaver = function (req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};
app.use(bodyParser.raw({ verify: rawBodySaver, type: '*/*' }));

app.use(function(req, res, next) {
  req.getUrl = function() {
    return req.protocol + "://" + req.header('host') + req.originalUrl;
  }
  return next();
});

app.enable('trust proxy');
app.use(function(req, res, next){
  require('console-stamp')(console, {
    pattern: "yyyy-mm-dd HH:MM:ss.l",
    metadata: function () {
      return (req.method + ' ' + req.getUrl() + ' ' + req.ips + '');
    },
    colors: {
      stamp: "yellow",
      label: "white",
      metadata: "green"
    }
  });
  return next();
});

app.use(function(req, res, next) {
  //console.log(req);
  //console.log(res);
  // console.log('----------')
  // console.log('req.method: ' + req.method);
  console.log(JSON.stringify(req.headers));
  // console.log('req.body: ')
  // console.log(req.body);
  // console.log(req.rawBody);
  // console.log('req.originalUrl: ' + req.originalUrl);
  // console.log('req.url: ' + req.url);
  // console.log('req.getUrl: ' + req.getUrl());
  // console.log('__dirname + req.originalUrl: ' +  __dirname + req.originalUrl);
  return next();
});

//app.set('etag', 'strong')

app.route('/')
  .get(getTarget)
  .head(getTarget);
app.route('/inbox/:id?')
  .get(getResource)
  .head(getResource);
app.route('/inbox/')
  .post(postContainer);

if (!module.parent) {
  app.listen(port, function() {
    console.log('curl -i ' + authority);
  });
}

function getTarget(req, res, next){
  var path = __dirname + req.originalUrl;

  var data = JSON.stringify({
    "@context": "http://www.w3.org/ns/ldp",
    "@id": "",
    "inbox": [ { "@id": inboxPath } ]
  }) + "\n";

  var p = extname(path);
  var contentType = p.length > 0 ? p : 'application/ld+json; charset=utf-8';

  res.status(200);
  res.set('Link', '<' + req.getUrl() + inboxPath + '>; rel="http://www.w3.org/ns/ldp#inbox"')
  res.set('Content-Type', contentType);
  res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
  res.set('ETag', etag(data));
  res.set('Vary', 'Origin');
  if(req.method === 'HEAD') {
    res.send();
    return next();
  }
  res.send(data);
  return next();
}


function getResource(req, res, next){
  var path = __dirname + req.originalUrl;

  fs.stat(path, function(error, stats) {
    if (error) {
      res.status(404);
      return next();
    }

    if (stats.isFile()) {
      var isReadable = stats.mode & 4 ? true : false;
// //console.log('-- isReadable: ' + isReadable);
      if (isReadable) {
          fs.readFile(path, 'utf8', function(error, data){
            if (error) throw error;

            if (req.headers['if-none-match'] && ('"' + req.headers['if-none-match'] + '"') == etag(data)) {
              res.status(304)
              return next();
            }

            res.status(200);
            res.set('Content-Type', 'application/ld+json; charset=utf-8');
            res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
            res.set('ETag', etag(data));
            res.set('Last-Modified', stats.mtime);
            res.set('Vary', 'Origin');
            if(req.method === 'HEAD') {
              res.send();
              return next();
            }
            res.send(data);
            return next();
          });
      }
      else {
        res.status(403);
        return next();
      }
    }
    else if(stats.isDirectory()) {
      fs.readdir(path, function(error, files){
        if(error) {
          console.log("Can't readdir: " + path); //throw err;
        }

        var contains = [];
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          contains.push({ "@id": file });
        }

        var data = JSON.stringify({
          "@context": "http://www.w3.org/ns/ldp",
          "@id": "",
          "contains": contains
        }) + "\n";

        if (req.headers['if-none-match'] && ('"' + req.headers['if-none-match'] + '"') == etag(data)) {
          res.status(304)
          return next();
        }

        res.status(200);
        res.set('Content-Type', 'application/ld+json; charset=utf-8');
        res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
        res.set('ETag', etag(data));
        res.set('Last-Modified', stats.mtime);
        res.set('Vary', 'Origin');
        if(req.method === 'HEAD') {
          res.send();
          return next();
        }
        res.send(data);
        return next();
      });
    }
    return;
  });
}

function postContainer(req, res, next){
  var data = req.rawBody;
  var contentType = req.header('Content-Type');

  if(req.is('application/ld+json') || req.is('text/turtle')) {
    SimpleRDF.parse(data, contentType, '_:ldn').then(
      function(g) {
        var fileName = uuid.v1();
        var file = __dirname + '/' + inboxPath + fileName;

        fs.appendFile(file, data, function() {
          var url = req.getUrl();
          var base = (url.endsWith('/')) ? url : url + '/';
          var location = base + inboxPath + fileName;
          console.log(location);
          res.set('Location', location);
          res.status(201);
          res.send();
          res.end();
          return;
        });
      },
      function(reason) {
        res.status(400);
        res.send();
      }
    );
  }
  else {
    res.status(415);
    res.end();
  }
  return;
}
