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

var Protocol = require("protocol/draft76").Protocol;

// SEE ALSO: http://tools.ietf.org/html/draft-ietf-hybi-thewebsocketprotocol-03

describe("draft76.Protocol", function() {
  var socket, protocol, spy, sent, headers, status, websocket;

  var sendResponse = function(challenge) {
    socket.emit("data", new Buffer("HTTP/1.1 " + status + " Reason\r\n", "ascii"));
    _.each(headers, function(value, key) {
      socket.emit("data", new Buffer(key + ": " + value + "\r\n", "ascii"));
    });
    socket.emit("data", new Buffer("\r\n", "ascii"));
    socket.emit("data", new Buffer(challenge || "0123456789abcdef", "ascii"));
  };

  var expectError = function() {
    expect(spy.error).toHaveBeenCalled();
    expect(spy.open).not.toHaveBeenCalled();
  };

  var expectSuccess = function() {
    expect(spy.open).toHaveBeenCalled();
    expect(protocol.connecting).toBe(false);
  };

  var socketSendBytes = function(data, encoding) {
    if (!(data instanceof Buffer)) {
      data = new Buffer(data, encoding);
    }
    var buffer = new Buffer(sent.length + data.length);
    sent.copy(buffer);
    data.copy(buffer, sent.length);
    sent = buffer;
  };

  var socketEnd = function(data, encoding) {
    if(data) {
      sendBytes(data, encoding);
    }
  };

  beforeEach(function() {
    websocket = {secure: false,
                 host: "foo.example.com",
                 port: "80", defaultPort: "80",
                 resource: "/path/to/something"};
    spyOn(helper, "generateKey").andReturn("secret key");
    spyOn(helper, "generateChallenge").andReturn("abcd1234");
    spyOn(helper, 'challengeResponse').andReturn("MDEyMzQ1Njc4OWFiY2RlZg==");
    spy = jasmine.createSpyObj('spy', ['message', 'error', 'open', 'close', 'closing']);
    protocol = new Protocol();
    protocol.on("error", spy.error);
    protocol.on("message", spy.message);
    protocol.on("open", spy.open);
    protocol.on("close", spy.close);
    protocol.on("closing", spy.closing);
    sent = new Buffer(0);
    socket = new events.EventEmitter();
    socket.end = jasmine.createSpy("socket.end");
    socket.end.andCallFake(socketEnd);
    socket.write = jasmine.createSpy("socket.write")
    socket.write.andCallFake(socketSendBytes);
    socket.writable = true;
    protocol.socket = socket;
    status = 101;
    headers = {
      'Upgrade': 'WebSocket',
      'Connection': 'Upgrade',
      'Sec-WebSocket-Location': 'ws://foo.example.com/path/to/something'
    };
  });

  it("sends a client handshake with security keys and challenge", function() {
    protocol.open(websocket);
    var shake = sent.toString("ascii");
    _.each(["^GET /path/to/something HTTP/1.1\r\n",
            "Upgrade: WebSocket\r\n",
            "Connection: Upgrade\r\n",
            "Host: foo.example.com\r\n",
            "Sec-WebSocket-Key1: secret key\r\n",
            "Sec-WebSocket-Key2: secret key\r\n",
            "\r\n\r\nabcd1234$"],
           function(x) { expect(shake).toMatch(x); });
  });

  it("sends a / if no path is provided", function() {
    websocket.resource = "/";
    protocol.open(websocket);
    var shake = sent.toString("ascii");
    expect(shake).toMatch("^GET / HTTP/1.1\r\n");
  });

  it("sends a port in the Host header if it is provided", function() {
    websocket.port = "1234";
    protocol.open(websocket);
    var shake = sent.toString("ascii");
    expect(shake).toMatch("Host: foo.example.com:1234\r\n");
  });

  it("if the handshake succeeds, emit an open event", function() {
    protocol.on("error", function(e) { throw e; });
    protocol.open(websocket);
    sendResponse();
    expect(helper.challengeResponse).toHaveBeenCalledWith("secret key", "secret key", "abcd1234");
    expectSuccess();
  });

  it("works if it all comes at once", function() {
    var oldsocket = socket;
    var response = "";
    socket = new events.EventEmitter();
    socket.on("data", function(data) { response += data.toString("ascii"); });
    protocol.on("error", function(e) { throw e; });
    protocol.open(websocket);
    sendResponse();
    oldsocket.emit("data", new Buffer(response, "ascii"));
    expect(helper.challengeResponse).toHaveBeenCalledWith("secret key", "secret key", "abcd1234");
    expectSuccess();
  });

  it("receives the first frame after the handshake", function() {
    protocol.on("error", function(e) { throw e; });
    protocol.open(websocket);
    sendResponse();
    socket.emit("data", new Buffer([0x00, 0x66, 0x6f, 0x6f, 0xff]));
    expect(spy.message).toHaveBeenCalledWith("foo");
  });

  describe("emit an error event, if the handshake fails because", function() {
    beforeEach(function() {
      protocol.open(websocket);
    });

    it("http status is not 101", function() {
      status = 404;
      sendResponse();
      expectError();
    });

    it("upgrade header is missing", function() {
      delete headers.Upgrade;
      sendResponse();
      expectError();
    });

    it("upgrade header is not 'Upgrade'", function() {
      headers.Upgrade = 'bogus';
      sendResponse();
      expectError();
    });

    it("connection header is missing", function() {
      delete headers.Connection;
      sendResponse();
      expectError();
    });

    it("connection header is not 'Connection'", function() {
      headers.Connection = 'bogus';
      sendResponse();
      expectError();
    });

    it("location header is missing", function() {
      delete headers['Sec-WebSocket-Location'];
      sendResponse();
      expectError();
    });

    it("location header is incorrect", function() {
      headers['Sec-WebSocket-Location'] = 'bogus';
      sendResponse();
      expectError();
    });

    it("challenge response is incorrect", function() {
      protocol.log = true;
      sendResponse("bogus01234567890");
      expectError();
    });
  });

  describe("after the handshake", function() {
    beforeEach(function() {
      protocol.connecting = false;
    });

    it("receives data from the socket", function() {
      socket.emit("data", new Buffer([0x00, 0x66, 0xff]));
      expect(spy.message).toHaveBeenCalledWith("f");
    });

    it("emits an error if a non-text frame is received", function() {
      protocol.receive(new Buffer("garbage"));
      expect(spy.error).toHaveBeenCalled();
      expect(spy.message).not.toHaveBeenCalled();
    });

    it("decodes a text frame and fires a message event with it", function() {
      frame = new Buffer([0x00, 0x66, 0x6f, 0x6f, 0xff]);
      protocol.receive(frame);
      expect(spy.message).toHaveBeenCalledWith("foo");
    });

    it("buffers data if an incomplete frame is received", function() {
      protocol.receive(new Buffer([0x00, 0x66, 0x6f]));
      expect(spy.message).not.toHaveBeenCalled();
      protocol.receive(new Buffer([0x6f, 0xff]));
      expect(spy.message).toHaveBeenCalledWith("foo");
    });

    it("decodes two frames received in same data", function() {
      protocol.receive(new Buffer([0x00, 0x66, 0xff, 0x00, 0x6f, 0xff]));
      expect(spy.message).toHaveBeenCalledWith("f");
      expect(spy.message).toHaveBeenCalledWith("o");
    });

    it("sends text in a frame", function() {
      protocol.send("foo");
      expect(sent[0]).toEqual(0x00);
      expect(sent.toString('utf8',1,4)).toEqual("foo");
      expect(sent[4]).toEqual(0xff);
    });

    describe("after receiving the closing handshake", function() {
      beforeEach(function() {
        protocol.receive(new Buffer([0xff, 0x00]));
      });

      it("ignores data sent afterward", function() {
        protocol.receive(new Buffer([0xff, 0x00, 0x00, 0x20, 0xff]));
        expect(spy.message).not.toHaveBeenCalled();
        expect(spy.error).not.toHaveBeenCalled();
      });

      it("sends a response and half-closes the socket", function() {
        expect(socket.end).toHaveBeenCalled();
        expect(sent[0]).toBe(0xff);
        expect(sent[1]).toBe(0x00);
      });

      it("emits a close event", function() {
        expect(spy.close).toHaveBeenCalled();
      });
    });

    it("doesn't write to the socket on clientClose, if the socket isn't writable", function() {
      socket.writable = false;
      protocol.clientClose();
      expect(socket.write).not.toHaveBeenCalled();
    });

    describe("after calling clientClose", function() {
      beforeEach(function() {
        protocol.clientClose();
        socket.write.reset();
      });

      it("sends the closing handshake", function() {
        expect(sent[0]).toBe(0xff);
        expect(sent[1]).toBe(0x00);
      });

      it("still can receive data", function() {
        protocol.receive(new Buffer([0x00, 0x66, 0xff]));
        expect(spy.message).toHaveBeenCalledWith("f");
      });

      it("does not send any data", function() {
        protocol.send("foo");
        expect(socket.write).not.toHaveBeenCalled();
      });
    });
  });
});
