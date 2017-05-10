module.exports = function(req, res, next) {
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST, PUT");
  if(req.header('Origin')) {
    res.header("Access-Control-Allow-Origin", req.header('Origin'));
  }
  else {
    res.header("Access-Control-Allow-Origin", "*");
  }
  res.header("Access-Control-Allow-Headers", "Content-Length, Content-Type, If-None-Match, Link, Location, Origin, Slug, X-Requested-With");
   res.header("Access-Control-Expose-Headers", "Accept-Post, Access-Control-Allow-Headers, Access-Control-Allow-Methods, Access-Control-Allow-Origin, Allow, Content-Length, Content-Type, ETag, Last-Modified, Link, Location, Updates-Via, Vary");
  return next();
};
