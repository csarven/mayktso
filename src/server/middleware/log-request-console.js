module.exports = function(req, res, next){
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
};
