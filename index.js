/** mayktso
 *
 * Sarven Capadisli <info@csarven.ca> http://csarven.ca/#i
 * http://www.apache.org/licenses/LICENSE-2.0.html Apache License, Version 2.0
 * https://github.com/csarven/mayktso
 */

var LdpStore = require('rdf-store-ldp/lite')
var SimpleRDF = require('simplerdf')
var N3Parser = require('rdf-parser-n3')
var JsonLdParser = require('rdf-parser-jsonld')
var RdfaParser = require('rdf-parser-rdfa')
var RdfXmlParser = require('rdf-parser-rdfxml')
var SimpleRDFParse = require('simplerdf-parse')

var formats = {parsers: {}}
formats.parsers['text/turtle'] = N3Parser
formats.parsers['application/ld+json'] = JsonLdParser
formats.parsers['application/xhtml+xml'] = RdfaParser
formats.parsers['text/html'] = RdfaParser
formats.parsers['application/rdf+xml'] = RdfXmlParser
var parser = SimpleRDFParse(formats.parsers)
SimpleRDF.parse = parser.parse.bind(parser)

var storeFormats = {parsers:{}}
storeFormats.parsers['text/turtle'] = N3Parser
storeFormats.parsers['application/ld+json'] = JsonLdParser
storeFormats.parsers['application/xhtml+xml'] = RdfaParser
storeFormats.parsers['text/html'] = RdfaParser
storeFormats.parsers['application/rdf+xml'] = RdfXmlParser
RDFstore = new LdpStore(storeFormats)

var fs = require('fs');
var minimist = require('minimist');
// var path = require('path');
// var extname = path.extname;
var etag = require('etag');
var uuid = require('node-uuid');
var express = require('express');
var https = require('https');
var http = require('http');
var XMLHttpRequest = require('xhr2');
//var accepts = require('accepts');
var contentType = require('content-type');
var bodyParser = require('body-parser');

var availableTypes = ['application/ld+json', 'text/turtle'];
var mayktsoURI = 'https://github.com/csarven/mayktso';

var vocab = {
  "rdftype": { "@id": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "@type": "@id", "@array": true },
  "ldpcontains": { "@id": "http://www.w3.org/ns/ldp#contains", "@type": "@id", "@array": true },
  "ldpinbox": { "@id": "http://www.w3.org/ns/ldp#inbox", "@type": "@id", "@array": true },
  "ldpresource": { "@id": "http://www.w3.org/ns/ldp#Resource", "@type": "@id", "@array": true  },
  "ldpcontainer": { "@id": "http://www.w3.org/ns/ldp#Container", "@type": "@id", "@array": true  },
  "ldpbasiccontainer": { "@id": "http://www.w3.org/ns/ldp#BasicContainer", "@type": "@id", "@array": true  },
  "ldpconstrainedBy": { "@id": "http://www.w3.org/ns/ldp#constrainedBy", "@type": "@id", "@array": true  }
};

var argv;
var app = express();

// app.use(compress());

if(!module.parent) {
  init();
}

function config(configFile){
  var config = {};
  if(configFile){
    config = configFile;
  }
  else {
    var localConfigFile = __dirname + '/config.json';
    if(fs.existsSync(localConfigFile)){
      config = localConfigFile;
    }
  }

  config['hostname'] = 'localhost';
  config['port'] = config.port || 3000;
  config['scheme'] = 'http';
  if (config.sslKey && config.sslCert) {
    var options = {
      key: fs.readFileSync(config.sslKey),
      cert: fs.readFileSync(config.sslCert),
      requestCert: false
    };
    https.createServer(options, app).listen(config.port);
    config['scheme'] = 'https';
  }
  else {
    http.createServer(app).listen(config.port);
  }

  config['authority'] = config.scheme + '://' + config.hostname + ':' + config.port;
  config['rootPath'] = config.rootPath || '.';
  config['basePath'] = config.basePath || '';
  config['inboxPath'] = config.inboxPath || 'inbox/';
  config['queuePath'] = config.queuePath || 'queue/';
  config['annotationPath'] = config.annotationPath || 'annotation/';
  config['maxPayloadSize'] = config.maxPayloadSize || 10000;
  config['maxResourceCount'] = config.maxResourceCount || 100;
  config['proxyURL'] = config.proxyURL || 'https://dokie.li/proxy?uri=';

//console.log(config);
  return config;
}

