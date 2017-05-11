/** mayktso
 *
 * Sarven Capadisli <info@csarven.ca> http://csarven.ca/#i
 * http://www.apache.org/licenses/LICENSE-2.0.html Apache License, Version 2.0
 * https://github.com/csarven/mayktso
 */

var LdpStore = require('rdf-store-ldp/lite')
var SimpleRDF = require('simplerdf')
var JsonLdParser = require('rdf-parser-jsonld')
var N3Parser = require('rdf-parser-n3')
var RdfaParser = require('rdf-parser-rdfa')
var RdfXmlParser = require('rdf-parser-rdfxml')
var SimpleRDFParse = require('simplerdf-parse')

// local requires
const { getGraph, getGraphFromData, resStatus, serializeData } = require('./src/utils.js');

var handleResource = require('./src/server/middleware/handle-resource.js');

var formats = {parsers: {}}
formats.parsers['application/ld+json'] = JsonLdParser
formats.parsers['text/turtle'] = N3Parser
// formats.parsers['text/n3'] = N3Parser
// formats.parsers['application/n-triples'] = N3Parser
formats.parsers['application/xhtml+xml'] = RdfaParser
formats.parsers['text/html'] = RdfaParser
formats.parsers['application/rdf+xml'] = RdfXmlParser
var parser = SimpleRDFParse(formats.parsers)
SimpleRDF.parse = parser.parse.bind(parser)

var storeFormats = {parsers:{}}
storeFormats.parsers['application/ld+json'] = JsonLdParser
storeFormats.parsers['text/turtle'] = N3Parser
// storeFormats.parsers['text/n3'] = N3Parser
// storeFormats.parsers['application/n-triples'] = N3Parser
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
var XMLHttpRequest = require('xhr2');
//var accepts = require('accepts');
var contentType = require('content-type');
var bodyParser = require('body-parser');

// local requires
var createServer = require('./src/server/index.js').createServer;

var availableTypes = ['application/ld+json', 'text/turtle', 'application/xhtml+xml', 'text/html'];
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
  "owlsameAs": { "@id": "http://www.w3.org/2002/07/owl#sameAs", "@type": "@id", "@array": true }
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
  "schema": "https://schema.org/",
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

function createDir(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
}

function config(configFile){
  var config = getConfigFile(configFile);

  console.log('Applying defaults:');
  config['hostname'] = 'localhost';
  config['port'] = config.port || 3000;
  config['scheme'] = (config.sslKey && config.sslCert) ? 'https' : 'http';
  config['authority'] = config.scheme + '://' + config.hostname + ':' + config.port;
  config['rootPath'] = config.rootPath || ((process.cwd() != __dirname) ? process.cwd() + '/www/' : 'www/');
  config['basePath'] = config.basePath || '';

  // pre-provided resource endpoints
  config['annotationPath'] = config.annotationPath || 'annotation/';
  config['inboxPath'] = config.inboxPath || 'inbox/';
  config['queuePath'] = config.queuePath || 'queue/';
  config['reportsPath'] = config.reportsPath || 'reports/';

  config['maxPayloadSize'] = config.maxPayloadSize || 100000;
  config['maxResourceCount'] = config.maxResourceCount || 100;
  config['proxyURL'] = config.proxyURL || 'https://dokie.li/proxy?uri=';

  // create the `rootPath` directory
  createDir(config['rootPath']);
  // ...all others are relative to `rootPath`
  var createThese = [
    config['annotationPath'], config['inboxPath'], config['queuePath'],
    config['reportsPath']
  ];
  createThese.forEach(function(path) {
    createDir(config['rootPath'] + path);
  });

  // rootPath folder does not contain an index.html file...so we'll copy the
  // default one in.
  if (!fs.existsSync(config.rootPath + 'index.html')
      && fs.existsSync(process.cwd() + '/index.html')) {
    fs.createReadStream(process.cwd() + '/index.html')
      .pipe(fs.createWriteStream(config.rootPath + 'index.html'));
  }

//console.log(config);
  return config;
}

function init(options){
  argv = minimist(process.argv.slice(2));

  if (process.argv.length > 2) {
    processArgs(argv);
  }
  else {
    config = (options && options.config) ? options.config : config();
console.log(config);

    var app = createServer(config);

    app.use(function(req, res, next) {
      res.header('X-Powered-By', mayktsoURI);
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
    app.use(function(req, res, next) {
//      module.exports.accept = accept = accepts(req);
      req.requestedType = req.accepts(availableTypes);
      // remove initial `/` from `originalUrl since `rootPath` has one
      req.requestedPath = config.rootPath + req.originalUrl.substr(1);
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
      // console.log('requestedPath: ' + req.requestedPath);
      return next();
    });

    var oR = (options && options.omitRoutes) ? '|' + options.omitRoutes.join('|') : '';
    var handleRoutes = new RegExp('^(?!/index.html' + oR + ').*$');

    app.route(/^\/(index.html)?$/).all(getTarget);
    app
      .route(handleRoutes)
      .all(handleResource(config, {
        jsonld: {
          profile: 'http://www.w3.org/ns/json-ld#expanded'
        },
        availableTypes: availableTypes
      }));

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
  console.log('    m: mimetype or format; jsonld, turtle');
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
    resStatus(res, 406);
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
        return next();
      }

      var fromContentType = 'text/html';
      var toContentType = req.requestedType;

      var baseURL = getBaseURL(req.getUrl());
      var base = baseURL.endsWith('/') ? baseURL : baseURL + '/';
      var basePath = config.basePath.endsWith('/') ? config.basePath : '';
      var inboxURL = base + basePath + config.inboxPath;

      var sendHeaders = function(outputData, contentType) {
        res.set('Link', '<' + inboxURL + '>; rel="http://www.w3.org/ns/ldp#inbox", <http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type"');
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

  if(availableTypes.indexOf(mediaType) > -1) {
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
    else if(req.headers['slug'] && req.headers['slug'].length > 0 && !req.headers['slug'].match(/\/?\.\.+\/?/g) && !fs.existsSync(req.requestedPath + req.headers['slug'])) {
      fileName = req.headers['slug'];
      pathWriteable = true;
    }
    //XXX: This will let the path to be overwritten.
    else if('id' in req.query && req.query.id.length > 0 && typeof options !== 'undefined' && options.allowSlug){
      fileName = req.query.id;
      pathWriteable = true;
    }
    else {
      fileName = uuid.v1();
      pathWriteable = true;
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
        return next();
      }

      if(createRequest) {
        if(stats.isDirectory() && pathWriteable) {
            SimpleRDF.parse(data, mediaType, uri).then(
              function(g) {
// console.log(g);
                if(g._graph.length > 0) {
                  gcDirectory(basePath);
                  //XXX: At this point we assume that it is okay to overwrite. Should be only for ?id
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
      return next();
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
    default:
      return format;
  }
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

//TODO: clean this up
module.exports = {
getConfigFile,
config,
init,
XMLHttpRequest,
SimpleRDF,
vocab,
prefixes,
prefixesRDFa,
RDFstore,
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
getBaseURL,
getExternalBaseURL,
}
