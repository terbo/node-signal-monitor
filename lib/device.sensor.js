// a class containing individual sensor related info
// including graphs of packets/types, channel usage,
// and chronological statistics/benchmarks

// should draw from etc/sensors.yaml

// sensor1 = new Sensor(packet) - gets sensor name from packet
// sensor1.update(packet)
// sensor1.active() => true || false
// sensor1.cmd() => send various commands/messages
// sensor1.location() => return last location as { lat, lon }
// sensor1.config() => manipulate running configuration, maybe save?
// sensor1.channels() => return list of channels covered
// sensor1.channelGraph() => return graph of channel usage
// sensor1.packetGraph() => return graph of packets by minute
// sensor1.packetTypes() => return graph of types of packets seen
// sensor1.perSecond, perMinute, perHour, perDay
// sensor1.uptime() => return sensor uptime
// sensor1.iface() => return sensor interface
// sensor1.source() => return source type, bt, sdr, wifi, etc
// sensor1.logs()
// sensor1.status()

const path = require('path'),
      cfg  = require('../etc/config'),
      frameTypes = require('./wifi.protocol').frames

Sensor = function(packet) {
  var now = new Date()

  this.name = packet.sensor
  this.active = true

  this.firstseen = now
  this.lastseen = now

  this.totalPackets = 1
  this.totalBytes = parseInt(packet.len)

  this.config =  {}
  this.info =  {}
  this.location =  { lon: packet.lon,  lat: packet.lat }
  this.stats =  {}

  this.graphs =  {
    packets:  { x: [], y: [] },
    channels:  {},
    packetTypes: {},
  }

  Object.keys(frameTypes.type).forEach(type => {
    this.graphs.packetTypes[ parseInt(type) ] = {}

    Object.keys(frameTypes.subtype).forEach(subtype => {
      this.graphs.packetTypes[ parseInt(type) ][ parseInt(subtype) ] = 0
    })
  })

  this.graphs.packetTypes[ parseInt(packet.rftype[0]) ][ parseInt(packet.rftype[1]) ] = 1

  this.graphs.channels[ parseInt(packet.freq) ] = { channel: parseInt(packet.channel),  count: 1}

  return this
}

Sensor.prototype.update = function(packet) {
  this.location = { lat: packet.lat, lon: packet.lon }
  this.lastseen = new Date()
  this.totalPackets += 1
  this.totalBytes += parseInt(packet.len)

  this.graphs.packetTypes[ packet.rftype[0] ][ packet.rftype[1] ]  += 1

  if(this.graphs.channels.hasOwnProperty(packet.freq))
    this.graphs.channels[ packet.freq ].count += 1
  else {
    this.graphs.channels[ packet.freq ] = { channel: parseInt(packet.channel),  count: 1}
  }
}

module.exports = { Sensor }