function init(options){
  argv = minimist(process.argv.slice(2));

  if (process.argv.length > 2) {
    processArgs(argv);
  }
  else {
    config = (options && options.configFile) ? config(options.configFile) : config();
console.log(config);

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
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.raw({ verify: rawBodySaver, type: '*/*' }));

    app.use(function(req, res, next) {
      req.getUrl = function() {
        return req.protocol + "://" + req.header('host') + config.basePath + req.originalUrl;
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
//      module.exports.accept = accept = accepts(req);
      req.requestedType = req.accepts(availableTypes);

      req.requestedPath = config.rootPath + req.originalUrl;
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
      // console.log('rootPath + req.originalUrl: ' +  rootPath + req.originalUrl);
      return next();
    });

    app.route('/').all(getTarget);
    app.route('/index.html').all(getTarget);
    app.route('/' + config.inboxPath + ':id?').all(handleResource);
    app.route('/' + config.queuePath + ':id').all(handleResource);
    app.route('/' + config.annotationPath + '/:id?').all(handleResource);

//console.log(app);

    console.log('process.cwd(): ' + process.cwd());
    console.log('rootPath: ' + config.rootPath);
    console.log('curl -i ' + config.authority);
    console.log('');
  }
}


function processArgs(argv){
  console.log(argv);
  if('help' in argv) {
    help();
  }

  else if('discoverInbox' in argv){
    discoverInbox(argv['discoverInbox']);
  }
  else if ('getNotifications' in argv){
    getNotificationsArgv(argv['getNotifications']);
  }
  else if ('get' in argv){
    getResourceArgv(argv['get']);
  }
  else if ('post' in argv){
    postResourceArgv(argv['post']);
  }
  else if ('put' in argv){
    putResourceArgv(argv['put']);
  }
  else if ('head' in argv){
    headResourceArgv(argv['head']);
  }
  else if ('options' in argv){
    optionsResourceArgv(argv['options']);
  }
  else {
    help();
  }
}

function help() {
  console.log('mayktso: ' + mayktsoURI);
  console.log('  * Running without parameter/option starts server, otherwise:');
  console.log('  * Usage: node app.js [parameter] [options]');
  console.log('    [parameter]');
  console.log('    --help');
  console.log("    --discoverInbox <URI>        Discover a target's Inbox");
  console.log("    --getNotifications <URI>     Get the notifications contained in an Inbox");
  console.log("    --head <URI>                 Headers of a URI");
  console.log('    --options <URI>              Check the options of a URI');
  console.log('    --get <URI> [options]        Dereference a resource to RDF');
  console.log('    --post <URI> [options]       Send notification to Inbox');
  console.log('    --put <URI> [options]        Store data under a URI');
  console.log('    [options]');
  console.log('    --accept (m, default: application/ld+json)');
  console.log('    --contentType (m, default: application/ld+json)');
  console.log('    --slug string');
  console.log('    -d, --data <data>');
  console.log('    -o, --outputType (m, default: application/ld+json)');
  console.log('    m: mimetype or format; jsonld, turtle');
}


function discoverInbox(url){
  url = url || argv['discoverInbox'];
  if (url.slice(0,4) != 'http') {
    process.exit(1);
  }

  getEndpoint(vocab['ldpinbox']['@id'], url).then(
    function(i){
      console.log('Found:');
      console.dir(i);
    },
    function(reason){
      console.log('Not Found:');
      console.dir(reason);
    }
  );
}

