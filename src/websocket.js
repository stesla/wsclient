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
var _ = require("underscore");

var helper = require('./helper');

var CONNECTING = exports.CONNECTING = 0;
var OPEN = exports.OPEN = 1;
var CLOSING = exports.CLOSING = 2;
var CLOSED = exports.CLOSED = 3;

var SYNTAX_ERR = new Error("SYNTAX_ERR");

var WebSocket = function(wsurl) {
  events.EventEmitter.call(this);

  this.url = this.URL = wsurl;
  this.readyState = CONNECTING;
  this._shouldConnect = true;

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
  this.emit = _.wrap(this.emit, function(f, type) {
    try {
      var args = _.toArray(arguments).slice(1);
      f.apply(self, args);
    } catch(e) {
      if (type === "error") {
        throw e;
      } else {
        f.apply(self, ["error", e]);
      }
    }
  });
};
sys.inherits(WebSocket, events.EventEmitter);

WebSocket.prototype.connect = function() {
  if (!this._shouldConnect) { return; }
  this._shouldConnect = false;
  var self = this;
  var socket = helper.createSocket();
  this.socket = socket;
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

WebSocket.prototype._doClose = function(wasClean, reason, code) {
  var self = this;
  _.each(["close", "closing", "error", "message", "open"], function(e) {
    self.protocol.removeAllListeners(e);
  });
  _.each(["connect", "close", "error"], function(e) {
    self.socket.removeAllListeners(e);
  });
  this._shouldConnect = true;
  this.readyState = CLOSED;
  this.emit("close", wasClean, reason, code);
};

WebSocket.prototype._doClosing = function() {
  this.readyState = CLOSING;
};

WebSocket.prototype._doError = function(error) {
  this.emit("error", error);
  this._doClose(false, error);
};

WebSocket.prototype._doOpen = function() {
  this.readyState = OPEN;
  this.emit("open");
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

WebSocket.prototype.isOpen = function(msg) {
  return this.readyState === OPEN;
};

exports.WebSocket = WebSocket;
