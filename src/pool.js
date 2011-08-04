var events = require("events");
var sys = require("sys");
var websocket = require("./websocket");
var _ = require("underscore");

function PooledSocket(wsurl) {
  this.count = 0;
  this.wsurl = wsurl;
}

_.each(_.functions(events.EventEmitter.prototype), function(method) {
  PooledSocket.prototype[method] = function() {
    this.ws[method].apply(this.ws, arguments);
  }
});

PooledSocket.prototype.isEmpty = function() {
  return this.count === 0;
};

PooledSocket.prototype.close = function() { 
  this.count--;
  if (this.isEmpty()) {
    this.ws.close();
  }
};

PooledSocket.prototype.open = function() {
  if (this.isEmpty()) {
    this.ws = websocket.create(this.wsurl);
  }
  this.count++;
};

PooledSocket.prototype.send = function(msg) {
  this.ws.send(msg);
}

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

Pool.prototype.create = function(wsurl) {
  this.sockets[wsurl] = this.sockets[wsurl] || new PooledSocket(wsurl);
  this.sockets[wsurl].open();
  return new Wrapper(this.sockets[wsurl]);
}

exports.createPool = function() {
  return new Pool();
}