function getNotificationsArgv(url){
  url = url || argv['getInbox'];
  if (url.slice(0,4) != 'http') {
    process.exit(1);
  }

  var headers = {};
  headers['Accept'] = ('accept' in argv) ? (formatToMimeType(argv['accept'])) : 'application/ld+json';

  getResourceHandler(url, headers).then(
    function(data){
      var options = {
        'contentType': headers['Accept'],
        'subjectURI': url
      }

      getInboxNotifications(data, options).then(
        function(notifications){
          var contains = [];
          for (var i = 0; i < notifications.length; i++) {
            contains.push({
              "@id": notifications[i]
            });
          }

          var data = {
            "@id": url,
            "@type": [ 'http://www.w3.org/ns/ldp#Resource', 'http://www.w3.org/ns/ldp#RDFSource', 'http://www.w3.org/ns/ldp#Container', 'http://www.w3.org/ns/ldp#BasicContainer' ]
          };

          if (contains.length > 0) {
            data['http://www.w3.org/ns/ldp#contains'] = contains;
          }

          data = JSON.stringify(data) + "\n";

          console.log(data);
        },
        function(reason){
          console.log('Error:');
          console.log(reason);
        }
      );
    },
    function(reason){
      console.log('Error:');
      console.log(reason);
    }
  );
}

function getResourceArgv(url){
  url = url || argv['get'];
  if (url.slice(0,4) != 'http') {
    process.exit(1);
  }

  var headers = {};
  headers['Accept'] = ('accept' in argv) ? (formatToMimeType(argv['accept'])) : 'application/ld+json';

  getResourceHandler(url, headers).then(
      function(i){
        console.log(i);
      },
      function(){
        console.log('Error:');
        console.log(reason);
      }
  );
}

function getResourceHandler(url, headers){
  var pIRI = getProxyableIRI(url);

  headers = headers || {};

  return getResource(pIRI, headers).then(
    function(response){
      console.log(response.xhr.getAllResponseHeaders());
      console.log('');
      var data = response.xhr.responseText;

      var toContentType;
      if ('outputType' in argv && argv['outputType'] !== '' && (argv['o'] == 'text/turtle' || argv['o'] == 'application/ld+json')){
        toContentType = argv['outputType'];
      }
      else if('o' in argv && argv['o'].length > 0 && (argv['o'] == 'text/turtle' || argv['o'] == 'application/ld+json')){
        toContentType = argv['o'];
      }
      else {
        toContentType = headers['Accept'];
      }

      toContentType = formatToMimeType(toContentType.toLowerCase());

      var options = { 'subjectURI': url };

      if(headers['Accept'] != toContentType) {
        return serializeData(data, headers['Accept'], toContentType, options);
      }
      else {
        return data;
      }
    },
    function(reason){
      return reason;
    }
  );
}

function headResourceArgv(url){
  url = url || argv['head'];
  if (url.slice(0,4) != 'http') {
    process.exit(1);
  }

  var headers = {};
  headers['Accept'] = ('accept' in argv) ? (formatToMimeType(argv['accept'])) : 'application/ld+json';

  headResourceHandler(url, headers).then(
      function(i){
        console.log(i);
      },
      function(){
        console.log('Error:');
        console.log(reason);
      }
  );
}

function headResourceHandler(url, headers){
  var pIRI = getProxyableIRI(url);

  headers = headers || {};

  return getResourceHead(pIRI, headers).then(
    function(response){
      console.log(response.xhr.getAllResponseHeaders());
      var data = '';
      if(response.xhr.responseText.length > 0) {
        data = "\n" + response.xhr.responseText;
      }
      return data;
    },
    function(reason){
      return reason;
    }
  );
}

