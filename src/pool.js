var events = require("events");
var sys = require("sys");
var util = require("./util");
var wsclient = require("./websocket");
var _ = require("underscore");

function pooledSocket(socket) {
  var count = 0;
  socket.connect = _.wrap(socket.connect, function(f) {
    if (count === 0) { f.apply(socket, []); }
    count++;
  });
  socket.close = _.wrap(socket.close, function(f) {
    count--;
    if (count === 0) { f.apply(socket, []); }
  });
  return socket;
}

function Wrapper(socket) {
  var self = this;
  var emitterMethods = _.functions(events.EventEmitter.prototype);
  util.delegate(this, socket);
  self.emitter = new events.EventEmitter();
  _.each(emitterMethods, function(m) {
    self[m] = _.wrap(socket[m], function(f, e) {
      var args = _.toArray(arguments).slice(1);
      if (_.include(["close", "open"], e)) { self.emitter[m].apply(self.emitter, args); }
      f.apply(socket, args);
    });
  });
  self.close = _.wrap(socket.close, function(f) {
    _.each(self.emitter.listeners("close"), function(g) {
      socket.removeListener("close", g);
    });
    f.apply(socket, []);
    self.emitter.emit("close");
  });
  self.connect = _.wrap(socket.connect, function(f) {
    if (socket.isOpen()) { self.emitter.emit("open"); }
    f.apply(socket, []);
  });
};

function Pool(createFunc) {
  this.sockets = {};
  this.createFunc = createFunc;
}

Pool.prototype.create = function(wsurl) {
  var socket = this.sockets[wsurl];
  if (!socket) {
    this.sockets[wsurl] = socket = pooledSocket(this.createFunc(wsurl));
  }
  return new Wrapper(socket);
}

exports.Pool = Pool;
