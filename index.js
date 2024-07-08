/** mayktso
 *
 * https://github.com/csarven/mayktso
 *
 * Copyright 2016 Sarven Capadisli <info@csarven.ca> http://csarven.ca/#i
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var LdpStore = require('rdf-store-ldp/lite')
var SimpleRDF = require('simplerdf')
var JsonLdParser = require('rdf-parser-jsonld')
var N3Parser = require('rdf-parser-n3')
var RdfaParser = require('rdf-parser-rdfa')
var RdfXmlParser = require('rdf-parser-rdfxml')
var SimpleRDFParse = require('simplerdf-parse')
var request = require('request')

var formats = {parsers: {}}
formats.parsers['application/ld+json'] = JsonLdParser
formats.parsers['text/turtle'] = N3Parser
formats.parsers['text/n3'] = N3Parser
formats.parsers['application/n-triples'] = N3Parser
formats.parsers['application/xhtml+xml'] = RdfaParser
formats.parsers['text/html'] = RdfaParser
formats.parsers['application/rdf+xml'] = RdfXmlParser
var parser = SimpleRDFParse(formats.parsers)
SimpleRDF.parse = parser.parse.bind(parser)

var storeFormats = {parsers:{}}
storeFormats.parsers['application/ld+json'] = JsonLdParser
storeFormats.parsers['text/turtle'] = N3Parser
storeFormats.parsers['text/n3'] = N3Parser
storeFormats.parsers['application/n-triples'] = N3Parser
storeFormats.parsers['application/xhtml+xml'] = RdfaParser
storeFormats.parsers['text/html'] = RdfaParser
// storeFormats.parsers['application/rdf+xml'] = RdfXmlParser
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
var mime = require('mime');
var EventEmitter = require('events');

var acceptRDFTypes = ['application/ld+json', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"', 'text/turtle', 'application/xhtml+xml', 'text/html'];
var acceptRDFaTypes = ['application/xhtml+xml', 'text/html'];
var acceptNonRDFTypes = ['text/css', 'application/javascript', 'image/svg+xml'];
var acceptNonRDFBinaryTypes = ['image/png', 'image/jpeg', 'image/gif'];

var acceptProfiles = ['https://www.w3.org/ns/activitystreams'];

var mayktsoURI = 'https://github.com/csarven/mayktso';

var vocab = {
  "rdftype": { "@id": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "@type": "@id", "@array": true },
  "ldpcontains": { "@id": "http://www.w3.org/ns/ldp#contains", "@type": "@id", "@array": true },
  "ldpinbox": { "@id": "http://www.w3.org/ns/ldp#inbox", "@type": "@id", "@array": true },
  "ldpresource": { "@id": "http://www.w3.org/ns/ldp#Resource", "@type": "@id", "@array": true  },
  "ldpcontainer": { "@id": "http://www.w3.org/ns/ldp#Container", "@type": "@id", "@array": true  },
  "ldpbasiccontainer": { "@id": "http://www.w3.org/ns/ldp#BasicContainer", "@type": "@id", "@array": true  },
  "ldpconstrainedBy": { "@id": "http://www.w3.org/ns/ldp#constrainedBy", "@type": "@id", "@array": true  },
  "rdfsseeAlso": { "@id": "http://www.w3.org/2000/01/rdf-schema#seeAlso", "@type": "@id", "@array": true },
  "foafprimaryTopic": { "@id": "http://xmlns.com/foaf/0.1/primaryTopic", "@type": "@id" },
  "owlsameAs": { "@id": "http://www.w3.org/2002/07/owl#sameAs", "@type": "@id", "@array": true },
  "asannounce": { "@id": "https://www.w3.org/ns/activitystreams#Announce", "@type": "@id", "@array": true  },
  "assubject": { "@id": "https://www.w3.org/ns/activitystreams#subject", "@type": "@id", "@array": true },
  "asobject": { "@id": "https://www.w3.org/ns/activitystreams#object", "@type": "@id", "@array": true },
  "astarget": { "@id": "https://www.w3.org/ns/activitystreams#target", "@type": "@id", "@array": true },
  "asrelationship": { "@id": "https://www.w3.org/ns/activitystreams#relationship", "@type": "@id", "@array": true },
  "ascontext": { "@id": "https://www.w3.org/ns/activitystreams#context", "@type": "@id", "@array": true },
  "asinReplyTo": { "@id": "https://www.w3.org/ns/activitystreams#inReplyTo", "@type": "@id", "@array": true },
  "asactor": { "@id": "https://www.w3.org/ns/activitystreams#actor", "@type": "@id" },
  "asupdated": "https://www.w3.org/ns/activitystreams#updated",
  "aspublished": "https://www.w3.org/ns/activitystreams#published",
  "ascontent": "https://www.w3.org/ns/activitystreams#content",
  "asname": "https://www.w3.org/ns/activitystreams#name",
  "asimage": { "@id": "https://www.w3.org/ns/activitystreams#image", "@type": "@id" },
  "schemalicense": { "@id": "http://schema.org/license", "@type": "@id" }
};

var prefixes = {
  "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
  "owl": "http://www.w3.org/2002/07/owl#",
  "xsd": "http://www.w3.org/2001/XMLSchema#",
  "dcterms": "http://purl.org/dc/terms/",
  "dctypes": "http://purl.org/dc/dcmitype/",
  "foaf": "http://xmlns.com/foaf/0.1/",
  "v": "http://www.w3.org/2006/vcard/ns#",
  "pimspace": "http://www.w3.org/ns/pim/space#",
  "cc": "https://creativecommons.org/ns#",
  "skos": "http://www.w3.org/2004/02/skos/core#",
  "prov": "http://www.w3.org/ns/prov#",
  "qb": "http://purl.org/linked-data/cube#",
  "schema": "http://schema.org/",
  "void": "http://rdfs.org/ns/void#",
  "rsa": "http://www.w3.org/ns/auth/rsa#",
  "cert": "http://www.w3.org/ns/auth/cert#",
  "cal": "http://www.w3.org/2002/12/cal/ical#",
  "wgs": "http://www.w3.org/2003/01/geo/wgs84_pos#",
  "org": "http://www.w3.org/ns/org#",
  "biblio": "http://purl.org/net/biblio#",
  "bibo": "http://purl.org/ontology/bibo/",
  "book": "http://purl.org/NET/book/vocab#",
  "ov": "http://open.vocab.org/terms/",
  "sioc": "http://rdfs.org/sioc/ns#",
  "doap": "http://usefulinc.com/ns/doap#",
  "dbr": "http://dbpedia.org/resource/",
  "dbp": "http://dbpedia.org/property/",
  "sio": "http://semanticscience.org/resource/",
  "opmw": "http://www.opmw.org/ontology/",
  "deo": "http://purl.org/spar/deo/",
  "doco": "http://purl.org/spar/doco/",
  "cito": "http://purl.org/spar/cito/",
  "fabio": "http://purl.org/spar/fabio/",
  "oa": "http://www.w3.org/ns/oa#",
  "as": "https://www.w3.org/ns/activitystreams#",
  "ldp": "http://www.w3.org/ns/ldp#",
  "solid": "http://www.w3.org/ns/solid/terms#",
  "earl": "http://www.w3.org/ns/earl#",
  "ldn": "https://www.w3.org/TR/ldn/#"
}

var prefixesRDFa = Object.keys(prefixes).map(function(i){ return i + ': ' + prefixes[i]; }).join(' ');

var argv;
var app = express();

const eventEmitter = new EventEmitter();

// app.use(compress());

if(!module.parent) {
  init();
}

function getConfigFile(configFile){
  var config = {};
  //TODO: Build/merge config in steps 1) input 2) cwd 3) local to mayktso 4) defaults in config()
  if(configFile && config.length > 0){
    config = require(configFile);
    console.log('Applied: ' + configFile);
  }
  else {
    var processConfigFile = process.cwd() + '/config.json';
    if(fs.existsSync(processConfigFile)){
      config = require(processConfigFile);
      console.log('Applied: ' + processConfigFile);
    }
    else {
      var localConfigFile = __dirname + '/config.json';
      if(fs.existsSync(localConfigFile)){
        config = require(__dirname + '/config.json');
        console.log('Applied: ' + localConfigFile);
      }
    }
  }
  // console.log(config);
  return config;
}

function config(configFile){
  var config = getConfigFile(configFile);

  console.log('Applying defaults:');
  config['hostname'] = 'localhost';
  config['port'] = config.port || 3000;
  config['scheme'] = (config.sslKey && config.sslCert) ? 'https' : 'http';
  config['authority'] = config.scheme + '://' + config.hostname + ':' + config.port;
  config['rootPath'] = config.rootPath || ((process.cwd() != __dirname) ? process.cwd() : '.');
  config['basePath'] = config.basePath || '';
  config['inboxPath'] = config.inboxPath || 'inbox/';
  config['queuePath'] = config.queuePath || 'queue/';
  config['annotationPath'] = config.annotationPath || 'annotation/';
  config['reportsPath'] = config.reportsPath || 'reports/';
  config['maxPayloadSize'] = config.maxPayloadSize || 100000;
  config['maxResourceCount'] = config.maxResourceCount || 100;
  config['maxMemberCount'] = config.maxMemberCount || 10;
  config['proxyPath'] = config.proxyPath || '/proxy';
  config['owners'] = config.owners || '';

  var createDirectories = [config['inboxPath'], config['queuePath'], config['annotationPath'], config['reportsPath']];
  createDirectories.forEach(function(path){ if(!fs.existsSync(path)){ fs.mkdirSync(path); } });

//console.log(config);
  return config;
}

function createServer(config){
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
}

function init(options){
  argv = minimist(process.argv.slice(2));

  if (process.argv.length > 2) {
    processArgs(argv);
  }
  else {
    config = (options && options.config) ? options.config : config();
console.log(config);

    createServer(config);

    app.use(function(req, res, next) {
      res.header('X-Powered-By', mayktsoURI);
      res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST, PUT, OPTIONS");

      var origin = req.header('Origin');
      if(origin) {
        var o = origin.trim().toLowerCase();
        if(o != 'null' && o != 'undefined' && (o.startsWith('http:') || o.startsWith('https:'))) {
          res.header("Access-Control-Allow-Origin", req.header('Origin'));
          res.header("Access-Control-Allow-Credentials", "true");
        }
      }
      else {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Credentials", "true");
      }
      res.header("Access-Control-Allow-Headers", "Accept, Cache-Control, Content-Length, Content-Type, If-None-Match, Link, Location, Origin, Pragma, Slug, X-Requested-With");
      res.header("Access-Control-Expose-Headers", "Accept-Post, Access-Control-Allow-Headers, Access-Control-Allow-Methods, Access-Control-Allow-Origin, Allow, Content-Length, Content-Type, ETag, Last-Modified, Link, Location, Updates-Via, Vary");
      res.set('Vary', 'Origin, Accept-Encoding');
      return next();
    });

    var rawBodySaver = function (req, res, buf, encoding) {
      if (buf && buf.length) {
        try {
          var mediaType = contentType.parse(req.headers['content-type']).type;
          if(mediaType && acceptNonRDFBinaryTypes.indexOf(mediaType) >  -1) {
            req.rawBody = buf;
          }
          else {
            req.rawBody = buf.toString(encoding || 'utf8');
          }

        }
        catch(e) {
          req.rawBody = buf.toString(encoding || 'utf8');
        }
      }
    };
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.raw({ verify: rawBodySaver, type: '*/*', limit: config.maxPayloadSize }));

    app.use(function(req, res, next) {
      req.getRootUrl = function() {
        return req.protocol + "://" + req.header('host') + config.basePath;
      }
      return next();
    });

    app.use(function(req, res, next) {
      req.getUrl = function() {
        return req.getRootUrl() + req.originalUrl;
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
      req.requestedType = req.accepts(acceptRDFTypes);
// console.log(req.requestedType);
      req.requestedType = (req.requestedType) ? req.requestedType.split(';')[0].trim() : req.requestedType;
// console.log(req.requestedType);

      var qPosition = req.originalUrl.indexOf('?');
      req.requestedPath = (qPosition > -1) ? config.rootPath + req.originalUrl.substr(0, qPosition) : config.rootPath + req.originalUrl;

      if(config.owners.length > 0) {
        var lHfV = [];
        config.owners.forEach(function(i){
           lHfV.push('<' + i + '>; rel="http://www.w3.org/ns/solid/terms#owner"');
        });
        req.linkHeaderFieldValueOwners = lHfV.join(', ');
      }

      // console.log(req);
      // console.log(res);

      // console.log('-----------------');
      console.log(JSON.stringify(req.headers));
      // console.log('req.protocol: ' + req.protocol);
      // console.log('accept.types(): ' + accept.types());
      // console.log(req.body);
      // console.log(req.rawBody);
      // console.log('req.baseUrl: ' + req.baseUrl);
      // console.log('req.originalUrl: ' + req.originalUrl);
      // console.log('req.url: ' + req.url);
      // console.log('req.getUrl: ' + req.getUrl());
      // console.log('requestedPath: ' + req.requestedPath);
      // console.log('linkHeaderFieldValueOwners: ' + req.linkHeaderFieldValueOwners)
      return next();
    });

    if(config.proxyPath.length > 0) {
      app.use(config.proxyPath, function(req, res, next){
        switch(req.method){
          case 'GET': case 'HEAD': case 'OPTIONS':
            break;
          default:
            res.status(405);
            res.set('Allow', 'GET, HEAD, OPTIONS');
            res.end();
            return;
            break;
        }

        if(req.query && 'uri' in req.query && req.query.uri.length > 0 && req.query.uri.indexOf(config.hostname) == -1 && req.query.uri.indexOf('127.0.0.1') == -1 && req.query.uri.indexOf('127.0.1.1') == -1 && !req.query.uri.startsWith('localhost') && !req.query.uri.startsWith('192.168.') && !req.query.uri.startsWith('176.16.') && !req.query.uri.startsWith('10.')){
            var rO = {
              'method': req.method,
              'uri': req.query.uri,
              headers: {'Accept': req.headers['accept']}
            };
            request(rO).pipe(res);
        }
        else {
          res.status(400);
          res.set('Allow', 'GET, HEAD, OPTIONS');
          res.end();
          return;
        }
      });
    }

    var oR = (options && options.omitRoutes) ? '|' + options.omitRoutes.join('|') : '';
    var handleRoutes = new RegExp('^(?!/index.html' + oR + ').*$');

    app.route(/^\/(index.html)?$/).all(getTarget);
    app.route(handleRoutes).all(function(req, res, next){
      handleResource(req, res, next, { jsonld: { profile: 'http://www.w3.org/ns/json-ld#expanded' }});
    });

    console.log('process.cwd(): ' + process.cwd());
    console.log('rootPath: ' + config.rootPath);
    console.log('curl -i ' + config.authority);
    console.log('');
  }
  return eventEmitter;
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
  console.log('  * Usage: node index.js [parameter] [options]');
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
  console.log('    m: mimetype or format; jsonld, rdfa, n3, turtle, ntriples');
}


