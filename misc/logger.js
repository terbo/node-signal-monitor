const os = require('os'),
    fs = require('fs');

var cfg = require('../etc/config.js')

const colors = require('colors')

require('console-stamp')(console, [{}]);
colors.setTheme({
  intro: 'rainbow',
  info: 'green',
  status: 'cyan',
  ap: 'yellow',
  sta: 'white',
  debug: 'grey',
  error: 'red'
});

var logFile = fs.createWriteStream('log.txt', { flags: 'a' });
var logStdout = process.stdout;

console.log = function () {
  logFile.write(util.format.apply(null, arguments) + '\n');
  logStdout.write(util.format.apply(null, arguments) + '\n');
}
console.error = console.log;

function log() {}
function info() {}
function debug() {}
function warn() {}
function error() {}

module.exports = { log:log, info:info, debug:debug, warn:warn, error:error ]
