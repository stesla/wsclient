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

var net = require('net');
var crypto = require('crypto');

var draft76 = require('./protocol/draft76');

exports.createSocket = function() {
  return new net.Socket();
};

exports.defaultProtocol = function() {
  return new draft76.Protocol();
};

exports.generateKey = function() {
  var spaces = 1 + Math.floor(Math.random() * 12);
  var noise = 1 + Math.floor(Math.random() * 12);
  var key = Math.floor(Math.random() * (4294967295 / spaces));
  var s = (key * spaces).toString();
  for (; noise > 0; noise--) {
    var pos = Math.floor(Math.random() * s.length + 1);
    var c = Math.floor(Math.random() * 0x7e) + 0x21;
    c = (c > 0x2f && c < 0x3a) ?
      String.fromCharCode(c + 10) :
      String.fromCharCode(c);
    s = s.substring(0,pos) + c + s.substring(pos, s.length);
  }
  for(; spaces > 0; spaces--) {
    var pos = Math.floor(Math.random() * (s.length - 1)) + 1;
    s = s.substring(0,pos) + " " + s.substring(pos, s.length);
  }
  var bytes = "";
  bytes += String.fromCharCode((key >> 24) & 0xff);
  bytes += String.fromCharCode((key >> 16) & 0xff);
  bytes += String.fromCharCode((key >> 8) & 0xff);
  bytes += String.fromCharCode((key >> 0) & 0xff);

  return {
    toString: function() { return this.string; },
    bytes: bytes,
    key: key,
    string: s
  }
}

exports.generateChallenge = function() {
  var result = new Buffer(8), i;
  for (i = 0; i < 8; i++) {
    result[i] = Math.floor(Math.random() * 255);
  }
  return result;
};

exports.challengeResponse = function(key1, key2, challenge) {
  var hash = crypto.createHash("md5");
  hash.update(key1.bytes);
  hash.update(key2.bytes);
  hash.update(challenge);
  return hash.digest("base64");
};