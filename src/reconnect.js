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

var events = require("events");
var util = require("./util");
var _ = require("underscore");

function Reconnect(socket, defaultTimeout) {
  this.timeout = defaultTimeout;
  var self = this;
  var emitterMethods = _.functions(events.EventEmitter.prototype);
  util.delegate(this, socket);

  self.socket = socket;

  var onClose = function(_clean, reason) { self.reconnect(reason); };
  socket.on("close", onClose);
  socket.on("error", function() { /* errors MUST emit close events */ });
  socket.on("open", function() { self.timeout = defaultTimeout; });

  self.connect = _.wrap(socket.connect, function(f) {
    f.apply(socket, []);
  });
  self.close = _.wrap(socket.close, function(f) {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); }
    socket.removeListener("close", onClose);
    socket.addListener("close", function() {
      var args = ["close"].concat(_.toArray(arguments));
      self.emitter.emit.apply(self.emitter, args);
    });
    f.apply(socket, []);
  });

  self.emitter = new events.EventEmitter();
  _.each(emitterMethods, function(m) {
    self[m] = _.wrap(socket[m], function(f, e) {
      var args = _.toArray(arguments).slice(1);
      if (_.include(["close", "error", "reconnecting"], e)) {
        self.emitter[m].apply(self.emitter, args);
      } else {
        f.apply(socket, args);
      }
    });
  });
}

Reconnect.prototype.reconnect = function(reason) {
  this.emitter.emit("reconnecting", reason, this.timeout);
  this.reconnectTimer = setTimeout(_.bind(function() {
    this.timeout *= 2;
    this.socket.connect();
  }, this), this.timeout);
}

exports.wrap = function(socket, defaultTimeout) {
  return new Reconnect(socket, defaultTimeout);
}
