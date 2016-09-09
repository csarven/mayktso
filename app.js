var LdpStore = require('rdf-store-ldp/lite')
var SimpleRDF = require('simplerdf')
var RdfaParser = require('rdf-parser-rdfa')
var RdfXmlParser = require('rdf-parser-rdfxml')
var N3Parser = require('rdf-parser-n3')
var SimpleRDFParse = require('simplerdf-parse')

var formats = {parsers: {}}
formats.parsers['application/xhtml+xml'] = RdfaParser
formats.parsers['text/html'] = RdfaParser
formats.parsers['text/turtle'] = N3Parser
formats.parsers['application/rdf+xml'] = RdfXmlParser
var parser = SimpleRDFParse(formats.parsers)

SimpleRDF.parse = parser.parse.bind(parser)

var storeFormats = {parsers:{}}
storeFormats.parsers['text/turtle'] = require('rdf-parser-n3')
storeFormats.parsers['application/ld+json'] = require('rdf-parser-jsonld')
storeFormats.parsers['application/xhtml+xml'] = RdfaParser
storeFormats.parsers['text/html'] = RdfaParser
storeFormats.parsers['application/rdf+xml'] = RdfXmlParser

exports.store = new LdpStore(storeFormats)
exports.SimpleRDF = SimpleRDF

var fs = require('fs');
var path = require('path');
//const url = require('url');
var etag = require('etag');
var extname = path.extname;
var express = require('express');
var bodyParser = require('body-parser');
var app = module.exports = express();
//app.disable('x-powered-by');

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

//TODO: If-None-Match

var rawBodySaver = function (req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}
app.use(bodyParser.raw({ verify: rawBodySaver, type: '*/*' }));
//app.use(bodyParser.json());
//app.use(bodyParser.text());

app.use(function(req, res, next) {
  req.getUrl = function() {
    return req.protocol + "://" + req.get('host') + req.originalUrl;
  }
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

function init(req, res) {
//console.log(req);
//console.log(res);
console.log('----------')
console.log('req.method: ' + req.method);
console.log(req.headers);
console.log('req.body: ')
console.log(req.body);
console.log('req.originalUrl: ' + req.originalUrl);
console.log('req.url: ' + req.url);
console.log('req.getUrl: ' + req.getUrl());

console.log('__dirname + req.originalUrl: ' +  __dirname + req.originalUrl);
}

function getTarget(req, res, next){
  init(req, res);
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
  res.type(contentType);
  res.vary('Accept');
  if(req.method.toLowerCase() == 'get') {
    res.send(data);
  }
}


function getResource(req, res, next){
  init(req, res);
  var path = __dirname + req.originalUrl;

  fs.stat(path, function(error, stats) {
    if (error) {
      res.sendStatus(404);
      return;
    }

    if (stats.isFile()) {
      var isReadable = stats["mode"] & 4 ? true : false;
// //console.log('-- isReadable: ' + isReadable);
      if (isReadable) {
          fs.readFile(path, 'utf8', function(error, data){
            if (error) throw error;

            if (req.headers['if-none-match'] && ('"' + req.headers['if-none-match'] + '"') == etag(data)) {
              return res.sendStatus(304);
            }

            res.status(200);
            res.type('application/ld+json; charset=utf-8');
            res.vary('Accept');
            res.set('ETag', etag(data));

            if(req.method.toLowerCase() == 'head') {
              res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
              res.send();
              return;
            }

            res.send(data);
          });
      }
    }
    else if(stats.isDirectory()) {
      fs.readdir(path, function(error, files){
        if(error) {
          console.log("Can't readdir: " + path); //throw err;
        }

        if(req.method.toLowerCase() == 'get') {
          res.send(data);
          return;
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
        console.log(data);

        res.status(200);
        res.type('application/ld+json; charset=utf-8');
        res.vary('Accept');
        res.send(data);
        return;
      });
    }
  });
}

function postContainer(req, res, next){
  init(req, res);
  res.status = 201;
  console.log(req.rawBody);

//TODO: parse as JSON-LD (or other RDF)
var filename = 'x';
res.set('Content-Location', 'http://localhost:3000/inbox/' + filename);
res.send();
}

