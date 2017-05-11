const SimpleRDF = require('simplerdf');

exports.htmlEntities = function(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
exports.getGraphFromData = getGraphFromData;

function getGraph(url) {
    return SimpleRDF(vocab, url, null, RDFstore).get();
}
exports.getGraph = getGraph;

function serializeGraph(g, options) {
  options = options || {};
  if (!('contentType' in options)) {
    options['contentType'] = 'text/turtle';
  }

  return RDFstore.serializers[options.contentType].serialize(g._graph);
}
exports.serializeGraph = serializeGraph;

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
};
exports.serializeData = serializeData;

exports.getSerialization = function(data, fromContentType, toContentType, serializeOptions, requestedType, rdfTypes) {
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

      if(requestedType){
        if(requestedType == toContentType || rdfaTypes.indexOf(requestedType) > -1) {
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
};

exports.resStatus = function(res, status) {
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
};