function optionsResourceArgv(url){
  url = url || argv['head'];
  if (url.slice(0,4) != 'http') {
    process.exit(1);
  }

  var headers = {};
  headers['Accept'] = ('accept' in argv) ? (formatToMimeType(argv['accept'])) : 'application/ld+json';
  if('acceptPost' in argv) {
    headers['Accept-Post'] = argv['acceptPost'];
  }

  headResourceHandler(url, headers).then(
      function(i){
        console.log(i);
      },
      function(){
        console.log('Error:');
        console.log(reason);
      }
  );
}

function optionsResourceHandler(url, headers){
  var pIRI = getProxyableIRI(url);

  headers = headers || {};

  return getResourceOptions(pIRI, headers).then(
    function(response){
      console.log(response.xhr.getAllResponseHeaders());
      var data = '';
      if(response.xhr.responseText.length > 0) {
        data = "\n" + response.xhr.responseText;
      }
      return data;
    },
    function(reason){
      return reason;
    }
  );
}

function postResourceArgv(url){
  url = url || argv['post'];
  if (url.slice(0,4) != 'http') {
    process.exit(1);
  }
  var pIRI = getProxyableIRI(url);

  var headers = {};
  headers['Slug'] = ('slug' in argv) ? argv['slug'] : '';
  headers['Content-Type'] = ('contentType' in argv) ? formatToMimeType(argv['contentType']) : 'application/ld+json';

  var data;
  if ('data' in argv && argv['data'] !== ''){
    data = argv['data'];
  }
  else if('d' in argv && argv['d'] !== ''){
    data = argv['d'];
  }

  if(data){
    postResource(pIRI, headers['Slug'], data, headers['Content-Type']).then(
      function(response){
//        console.log(response.xhr);
        console.log('HTTP/1.1 ' + response.xhr.status + ' ' + response.xhr.statusText);
        console.log(response.xhr.getAllResponseHeaders());
        console.log('');
        if(response.xhr.responseText.lenth > 0){
          console.log(response.xhr.responseText);
        }
      },
      function(reason){
        console.log('Not Found:');
        console.dir(reason);
      }
    );
  }
  else {
    console.log('Missing payload. Include -d or --data.');
  }
}