function discoverInbox(url){
  url = url || argv['discoverInbox'];
  if (url.slice(0,4) != 'http') {
    process.exit(1);
  }

  return getEndpoint(vocab['ldpinbox']['@id'], url).then(
    function(i){
      if(argv['discoverInbox']) {
        console.log('Found:');
        console.dir(i);
      }
      return i;
    },
    function(reason){
      if(argv['discoverInbox']){
        console.log('Not Found:');
        console.dir(reason);
      }
      return reason;
    }
  );
}

function getNotificationsArgv(url){
  url = url || argv['getNotifications'];
  if (url.slice(0,4) != 'http') {
    process.exit(1);
  }

  var headers = {};
  headers['Accept'] = ('accept' in argv) ? (formatToMimeType(argv['accept'])) : 'application/ld+json';

  return getResourceHandler(url, headers).then(
    function(data){
      var options = {
        'contentType': headers['Accept'],
        'subjectURI': url
      }

      return getInboxNotifications(data, options).then(
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

          if(argv['getNotifications']){
            var c = JSON.stringify(data) + "\n";
            console.log(c);
          }

          return data;
        },
        function(reason){
          if(argv['getNotifications']){
            console.log('Error:');
            console.log(reason);
          }
          return reason;
        }
      );
    },
    function(reason){
      console.log('Error:');
      console.log(reason);
      return reason;
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
      function(reason){
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
      if ('outputType' in argv && argv['outputType'] !== '' && acceptRDFTypes.indexOf(argv['outputType']) > -1){
        toContentType = argv['outputType'];
      }
      else if('o' in argv && argv['o'] !== ''){
        toContentType = formatToMimeType(argv['o'].toLowerCase());
      }
      else {
        toContentType = headers['Accept'];
      }

      if(acceptRDFaTypes.indexOf(toContentType) > -1) {
        toContentType = 'application/ld+json';
      }

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

  optionsResourceHandler(url, headers).then(
      function(i){
        console.log(i);
        return i;
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
        if(response.xhr.responseText.length > 0){
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
      return;
      break;
  }

  if(!req.requestedType && !req.accepts(['text/html'])) {
    resStatus(res, 406);
    return;
  }

  fs.stat(req.requestedPath, function(error, stats) {
    if (error) {
      res.status(404);
      return;
    }

    fs.readFile(config.rootPath + '/index.html', 'utf8', function(error, data){
      if (error) { console.log(error); }

      if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
        res.status(304);
        res.end();
        return;
      }

      var fromContentType = 'text/html';
      var toContentType = req.requestedType;

      var baseURL = getBaseURL(req.getUrl());
      var base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
      var basePath = config.basePath.endsWith('/') ? config.basePath : '';
      var inboxURL = base + basePath + config.inboxPath;

      var sendHeaders = function(outputData, contentType) {
        res.set('Link', '<' + inboxURL + '>; rel="http://www.w3.org/ns/ldp#inbox", <http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
        responseStorageOwners(req, res);
        res.set('Content-Type', contentType +';charset=utf-8');
        res.set('Content-Length', Buffer.byteLength(outputData, 'utf-8'));
        res.set('ETag', etag(outputData));
        res.set('Last-Modified', stats.mtime);
        res.set('Allow', 'GET, HEAD, OPTIONS');
      }

      if(req.accepts(['text/html'])){
        sendHeaders(data, 'text/html');
        res.status(200);
        res.send(data);
        res.end();
      }
      else {
        var options = { 'subjectURI': base };
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
                break;
            }

            res.end();
          },
          function(reason){
            res.status(500);
            res.end();
            return;
          }
        );
      }
    });
  });
}

function applyParserFixes(data, fromContentType, toContentType) {
  switch(toContentType) {
    case 'text/turtle':
      //XXX: Workaround for rdf-parser-rdfa bug that gives '@langauge' instead of @type when encountering datatype in HTML+RDFa . TODO: Link to bug here
      data = data.replace(/Z"@en;/, 'Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>;');
      data = data.replace(/start> "(\d+)"@en;/, 'start> "$1"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger>;');
      data = data.replace(/end> "(\d+)"@en;/, 'end> "$1"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger>;');
      data = data.replace(/\%2523/, '%23');

      //XXX: Seems to get added when https://schema.org/docs/jsonldcontext.jsonld is used. After using 'http' -> 'https' (for fetching purpose) but then the serializer adds `@prefix 0: <https://schema.org/>` which seems invalid.
      data = data.replace(/^@prefix 0: .*$/gm, '');
      break;

    case 'application/ld+json':
      var x = JSON.parse(data);

      //XXX: Workaround for rdf-parser-rdfa bug that gives '@language' instead of @type when encountering datatype in HTML+RDFa . See also https://github.com/rdf-ext/rdf-parser-rdfa/issues/5
      var properties = ['https://www.w3.org/ns/activitystreams#published', 'https://www.w3.org/ns/activitystreams#updated', 'http://schema.org/dateCreated', 'http://schema.org/datePublished', 'http://schema.org/dateModified', 'http://www.w3.org/ns/oa#start', 'http://www.w3.org/ns/oa#end'];

      for(var i = 0; i < x.length; i++){
        for(var j = 0; j < properties.length; j++){
          if(properties[j] in x[i]) {
            if (properties[j] == 'http://www.w3.org/ns/oa#start' || properties[j] == 'http://www.w3.org/ns/oa#end') {
              x[i][properties[j]] = {
                '@type': 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger',
                '@value': x[i][properties[j]]['@value']
              };
            }
            else {
              x[i][properties[j]] = {
                '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                '@value': x[i][properties[j]]['@value']
              };
            }
          }
        }
      }

      var x = transformJsonldContextURLScheme(x);

      data = JSON.stringify(x);
      break;
  }

  return data;
}


function transformJsonldContextURLScheme(data) {
  // console.log(data)
  if (typeof data["@context"] === "string") {
    data["@context"] = data["@context"].replace(/^http:/, 'https:');
  }
  // else if (typeof data["@context"] === "object") {
  //   for (var key in data["@context"]) {
  //     if (data["@context"].hasOwnProperty(key) && typeof data["@context"][key] === "string") {
  //       data["@context"][key] = data["@context"][key].replace(/^http:/, 'https:');
  //     }
  //   }
  // }
  return data;
}


function getSerialization(data, fromContentType, toContentType, serializeOptions, requestedType) {
// console.log('- - -' + fromContentType + ' ' + toContentType + ' ' + requestedType)
  if(fromContentType == 'application/ld+json'){
    try { JSON.parse(data) }
    catch(error) {
      return Promise.resolve({
        'fromContentType': fromContentType,
        'toContentType': toContentType,
        'result': 'fail',
        'data': error });
    }
  }

  return serializeData(data, fromContentType, toContentType, serializeOptions).then(
    function(transformedData){
      var outputData = (fromContentType == toContentType) ? data : transformedData;
// console.log(outputData);

      //XXX: Temporary workarounds until bugs are resolved upstream
      if(acceptRDFaTypes.indexOf(fromContentType) > -1){
        outputData = applyParserFixes(outputData, fromContentType, toContentType);
      }

      if(requestedType){
        if(requestedType == toContentType || acceptRDFaTypes.indexOf(requestedType) > -1) {
          return {
            'fromContentType': fromContentType,
            'toContentType': toContentType,
            'result': 'pass',
            'data': outputData };
        }
        else {
// console.log('     ' + fromContentType + ' ' + toContentType + ' ' + requestedType)
          return getSerialization(data, fromContentType, requestedType, serializeOptions, requestedType);
        }
      }
      else {
        return {
          'fromContentType': fromContentType,
          'toContentType': toContentType,
          'result': 'pass',
          'data': outputData };
      }
    },
    function(error){
      // console.log(error);
      return Promise.resolve({
        'fromContentType': fromContentType,
        'toContentType': toContentType,
        'result': 'fail',
        'data': error });
    });
}


function handleResource(req, res, next, options){
  options = options || {};
// console.log(options);
  switch(req.method){
    case 'GET': case 'HEAD': case 'OPTIONS':
      break;
    case 'POST': case 'PUT':
      return postContainer(req, res, next, options);
      break;
    default:
      res.status(405);
      res.set('Allow', 'GET, HEAD, OPTIONS');
      res.end();
      return;
      break;
  }

  var requestedPathMimeType = mime.lookup(req.requestedPath);
// console.log(req.requestedType)
// console.log(requestedPathMimeType);
// console.log(req.accepts(requestedPathMimeType));
// console.log(req.accepts(acceptRDFTypes));
// console.log(acceptRDFTypes.indexOf(requestedPathMimeType));
// console.log(acceptRDFTypes.indexOf(req.requestedType));

  if(!req.accepts(requestedPathMimeType) && !req.requestedType){
    resStatus(res, 406);
    return;
  }

  fs.stat(req.requestedPath, function(error, stats) {
    if (error) {
      if(req.method == 'OPTIONS'){
        res.set('Content-Type', 'text/plain');
        res.set('Content-Length', '0');
        res.set('Allow', 'GET, HEAD, OPTIONS, PUT, POST');
        res.status(204);
        res.end();
      }
      else {
        res.status(404);
        res.end();
      }
      return;
    }

    if (stats.isFile()) {
      var isReadable = stats.mode & 4 ? true : false;
      if (isReadable) {
        //TODO: Change this to acceptRDFTypes (RDF) but watch out for application/octet-stream or whatever in req.accepts()
        if (acceptNonRDFTypes.indexOf(requestedPathMimeType) < 0 && acceptNonRDFBinaryTypes.indexOf(requestedPathMimeType) < 0) {
          fs.readFile(req.requestedPath, 'utf8', function(error, data){
            if (error) { console.log(error); }

            if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
              res.status(304);
              res.end();
              return;
            }

            if(req.requestedPath.startsWith(config.rootPath + '/' + config.queuePath)) {
              res.status(200);
              res.send(data);
              res.end();
              deleteResource(req.requestedPath);
            }

            var toContentType = req.requestedType;
            var serializeOptions = { 'subjectURI': req.getUrl() };

            var doSerializations = function(data, serializeOptions){
              var checkSerializations = [];
              acceptRDFTypes.forEach(function(fromContentType){
                //XXX: toContentType is application/ld+json because we need to see what is serializable since text/html doesn't have a serializer yet. This is not great because we have to rerun the getSerialization in some cases eg resource is Turtle, fromContentType is text/turtle, toContentType is application/ld+json gives a success but the request is text/turtle so we reuse the requestedType in place of toContentType in the second time around.
                checkSerializations.push(getSerialization(data, fromContentType, 'application/ld+json', serializeOptions, req.requestedType));
              });

              return Promise.all(checkSerializations)
                .then((serializations) => {
// console.log(serializations);
                  //If no successful transformation.
                  if(serializations
                      .map(function(e){return e.result;})
                      .indexOf('pass') < 0){
                    resStatus(res, 406);
                    return;
                  }
                  else {
                    var responseSent = false;
                    serializations.forEach(function(s){
                      if(s.result == 'pass' && !responseSent){
                        responseSent = true;
                        //XXX: If success was due to resource being HTML return the data as is, otherwise we can't serialize
                        var outputData = (req.requestedType == s.fromContentType) ? data : s.data;
// console.log(s);
                        if(acceptRDFaTypes.indexOf(req.requestedType) > -1){
                          if(acceptRDFaTypes.indexOf(s.fromContentType) > -1){
                            outputData = data;
                          }
                          else {
                            resStatus(res, 406);
                            return;
                          }
                        }

                        res.set('Content-Type', req.requestedType +';charset=utf-8');
                        res.set('Content-Length', Buffer.byteLength(outputData, 'utf-8'));
                        res.set('ETag', etag(outputData));
                        res.set('Last-Modified', stats.mtime);
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
                            break;
                        }

                        res.end();
                        return;
                      }
                    });
                  }
                })
                .catch((error) => {
                  console.log('--- catch: `return Promise.all(checkSerializations)` ');
                  console.log(error);
                  res.status(500);
                  res.end();
                  return;
                });
            }

            doSerializations(data, serializeOptions);
          });
        }
        else {
          var outputData = fs.readFileSync(req.requestedPath);
          res.set('Content-Type', requestedPathMimeType);
          res.set('Content-Length', stats.size);
          res.set('ETag', etag(outputData));
          res.set('Last-Modified', stats.mtime);
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
              break;
          }

          res.end();
          return;
        }
      }
      else {
        res.status(403);
        res.end();
        return;
      }
    }
    else if(stats.isDirectory()) {
      fs.readdir(req.requestedPath, function(error, files){
        if(error) {
          console.log("Can't readdir: " + req.requestedPath); //throw err;
        }

        var baseURL = getBaseURL(req.getUrl());
        baseURL = baseURL.endsWith('/') ? baseURL : baseURL + '/';

        var profile = 'http://www.w3.org/ns/json-ld#expanded';
        if(typeof options !== 'undefined' && 'jsonld' in options && 'profile' in options.jsonld){
          switch(options.jsonld.profile){
            default:
              profile = 'http://www.w3.org/ns/json-ld#expanded';
              break;
            case 'http://www.w3.org/ns/json-ld#compacted':
              profile = 'http://www.w3.org/ns/json-ld#compacted';
              break;
            case 'https://www.w3.org/ns/activitystreams':
              profile = 'https://www.w3.org/ns/activitystreams';
              files
                .map(function(v) {
                  return {
                    name: v,
                    time: fs.statSync(req.requestedPath + v).ctime.getTime()
                  };
                })
                .sort(function(a, b) { return a.time - b.time; })
                .reverse()
                .map(function(v) { return v.name; });
              break;
          }
        }

        //XXX: Super lazy to look up
        if (req.headers['accept'] && (req.headers['accept'].indexOf('profile="https://www.w3.org/ns/activitystreams"') > -1
          || req.headers['accept'].indexOf("profile='https://www.w3.org/ns/activitystreams'") > -1
          || req.headers['accept'].indexOf('profile=https://www.w3.org/ns/activitystreams') > -1)) {
          profile = 'https://www.w3.org/ns/activitystreams';
        }


        var data = {};

        if(profile == 'https://www.w3.org/ns/activitystreams') {
          data["@context"] = 'https://www.w3.org/ns/activitystreams';
        }
        else if(profile == 'http://www.w3.org/ns/json-ld#compacted'){
          data["@context"] = 'http://www.w3.org/ns/ldp';
        }


        var basePath = getBaseURL(req.requestedPath);
        var outputPaging = checkPaging(profile, basePath, config);

        var getContains = function(files, startItem, endItem) {
          var startItem = startItem || 0;
          var endItem = endItem || files.length;

          var contains = [];

          for (var i = startItem; i < endItem; i++) {
            var file = files[i];

            var resourceTypes = [];

            try {
              var f = fs.statSync(req.requestedPath + file);


              //TODO: Check if resource ldp:RDFSource or ldp:NonRDFSource

              if(f.isDirectory()){
                if(profile == 'https://www.w3.org/ns/activitystreams') {
                  resourceTypes = [prefixes['as'] + 'Collection'];
                }
                else {
                  resourceTypes = [prefixes['ldp'] + 'Resource', prefixes['ldp'] + 'Container', prefixes['ldp'] + 'BasicContainer'];
                }

                file = file + '/';
              }
              else {
                if(profile == 'https://www.w3.org/ns/activitystreams') {
                  resourceTypes = [prefixes['as'] + 'Create'];
                }
                else {
                  resourceTypes = [prefixes['ldp'] + 'Resource'];
                }
              }
            }catch(e){ }

            contains.push({
              "@id": baseURL + file,
              "@type": resourceTypes
            });
          }

          return contains;
        }


        if (outputPaging) {
          var applyCollectionPage = ('p' in req.query && req.query.p.length > 0 && typeof parseInt(req.query.p) == 'number') ? true : false

          var totalPages = Math.ceil(files.length / config.maxMemberCount);
          totalPages =  (totalPages < 1) ? 1 : totalPages;

          var first = { '@id': baseURL + '?p=1' }

          var last = { '@id': baseURL + '?p=' + totalPages }

          var includeProperty = prefixes['ldp'] + 'contains';


          if (applyCollectionPage) {
            var p = parseInt(req.query.p);

            if (p < 1 || p > totalPages) {
              res.status(404);
              res.end();
              // storeMeta(req, res, next, Object.assign(options, { "file": file }));
              return;
            }

            var types = [ prefixes['ldp'] + 'Resource', prefixes['ldp'] + 'RDFSource' ];

            if (profile == 'https://www.w3.org/ns/activitystreams') {
              includeProperty = prefixes['as'] + 'items';
              types = [prefixes['as'] + 'CollectionPage'];
            }

            data['@id'] = req.getUrl();
            data['@type'] = types;

            data[prefixes['as'] + 'partOf'] = {
              '@id': baseURL
            }

            if (p > 1) {
              data[prefixes['as'] + 'prev'] = { '@id': baseURL + '?p=' + (p-1) }
            }

            if (p + 1 <= totalPages) {
              data[prefixes['as'] + 'next'] = { '@id': baseURL + '?p=' + (p+1) }
            }

            var startItem = (p == 1) ? 0 : (p - 1) * config.maxMemberCount;
            var endItem = startItem + config.maxMemberCount;
            endItem = (files.length <= endItem) ? files.length : endItem;

            data[prefixes['as'] + 'first'] = first
            data[prefixes['as'] + 'last'] = last

            var contains = getContains(files, startItem, endItem);

            if(contains.length > 0) {
              data[includeProperty] = contains;
            }
          }
          else {
            data['@id'] = baseURL;

            var types = [ prefixes['ldp'] + 'Resource', prefixes['ldp'] + 'RDFSource', prefixes['ldp'] + 'Container', prefixes['ldp'] + 'BasicContainer' ];

            if (profile == 'https://www.w3.org/ns/activitystreams') {
              includeProperty = prefixes['as'] + 'items';
              types = [prefixes['as'] + 'Collection'];
            }

            data['@type'] = types;

            data[prefixes['as'] + 'totalItems'] = files.length;

            data[prefixes['as'] + 'first'] = first
            data[prefixes['as'] + 'last'] = last
          }
        }
        else {
          data['@id'] = baseURL;

          var contains = getContains(files);

          var includeProperty = prefixes['ldp'] + 'contains';

          var types = [ prefixes['ldp'] + 'Resource', prefixes['ldp'] + 'RDFSource', prefixes['ldp'] + 'Container', prefixes['ldp'] + 'BasicContainer' ];

          if (profile == 'https://www.w3.org/ns/activitystreams') {
            includeProperty = prefixes['as'] + 'items';
            types = [prefixes['as'] + 'Collection'];
          }

          data['@type'] = types;

          if(contains.length > 0) {
            data[includeProperty] = contains;
          }
        }



        if(profile == 'http://www.w3.org/ns/json-ld#expanded'){
          data = [data];
        }

        data = JSON.stringify(data) + "\n";

        var respond = function() {
          return new Promise(function(resolve, reject) {
            if(req.method == 'OPTIONS' || req.requestedType == 'application/ld+json') {
              return resolve(data);
            }
            else {
              var fromContentType = 'application/ld+json';
              var toContentType = req.requestedType;
              var serializeOptions = { 'subjectURI': req.getUrl() };

              if(acceptRDFaTypes.indexOf(toContentType) > -1){
                return reject({'toContentType': 'text/html'});
              }
              else {
                //TODO: the resolve/reject should happen at a lower-level.
                return serializeData(data, fromContentType, toContentType, options).then(
                  function(i) { resolve(i); },
                  function(j) { reject(j); }
                );
              }
            }
          });
        };

        respond().then(
          function(data) {
            if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
              res.status(304);
              res.end();
              return;
            }

            parameterProfile = '';
            if(req.requestedType == 'application/ld+json') {
              parameterProfile = ';profile="'+profile+'"';
            }

            responseStorageOwners(req, res);

            // console.log(res)
            res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type", <http://www.w3.org/ns/ldp#Container>; rel="type", <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"');
            res.set('Content-Type', req.requestedType + parameterProfile + ';charset=utf-8');
            res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
            res.set('ETag', etag(data));
            res.set('Last-Modified', stats.mtime);
            res.set('Accept-Post', 'text/html, application/xhtml+xml, application/ld+json, text/turtle');
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
                res.send();
                break;
            }
            res.end();
            return;
          },
          function(reason){
            if('toContentType' in reason && reason.toContentType == 'text/html'){
              resStatus(res, 406);
            }
            else {
              res.status(500);
              res.end();
            }
            return;
          }
        );
      });
    }
    return;
  });
}

