#!/usr/bin/env node
"use strict"

const version = '0.0.1'

var cfg     = require('../etc/config'),
    gps     = require('../modules/gps'),
    hopper  = require('../modules/hopper'),
    getChan = require('../modules/wifichannel').get

const fs      = require('fs'),
      os      = require('os'),
      pcap    = require('pcap'),
      RWS     = require('reconnecting-websocket'),
      WS      = require('ws'),
      program = require('commander'),
      process = require('process') 
const hostname = os.hostname()

require('console-stamp')(console, { pattern: 'HH:MM:ss' });
let errors = 0

program.option('-i, --iface <iface>','choose interface')

if(program.iface)
  cfg.sensor.interface = program.iface

function packet_cb(buf) {
  try {
    const packet = pcap.decode.packet(buf),
            rf = packet.payload.ieee802_11Frame
    var pkt  = {}

    pkt.sensor  = hostname
    pkt.len     = packet.pcap_header.len
    pkt.time    = packet.pcap_header.tv_sec
    pkt.rftype  = [rf.type, rf.subType]
    pkt.channel = getChan(packet.payload.frequency)
    pkt.mac     = rf.shost.toString()
    pkt.seq     = rf.fragSeq
    pkt.rssi    = packet.payload.signalStrength
    pkt.lon     = gps.location.lon
    pkt.lat     = gps.location.lat
    
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
    } else if (rf.type == 2) {
      pkt.dst = rf.dhost.toString()
      pkt.src = rf.shost.toString()
    }
    
    if(!pkt.hasOwnProperty('ssid') || (pkt.hasOwnProperty('ssid') && pkt.ssid.len <= 1))
      if(rf.subType != 4)
        pkt.ssid = '[hidden]'
      else if(rf.subType == 4)
        pkt.ssid = '[any]'
      else
        pkt.ssid = '[hidden]'
     
    const msg = JSON.stringify({type: 'data', interface: cfg.sensor.interface,
                          sensor: hostname, location: gps.location, data: pkt})
    ws.send(msg)
  } catch (e) {
    /*errors += 1
    if(errors % 200000 == 0)
      console.error(`${errors} errors received - ${e}`)
    */
    return
  }
}

var ws = new WS(cfg.sensor.ws.server, [], { WebSocket: WS } )
//ws.debug = true
var sniffer = pcap.createSession(cfg.sensor.interface)

sniffer.on('error', () => {
  console.error('PCAP:' + arguments)
})

ws.on('open', () => {
  console.info('Connected to websocket ' + cfg.sensor.ws.server)
  hopper.start()
  sniffer.on('packet', packet_cb)
  console.info('Listening on ' + sniffer.device_name)
})

ws.on('message', message => {
  // type: command
  // type: get/set
  // type: status
  // type: log
  //const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
  console.debug(`Message ${message}`)
})

ws.on('error', () => {
  console.error('WS Client:')
})
