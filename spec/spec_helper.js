var fs = require('fs');
var path = require('path');
var specDir = path.dirname(fs.realpathSync(__filename));
require.paths.unshift(path.join(specDir, "../src"));

_ = require("underscore");
events = require("events");
helper = require("helper");
websocket = require("websocket");
wsclient = require('index');
