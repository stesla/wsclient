/*
 * Copyright 2011, Saumel Tesla <samuel.tesla@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at
 * your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var events = require('events');
var sys = require('sys');
var url = require('url');

var helper = require('./helper');

var CONNECTING = 0;
var OPEN = 1;
var CLOSING = 2;
var CLOSED = 3;

var SYNTAX_ERR = new Error("SYNTAX_ERR");

var WebSocket = function(wsurl, protocols) {
  events.EventEmitter.call(this);

  this.url = this.URL = wsurl;
  this.readyState = CONNECTING;

  var urlParts = url.parse(wsurl), defaultPort;
  this.host = urlParts.hostname;
  if (urlParts.protocol === 'wss:') {
    this.secure = true;
    this.defaultPort = "443";
  } else if (urlParts.protocol === 'ws:') {
    this.defaultPort = "80";
  } else {
    throw SYNTAX_ERR;
  }
  this.port = urlParts.port || this.defaultPort;
  this.resource = urlParts.pathname || "/";

  var self = this;
  process.nextTick(function() { self.connect(); });
};
sys.inherits(WebSocket, events.EventEmitter);

Object.defineProperty(WebSocket, 'CONNECTING', {value: CONNECTING});
Object.defineProperty(WebSocket, 'OPEN', {value: OPEN});
Object.defineProperty(WebSocket, 'CLOSING', {value: CLOSING});
Object.defineProperty(WebSocket, 'CLOSED', {value: CLOSED});

WebSocket.prototype.connect = function() {
  var self = this;
  var socket = helper.createSocket();
  var protocol = helper.defaultProtocol();
  this.protocol = protocol;
  protocol.socket = socket;
  socket.on("connect", function() { protocol.open(self); });
  socket.on("close", function(hadError) { self._doClose(!hadError); });
  socket.on("error", function(error) { self._doError(error); });
  protocol.on("close", function(code, reason) { self._doClose(true, reason, code); });
  protocol.on("closing", function() { self._doClosing(); });
  protocol.on("error", function(error) { self._doError(error); });
  protocol.on("message", function(data) { self._doMessage(data); });
  protocol.on("open", function() { self._doOpen(); });
  socket.connect(this.port, this.host);
};

WebSocket.prototype.emit = function(type) {
  try {
    events.EventEmitter.prototype.emit.apply(this, arguments);
  } catch (e) {
    if (type === "error") {
      throw e
    } else {
      this.emit("error", e);
    }
  }
}

WebSocket.prototype._doClose = function(wasClean, reason, code) {
  this.emit("close", wasClean, reason, code);
  this.readyState = CLOSED;
};

WebSocket.prototype._doClosing = function() {
  this.readyState = CLOSING;
};

WebSocket.prototype._doError = function(error) {
  this.emit("error", error);
  this._doClose(false, error);
};

WebSocket.prototype._doOpen = function() {
  this.emit("open");
  this.readyState = OPEN;
};

WebSocket.prototype._doMessage = function(data) {
  this.emit("message", data);
};

WebSocket.prototype.close = function() {
  this.readyState = CLOSING;
  this.protocol.clientClose();
};

WebSocket.prototype.send = function(msg) {
  this.protocol.send(msg);
};

exports.WebSocket = WebSocket;