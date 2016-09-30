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
// var path = require('path');
// var extname = path.extname;
var etag = require('etag');
var uuid = require('node-uuid');
var express = require('express');
var https = require('https');
var http = require('http');
var accepts = require('accepts');
var contentType = require('content-type');
var bodyParser = require('body-parser');
var app = express();
var accept, requestedType;
var availableTypes = ['application/ld+json', 'text/turtle'];
var mayktsoURI = 'https://github.com/csarven/mayktso';

var vocab = {
  "rdftype": { "@id": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "@type": "@id", "@array": true },
  "ldpcontains": { "@id": "http://www.w3.org/ns/ldp#contains", "@type": "@id", "@array": true },
  "ldpinbox": { "@id": "http://www.w3.org/ns/ldp#inbox", "@type": "@id", "@array": true },
  "ldpresource": { "@id": "http://www.w3.org/ns/ldp#Resource", "@type": "@id", "@array": true  },
  "ldpcontainer": { "@id": "http://www.w3.org/ns/ldp#Container", "@type": "@id", "@array": true  }
};


// app.use(compress());

app.use(function(req, res, next) {
  res.header('X-Powered-By', mayktsoURI);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST");
  if(req.header('Origin')) {
    res.header("Access-Control-Allow-Origin", req.header('Origin'));
  }
  else {
    res.header("Access-Control-Allow-Origin", "*");
  }
  res.header("Access-Control-Allow-Headers", "Content-Length, Content-Type, If-None-Match, Link, Location, Origin, Slug, X-Requested-With");
   res.header("Access-Control-Expose-Headers", "Accept-Post, Access-Control-Allow-Headers, Access-Control-Allow-Methods, Access-Control-Allow-Origin, Allow, Content-Length, Content-Type, ETag, Last-Modified, Link, Updates-Via, Vary");
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
    return req.protocol + "://" + req.header('host') + config['basePath'] + req.originalUrl;
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

  // console.log('-----------------');
  console.log(JSON.stringify(req.headers));
  // console.log('req.protocol: ' + req.protocol);
  // console.log('accept.types(): ' + accept.types());
  // console.log('requestedType: ' + requestedType);
  // console.log(req.body);
  // console.log(req.rawBody);
  // console.log('req.baseUrl: ' + req.baseUrl);
  // console.log('req.originalUrl: ' + req.originalUrl);
  // console.log('req.url: ' + req.url);
  // console.log('req.getUrl: ' + req.getUrl());
  // console.log('__dirname + req.originalUrl: ' +  __dirname + req.originalUrl);
  return next();
});

app.route('/').all(getTarget);
app.route('/index.html').all(getTarget);
app.route('/inbox/:id?').all(handleResource);
app.route('/queue/:id').all(handleResource);
app.route('/annotation/:id').all(handleResource);

