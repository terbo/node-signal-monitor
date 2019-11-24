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
      wifiProtocol = require('./wifi.protocol'),
      wifiChannels = wifiProtocol.frequencies,
      frameTypes  = wifiProtocol.frames

Sensor = function(packet = null, sensor = null, max_packet_graphs=256) {
  var now = new Date(),
     nowH = now.getHours().toString().padStart(2,0) + ':' +
            now.getMinutes().toString().padStart(2,0) + ':' +
            now.getSeconds().toString().padStart(2,0)

  if(packet) {
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

    Object.keys(wifiChannels['g']).forEach(freq => {
      this.graphs.channels[ parseInt(freq) ] = { channel: parseInt(wifiChannels['g'][freq]), count: 0 }
    })

    Object.keys(wifiChannels['ac']).forEach(freq => {
      this.graphs.channels[ parseInt(freq) ] = { channel: parseInt(wifiChannels['ac'][freq]), count: 0 }
    })

    this.graphs.channels[ parseInt(packet.freq) ] = { channel: parseInt(packet.channel),  count: 1 }
  } else if(sensor) {
    Object.keys(sensor).forEach(key => {
      this[key] = sensor[key]
    })
  } else {
    throw 'no packet or sensor sent'
  }
  this.max_packet_graphs = max_packet_graphs

  return this
}

Sensor.prototype.update = function(packet) {
  var now = new Date(),
     nowH = now.getHours().toString().padStart(2,0) + ':' +
            now.getMinutes().toString().padStart(2,0) + ':',
    lastIdx = 0,
    lastCol = 0

  nowH += Math.round(((now.getSeconds()/2)*.4)*5).toString().padStart(2,0)

  this.location = { lat: packet.lat, lon: packet.lon }
  this.lastseen = new Date()
  this.totalPackets += 1
  this.totalBytes += parseInt(packet.len)

  this.graphs.packetTypes[ packet.rftype[0] ][ packet.rftype[1] ]  += 1

  if(this.graphs.channels.hasOwnProperty(parseInt(packet.freq)))
    this.graphs.channels[ parseInt(packet.freq) ].count += 1
  else
    this.graphs.channels[ parseInt(packet.freq) ] = { channel: parseInt(packet.channel),  count: 1 }

  if(this.graphs.packets.x.length > this.max_packet_graphs) {
    this.graphs.packets.x = [] //this.graphs.packets.x.reverse().splice(0, this.max_packet_graphs).reverse()
    this.graphs.packets.y = [] //this.graphs.packets.y.reverse().splice(0, this.max_packet_graphs).reverse()
  }

  lastIdx = this.graphs.packets.x.length - 1 // get the index of the last data column

  if(this.graphs.packets.x[lastIdx] != nowH)
    this.graphs.packets.x.push(nowH)

  lastCol = this.graphs.packets.y.length - 1

  if(lastCol < lastIdx)
    this.graphs.packets.y[lastIdx] = 1 // now increase the number of packets
  else
    this.graphs.packets.y[lastIdx] += 1
}

Sensor.prototype.channelGraph = function(band = null) {
  var result = {},
      results = []

  if(band == 'g' || (band === null)) {
    Object.keys(wifiChannels['g']).forEach(freq => {
      var chan = wifiProtocol.getChannel(freq)
      if(chan !== null)
      if(this.graphs.channels.hasOwnProperty(parseInt(freq)) && this.graphs.channels[freq].count)
        result[chan] = this.graphs.channels[parseInt(freq)].count
      else
        result[chan] = 0
    })
  }

  if (band == 'ac' || (band === null)) {
    Object.keys(wifiChannels['ac']).forEach(freq => {
      var chan = wifiProtocol.getChannel(freq)
      if(chan !== null)
      if(this.graphs.channels.hasOwnProperty(parseInt(freq)) && this.graphs.channels[freq].count)
        result[chan] = this.graphs.channels[parseInt(freq)].count
      else
        result[chan] = 0
    })
  }

  Object.keys(result).sort((a,b) => { return a - b }).forEach(res => { results.push(result[res]) })

  return results
}

module.exports = { Sensor }
