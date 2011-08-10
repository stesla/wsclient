var fs = require('fs');
var path = require('path');
var specDir = path.dirname(fs.realpathSync(__filename));
require.paths.unshift(path.join(specDir, "../src"));

_ = require("underscore");
events = require("events");
helper = require("helper");
sys = require("sys");
websocket = require('websocket');
wsclient = require('index');

jasmine.getEnv().beforeEach(function(){
  spyOn(process, 'nextTick');
  spyOn(global, 'clearTimeout');
  spyOn(global, 'setTimeout');
});
