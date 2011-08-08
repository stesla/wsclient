var events = require("events");
var sys = require("sys");
var _ = require("underscore");

function pooledSocket(socket) {
  var count = 0;
  socket.addRef = function() { count++; };
  socket.close = _.wrap(_.bind(socket.close, socket), function(f) {
    count--;
    if (count === 0) { f(); }
  });
  return socket;
}

function wrap(socket) {
  function wrapper() {
    var self = this;
    self.emitter = new events.EventEmitter();
    _.each(_.functions(events.EventEmitter.prototype), function(m) {
      self[m] = _.wrap(socket[m], function(f, e) {
        var args = _.toArray(arguments).slice(1);
        if (e === "close") { self.emitter[m].apply(self.emitter, args); }
        f.apply(socket, args);
      });
    });
    self.close = _.wrap(socket.close, function(f) {
      _.each(self.emitter.listeners("close"), function(g) {
        socket.removeListener("close", g);
      });
      f.apply(socket, []);
      self.emitter.emit("close");
    })
  };
  wrapper.prototype = socket;
  return new wrapper();
}

function Pool(createFunc) {
  this.sockets = {};
  this.createFunc = createFunc;
}

Pool.prototype.create = function(wsurl) {
  var socket = this.sockets[wsurl];
  if (!socket) {
    this.sockets[wsurl] = socket = pooledSocket(this.createFunc(wsurl));
  }
  socket.addRef();
  return wrap(socket);
}

exports.Pool = Pool;
