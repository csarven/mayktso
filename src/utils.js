exports.htmlEntities = function(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

exports.getSerialization = function(data, fromContentType, toContentType, serializeOptions, requestedType) {
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
