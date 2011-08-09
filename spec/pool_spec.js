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

describe("pool", function() {
  var pool, pws, ws, closeSpy, sendSpy;
  beforeEach(function() {
    _.each(_.functions(websocket.WebSocket.prototype), function(m) {
      spyOn(websocket.WebSocket.prototype, m);
    })
    ws = new websocket.WebSocket("ws://example.com");
    closeSpy = ws.close;
    sendSpy = ws.send;
    spyOn(wsclient, "create").andReturn(ws);
    pool = wsclient.createPool();
    pws = pool.create("ws://example.com");
  });

  it("boo", function() {});

  it("creates a websocket", function() {
    expect(wsclient.create).toHaveBeenCalledWith("ws://example.com");
  });

  it("does not create a websocket for a second client", function() {
    wsclient.create.reset();
    var pws2 = pool.create("ws://example.com");
    expect(pws2).toBeDefined();
    expect(wsclient.create).not.toHaveBeenCalled();
  });

  it("emits events", function() {
    var spy = jasmine.createSpy("listener");
    pws.on("foo", spy);
    ws.emit("foo", "bar");
    expect(spy).toHaveBeenCalledWith("bar");
  });

  it("removes listeners", function() {
    var spy = jasmine.createSpy("listener");
    pws.on("bar", spy);
    pws.removeListener("bar", spy);
    ws.emit("bar");
    expect(spy).not.toHaveBeenCalled();
  });

  it("sends data", function() {
    pws.send("foo");
    expect(sendSpy).toHaveBeenCalled();
  });

  describe("closing with only one client", function() {
    var spy;
    beforeEach(function() {
      spy = jasmine.createSpy("close");
      pws.on("close", spy);
      pws.close();
    });

    it("closes the websocket", function() {
      expect(closeSpy).toHaveBeenCalled();
    });

    it("emits a close event", function() {
      expect(spy).toHaveBeenCalled();
    })

    it("emits only one close event", function() {
      expect(spy.callCount).toBe(1);
    });
  });

  describe("closing with more than one client", function() {
    var spy1, spy2, pws2;
    beforeEach(function() {
      pws2 = pool.create("ws://example.com");
      spy2 = jasmine.createSpy("pws2.close");
      pws2.on("close", spy2);
      spy1 = jasmine.createSpy("pws.close");
      pws.on("close", spy1);
      pws.close();
    });

    it("does not close the websocket", function() {
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it("emits a close event to the sender", function() {
      expect(spy1).toHaveBeenCalled();
    });

    it("does not emit a close event to other clients", function() {
      expect(spy2).not.toHaveBeenCalled();
    });

    it("does not emit close events to the closed client", function() {
      spy1.reset();
      ws.emit("close");
      expect(spy1).not.toHaveBeenCalled();
    });
  });
});
