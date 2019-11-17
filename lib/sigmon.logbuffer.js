/**
 * Summary            Logger with per-source buffering, which yields first line in log.
 *
 * Description        All modules log using log.xxx functions. Eventually this will be
 *                    extended with another library which coordinates forwarding and
 *                    handling of remote logs, and also file or database logging.
 *
 *
 * @file              This file defines the 'logbuf' class.
 *
 * @example           logbuf = require('logbuffer').logbuf
 *                    logger = new logbuf(  {  'source': 'sensor1',    // name for source
 *                                          'size':   256,          // maximum buffered lines
 *                                          'stdout': true,          // console.log also
 *                                          'default_level': 0      // default log level
 *                                       })
 *
 *                    logger.debug('xxx')
 *
 *                    while logger.last().next() -> do stuff with lines
 *
 *  
 */

/*  
    Currently doesn't use new config file
    Need to add 'emit' functions so we can just listen instead of settimer
    Also want to find local IP of machine and append that, and use as default name
*/

const os = require('os'),
    fs = require('fs'),
    events = require('events')

//var cfg = require('../etc/config.js')

const loglevels = ['info', 'verbose', 'error', 'debug', 'trace']

/**
 * Summary           Create and return a logger object.
 *
 * Description       Returns an object with named functions for each log level.
 *                   Saves 'size' lines of logs firing 'log.newline',
 *                   and then firing 'log.full' after exceeding this limit.
 */

var logbuf = function(source = 'unknown', size = 256, default_level = 0, stdout = false) {
  this.loglevels = loglevels

  this.source = source
  this.size = size
  this.default_level = default_level
  this.stdout = stdout
  this.buffer = []

  return this
}

logbuf.prototype.log = function(line) {
  this.add(this.default_level,line)
}


/**
 * Summary         Create named functions for each log level.
 *
 *
 * @param    {string}   [line]    Description: add a line to the log buffer.
 *
 */
 
for (var level=0; level < loglevels.length; level++) {
  eval(`logbuf.prototype.${loglevels[level]} = function(line) { this.add(${level}, line) }`)
}


logbuf.prototype.add = function (level, line) {
  if(typeof level == 'string')
		if(loglevels.includes(level))
			level = loglevels.indexOf(level)
		else {
			console.error('Invalid LOG LEVEL: ', level)
			level = 0
		}

	if(this.buffer.length <= this.size)
    this.buffer.push({time: new Date(), level: level, source: this.source, log: line})

  if(this.stdout)
    console.log(this.loglevels[level], this.source, line)
}

logbuf.prototype.last = function* () {
    while(this.buffer.length)
      yield this.buffer.splice(0,1)
}

module.exports = { logbuf }
