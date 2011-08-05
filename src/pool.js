var events = require("events");
var sys = require("sys");
var websocket = require("./websocket");
var _ = require("underscore");

function Wrapper(socket) {
  var self = this;
  events.EventEmitter.call(self);
  self.socket = socket;
  self.onClose = function(wasClean, reason, code) { self.emit("close", wasClean, reason, code); };
  socket.on("close", this.onClose);
  socket.on("error", function(error) { self.emit("error", error); });
  socket.on("open", function() { self.emit("open"); });
  socket.on("message", function(data) { self.emit("message", data); });
}
sys.inherits(Wrapper, events.EventEmitter);

Wrapper.prototype.close = function() {
  this.socket.removeListener("close", this.onClose);
  this.socket.close();
  this.emit("close");
}

Wrapper.prototype.send = function(msg) {
  this.socket.send(msg);
}

function Pool() {
  this.sockets = {};
}

function pooledSocket(socket) {
  var count = 0;
  socket.addRef = function() { count++; };
  socket.close = _.wrap(_.bind(socket.close, socket), function(f) {
    count--;
    if (count === 0) { f(); }
  });
  return socket;
}

Pool.prototype.create = function(wsurl) {
  var socket = this.sockets[wsurl];
  if (!socket) {
    this.sockets[wsurl] = socket = pooledSocket(websocket.create(wsurl));
  }
  socket.addRef();
  return new Wrapper(socket);
}

exports.createPool = function() {
  return new Pool();
}