function putResourceArgv(url){
  url = url || argv['put'];
  if (url.slice(0,4) != 'http') {
    process.exit(1);
  }
  var pIRI = getProxyableIRI(url);

  var headers = {};
  headers['Content-Type'] = ('contentType' in argv) ? formatToMimeType(argv['contentType']) : 'application/ld+json';

  var data;
  if ('data' in argv && argv['data'] !== ''){
    data = argv['data'];
  }
  else if('d' in argv && argv['d'] !== ''){
    data = argv['d'];
  }

  if(data){
    putResource(pIRI, data, headers['Content-Type']).then(
      function(response){
//        console.log(response.xhr);
        console.log('HTTP/1.1 ' + response.xhr.status + ' ' + response.xhr.statusText);
        console.log(response.xhr.getAllResponseHeaders());
        console.log('');
        if(response.xhr.responseText.lenth > 0){
          console.log(response.xhr.responseText);
        }
      },
      function(reason){
        console.log('Not Found:');
        console.dir(reason);
      }
    );
  }
  else {
    console.log('Missing payload. Include -d or --data.');
  }
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

  if(!req.requestedType && !req.accepts(['text/html'])) {
    res.status(406);
    res.end();
    return next();
  }

  fs.stat(req.requestedPath, function(error, stats) {
    if (error) {
      res.status(404);
      return next();
    }

    fs.readFile(config.rootPath + '/index.html', 'utf8', function(error, data){
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
      var toContentType = req.requestedType;
      var options = { 'subjectURI': baseURI };

      var sendHeaders = function(outputData, contentType) {
        res.set('Link', '<' + baseURI + config.basePath + "/" + config.inboxPath + '>; rel="http://www.w3.org/ns/ldp#inbox", <http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
        res.set('Content-Type', contentType +';charset=utf-8');
        res.set('Content-Length', Buffer.byteLength(outputData, 'utf-8'));
        res.set('ETag', etag(outputData));
        res.set('Last-Modified', stats.mtime);
        res.set('Vary', 'Origin');
        res.set('Allow', 'GET, HEAD, OPTIONS');
      }

      if(req.accepts(['text/html'])){
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
            sendHeaders(outputData, req.requestedType);

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
    case 'POST': case 'PUT':
      return postContainer(req, res, next);
      break;
    default:
      res.status(405);
      res.set('Allow', 'GET, HEAD, OPTIONS');
      res.end();
      return next();
      break;
  }

  if(!req.requestedType) {
    res.status(406);
    res.end();
    return next();
  }

  fs.stat(req.requestedPath, function(error, stats) {
    if (error) {
      res.status(404);
      return next();
    }

    if (stats.isFile()) {
      var isReadable = stats.mode & 4 ? true : false;
// //console.log('-- isReadable: ' + isReadable);
      if (isReadable) {
        fs.readFile(req.requestedPath, 'utf8', function(error, data){
          if (error) { console.log(error); }

          if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
            res.status(304);
            res.end();
          }

          if(req.requestedPath.startsWith(config.rootPath + '/' + config.queuePath)) {
            res.status(200);
            res.send(data);
            res.end();
            deleteResource(req.requestedPath);
          }

          var toContentType = req.requestedType;
          var options = { 'subjectURI': req.getUrl() };
          var unserializeableCount = 0;

          availableTypes.forEach(function(fromContentType){
            serializeData(data, fromContentType, toContentType, options).then(
              function(transformedData){
                var outputData = (fromContentType != toContentType) ? transformedData : data;

                res.set('Content-Type', req.requestedType +';charset=utf-8');
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
      fs.readdir(req.requestedPath, function(error, files){
        if(error) {
          console.log("Can't readdir: " + req.requestedPath); //throw err;
        }

        var baseURL = req.getUrl().endsWith('/') ? req.getUrl() : req.getUrl() + '/';

        var contains = [];
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          contains.push({
            "@id": baseURL + file,
            "@type": [ 'http://www.w3.org/ns/ldp#Resource', 'http://www.w3.org/ns/ldp#RDFSource' ]
          });
        }

//          "@context": "http://www.w3.org/ns/ldp",
        var data = {
          "@id": baseURL,
          "@type": [ 'http://www.w3.org/ns/ldp#Resource', 'http://www.w3.org/ns/ldp#RDFSource', 'http://www.w3.org/ns/ldp#Container', 'http://www.w3.org/ns/ldp#BasicContainer' ]
        };

        if(contains.length > 0) {
          data['http://www.w3.org/ns/ldp#contains'] = contains;
        }

        data = JSON.stringify(data) + "\n";

        var respond = function() {
          return new Promise(function(resolve, reject) {
            if(req.requestedType == 'application/ld+json') {
              return resolve(data);
            }
            else {
              var fromContentType = 'application/ld+json';
              var toContentType = req.requestedType;
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
            res.set('Content-Type', req.requestedType + ';charset=utf-8');
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
    var createRequest = (contentLength < config.maxPayloadSize) ? true : false;
    var url = req.getUrl();
    var basePath = getBaseURL(req.requestedPath);
    var baseURL = getBaseURL(url);

    var fileName;
    var lastPath = url.substr(url.lastIndexOf('/') + 1);

    if(req.method == 'PUT' && lastPath.length > 0 && !lastPath.match(/\/?\.\.+\/?/g) && !fileExists(path)) {
      fileName = lastPath;
    }
    else if(req.headers['slug'] && req.headers['slug'].length > 0 && !req.headers['slug'].match(/\/?\.\.+\/?/g) && !fileExists(req.requestedPath + req.headers['slug'])) {
      fileName = req.headers['slug'];
    }
    else {
      fileName = uuid.v1();
    }

    fs.stat(basePath, function(error, stats) {
      if(error) {
        res.status(404);
        res.end();
        return next();
      }
//console.log(stats);

      if(createRequest) {
        if(stats.isDirectory()) {
            var file = basePath + fileName;
            var base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
            var uri = base + fileName;

            SimpleRDF.parse(data, mediaType, uri).then(
              function(g) {
                gcDirectory(basePath);
                fs.appendFile(file, data, function(x) {
// console.log(uri);
                  res.set('Location', uri);
                  res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
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
            )
            .catch(function(Error){
console.log('---- catch');
console.log(error);
            });
        }
        else {
          res.status(405);
          res.set('Allow', 'GET, HEAD, OPTIONS');
          res.end();
          return next();
        }
      }
      else {
        var file = config.rootPath + '/' + config.queuePath + fileName;
// console.log(file);

        gcDirectory(config.rootPath + '/' + config.queuePath);

        fs.appendFile(file, 'Sorry your request was rejected. This URL will no longer be available.\n', function() {
          res.status(202);
          res.set('Content-Language', 'en');
          res.set('Content-Type', 'text/plain;charset=utf-8');
          var location = req.protocol + '://' + req.headers.host + config.basePath + '/' + config.queuePath + fileName;

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

  if(files.length >= config.maxResourceCount) {
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

function fileExists(filepath){
  var flag = true;
  try{
    fs.accessSync(filepath, fs.F_OK);
  }catch(e){
    flag = false;
  }
  return flag;
}

function getBaseURL(url) {
  if(typeof url === 'string') {
      url = url.substr(0, url.lastIndexOf('/') + 1);
  }

  return url;
}

function formatToMimeType(format){
  switch(format){
    case 'jsonld':
      return 'application/ld+json';
    case 'turtle':
      return 'text/turtle';
    default:
      return format;
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

//https://github.com/solid/solid.js/blob/master/lib/util/web-util.js
function parseLinkHeader(link) {
  if (!link) {
      return {}
  }
  var linkexp = /<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g;
  var paramexp = /[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g;
  var matches = link.match(linkexp);
  var rels = {};
  for (var i = 0; i < matches.length; i++) {
      var split = matches[i].split('>');
      var href = split[0].substring(1);
      var ps = split[1];
      var s = ps.match(paramexp);
      for (var j = 0; j < s.length; j++) {
          var p = s[j];
          var paramsplit = p.split('=');
          var name = paramsplit[0];
          var rel = paramsplit[1].replace(/["']/g, '');
          if (!rels[rel]) {
              rels[rel] = []
          }
          rels[rel].push(href)
          if (rels[rel].length > 1) {
              rels[rel].sort()
          }
      }
  }
  return rels;
}

function encodeString(string) {
  return encodeURIComponent(string).replace(/'/g,"%27").replace(/"/g,"%22");
}

function decodeString(string) {
  return decodeURIComponent(string.replace(/\+/g,  " "));
}

function htmlEntities(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getProxyableIRI(url) {
  var pIRI = stripFragmentFromString(url);
  if (typeof document !== 'undefined' && document.location.protocol == 'https:' && pIRI.slice(0, 5).toLowerCase() == 'http:') {
      pIRI = config.proxyURL + encodeString(pIRI);
  }
  return pIRI;
}

function stripFragmentFromString(string) {
  if (typeof string === "string") {
      var stringIndexFragment = string.indexOf('#');

      if (stringIndexFragment >= 0) {
          string = string.substring(0, stringIndexFragment);
      }
  }
  return string;
}

function postResource(url, slug, data, contentType, links, options) {
  if (url && url.length > 0) {
      contentType = contentType || 'text/html; charset=utf-8';
      var ldpResource = '<http://www.w3.org/ns/ldp#Resource>; rel="type"';
      links = (links) ? ldpResource + ', ' + links : ldpResource;
      options = options || {};

      return new Promise(function(resolve, reject) {
          var http = new XMLHttpRequest();
          http.open('POST', url);
          http.setRequestHeader('Content-Type', contentType);
          http.setRequestHeader('Link', links);
          if (slug && slug.length > 0) {
              http.setRequestHeader('Slug', slug);
          }
          // if (!options.noCredentials) {
          //     http.withCredentials = true;
          // }
          http.onreadystatechange = function() {
              if (this.readyState == this.DONE) {
                  if (this.status === 200 || this.status === 201 || this.status === 202 || this.status === 204) {
                      return resolve({xhr: this});
                  }
                  return reject({status: this.status, xhr: this});
              }
          };
          http.send(data);
      });
  }
  else {
      return Promise.reject({'message': 'url parameter not valid'});
  }
}

function putResource(url, data, contentType, links, options) {
  if (url && url.length > 0) {
      contentType = contentType || 'text/html; charset=utf-8';
      var ldpResource = '<http://www.w3.org/ns/ldp#Resource>; rel="type"';
      links = (links) ? ldpResource + ', ' + links : ldpResource;
      options = options || {};

      return new Promise(function(resolve, reject) {
          var http = new XMLHttpRequest();
          http.open('PUT', url);
          http.setRequestHeader('Content-Type', contentType);
          http.setRequestHeader('Link', links);
          // if (!options.noCredentials) {
          //     http.withCredentials = true;
          // }
          http.onreadystatechange = function() {
              if (this.readyState == this.DONE) {
                  if (this.status === 200 || this.status === 201 || this.status === 204) {
                      return resolve({xhr: this});
                  }
                  return reject({status: this.status, xhr: this});
              }
          };
          http.send(data);
      });
  }
  else {
      return Promise.reject({'message': 'url parameter not valid'});
  }
}

function getResource(url, headers) {
  url = url || window.location.origin + window.location.pathname;
  headers = headers || {};
  if(typeof headers['Accept'] == 'undefined') {
      headers['Accept'] = 'application/ld+json';
  }

  return new Promise(function(resolve, reject) {
      var http = new XMLHttpRequest();
      http.open('GET', url);
      Object.keys(headers).forEach(function(key) {
          http.setRequestHeader(key, headers[key]);
      });
//      http.withCredentials = true;
      http.onreadystatechange = function() {
          if (this.readyState == this.DONE) {
              if (this.status === 200) {
                  return resolve({xhr: this});
              }
              return reject({status: this.status, xhr: this});
          }
      };
      http.send();
  });
}

function getResourceOptions(url, headers) {
  url = url || window.location.origin + window.location.pathname;
  headers = headers || {};
  if(typeof headers['Accept'] == 'undefined') {
      headers['Accept'] = 'application/ld+json';
  }

  return new Promise(function(resolve, reject) {
      var http = new XMLHttpRequest();
      http.open('OPTIONS', url);
      Object.keys(headers).forEach(function(key) {
          http.setRequestHeader(key, headers[key]);
      });
      // http.withCredentials = true;
      http.onreadystatechange = function() {
          if (this.readyState == this.DONE) {
              if (this.status === 200 || this.status === 204) {
                  return resolve({xhr: this});
              }
              return reject({status: this.status, xhr: this});
          }
      };
      http.onerror = function () {
          return reject({status: this.status, xhr: this});
      }
      http.send();
  });
}

function getResponseHeaderValue(response, header) {
  return new Promise(function(resolve, reject) {
    if(response.xhr.getResponseHeader(header)) {
      return resolve({'headers': response.xhr.getResponseHeader(header)});
    }
    else {
      return reject({'message': "'" + header + "' header not found"});
    }
  });
}

function getResourceHead(url, headers) {
  url = url || ((typeof window !== 'undefined') ? window.location.origin + window.location.pathname : '');
  headers = headers || {};
  if(typeof headers['Accept'] == 'undefined') {
      headers['Accept'] = 'application/ld+json';
  }

  return new Promise(function(resolve, reject) {
      var http = new XMLHttpRequest();
      http.open('HEAD', url);
      Object.keys(headers).forEach(function(key) {
          http.setRequestHeader(key, headers[key]);
      });
//      http.withCredentials = true;
      http.onreadystatechange = function() {
          if (this.readyState == this.DONE) {
              if (this.status === 200) {
                  return resolve({xhr: this});
              }
              return reject({status: this.status, xhr: this});
          }
      };
      http.send();
  });
}

function getEndpoint(property, url) {
  if (url) {
      return getEndpointFromHead(property, url).then(
          function(i){
              return i;
          },
          function(x){
console.log(x);
              return getEndpointFromRDF(property, url);
          }
      );
  }
}

function getEndpointFromHead(property, url) {
  var pIRI = getProxyableIRI(url);
  console.log('HEAD ' + pIRI);

  return getResourceHead(pIRI)
    .then(function(response){
      return getResponseHeaderValue(response, 'Link')
    })
    .then(
      function(i){
          var linkHeaders = parseLinkHeader(i.headers);
console.log('  Checking for ' + property);
          if (property in linkHeaders) {
              return linkHeaders[property];
          }
          else if (property == 'http://www.w3.org/ns/ldp#inbox' && 'http://www.w3.org/ns/solid/terms#inbox' in linkHeaders) {
              return linkHeaders['http://www.w3.org/ns/solid/terms#inbox'];
          }
          return Promise.reject({'message': property + " endpoint was not found in 'Link' header"});
      },
      function(reason){
          return Promise.reject({'message': "'Link' header not found"});
      }
    );
}

function getEndpointFromRDF(property, url, subjectIRI) {
  url = url || window.location.origin + window.location.pathname;
  subjectIRI = subjectIRI || url;
  var pIRI = getProxyableIRI(url);

console.log('GET ' + pIRI);

  //FIXME: This doesn't work so well if the document's URL is different than input url
  return getGraph(pIRI)
      .then(
          function(i) {
              var s = i.child(subjectIRI);
//console.log(s.toString());
//console.log(s.ldpinbox);
console.log('  Checking ' + subjectIRI + ' for ' + property);
              switch(property) {
                  case vocab['ldpinbox']['@id']:
                      if (s.ldpinbox._array.length > 0){
                          return [s.ldpinbox._array[0]];
                      }
                      break;
              }

              var reason = {"message": property + " endpoint was not found in message body"};
              return Promise.reject(reason);
          },
          function(reason) {
console.log(reason);
              return reason;
          }
      );
}


function getInboxNotifications(data, options) {
  return getGraphFromData(data, options).then(
    function(i) {
        var s = SimpleRDF(vocab, options['subjectURI'], i, RDFstore).child(options['subjectURI']);

        var notifications = [];
        s.ldpcontains.forEach(function(resource) {
            resource = resource.toString();
// console.log(resource);
            var types = s.child(resource).rdftype;
// console.log(types);
            var resourceTypes = [];
            types.forEach(function(type){
                resourceTypes.push(type.toString());
// console.log(type);
            });

            if(resourceTypes.indexOf(vocab.ldpcontainer["@id"]) < 0) {
                notifications.push(resource);
            }
        });
// console.log(notifications);
        if (notifications.length > 0) {
            return notifications;
        }
        else {
            var reason = {"message": "There are no notifications."};
            return Promise.reject(reason);
        }
    },
    function(reason) {
        console.log(reason);
        return reason;
    }
  );
}


module.exports = {
config,
init,
app,

SimpleRDF,
vocab,
htmlEntities,
discoverInbox,
getInboxNotifications,
getResource,
getResourceHandler,
getResourceHead,
getResourceOptions,
postResource,
putResource,
parseLinkHeader,
getGraphFromData
}