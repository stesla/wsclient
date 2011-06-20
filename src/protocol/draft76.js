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

var crypto = require('crypto');
var events = require('events');
var sys = require('sys');
var _ = require('underscore');

var helper = require('../helper');

if (!Buffer.prototype.indexOf) {
  Buffer.prototype.indexOf = function(c) {
    var i;
    for (i = 0; i < this.length; i++) {
      if (this[i] === c) {
        return i;
      }
    }
    return -1;
  };

  Buffer.prototype.indexOfCRLF = function() {
    var i;
    for (i = 0; i < this.length - 1; i++) {
      if (this[i] === 0x0d && this[i+1] === 0x0a) {
        return i;
      }
    }
  };
}

var Protocol = function() {
  events.EventEmitter.call(this);
  this.connecting = true;
  this.headers = {};
};
sys.inherits(Protocol, events.EventEmitter);

Protocol.prototype.open = function(urlParts) {
  this.generateChallenge();
  this.sendClientHandshake(urlParts);
};

Protocol.prototype.generateChallenge = function() {
  this.key1 = helper.generateKey();
  this.key2 = helper.generateKey();
  this.challenge = helper.generateChallenge();
};

Protocol.prototype.sendClientHandshake = function(websocket) {
  var self = this;
  this.websocket = websocket;
  var host = websocket.host + (websocket.port === websocket.defaultPort ? "" : ":" + websocket.port);
  var resource = websocket.resource || "/";
  this.location = (websocket.secure ? "wss://" : "ws://") + host + resource;
  _.each(["GET " + resource + " HTTP/1.1\r\n",
          "Upgrade: WebSocket\r\n",
          "Connection: Upgrade\r\n",
          "Host: " + host + "\r\n",
          "Sec-WebSocket-Key1: " + this.key1 + "\r\n",
          "Sec-WebSocket-Key2: " + this.key2 + "\r\n\r\n"],
         function(data) { self.socket.write(data, "ascii"); });
  self.socket.write(this.challenge);
};

Protocol.prototype.frameInProgress = function() {
  return this.buffer !== undefined;
};

Protocol.prototype.receive = function(data) {
  try {
    if (this.buffer) {
      var newData = new Buffer(this.buffer.length + data.length);
      this.buffer.copy(newData);
      data.copy(newData, this.buffer.length);
      this.buffer = newData;
    } else {
      this.buffer = data;
    }

    if (this.connecting) {
      this.receiveServerHandshake();
    } else {
      this.receiveMessage();
    }
  } catch(e) {
    this.emit("error", e);
  }
};

Protocol.prototype.receiveServerHandshake = function () {
  var b = this.buffer, i, found = false;
  for (i = 0; i < b.length; i++) {
    if(b[i-3] === 0x0d && b[i-2] === 0x0a && b[i-1] === 0x0d && b[i] === 0x0a) {
      found = true;
      break;
    }
  }

  if (found && b.length - i >= 16) {
    this.handleServerHandshake();
    this.receiveMessage();
  }
};

Protocol.prototype.handleServerHandshake = function() {
  this.verifyStatusCode();
  this.verifyHeaders();
  this.verifyChallengeResponse();
  this.connecting = false;
  this.emit("open");
};

Protocol.prototype.verifyStatusCode = function() {
  var i = this.buffer.indexOfCRLF();
  var line = this.buffer.toString("ascii", 0, i).split(" ");
  if (line[1] !== "101") {
    throw new Error("HTTP Status " + line[1]);
  }
  this.buffer = this.buffer.slice(i+2);
};

Protocol.prototype.verifyHeaders = function() {
  var i;
  while (true) {
    i = this.buffer.indexOfCRLF();
    if (i === 0) {
      break;
    }
    var line = this.buffer.toString("ascii", 0, i).split(": ");
    this.headers[line[0]] = line[1];
    this.buffer = this.buffer.slice(i + 2);
  }
  this.buffer = this.buffer.slice(i + 2);
  if (this.headers.Upgrade !== "WebSocket") {
    throw new Error("Incorrect/Missing Upgrade header");
  }
  if (this.headers.Connection !== "Upgrade") {
    throw new Error("Incorrect/Missing Connection header");
  }
  if (this.headers['Sec-WebSocket-Location'] !== this.location) {
    throw new Error("Incorrect/Missing Sec-WebSocket-Location header");
  }
};

Protocol.prototype.verifyChallengeResponse = function() {
  var expected = helper.challengeResponse(this.key1, this.key2, this.challenge);
  var response = this.buffer.toString("base64", 0, 16);
  this.buffer = this.buffer.slice(16);
  if (expected !== response) {
    throw new Error("Incorrect challenge response, challenge = " + sys.inspect(this.challenge));
  }
};

Protocol.prototype.receiveMessage = function() {
  var again = true;
  while (again) { again = this.processFrame(); }
};

var isTextFrame = function(frame) {
  return frame[0] === 0x00;
};

var isSupportedFrameType = function(frame) {
  return isTextFrame(frame);
};

var isClosing = function(frame) {
  return frame[0] === 0xff && frame[1] === 0x00;
};

Protocol.prototype.processFrame = function() {
  if (!this.buffer || this.buffer.length === 0) {
    return false;
  }

  if (isClosing(this.buffer)) {
    this.serverClose();
    return false;
  }

  if (!isSupportedFrameType(this.buffer)) {
    throw new Error("unsupported frame type");
  }

  var i = this.buffer.indexOf(0xff);
  if (i < 0) {
    return false;
  } else {
    this.emit("message", this.buffer.toString("utf8", 1, i));
    this.buffer = this.buffer.slice(i + 1);
    return true;
  }
};

Protocol.prototype.send = function(data) {
  var buf = new Buffer(data);
  var frame = new Buffer(2 + buf.length);
  frame[0] = 0x00;
  new Buffer(data).copy(frame, 1);
  frame[buf.length + 1] = 0xff;
  this.socket.write(frame);
};

Protocol.prototype.clientClose = function() {
  this.send = function() {}; /* TODO: maybe we should buffer */
  if (this.socket.writable) {
    this.socket.write(new Buffer([0xff, 0x00]));
  }
};

Protocol.prototype.serverClose = function() {
  this.clientClose();
  this.socket.end();
  this.emit("close");
};

Object.defineProperty(Protocol.prototype, "socket", {
  get: function() { return this._socket; },
  set: function(socket) {
    var self = this;
    socket.on("data", function(data) { self.receive(data); });
    this._socket = socket;
  }
});

exports.Protocol = Protocol;