var events = require("events");
var sys = require("sys");
var websocket = require("./websocket");
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
  function wrapper() {};
  wrapper.prototype = socket;
  var wrapped = new wrapper();
  var emitter = new events.EventEmitter();
  _.each(["on", "addListener", "removeListener", "removeAllListeners"], function(m) {
    wrapped[m] = _.wrap(socket[m], function(f, e) {
      var args = _.toArray(arguments).slice(1);
      if (e === "close") { emitter[m].apply(emitter, args); }
      f.apply(socket, args);
    });
  });
  wrapped.close = _.wrap(socket.close, function(f) {
    _.each(emitter.listeners("close"), function(g) {
      socket.removeListener("close", g);
    });
    f();
    emitter.emit("close");
  })
  return wrapped;
}

function Pool() {
  this.sockets = {};
}

Pool.prototype.create = function(wsurl) {
  var socket = this.sockets[wsurl];
  if (!socket) {
    this.sockets[wsurl] = socket = pooledSocket(websocket.create(wsurl));
  }
  socket.addRef();
  return wrap(socket);
}

exports.createPool = function() {
  return new Pool();
}
