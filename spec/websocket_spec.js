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
var helper = require('helper');
var net = require('net');
var WebSocket = require('websocket').WebSocket;

//   readonly attribute unsigned long bufferedAmount;
//   void close(in optional unsigned long code, in optional DOMString reason);

describe("WebSocket", function() {
  beforeEach(function() {
    spyOn(process, 'nextTick');
  });

  describe("contructor", function() {
    var ws;
    it("should accept ws as a valid URL scheme", function() {
      expect(function() {ws = new WebSocket("ws://example.com"); }).not.toThrow("SYNTAX_ERR");
      expect(ws.port).toBe("80");
      expect(ws.defaultPort).toBe("80");
    });

    it("should accept wss as a valid URL scheme", function() {
      expect(function() {ws = new WebSocket("wss://example.com"); }).not.toThrow("SYNTAX_ERR");
      expect(ws.port).toBe("443");
      expect(ws.defaultPort).toBe("443");
    });

    it("should accept port numbers", function() {
      expect(function() {ws = new WebSocket("ws://example.com:8080"); }).not.toThrow("SYNTAX_ERR");
      expect(ws.port).toBe("8080");
      expect(ws.defaultPort).toBe("80");
    });

    it("should not accept anything except ws or wss as a valid URL scheme", function() {
      expect(function() {ws = new WebSocket("http://example.com"); }).toThrow("SYNTAX_ERR");
      expect(function() {ws = new WebSocket("ftp://example.com"); }).toThrow("SYNTAX_ERR");
      expect(function() {ws = new WebSocket("foo://example.com"); }).toThrow("SYNTAX_ERR");
    });
  });

  describe("after construction", function () {
    var socket, spy, ws;
    beforeEach(function() {
      socket = new events.EventEmitter();
      socket.connect = jasmine.createSpy('socket.connect');
      protocol = helper.defaultProtocol();
      spyOn(protocol, 'open');
      spyOn(protocol, 'clientClose');
      spyOn(helper, 'createSocket').andReturn(socket);
      spyOn(helper, 'defaultProtocol').andReturn(protocol);
      spy = jasmine.createSpyObj("spy", ["open", "message", "close", "error"]);
      ws = new WebSocket("ws://example.com");
      ws.on("close", spy.close);
      ws.on("message", spy.message);
      ws.on("open", spy.open);
      ws.on("error", spy.error);
    });

    it("has a readyState of CONNECTING", function() {
      expect(ws.readyState).toEqual(WebSocket.CONNECTING);
    });

    it("has an url attribute with the URL used to create it", function() {
      expect(ws.url).toEqual("ws://example.com");
    });

    it("should connect in the background", function() {
      expect(process.nextTick).toHaveBeenCalled();
    });

    describe("when errors in callbacks occur", function() {
      var error, makeError = function() { throw error; }

      beforeEach(function() {
        error = new Error("boom");
      });

      it("should catch all errors in its events and emit an error event", function() {
        ws.on("foo", makeError);
        ws.emit("foo");
        expect(spy.error).toHaveBeenCalledWith(error);
      });

      it("should raise errors thrown from inside error callbacks", function() {
        ws.on("error", makeError);
        expect(function() { ws.emit("error"); }).toThrow(new Error("boom"));
      });
    });

    describe("after connect()", function() {
      beforeEach(function() {
        ws.connect();
      });

      it("should get a protocol object from the helper", function() {
        expect(helper.defaultProtocol).toHaveBeenCalled();
      });

      it("should connect the socket", function() {
        expect(socket.connect).toHaveBeenCalledWith("80", "example.com");
      });

      it("should emit an error event then a close event  on socket error", function() {
        socket.emit("error", "the error");
        expect(spy.error).toHaveBeenCalledWith("the error");
        expect(spy.close).toHaveBeenCalledWith(false, "the error", undefined);
      });

      it("should emit a close event on socket close", function() {
        socket.emit("close", false);
        expect(spy.close).toHaveBeenCalledWith(true, undefined, undefined);
      });

      it("should emit a close event when a close handshake completes", function() {
        protocol.emit("close", 42, "reason");
        expect(spy.close).toHaveBeenCalledWith(true, "reason", 42);
      });

      it("should emit an error event then a close event on protocol error", function() {
        protocol.emit("error", "the error");
        expect(spy.error).toHaveBeenCalledWith("the error");
        expect(spy.close).toHaveBeenCalledWith(false, "the error", undefined);
      });

      it("should start the handshake once the socket is connects", function() {
        socket.emit("connect");
        expect(protocol.socket).toBe(socket);
        expect(protocol.open).toHaveBeenCalled();
      });

      it("should emit an open event if the handshake succeeds", function() {
        protocol.emit("open");
        expect(spy.open).toHaveBeenCalled();
      });

      it("should emit a message event when it receives a data frame", function() {
        protocol.emit("message", "foo");
        expect(spy.message).toHaveBeenCalledWith("foo");
      });

      it("should have a readyState of OPEN after the handshake", function() {
        protocol.emit("open");
        expect(ws.readyState).toEqual(WebSocket.OPEN);
      });

      it("should have a readyState of CLOSING after it receives the closing handshake", function() {
        protocol.emit("closing");
        expect(ws.readyState).toEqual(WebSocket.CLOSING);
      });

      it("should have a readyState of CLOSING after close() is called", function() {
        ws.close();
        expect(ws.readyState).toEqual(WebSocket.CLOSING);
      });

      it("should have a readyState of CLOSED after the socket closes", function() {
        socket.emit("close");
        expect(ws.readyState).toEqual(WebSocket.CLOSED);
      });

      it("should have a readyState of CLOSED after the socket errors", function() {
        socket.emit("error");
        expect(ws.readyState).toEqual(WebSocket.CLOSED);
      });

      it("should have a readyState of CLOSED after the protocol closes", function() {
        protocol.emit("close");
        expect(ws.readyState).toEqual(WebSocket.CLOSED);
      });

      it("should have a readyState of CLOSED after the protocol errors", function() {
        protocol.emit("error");
        expect(ws.readyState).toEqual(WebSocket.CLOSED);
      });

      it("should start the closing handshake when close() is called", function() {
        ws.close();
        expect(protocol.clientClose).toHaveBeenCalled();
      });
    });
  });
});
