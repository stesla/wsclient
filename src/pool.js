var events = require("events");
var websocket = require("./websocket");
var _ = require("underscore");

function PooledSocket(wsurl) {
  this.count = 0;
  this.wsurl = wsurl;
}

_.each(["on", "addListener", "removeListener"], function(method) {
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


function Wrapper(socket) {
  this.socket = socket;
  this.emitter = new events.EventEmitter();
}

Wrapper.prototype.on = function(event, func) {
  if (event === "close") {
    this.emitter.on("close", func);
  }
  this.socket.on(event, func);
};
Wrapper.prototype.addListener = Wrapper.prototype.on;

Wrapper.prototype.removeListener = function(event, func) {
  if (event === "close") {
    this.emitter.removeListener(event, func);
  }
  this.socket.removeListener(event, func);
}

Wrapper.prototype.close = function() {
  var socket = this.socket;
  _.each(this.emitter.listeners("close"), function(func) {
    socket.removeListener("close", func);
  });
  socket.close();
  this.emitter.emit("close");
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
