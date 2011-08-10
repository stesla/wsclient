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

describe("reconnect", function() {
  var defaultTimeout = 42;
  var proto, ws, rws, spies;
  beforeEach(function() {
    proto = websocket.WebSocket.prototype;
    var emitterMethods = _.functions(events.EventEmitter.prototype);
    _.each(_.functions(proto), function(m) { 
      if (_.include(emitterMethods, m)) { return; }
      spyOn(proto, m);
    });
    ws = new websocket.WebSocket("ws://example.com");
    rws = wsclient.reconnect(ws, defaultTimeout);
    spies = {};
    _.each(["close", "error", "reconnecting", "foo", "bar"], function(e) {
      spies[e] = jasmine.createSpy("spies." + e);
      rws.on(e, spies[e]);
    });
  });

  it("emits events", function() {
    ws.emit("foo", "bar");
    expect(spies.foo).toHaveBeenCalledWith("bar");
  });

  it("removes listeners", function() {
    rws.removeListener("bar", spies.bar);
    ws.emit("bar");
    expect(spies.bar).not.toHaveBeenCalled();
  });

  it("sends data", function() {
    rws.send("foo");
    expect(proto.send).toHaveBeenCalled();
  });

  it("intercepts the error event", function() {
    ws.emit("error");
    expect(spies.error).not.toHaveBeenCalled();
  });

  describe("on websocket close", function() {
    var timer;
    beforeEach(function() {
      timer = {};
      setTimeout.andReturn(timer);
      rws.connect();
      ws.emit("close", "wasClean", "reason");
    });

    it("intercepts the close event", function() {
      expect(spies.close).not.toHaveBeenCalled();
    });

    it("emits a reconnecting event", function() {
      expect(spies.reconnecting).toHaveBeenCalledWith("reason", defaultTimeout);
    });

    it("calls connect on the websocket after a timeout", function() {
      expect(setTimeout).toHaveBeenCalled();
      setTimeout.argsForCall[0][0]();
      expect(proto.connect).toHaveBeenCalled();
    });

    it("backs off reconnects until it succeeds", function() {
      setTimeout.argsForCall[0][0]();
      ws.emit("close");
      var firstTimeout = setTimeout.argsForCall[0][1];
      var secondTimeout = setTimeout.argsForCall[1][1];
      expect(secondTimeout).toBeGreaterThan(firstTimeout);
    });

    it("cancels reconnects when it is closed", function() {
      setTimeout.argsForCall[0][0]();
      rws.close();
      expect(clearTimeout).toHaveBeenCalledWith(timer);
    });

    it("resets the timeout after a successful reconnect", function() {
      setTimeout.argsForCall[0][0]();
      ws.emit("close");
      setTimeout.argsForCall[1][0]();
      ws.emit("open");
      ws.emit("close");
      expect(setTimeout.argsForCall[2][1]).toBe(defaultTimeout);
    });
  });

  it("does not reconnect if it has been closed", function() {
    rws.close();
    ws.emit("close");
    expect(setTimeout).not.toHaveBeenCalled();
  });

  it("emits a close event when it is closed", function() {
    rws.close();
    ws.emit("close", true, "reason", 42);
    expect(spies.close).toHaveBeenCalledWith(true, "reason", 42);
  });
});