function postContainer(req, res, next, options){
  options = options || {};
  options['fileNameSuffix'] = ('fileNameSuffix' in options) ? encodeURIComponent(options['fileNameSuffix']) : '';
  var pathWriteable = false;
  var data = req.rawBody;
  var fileName, file = '';
  var url = req.getUrl();
  var basePath = getBaseURL(req.requestedPath);
  var baseURL = getBaseURL(url);
  var base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
  var lastPath = url.substr(url.lastIndexOf('/') + 1);

  try {
    var mediaType = contentType.parse(req.headers['content-type']).type;
  }
  catch(error) {
    res.status(400);
    res.end();
    if('id' in req.query && req.query.id.length > 0 && typeof options !== 'undefined' && options.allowSlug){
      fileName = req.query.id;
      file = basePath + fileName + options.fileNameSuffix;
    }
    storeMeta(req, res, next, Object.assign(options, { "file": file }));
    return;
  }

  if(req.is('application/ld+json')) {
    try { JSON.parse(data) }
    catch(e) {
      res.status(400);
      res.end();
      if('id' in req.query && req.query.id.length > 0 && typeof options !== 'undefined' && options.allowSlug){
        fileName = req.query.id;
        file = basePath + fileName + options.fileNameSuffix;
      }
      storeMeta(req, res, next, Object.assign(options, { "file": file }));
      return;
    }
  }

  if(acceptRDFTypes.indexOf(mediaType) > -1 || acceptNonRDFTypes.indexOf(mediaType) > -1 || acceptNonRDFBinaryTypes.indexOf(mediaType) > -1) {
    try {
      var contentLength = Buffer.byteLength(data, 'utf-8');
    }
    catch(e) {
      res.status(400);
      res.end();
      if('id' in req.query && req.query.id.length > 0 && typeof options !== 'undefined' && options.allowSlug){
        fileName = req.query.id;
        file = basePath + fileName + options.fileNameSuffix;
      }
      storeMeta(req, res, next, Object.assign(options, { "file": file }));
      return;
    }
    var createRequest = (contentLength < config.maxPayloadSize) ? true : false;

    if(req.method == 'PUT' && lastPath.length > 0 && !lastPath.match(/\/?\.\.+\/?/g) && !fs.existsSync(basePath + lastPath)) {
      fileName = lastPath;
      pathWriteable = true;
    }
    else if(req.headers['slug'] && req.headers['slug'].length > 0 && !req.headers['slug'].match(/\/?\.\.+\/?/g) && !fs.existsSync(req.requestedPath + req.headers['slug']) && isWritable(req.requestedPath)) {
      fileName = req.headers['slug'];
      pathWriteable = true;
    }
    //XXX: This will let the path to be overwritten.
    else if('id' in req.query && req.query.id.length > 0 && typeof options !== 'undefined' && options.allowSlug){
      fileName = req.query.id;
      pathWriteable = true;
    }
    else if(isWritable(req.requestedPath)) {
      fileName = uuid.v1();
      pathWriteable = true;
    }

    if (!pathWriteable) {
      res.status(403);
      res.set('Allow', 'GET, HEAD, OPTIONS');
      res.end();
      return;
    }

    file = basePath + fileName + options.fileNameSuffix;
    var uri = base + fileName + options.fileNameSuffix;

    //XXX: The API does not recommended to use fs.stat before fs.open/readFile/writeFile()
    fs.stat(basePath, function(error, stats) {
      //FIXME: Why is the earlier file variable not available here???
      // console.log(base);
      // console.log(basePath);
      // console.log(fileName);
      // console.log(file);
      // console.log(uri);
      file = basePath + fileName + options.fileNameSuffix;

      if(error) {
        res.status(404);
        res.end();
        storeMeta(req, res, next, Object.assign(options, { "file": file }));
        return;
      }

      if(createRequest) {
        if(stats.isDirectory() && pathWriteable) {
          if(acceptRDFTypes.indexOf(mediaType) > -1) {
            SimpleRDF.parse(data, mediaType, uri).then(
              function(g) {
// console.log(g);
                var s = SimpleRDF(vocab, uri, g, RDFstore).child(uri);
// console.log(s);
                var validDataShape = checkDataShape(s, mediaType, basePath, config);
// console.log(validDataShape);
// console.log(basePath);
                if(validDataShape && g._graph.length > 0) {
                  gcDirectory(basePath);
                  //XXX: At this point we assume that it is okay to overwrite. Should be only for ?id
                  eventEmitter.emit('notification', data, mediaType, 'utf-8');
                  fs.writeFile(file, data, function(x) {
                    // console.log(uri);
                    res.set('Location', uri);
                    res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
                    res.status(201);
                    res.send();
                    res.end();
                    storeMeta(req, res, next, Object.assign(options, { "file": file }));
                    return;
                  });
                }
                else {
                  res.status(400);
                  res.end();
                  storeMeta(req, res, next, Object.assign(options, { "file": file }));
                  return;
                }
              },
              function(reason) {
                res.status(400);
                res.end();
                storeMeta(req, res, next, Object.assign(options, { "file": file }));
                return;
              }
            )
            .catch(function(error){
// console.log(error);
              res.status(400);
              res.end();
              storeMeta(req, res, next, Object.assign(options, { "file": file }));
              return;
            });
          }
          else {
            var encoding = (acceptNonRDFBinaryTypes.indexOf(mediaType) > -1) ? 'binary' : '';
// console.log(file + ' ' + encoding);
            gcDirectory(basePath);
            //XXX: At this point we assume that it is okay to overwrite. Should be only for ?id
            eventEmitter.emit('notification', data, mediaType, encoding);
            fs.writeFile(file, data, encoding, function(x) {
              res.set('Location', uri);
              res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#NonRDFSource>; rel="type"');
              res.status(201);
              res.send();
              res.end();
              storeMeta(req, res, next, Object.assign(options, { "file": file }));
              return;
            });
          }
        }
        else {
          res.status(405);
          res.set('Allow', 'GET, HEAD, OPTIONS');
          res.end();
          storeMeta(req, res, next, Object.assign(options, { "file": file }));
          return;
        }
      }
      else {
        var file = config.rootPath + '/' + config.queuePath + fileName + options.fileNameSuffix;
// console.log(file);

        gcDirectory(config.rootPath + '/' + config.queuePath);

        fs.writeFile(file, 'Sorry your request was rejected. This URL will no longer be available.\n', function() {
          res.status(202);
          res.set('Content-Language', 'en');
          res.set('Content-Type', 'text/plain;charset=utf-8');
          var location = req.protocol + '://' + req.headers.host + config.basePath + '/' + config.queuePath + fileName;

          res.send('Your request is being processed. Check status: ' + location + '\n');
          res.end();
          storeMeta(req, res, next, Object.assign(options, { "file": file }));
          return;
        });
      }
    });
  }
  else {
    res.status(415);
    res.end();
    if('id' in req.query && req.query.id.length > 0 && typeof options !== 'undefined' && options.allowSlug){
      fileName = req.query.id;
      file = basePath + fileName + options.fileNameSuffix;
    }
    storeMeta(req, res, next, Object.assign(options, { "file": file }));
    return;
  }
}

