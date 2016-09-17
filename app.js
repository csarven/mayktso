var LdpStore = require('rdf-store-ldp/lite')
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

var storeFormats = {parsers:{}}
storeFormats.parsers['text/turtle'] = N3Parser
storeFormats.parsers['application/ld+json'] = JsonldParser
storeFormats.parsers['application/xhtml+xml'] = RdfaParser
storeFormats.parsers['text/html'] = RdfaParser
RDFstore = new LdpStore(storeFormats)

var fs = require('fs');
var path = require('path');
var extname = path.extname;
var etag = require('etag');
var uuid = require('node-uuid');
var express = require('express');
var https = require('https');
var http = require('http');
var accepts = require('accepts');
var bodyParser = require('body-parser');
var app = express();
var accept, requestedType;
var availableTypes = ['application/ld+json', 'text/turtle'];
var path;

// app.use(compress());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST");
  if(req.header('Origin')) {
    res.header("Access-Control-Allow-Origin", req.header('Origin'));
  }
  else {
    res.header("Access-Control-Allow-Origin", "*");
  }
  res.header("Access-Control-Allow-Headers", "Accept-Post, Content-Length, Content-Type, If-None-Match, Link, Location, Origin, Slug, X-Requested-With");
   res.header("Access-Control-Expose-Headers", "Access-Control-Allow-Headers, Access-Control-Allow-Origin, Access-Control-Allow-Methods, Allow, Content-Length, Content-Type, Link, Last-Modified, ETag, Vary");
  return next();
});

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
  accept = accepts(req);
  requestedType = accept.type(availableTypes);
  path = __dirname + req.originalUrl;

  // console.log(req);
  // console.log(res);

  console.log('-----------------');
  console.log(JSON.stringify(req.headers));
  // console.log('req.protocol: ' + req.protocol);
  // console.log('accept.types(): ' + accept.types());
  console.log('requestedType: ' + requestedType);
  // console.log(req.body);
  // console.log(req.rawBody);
  // console.log('req.baseUrl: ' + req.baseUrl);
  console.log('req.originalUrl: ' + req.originalUrl);
  // console.log('req.url: ' + req.url);
  console.log('req.getUrl: ' + req.getUrl());
  console.log('__dirname + req.originalUrl: ' +  __dirname + req.originalUrl);
  return next();
});

//app.set('etag', 'strong')

app.route('/')
  .get(getTarget)
  .head(getTarget);
app.route('/inbox/:id?').all(handleResource);
app.route('/queue/:id').all(handleResource);

