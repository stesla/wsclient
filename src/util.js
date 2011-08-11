var _ = require("underscore");

exports.delegate = function(self, delegate) {
  _.each(_.functions(delegate), function(m) {
    self[m] = _.wrap(delegate[m], function(f) {
      var args = _.toArray(arguments).slice(1);
      return f.apply(delegate, args);
    });
  });
}