function checkPaging(profile, basePath, options){
  if (typeof profile !== 'undefined' && typeof basePath !== 'undefined' && typeof options !== 'undefined' &&
     'checkPaging' in options && options.checkPaging && options.checkPaging.length > 0){

    for (var i = 0; i < options.checkPaging.length; i++) {
      if(basePath == './' + options.checkPaging[i].uri) {
        return true;
      }
    }
  }

  return false;
}

function checkDataShape(s, mediaType, basePath, options){
  if(typeof options !== 'undefined' && 'checkDataShape' in options && options.checkDataShape && options.checkDataShape.length > 0){

    for (var i = 0; i < options.checkDataShape.length; i++) {
      if(basePath == './' + options.checkDataShape[i].uri) {
        switch(options.checkDataShape[i].uri) {
          case 'inbox/linkedresearch.org/cloud/':
            var types = s.rdftype;
            var resourceTypes = [];
            types.forEach(function(type){
              resourceTypes.push(type.toString());
            });

            if(resourceTypes.indexOf(vocab.asannounce["@id"]) < 0) {
              console.log('checkDataShape as:Announce FAIL');
              return false;
            }
            else if(typeof s.asobject == 'undefined') {
              console.log('checkDataShape s.asobject FAIL: ' + s.asobject);
              return false;
            }
            else if((typeof s.asupdated == 'undefined')){
              console.log('checkDataShape s.asupdated FAIL: ' + s.asupdated);
              return false;
            }
            else if(typeof s.schemalicense == 'undefined' && s.schema.license !== 'https://creativecommons.org/publicdomain/zero/1.0/') {
              console.log('checkDataShape s.schemalicense FAIL: ' + s.schemalicense);
              return false;
            }
            else {
              var asupdated = s.graph().filter(function(t) {
                ///FIXME: This t.object.datatype == rdf:langString is an exception due to a bug in rdf-parser-rdfa / green-turtle perhaps.
                return (t.predicate.nominalValue == vocab.asupdated && t.object.datatype && (t.object.datatype.nominalValue == 'http://www.w3.org/2001/XMLSchema#dateTime' || (acceptRDFaTypes.indexOf(mediaType) > -1 && t.object.datatype == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'))) ? true : false;
              });
              if(asupdated.length == 0) {
                console.log('checkDataShape s.asupdated FAIL: no xsd:dateTime');
                return false;
              }
              else {
                //XXX: We probably shouldn't be doing this regex here. Isn't there a lowerlevel method for it?
                var regexp = /-?(?:[1-9][0-9][0-9][0-9]|0[1-9][0-9][0-9]|00[1-9][0-9]|000[1-9])-[0-9][0-9]-[0-9][0-9]T(?:[0-1][0-9]|2[0-4]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]+)?(?:Z|[+\-][0-9][0-9]:[0-9][0-9])?/
                var re = new RegExp(regexp).exec(asupdated);

                if(re === null) {
                  console.log('checkDataShape s.asupdated FAIL: invalid xsd:dateTime ' + asupdated);
                  return false;
                }
              }
            }
            break;

          default:
            break;
        }
      }
    }

    return true;
  }
  else {
    return true;
  }
}

function responseStorageOwners(req, res, next, options) {
  var rootURL = req.getRootUrl() + '/'
  var requestedURL = req.getUrl()

  if(rootURL === requestedURL) {
    res.append('Link', '<http://www.w3.org/ns/pim/space#Storage>; rel="type"')

    if(config.owners.length > 0) {
      res.append('Link', req.linkHeaderFieldValueOwners)
    }
  }
}

function storeMeta(req, res, next, options){
  if(typeof options !== 'undefined' && 'storeMeta' in options && options.storeMeta && 'file' in options && options.file.length > 0){
// console.log(req)
// console.log(res);
    var data = {
      req: {
        httpVersion: req.httpVersion,
        method: req.method,
        url: req.url,
        query: req.query,
        headers: req.headers,
        rawHeaders: req.rawHeaders,
        rawBody: req.rawBody
      },
      res: {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.header()._headers,
        rawHeaders: res.header()._header
      }
    };
// console.log(res.header());
// console.log(res.header()._header);
// console.log(res.header()._headers);
// console.log(data);
// console.log(JSON.stringify(data));

    if(res.statusCode >= 400 && res.statusCode < 500) {
      deleteFile(options.file);
    }
    fs.writeFile(options.file + '.json', JSON.stringify(data));
  }
}


function deleteResource(path){
  if (!path) { return; }

  fs.stat(path, function(error, stats) {
    if (error) {
      res.status(404);
      res.end();
    }

    if (stats.isFile()) {
      deleteFile(path);
    }
    else {
      res.status(404);
      res.end();
    }
  });
}

function deleteFile(path){
  if(isWritable(path)){
    fs.unlink(path, function(error){
      if (error) {
console.log(error);
      }
console.log('Delete: ' + path);
    });
  }
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

function getExternalBaseURL(url) {
  var baseURL = getBaseURL(url);
  var base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
  var basePath = config.basePath.endsWith('/') ? config.basePath : '';

  return base + basePath;
}


function formatToMimeType(format){
  switch(format){
    case 'jsonld':
      return 'application/ld+json';
    case 'turtle':
      return 'text/turtle';
    case 'n3':
      return 'text/n3';
    case 'ntriples':
      return 'application/n-triples';
    case 'rdfa':
      return 'text/html';
    default:
      return format;
  }
}

//From https://github.com/linkeddata/dokieli/scripts/dokieli.js
function getGraphFromData(data, options) {
  options = options || {};
  if (!('contentType' in options)) {
    options['contentType'] = 'text/turtle';
  }
  if (!('subjectURI' in options)) {
    options['subjectURI'] = '_:dokieli';
  }
  if(acceptRDFTypes.indexOf(options['contentType']) > -1) {
    var mediaType = options['contentType'].split(';')[0].trim();
    return SimpleRDF.parse(data, mediaType, options['subjectURI']);
  }
  else {
    return Promise.reject({'status': '415'});
  }
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

function parseProfileLinkRelation(s) {
  var profile = '';
  var split = s.split(';');
  if(split.length > 1){
    split.forEach(function(x){
      var i = x.trim();
      if(i.startsWith('profile=')){
        profile = i.split('=')[1];
        profile=profile.substr(1, profile.length-1);
      }
    })
  }
  return profile;
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

function preSafe(s) {
  return String(s).replace(/\\"/g, '"').replace(/\\r\\n/g, "\n").replace(/\"/g, '"').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/^\s+|\s+$/g, '');
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
      contentType = contentType || 'text/html;charset=utf-8';
//      var ldpResource = '<http://www.w3.org/ns/ldp#Resource>; rel="type"';
//      links = (links) ? ldpResource + ', ' + links : ldpResource;
      options = options || {};

      return new Promise(function(resolve, reject) {
          var http = new XMLHttpRequest();
          http.open('POST', url);
          http.setRequestHeader('Content-Type', contentType);
          // http.setRequestHeader('Link', links);
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
      contentType = contentType || 'text/html;charset=utf-8';
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

function resStatus(res, status){
  res.status(status);
  switch(status){
    default:
      break;
    case 406:
      var data = "HTTP 406: Accept type not acceptable. See also https://tools.ietf.org/html/rfc7231#section-6.5.6\n";
      break;
  }
  if (typeof data !== 'undefined'){
    res.send(data);
  }
  res.end();
}

//TODO: clean this up
module.exports = {
express,
getConfigFile,
config,
init,
app,

XMLHttpRequest,
SimpleRDF,
vocab,
prefixes,
prefixesRDFa,
RDFstore,
htmlEntities,
preSafe,
discoverInbox,
getInboxNotifications,
getResource,
getResourceHandler,
getResourceHead,
getResourceOptions,
postResource,
putResource,
parseLinkHeader,
parseProfileLinkRelation,
getGraph,
getGraphFromData,
serializeData,
getBaseURL,
getExternalBaseURL,
handleResource,
getSerialization,
resStatus,
}
