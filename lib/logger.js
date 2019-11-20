const os = require('os'),
    fs = require('fs');

var cfg = require('../etc/config.js'),
    _verbose = false,
    _lastlog = [], 
    source = 'smwss',
    maxbuf = 32

/*const colors = require('colors')

/require('console-stamp')(console, [{}]);
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

*/

/*console.log = function () {
  logFile.write(util.format.apply(null, line) + '\n');
  logStdout.write(util.format.apply(null, line) + '\n');
}
console.error = console.log;
*/

function log() {
  var line = arguments[0]
  lastlog('info',line)
  if(_verbose)
    console.log(line)
}

function debug() {
  var line = arguments[0]
  lastlog('debug',line)
  if(_verbose)
  console.debug(line)
}
function error() {
  var line = arguments[0]
  lastlog('error',line)
  if(_verbose)
  console.error(line)
}

/**

  @param    {string}  [line]    Description: add a line to the last log

  @return   {array}   Returns last lines of log and clears log. Maybe yield string instead?

**/

function lastlog() {
  if(arguments.length) {
    if(_lastlog.length < maxbuf)
      _lastlog.push({time: new Date(), level: arguments[0], source: source, log: arguments[1]})
  } else
  return _lastlog.splice(0,_lastlog.length) || []
}

function verbose() {
  _verbose = !_verbose
}

module.exports = { log, debug, error, lastlog, verbose }