if (!module.parent) {
  var config;
  fs.readFile(__dirname + '/config.json', 'utf8', function(error, file){
    config = (error) ? {} : JSON.parse(file);
    config['port'] = config.port || 3000;
    config['inboxPath'] = config.inboxPath || 'inbox/';
    config['queuePath'] = config.queuePath || 'queue/';
    config['maxPayloadSize'] = config.maxPayloadSize || 1000;
    config['maxResourceCount'] = config.maxResourceCount || 10;
    console.log(config);

    var scheme = 'http';
    if (config.sslKey && config.sslCert) {
      var options = {
        key: fs.readFileSync(config.sslKey),
        cert: fs.readFileSync(config.sslCert),
        requestCert: false
      };
      https.createServer(options, app).listen(config.port);
      scheme = 'https';
    }
    else {
      http.createServer(app).listen(config.port);
    }

    var hostname = 'localhost';
    var authority = scheme + '://' + hostname + ':' + config.port;
    inboxPath = config.inboxPath;
    queuePath = config.queuePath;
    maxPayloadSize = config.maxPayloadSize;
    maxResourceCount = config.maxResourceCount;

    console.log('process.cwd(): ' + process.cwd());
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

//From https://github.com/linkeddata/dokieli/scripts/do.js
function getGraphFromData(data, options) {
  options = options || {};
  if (!('contentType' in options)) {
    options['contentType'] = 'text/turtle';
  }
  if (!('subjectURI' in options)) {
    options['subjectURI'] = '_:dokieli';
  }

  return SimpleRDF.parse(data, options['contentType'], options['subjectURI']);
}

function getGraph(url) {
    return SimpleRDF({}, url, null, RDFstore).get();
}

function serializeGraph(g, options) {
  options = options || {};
  if (!('contentType' in options)) {
    options['contentType'] = 'text/turtle';
  }

  return RDFstore.serializers[options.contentType].serialize(g._graph);
}

function serializeData(data, fromContentType, toContentType, options) {
  var o = {
    'contentType': fromContentType,
    'subjectURI': options.subjectURI
  };
  return getGraphFromData(data, o).then(
    function(g) {
      return serializeGraph(g, { 'contentType': toContentType });
    },
    function(reason) {
      return Promise.reject(reason);
    }
  );
}


function handleResource(req, res, next){
//  var path = __dirname + req.originalUrl;
//console.log(path);
  switch(req.method){
    case 'GET': case 'HEAD': case 'OPTIONS':
      break;
    case 'POST':
      postContainer(req, res, next);
      // res.end();
      // return next();
      return;
      break;
    default:
      res.status(405);
      res.set('Allow', 'GET, HEAD, OPTIONS');
      res.end();
      return next();
      break;
  }

  if(!requestedType) {
    res.status(406);
    res.end();
    return next();
  }

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

          if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
            res.status(304);
            res.end();
          }

          if(path.startsWith(__dirname + '/queue/')) {
            res.status(200);
            res.send(data);
            res.end();
            deleteResource(path);
          }

          var toContentType = requestedType;
          var options = { 'subjectURI': req.getUrl() };
          var unserializeableCount = 0;

          availableTypes.forEach(function(fromContentType){
            serializeData(data, fromContentType, toContentType, options).then(
              function(transformedData){
                var outputData = (fromContentType != toContentType) ? transformedData : data;

                res.set('Content-Type', requestedType +'; charset=utf-8');
                res.set('Content-Length', Buffer.byteLength(outputData, 'utf-8'));
                res.set('ETag', etag(outputData));
                res.set('Last-Modified', stats.mtime);
                res.set('Vary', 'Origin');
                res.set('Allow', 'GET, HEAD, OPTIONS');

                switch(req.method) {
                  case 'GET': default:
                    res.status(200);
                    res.send(outputData);
                    break;
                  case 'HEAD':
                    res.status(200);
                    res.send();
                    break;
                  case 'OPTIONS':
                    res.status(204);
//                    res.set('Allow', 'GET, HEAD, OPTIONS');
                    res.end();
                    break;
                }

                return next();
              },
              function(reason){
                unserializeableCount++;
                if(availableTypes.length == unserializeableCount) {
                  res.status(500);
                  res.end();
                  return next();
                }
              }
            );
          });
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

        var respond = function() {
          return new Promise(function(resolve, reject) {
            if(requestedType == 'application/ld+json') {
              return resolve(data);
            }
            else {
              var fromContentType = 'application/ld+json';
              var toContentType = requestedType;
              var options = { 'subjectURI': req.getUrl() };
              return serializeData(data, fromContentType, toContentType, options).then(
                function(i) { resolve(i); },
                function(j) { reject(j); }
              );
            }
          });
        };

        respond().then(
          function(data) {
            if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
              res.status(304);
              res.end();
              return next();
            }

            res.set('Content-Type', requestedType + '; charset=utf-8');
            res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
            res.set('ETag', etag(data));
            res.set('Last-Modified', stats.mtime);
            res.set('Vary', 'Origin');
            res.set('Accept-Post', 'application/ld+json, text/turtle');
            res.set('Allow', 'GET, HEAD, OPTIONS, POST');

            switch(req.method) {
              case 'GET': default:
                res.status(200);
                res.send(data);
                break;
              case 'HEAD':
                res.status(200);
                res.send();
                break;
              case 'OPTIONS':
                res.status(204);
                res.end();
                break;
            }
            return next();
          },
          function(reason){
            res.status(500);
            res.end();
            return next();
          }
        );
      });
    }
    return;
  });
}

function postContainer(req, res, next){
  var data = req.rawBody;
  var contentType = req.header('Content-Type');

  if(req.is('application/ld+json') || req.is('text/turtle')) {
    var contentLength = Buffer.byteLength(data, 'utf-8');
    var createRequest = (contentLength < maxPayloadSize) ? true : false;
    var fileName = uuid.v1();

    fs.stat(path, function(error, stats) {
      if(error) {
        res.status(404);
        res.end();
        return next();
      }
//console.log(stats);

      if(createRequest) {
        if(stats.isDirectory()) {
          SimpleRDF.parse(data, contentType, '_:ldn').then(
            function(g) {
              var file = __dirname + '/' + inboxPath + fileName;
//console.log(file);
              fs.appendFile(file, data, function() {
                var url = req.getUrl();
                var base = url.endsWith('/') ? url : url + '/';
                var location = base + fileName;
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
          res.status(405);
          res.set('Allow', 'GET, HEAD, OPTIONS');
          res.end();
          return next();
        }
      }
      else {
        var file = __dirname + '/' + queuePath + fileName;
console.log(file);
        fs.appendFile(file, 'Sorry your request was rejected. This URL will no longer be available.\n', function() {
          res.status(202);
          res.set('Content-Type', 'text/plain; charset=utf-8');
          var location = req.protocol + '://' + req.headers.host + '/queue/' + fileName;
          res.send('Your request is being processed. Check status: ' + location + '\n');
          res.end();
          return;
        });
      }
    });
  }
  else {
    res.status(415);
    res.end();
  }
}

function isWritable(file) {
  try {
    fs.accessSync(file, fs.W_OK);
    return true;
  }
  catch(e) {
    return false;
  }
}

function deleteResource(path){
  if (!path) { return; }

  fs.stat(path, function(error, stats) {
    if (error) {
      res.status(404);
      return next();
    }

    if (stats.isFile()) {
      fs.access(path, fs.W_OK, function(error) {
        if(!error){
          fs.unlink(path, function(error){
            if (error) {
              console.log(error);
            }
            console.log('Delete: ' + path);
          });
        }
      });
    }
    else {
      res.status(404);
      res.end();
    }
  });
}