if (!module.parent) {
  var config;
  fs.readFile(__dirname + '/config.json', 'utf8', function(error, file){
    config = (error) ? {} : JSON.parse(file);
    config['port'] = config.port || 3000;
    config['inboxPath'] = config.inboxPath || 'inbox/';
    config['queuePath'] = config.queuePath || 'queue/';
    config['maxPayloadSize'] = config.maxPayloadSize || 1000;
    config['maxResourceCount'] = config.maxResourceCount || 10;
    config['basePath'] = config.basePath || '';
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
  switch(req.method){
    case 'GET': case 'HEAD': case 'OPTIONS':
      break;
    default:
      res.status(405);
      res.set('Allow', 'GET, HEAD, OPTIONS');
      res.end();
      return next();
      break;
  }

  if(!requestedType && !accept.type(['text/html'])) {
    res.status(406);
    res.end();
    return next();
  }

  fs.stat(path, function(error, stats) {
    if (error) {
      res.status(404);
      return next();
    }

    fs.readFile(__dirname + '/index.html', 'utf8', function(error, data){
      if (error) { console.log(error); }

      if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
        res.status(304);
        res.end();
      }

      baseURI = req.getUrl();
      var s = baseURI.indexOf('index.html');
      if (s >= 0) {
          baseURI = baseURI.substring(0, s);
      }

      var fromContentType = 'text/html';
      var toContentType = requestedType;
      var options = { 'subjectURI': baseURI };

      var sendHeaders = function(outputData, contentType) {
        res.set('Link', '<' + baseURI + inboxPath + '>; rel="http://www.w3.org/ns/ldp#inbox", <http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
        res.set('Content-Type', contentType +';charset=utf-8');
        res.set('Content-Length', Buffer.byteLength(outputData, 'utf-8'));
        res.set('ETag', etag(outputData));
        res.set('Last-Modified', stats.mtime);
        res.set('Vary', 'Origin');
        res.set('Allow', 'GET, HEAD, OPTIONS');
      }

      if(accept.type(['text/html'])){
        sendHeaders(data, 'text/html');
        res.status(200);
        res.send(data);
        return next();
      }
      else {
        serializeData(data, fromContentType, toContentType, options).then(
          function(transformedData){
            switch(toContentType) {
              case 'application/ld+json':
                var x = JSON.parse(transformedData);
                x[0]["@context"] = ["http://www.w3.org/ns/ldp"];
                transformedData = JSON.stringify(x);
                break;
              default:
                break;
            }

            var outputData = (fromContentType != toContentType) ? transformedData : data;
            sendHeaders(outputData, requestedType);

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
      }
    });
  });
}


function handleResource(req, res, next){
//  var path = __dirname + req.originalUrl;
//console.log(path);
  switch(req.method){
    case 'GET': case 'HEAD': case 'OPTIONS':
      break;
    case 'POST':
      return postContainer(req, res, next);
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
          if (error) { console.log(error); }

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

                res.set('Content-Type', requestedType +';charset=utf-8');
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
          contains.push({
            "@id": req.getUrl() + file,
            "@type": [ 'http://www.w3.org/ns/ldp#Resource', 'http://www.w3.org/ns/ldp#RDFSource' ]
          });
        }

//          "@context": "http://www.w3.org/ns/ldp",
        var data = JSON.stringify({
          "@id": req.getUrl(),
          "@type": [ 'http://www.w3.org/ns/ldp#Resource', 'http://www.w3.org/ns/ldp#RDFSource', 'http://www.w3.org/ns/ldp#Container', 'http://www.w3.org/ns/ldp#BasicContainer' ],
          "http://www.w3.org/ns/ldp#contains": contains
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

            res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type", <http://www.w3.org/ns/ldp#Container>; rel="type", <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"');
            res.set('Content-Type', requestedType + ';charset=utf-8');
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
  var mediaType = contentType.parse(req.headers['content-type']).type;

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
            gcDirectory(path);

            var file = path + fileName;
  //console.log(file);
            var url = req.getUrl();
            var base = url.endsWith('/') ? url : url + '/';
            var uri = base + fileName;

            SimpleRDF.parse(data, mediaType, uri).then(
              function(g) {
                fs.appendFile(file, data, function() {
// console.log(uri);
                  res.set('Location', uri);
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
// console.log(file);

        gcDirectory(__dirname + '/' + queuePath);

        fs.appendFile(file, 'Sorry your request was rejected. This URL will no longer be available.\n', function() {
          res.status(202);
          res.set('Content-Language', 'en');
          res.set('Content-Type', 'text/plain;charset=utf-8');
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

function deleteResource(path){
  if (!path) { return; }

  fs.stat(path, function(error, stats) {
    if (error) {
      res.status(404);
      return next();
    }

    if (stats.isFile()) {
      if(isWritable(path)){
        fs.unlink(path, function(error){
          if (error) {
            console.log(error);
          }
console.log('Delete: ' + path);
        });
      }
    }
    else {
      res.status(404);
      res.end();
    }
  });
}

function gcDirectory(path){
  var files = fs.readdirSync(path)
    .filter(function(v){
      return isWritable(path + v);
    })
    .map(function(v) {
      return {
        name:v,
        time:fs.statSync(path + v).mtime.getTime() };
     })
     .sort(function(a, b) { return a.time - b.time; })
     .map(function(v) { return v.name; } );

  if(files.length >= maxResourceCount) {
    var removeFile = path + files[0];
    fs.unlink(removeFile, function(error){
      if (error) {
        console.log(error);
      }
      console.log('To make space, removed: ' + removeFile);
    });
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
    return SimpleRDF(vocab, url, null, RDFstore).get();
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
