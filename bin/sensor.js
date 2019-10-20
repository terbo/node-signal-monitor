#!/usr/bin/env node
"use strict"

var cfg       = require('../etc/config'),
    gps       = require('../lib/gps'),
    hopper    = require('../lib/hopper'),
    getChan   = require('../lib/wifichannel').get

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

program.name('sigmon.sensor')
       .version(cfg.version)
       .description('sigmon 802.11 pcap collector & websocket client')

cfg = cfg.sensor

program.option('-A, --airmon', 'use airmon-ng to set interface to monitor mode', cfg.use_airmon_ng)
       .option('-i, --iface <interface>', 'interface to listen on', cfg.interface)
       .option('-s, --hostname <hostname>', 'websocket hostname', cfg.ws.hostname)
       .option('-p, --port <port>', 'websocket port', cfg.ws.port)
       .option('-C, --channel <channel>', 'use fixed channel', cfg.hopper.channel)
       .option('-D, --dwell <ms>', 'set channel hop dwell time', cfg.hopper.dwell)
       .option('--gps <gps_server>', 'gpsd server', cfg.gps.hostname)
       .option('--location <lat,lon>', 'use fixed location', `${cfg.gps.latitude},${cfg.gps.longitude}`)
       .option('-R, --disable-reconnect', 'disable reconnecting', !cfg.reconnect)
       .option('-H, --disable-hopper', 'disable channel hopping', !cfg.hopper.enabled)
       .option('-d, --debug', 'enable debugging output', false)

program.parse(process.argv)

cfg.hopper.enabled = !program.disableHopper 
cfg.hopper.channel = program.channel
cfg.hopper.dwell = program.dwell

program.location = program.location.split(',')
cfg.gps.longitude = program.location[0]
cfg.gps.latitude = program.location[1]

function packet_cb(buf) {
  try {
    const packet = pcap.decode.packet(buf),
            rf = packet.payload.ieee802_11Frame
    var pkt  = {}

    pkt.sensor  = hostname
    pkt.iface   = program.iface
    pkt.len     = packet.pcap_header.len
    pkt.time    = packet.pcap_header.tv_sec
    pkt.rssi    = packet.payload.signalStrength
    pkt.rftype  = [rf.type, rf.subType]
    
    // I think this is the channel the receiver was on when the packet was captured
    pkt.rcvchan = getChan(packet.payload.frequency)
    pkt.channel = 0 
    pkt.mac     = rf.shost.toString()
    pkt.seq     = rf.fragSeq
    pkt.lon     = gps.location.lon
    pkt.lat     = gps.location.lat
    
    if(rf.type == 0 && rf.subType == 8) {
      for(var tags in rf.beacon.tags) {
        var tag = rf.beacon.tags[tags]
      
        if(tag.type == 'ERP')
          pkt.enctype = tag.value
        
        if(tag.type == 'RSN')
          pkt.cyphertype = tag.value
        
        if(tag.type == 'rates')
          pkt.rates = tag.value
        
        if(tag.type == 'extrarates')
          pkt.extrarates = tag.value
        
        if(tag.type == 'channel')
          pkt.channel = tag.channel 
        
        if(tag.type == 'ssid' && tag.ssid.length)
          pkt.ssid = tag.ssid
      }
    } else
    if (rf.type == 0 && rf.subType == 4) {
      for(var tags in rf.probe.tags) {
        var tag = rf.probe.tags[tags]
      
        if(tag.type == 'ssid' && tag.ssid.length)
          pkt.ssid = tag.ssid
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
      //else
      //  pkt.ssid = '[hidden]'
     
    const msg = JSON.stringify({type: 'data', interface: program.iface,
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

//var ws = new RWS(`${cfg.ws.protocol}//${cfg.ws.server}:${cfg.ws.port}/${cfg.ws.endpoint}`, [], { WebSocket: WS } )
var ws = new RWS(`ws://${program.hostname}:${program.port}/ws`, [], { WebSocket: WS, debug: program.debug } )

var sniffer = pcap.createSession(program.iface)

sniffer.on('error', (error) => {
  console.error(`PCAP: ${error}`)
})

ws.addEventListener('open', () => {
  console.info('Connected to websocket ' + program.hostname)
  
  if(!cfg.gps.enabled)
    gps = {lat: cfg.gps.latitude, lon: cfg.gps.longitude}
 
  hopper.cfg = cfg.hopper
  
  if(program.disableHopper) {
    console.info(`Setting channel to ${program.channel}`)
    hopper.set_channel(program.channel)
  }
  else
    hopper.start()
  
  sniffer.on('packet', packet_cb)
  console.info('Listening on ' + sniffer.device_name)
})

ws.addEventListener('close', () => {
  console.error('Disconnected from websocket')
  
  if(program.disableReconnect)
    process.exit(2)
})

ws.addEventListener('message', message => {
  // type: command
  // type: get/set
  // type: status
  // type: log
  //const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
  console.debug(`Message ${message}`)
})

ws.addEventListener('error', (e) => {
  console.error(`WebSocket client: ${e}`)
})
