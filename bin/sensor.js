#!/usr/bin/env node

const version = '0.0.1'

var cfg     = require('../etc/config'),
    gps     = require('../modules/gps'),
    hopper  = require('../modules/hopper')
    getChan = require('../modules/wifichannel').get

const fs    = require('fs'),
      os    = require('os'),
      pcap  = require('pcap'),
      RWS   = require('reconnecting-websocket'),
      WS    = require('ws')

const hostname = os.hostname()

let errors = 0

function packet_cb(buf) {
  try {
    const packet = pcap.decode.packet(buf),
            rf = packet.payload.ieee802_11Frame
    var pkt  = {}

    pkt.sensor  = hostname
    pkt.len     = packet.pcap_header.len
    pkt.time    = packet.pcap_header.ts_usec
    pkt.rftype  = [rf.type, rf.subType]
    pkt.channel = getChan(packet.payload.frequency)
    pkt.mac     = rf.shost.toString()
    pkt.seq     = rf.fragSeq
    pkt.rssi    = packet.payload.signalStrength
    pkt.lon     = gps.lon
    pkt.lat     = gps.lat
    
    if(rf.type == 0 && rf.subType == 8) {
      for(var tag in rf.beacon.tags) {
        var tags = rf.beacon.tags[tag]
      
        if(tags.type == 'channel')
          pkt.channel2 = tags.channel 
        
        if(tags.type == 'ssid' && tags.ssid.length)
          pkt.ssid = tags.ssid
      }
    } else
    if (rf.type == 0 && rf.subType == 4) {
      for(var tag in rf.probe.tags) {
        var tags = rf.probe.tags[tag]
      
        if(tags.type == 'ssid' && tags.ssid.length)
          pkt.ssid = tags.ssid
        }
    } else
    if (rf.type == 2) {
      // where is ssid here?
      if(rf.hasOwnProperty('beacon'))
        pkt.hasbeacon = true
      else if(rf.hasOwnProperty('probe'))
        pkt.hasprobe = true
      
      pkt.dst = rf.dhost.toString()
      pkt.src = rf.shost.toString()
    }
    
    if(!pkt.hasOwnProperty('ssid'))
      if(rf.subType != 4)
        pkt.ssid = '[hidden]'
      else if(rf.subType == 4)
        pkt.ssid = '[any]'
     
    const msg = JSON.stringify({type: 'data', interface: cfg.sensor.interface,
                          sensor: hostname, location: gps.location, data: pkt})
    ws.send(msg)
  } catch (e) {
    errors += 1
    if(errors % 200000 == 0)
      console.log(`${errors} errors received - ${e}`)
    return
  }
}

var ws = new WS(cfg.sensor.ws.server, [], { WebSocket: WS } )
//ws.debug = true
var sniffer = pcap.createSession(cfg.sensor.interface)

sniffer.on('error', function wtf() {
  console.error('PCAP:' + arguments)
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
  console.error('WS Client:')
})
