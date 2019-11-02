var cfg  = require('../etc/config')

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

var deviceSession = function(packet=false,sessions=false) {
  this.sessions = []
  if(packet)
    this.sessions = [this._session(packet)]
  else if(sessions)
    this.sessions = sessions
  
  this.limit = cfg.sensor.max_sessions
}

// return the last / active session
deviceSession.prototype.last = function() {
  if(this.sessions.length)
    return this.sessions[this.sessions.length-1]
  else return 0
}

// actually adds a new packet to the session 
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

  // this has to be limited ...
  if( (this.last().location[this.last().location.length - 1].lon != packet.lon) && 
      (this.last().location[this.last().location.length - 1].lat != packet.lat))
      this.last().location.push({time: now, lon: packet.lon, lat: packet.lat, rssi: packet.rssi, sensor: packet.sensor})

  this.last().exit = now
}

// the wrapper for a new session
deviceSession.prototype._session = function(packet) {
  var now = new Date(),
      session = {
        enter: now,
        exit: now,

        lastrssi: packet.rssi,
        maxrssi: packet.rssi,
        minrssi: packet.rssi,

        sensors: [packet.sensor],
        location: [ { time: now, lon: packet.lon, lat: packet.lat, rssi: packet.rssi, sensor: packet.sensor } ]
      }

  return session
}

module.exports = { deviceSession }
