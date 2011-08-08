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

var websocket = require("websocket");
var pool = require("pool");
var _ = require("underscore");

exports.create = function(wsurl) {
  return new websocket.WebSocket(wsurl);
}
_.each(["CONNECTING", "CLOSED", "CLOSING", "OPEN"], function(state) {
  exports[state] = websocket[state];
})

exports.createPool = function() {
  return new pool.Pool(exports.create);
}
