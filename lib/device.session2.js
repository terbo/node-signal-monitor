//path.dirname(process.argv[0]
const path = require('path'),
      cfg  = require('../etc/config')

// a class to organize presence of detected devices
// along with other protocol specific information
// the default length of a session is 4 minutes
// access object.sessions to manipulate the array of sessions
// or use .add, .last, and .extend for easier access

// e.g. create a new session object
//   device.session = new deviceSession(packet)
// create a session and remove the first if more sessions than limit
//   device.session.add(packet)
// check if device was seen in the last minute
//   device.session.last().exit < now - 60000 
// extend last time device was seen
//   device.session.extend(packet)


// instantiated with a single packet, it will return a new session
// with a session object, will return the object dressed in a session

var deviceSession = function(packet = null, sessions = null, limit = cfg.sensor.max_sessions, maxloc = cfg.sensor.max_locations ) {
  this.sessions = []

  if(packet)
    this.sessions.add(packet)
  else
  if(sessions)
    this.sessions = sessions

  this.limit = limit
  this.maxloc = maxloc

  return this
}

// return the last / active session.
// arg type to return last location array or duration of last session

deviceSession.prototype.last = function(type = null) {
  if(type == 'location')
/*    return [ this.sessions[this.sessions.length -1 ].location[ this.sessions[this.sessions.length -1 ].location.length - 1].lat,
            this.sessions[this.sessions.length -1 ].location[ this.sessions[this.sessions.length -1 ].location.length - 1].lon ]
*/
    return { sensor: this.sessions[this.sessions.length -1].location[ this.sessions[this.sessions.length -1].location.length - 1].sensor,
             lat: this.sessions[this.sessions.length -1].location[ this.sessions[this.sessions.length -1].location.length - 1].lat,
             lon: this.sessions[this.sessions.length -1].location[ this.sessions[this.sessions.length -1].location.length - 1].lon,
             rssi: this.sessions[this.sessions.length -1].location[ this.sessions[this.sessions.length -1].location.length - 1].rssi,
             //duration: this.duration(this.sessions.length - 1)
             duration: new Date(this.sessions[this.sessions.length -1].exit).getTime() - new Date(this.sessions[this.sessions.length -1].enter).getTime()
           }

  else
  if(type == 'duration')
    //return this.duration(this.sessions.length - 1)
    return Number(new Date(this.sessions[this.sessions.length-1].exit).getTime() - new Date(this.sessions[this.sessions.length-1].enter).getTime())

  if(this.sessions.length)
    return this.sessions[this.sessions.length-1]
  else return false
}

// return the first session
// arg true to return last location array

deviceSession.prototype.first = function(type = null) {
  if(type == 'location')
    return [ this.sessions[0].location[ this.sessions[0].location.length - 1].lon,
             this.sessions[0].location[ this.sessions[0].location.length - 1].lat ]
  else
  if(type == 'duration')
    return Number(new Date(this.sessions[0].exit).getTime() - new Date(this.sessions[0].enter).getTime()) || 0
  if(this.sessions.length)
    return this.sessions[0]
  else return false
}

// given a session array index, returns the duration of the session
deviceSession.prototype.duration = function(idx) {
  return new Date(this.sessions[idx].exit).getTime() - new Date(this.sessions[idx].enter).getTime()
}

// actually adds a new session to the object
// while limiting the number of sessions kept
// default is 10, to determine if devices are
// static AP's or desktops, or regular visitors

deviceSession.prototype.add = function(packet) {
  if(this.sessions.length > this.limit)
    this.sessions = this.sessions.reverse().splice(0,this.limit).reverse()
  this.sessions.push(this._session(packet))
}

// updates the last time seen within a period of [session] seconds
// also *will compare the distance changed since the last time seen (turfjs)
// and log that in a rotating buffer with the other protocol details
// a lot of which may only be useful for moving setups and considered optional

deviceSession.prototype.extend = function(packet) {
  var now = new Date()

  // check if packet has rftype[0/1] == wifi packet
  // or radio_id if from sdr (24 bit mac address)
  // or devclass for bluetooth

  if(packet.hasOwnProperty('rftype')) {
    if(this.last().maxrssi > packet.rssi)
      this.last().maxrssi = packet.rssi
    if(this.last().minrssi < packet.rssi)
      this.last().minrssi = packet.rssi
  }

  if(!this.last().sensors.includes(packet.sensor))
    this.last().sensors.push(packet.sensor)

  if( (this.last().location[this.last().location.length - 1].lon != packet.lon) && 
      (this.last().location[this.last().location.length - 1].lat != packet.lat) &&
      this.last().location[this.last().location.length - 1].sensor != packet.sensor) {

      if(this.last().location.length >= this.maxloc)
        this.last().location = this.last().location.reverse().splice(0,this.maxloc).reverse()

      this.last().location.push({time: now, lon: packet.lon, lat: packet.lat, rssi: packet.rssi, sensor: packet.sensor})
  }

  this.last().duration = now.getTime() - new Date(this.last().enter).getTime()
  this.last().exit = now
}

// the wrapper for a new session
// it could automatically calculate the duration . . . .

deviceSession.prototype._session = function(packet) {
  var now = new Date(),
      session = {
        enter: now,
        exit: now,

        lastrssi: packet.rssi,
        maxrssi: packet.rssi,
        minrssi: packet.rssi,
        duration: 0,

        sensors: [packet.sensor],
        location: [ { time: now, lon: packet.lon, lat: packet.lat, rssi: packet.rssi, sensor: packet.sensor } ]
      }

  return session
}

//deviceSession.prototype.to_json = function() {
//  return JSON.stringify(this)
//} 

deviceSession.prototype.summary = function() {
  var result = {}

  result.totalDuration = 0
  result.totalSessions = this.sessions.length - 1
  result.firstseen = this.first().enter
  result.lastseen = this.last().exit
  result.sensors = []

  Object.keys(this.sessions).forEach(sesh => {
    result.totalDuration += new Date(this.sessions[sesh].exit).getTime() - new Date(this.sessions[sesh].enter).getTime()
    result.sensors.concat(this.sessions[sesh].sensors)
  })

  result.sensors = new Set(result.sensors)

  return result
}

module.exports = { deviceSession }
