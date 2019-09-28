#!/usr/bin/env node

const version = '0.0.1'

var cfg = require('../etc/config')

const fs        = require('fs'),
      os        = require('os'),
      pcap      = require('pcap')
      WebSocket = require('ws')
      node_gpsd = require('node-gpsd')

const hostname = os.hostname()

const gpsd_events = [ 'tpv', 'sky' ]

var gpsd_reconnect = 1

var gpsd = new node_gpsd.Listener(cfg.sensor.gpsd)

var location = {lon: 0, lat: 0, time: 0, sats: 0, acc: 0, heading: 0}

gpsd_events.forEach(function(ev) {
  gpsd.on(ev.toUpperCase(), function(data) {
    try {
      if(data.class == 'SKY') {
        //console.log(`Got Satellites: ${data.satellites.length}`)
        location.sats = Number(data.satellites.length)
      }
      if(data.class == 'TPV' && data.mode == 3) {
        location.lon = data.lon
        location.lat = data.lat
        location.time = data.time

        if(data.hasOwnProperty('speed'))
          location.speed = data.speed
        if(data.hasOwnProperty('alt'))
          location.alt  = data.alt
        if(data.hasOwnProperty('track'))
          location.track = data.track
      } else {
        //console.info(data)
      }
    } catch (e) {
      console.error(`GPSD: ${e}`)
      return
    }
  })
})

gpsd.on('disconnected', function () {
  if(gpsd_reconnect !== null)
    return

  gpsd_reconnect = setInterval(function() {
    console.warn('GPSD Disconnected, reconnecting ...')
    gpsd.connect(function() {
      if(gpsd_reconnect !== null) {
        clearInterval(gpsd_reconnect)
        gpsd_reconnect = null
        gpsd.watch()
        console.info('GPSD Reconnected.')
      }
    })
  }, 3000)
})

gpsd.connect(function() {
  console.log(`Connected to GPSD ${cfg.sensor.gpsd.address}`)
  gpsd.watch()
})

function packet_cb(pkt) {
    try {
      //if(String(pkt).length < 100)
      //  return
      
      var packet = pcap.decode.packet(pkt)
      var rf = packet.payload.ieee802_11Frame
      
      p = {}

      p.lon = location.lon
      p.lat = location.lat
      p.len = packet.pcap_header.len
      p.sensor = hostname
      p.type = rf.type
      p.subtype = rf.subType
      p.time = new Date() / 1000
      p.rssi = packet.payload.signalStrength
      p.seq = rf.fragSeq
      
      p.mac = rf.shost.toString()
      
      if(rf.type == 0 && rf.subType == 8) {
        for(var tag in rf.beacon.tags) {
          tags = rf.beacon.tags[tag]
        
          if(tags.type == 'channel')
            p.channel = tags.channel 
          if(tags.type == 'ssid' && tags.ssid.length)
            p.ssid = tags.ssid
        }
        if(!p.hasOwnProperty('ssid'))
          p.ssid = '[hidden]'
      } else if (rf.type == 0 && rf.subType == 4) {
        for(var tag in rf.probe.tags) {
          tags = rf.probe.tags[tag]
          
          if(tags.type == 'ssid')
            if(tags.ssid.length)
              p.ssid = tags.ssid
            else
              p.ssid = '[Any]'
          }
    } else if(rf.type == 2) {
      p.dst = rf.dhost.toString()
      p.src = rf.shost.toString()
    } 
     
    if(p !== undefined) {
      msg = JSON.stringify({type: 'data', interface: cfg.sensor.interface,
                            sensor: hostname,
                            location: location, data: p})
      ws.send(msg)
    } 
  } catch (e) {
    //console.log(e)
    return
  }
}

function heartbeat() {
  clearTimeout(this.pingTimeout);

  // Use `WebSocket#terminate()`, which immediately destroys the connection,
  // instead of `WebSocket#close()`, which waits for the close timer.
  // Delay should be equal to the interval at which your server
  // sends out pings plus a conservative assumption of the latency.
  this.pingTimeout = setTimeout(() => {
    this.terminate();
  }, cfg.server.ws.ping_interval + 1000);
}

ws = new WebSocket(cfg.sensor.ws.server)
sniffer = pcap.createSession(cfg.sensor.interface)

ws.on('open', heartbeat)
ws.on('ping', heartbeat)
ws.on('close', function clear() {
  clearTimeout(this.pingTimeout)
})

ws.on('open', function open() {
  console.log('Connected to websocket ' + cfg.sensor.ws.server)
  console.log('Listening on ' + sniffer.device_name)
  sniffer.on('packet', packet_cb)
})

ws.on('message', function (message) {
  // type: command
  // type: get/set
  // type: status
  // type: log
  const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
  console.log(`Message from ${id}: ${message}`)
})
