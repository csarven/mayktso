const fs = require('fs');

const etag = require('etag');

let { getSerialization, resStatus, serializeData } = require('../../utils.js');

const rdfaTypes = ['application/xhtml+xml', 'text/html'];

module.exports = function(config, options) {
  options = options || {};

  return function (req, res, next) {

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
        return next();
        break;
    }

    if(!req.requestedType){
      resStatus(res, 406);
      return next();
    }

    fs.stat(req.requestedPath, function(error, stats) {
      if (error) {
        if(req.method == 'OPTIONS'){
          res.set('Content-Type', 'text/plain');
          res.set('Content-Length', '0');
          res.set('Vary', 'Origin');
          res.set('Allow', 'GET, HEAD, OPTIONS, PUT, POST');
          res.status(204);
          res.end();
        }
        else {
          res.status(404);
        }
        return next();
      }

      if (stats.isFile()) {
        var isReadable = stats.mode & 4 ? true : false;
        if (isReadable) {
          fs.readFile(req.requestedPath, 'utf8', function(error, data){
            if (error) { console.log(error); }

            if (req.headers['if-none-match'] && (req.headers['if-none-match'] == etag(data))) {
              res.status(304);
              res.end();
              return next();
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
              options.availableTypes.forEach(function(fromContentType){
                //XXX: toContentType is application/ld+json because we need to see what is serializable since text/html doesn't have a serializer yet. This is not great because we have to rerun the getSerialization in some cases eg resource is Turtle, fromContentType is text/turtle, toContentType is application/ld+json gives a success but the request is text/turtle so we reuse the requestedType in place of toContentType in the second time around.
                checkSerializations.push(getSerialization(data, fromContentType, 'application/ld+json', serializeOptions, req.requestedType, rdfaTypes));
              });

              return Promise.all(checkSerializations)
                .then((serializations) => {
  // console.log(serializations);
                  //If no successful transformation.
                  if(serializations
                      .map(function(e){return e.result;})
                      .indexOf('pass') < 0){
                    resStatus(res, 406);
                    return next();
                  }
                  else {
                    var responseSent = false;
                    serializations.forEach(function(s){
                      if(s.result == 'pass' && !responseSent){
                        responseSent = true;
                        //XXX: If success was due to resource being HTML return the data as is, otherwise we can't serialize
                        var outputData = (req.requestedType == s.fromContentType) ? data : s.data;
  // console.log(s);
                        if(rdfaTypes.indexOf(req.requestedType) > -1){
                          if(rdfaTypes.indexOf(s.fromContentType) > -1){
                            outputData = data;
                          }
                          else {
                            resStatus(res, 406);
                            return next();
                          }
                        }

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
                            break;
                        }

                        res.end();
                        return next();
                      }
                    });
                  }
                })
                .catch((error) => {
                  console.log('--- catch: `return Promise.all(checkSerializations)` ');
                  console.log(error);
                  res.status(500);
                  res.end();
                  return next();
                });
            }

            doSerializations(data, serializeOptions);
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

          var profile = 'http://www.w3.org/ns/json-ld#expanded';
          var data, nsLDP = '';
          if(typeof options !== 'undefined' && 'jsonld' in options && 'profile' in options.jsonld){
            switch(options.jsonld.profile){
              default:
                profile = 'http://www.w3.org/ns/json-ld#expanded';
                nsLDP = 'http://www.w3.org/ns/ldp#';
                break;
              case 'http://www.w3.org/ns/json-ld#compacted':
                profile = 'http://www.w3.org/ns/json-ld#compacted';
                break;
            }
          }

          var contains = [];
          for (var i = 0; i < files.length; i++) {
            var file = files[i];
            contains.push({
              "@id": baseURL + file,
              "@type": [ nsLDP + 'Resource', nsLDP + 'RDFSource' ]
            });
          }

          var data = {};
          if(profile == 'http://www.w3.org/ns/json-ld#compacted'){
            data["@context"] = 'http://www.w3.org/ns/ldp';
          }
          data = Object.assign(data, {
            "@id": baseURL,
            "@type": [ nsLDP+'Resource', nsLDP+'RDFSource', nsLDP+'Container', nsLDP+'BasicContainer' ]
          });

          if(contains.length > 0) {
            data[nsLDP+'contains'] = contains;
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

                if(rdfaTypes.indexOf(toContentType) > -1){
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
                return next();
              }

              parameterProfile = '';
              if(req.requestedType == 'application/ld+json') {
                parameterProfile = ';profile="'+profile+'"';
              }

              res.set('Link', '<http://www.w3.org/ns/ldp#Resource>; rel="type", <http://www.w3.org/ns/ldp#RDFSource>; rel="type", <http://www.w3.org/ns/ldp#Container>; rel="type", <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"');
              res.set('Content-Type', req.requestedType + ';charset=utf-8' + parameterProfile);
              res.set('Content-Length', Buffer.byteLength(data, 'utf-8'));
              res.set('ETag', etag(data));
              res.set('Last-Modified', stats.mtime);
              res.set('Vary', 'Origin');
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
              return next();
            },
            function(reason){
              if('toContentType' in reason && reason.toContentType == 'text/html'){
                resStatus(res, 406);
              }
              else {
                res.status(500);
                res.end();
              }
              return next();
            }
          );
        });
      }
      return;
    });
  };
};
