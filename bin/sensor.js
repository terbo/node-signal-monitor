#!/usr/bin/env node

const version = '0.0.1'

var cfg    = require('../etc/config'),
    gpsd   = require('../modules/gpsd'),
    hopper = require('../modules/hopper')

const fs   = require('fs'),
      os   = require('os'),
      WS   = require('ws'),
      pcap = require('pcap')

const hostname = os.hostname()

function packet_cb(pkt) {
  try {
    var packet = pcap.decode.packet(pkt),
            rf = packet.payload.ieee802_11Frame,
            p  = {}

    p.lon = gpsd.location.lon
    p.lat = gpsd.location.lat
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
    } else
    if (rf.type == 0 && rf.subType == 4) {
      for(var tag in rf.probe.tags) {
        tags = rf.probe.tags[tag]
      
        if(tags.type == 'ssid' && tags.ssid.length)
          p.ssid = tags.ssid
        }
    } // TODO: Other packet filters
    
    if(!p.hasOwnProperty('ssid'))
      p.ssid = '[hidden]'
     
    msg = JSON.stringify({type: 'data', interface: cfg.sensor.interface,
                          sensor: hostname, location: gpsd.location, data: p})
    ws.send(msg)
  } catch (e) {
    //console.log(e)
    return
  }
}

function heartbeat() {
  clearTimeout(this.pingTimeout);
  
  this.pingTimeout = setTimeout(() => {
    this.terminate();
  }, cfg.server.ws.ping_interval + 1000);
}

var ws = new WS(cfg.sensor.ws.server)
var sniffer = pcap.createSession(cfg.sensor.interface)

sniffer.on('error', function wtf() {
  console.log(arguments)
})

ws.on('open', heartbeat)
ws.on('ping', heartbeat)
ws.on('close', function clear() {
  clearTimeout(this.pingTimeout)
})

ws.on('open', function open() {
  console.log('Connected to websocket ' + cfg.sensor.ws.server)
  hopper.start()
  sniffer.on('packet', packet_cb)
  console.log('Listening on ' + sniffer.device_name)
})

ws.on('message', function incoming(message) {
  // type: command
  // type: get/set
  // type: status
  // type: log
  const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
  console.log(`Message from ${id}: ${message}`)
})

ws.on('error', function wtf() {
  console.error(arguments)
})
