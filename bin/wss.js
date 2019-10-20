#!/usr/bin/env node
"use strict"

var cfg  = require('../etc/config.js')

const fs       = require('fs'),
      os       = require('os'),
      oui      = require('oui'),
      WS       = require('ws'),
      process  = require('process'),
      program  = require('commander')

require('console-stamp')(console, { pattern: 'HH:MM:ss' })

program.name('sigmon websocket server')
       .version(cfg.version)
       .description('http://github.com/terbo/node-signal-monitor#readme')

cfg = cfg.server

program.option('-p,--port <port>','port to listen on',cfg.ws.port)
       .option('-l,--host <ip>','ip to bind to',cfg.ws.hostname)

program.parse(process.argv)

cfg.ws.port = program.port
cfg.ws.hostname = program.hostname

var data = {
  clients: [],
  devs: { ap: [], sta: [], ssid: [] },
  db: {},
  sensors: {},
  location: { lon: 0, lat: 0 },
  stats: { packets: 0, errors: 0, runtime: 0, cpu: 0,
           memory: 0, aps: 0, ssids: 0, stas: 0, vendors: 0,
         },
  info: { start_time: new Date(), port: cfg.ws.port,
          hostname: os.hostname(), versions: process.versions,
          user: os.userInfo(), pid: process.pid, version: program.version()
         },
}

//const logger = require('../modules/logger.js')
 
console.info(`Loading Signal Monitor version ${data.info.version} on ${data.info.hostname}`)

function updateStats() {
  data.stats.aps = data.devs.ap.length
  data.stats.ssids = data.devs.ssid.length
  data.stats.stas = data.devs.sta.length

  data.stats.cpu = process.cpuUsage()
  data.stats.memory = process.memoryUsage()
  data.stats.runtime = process.uptime()
  data.stats.uptime = os.uptime()
}

function newDevice(pkt) {
  const vendor = getVendor(pkt.mac)
  
  pkt.vendor = vendor[0]
  pkt.vendorSm = vendor[1]
  pkt.macSm = pkt.mac.substr(12,14).replace(':','')
  
  var tmp = { 
      type: null, // ap, sta
      pktype: pkt.rftype,
      seq: pkt.seq,
      mac: pkt.mac, // store as lc alnum, getmac translates?
      macSm: pkt.macSm, 
      sensor: pkt.sensor,
      lastseen: pkt.time,
      firstseen: pkt.time,
      vendor: pkt.vendor, // short, full
      vendorSm: pkt.vendorSm,
      ssid: pkt.ssid,
      rssi: pkt.rssi,
      channel: pkt.channel,
      recvchan: pkt.rcvchan,
      location: { lon: pkt.lon, lat: pkt.lat },
      hosts: [], // clients / ssids
      packets: [], // beacons / probes
      totalPackets: 1,
      totalBytes: pkt.len,
  }
  
  if(tmp.channel === 0)
    tmp.channel = tmp.recvchan

  if(pkt.rftype[0] === 0) {
    if(pkt.rftype[1] == 8) {
      tmp.type = 'ap'
      console.info(`+ AP '${tmp.ssid}' from ${tmp.sensor} type ${tmp.vendorSm} rssi ${tmp.rssi}`)

      tmp.enctype = pkt.enctype
      tmp.cyphertype = pkt.cyphertype
      tmp.rates = pkt.rates
      tmp.extrarates = pkt.extrarates

    } else if(pkt.rftype[1] == 4) {
      console.info(`+ Probe '${tmp.macSm}' for '${tmp.ssid}' from ${tmp.sensor} type ${tmp.vendorSm} rssi ${tmp.rssi}`)
      tmp.type = 'sta'
      tmp.hosts.push(tmp.ssid)
    }
  } else { // if(pkt.rftype[0] == 2) {
    console.info(`+ STA '${tmp.macSm}' for '${tmp.ssid}' from ${tmp.sensor} type ${tmp.vendorSm} rssi ${tmp.rssi}`)
    tmp.type = 'sta'

    tmp.hosts.push(tmp.ssid)
  }

  if(!data.devs[tmp.type].includes(tmp.mac))
    data.devs[tmp.type].push(tmp.mac)
  
  if(!data.devs.ssid.includes(tmp.ssid))
    data.devs.ssid.push(tmp.ssid)
  
  return tmp
}

function getVendor(mac) {
  const res = oui(mac)
  
  if(res !== null) {
    try {
      var vendor = res.split('\n')[0]
      var parts = vendor.split(' ')
      var vendorSm = parts[0].substr(0,7)
      
      if(parts.length > 1)
        vendorSm += parts[1].substr(0,1).toUpperCase() + parts[1].substr(1,2)
      return [vendor, vendorSm]
    } catch (e) {
      console.error(`OUI: ${e}`.error)
    }
  }
  return ['Unknown', 'None']
}

function read_packet(msg) {
  try {
    var p = msg.data
    var sensor = msg.sensor
    
    data.location = msg.location
    
    if(data.sensors.hasOwnProperty(sensor)) {
      data.sensors[sensor].packets += 1
      data.sensors[sensor].lastseen = new Date()
    }
    else {
      data.sensors[sensor] = { lastseen: new Date(),
                               firstseen: new Date(),
                               packets: 1 }
    }
    
    if(p.rftype[0] == 0 && p.rftype[1] == 8 && (!data.devs.ap.includes(p.mac)))
      data.db[p.mac] = newDevice(p) // ap beacon

    else if(p.rftype[0] == 0 && p.rftype[1] == 4 && (!data.devs.sta.includes(p.mac)))
      data.db[p.mac] = newDevice(p) // probe request
      
    else if(p.rftype[0] == 2) { // data packet
      var dst = p.dst
      var src = p.src
          
      if(data.devs.ap.includes(src)) {
        p.mac = dst
        p.ssid = data.db[src].ssid
        
        if(!data.db[src].hosts.includes(dst)) {
          data.db[src].hosts.push(dst)
              
          if(!data.db.hasOwnProperty(dst))
            data.db[dst] = newDevice(p)
        }
      } else
        if (data.devs.ap.includes(dst)) {
          p.mac = src
          p.ssid = data.db[dst].ssid
          
          if(!data.db[dst].hosts.includes(src)) {
            data.db[dst].hosts.push(src)
              
            if(!data.db.hasOwnProperty(src))
              data.db[src] = newDevice(p)
          }
      }
    }

    if(data.db.hasOwnProperty(p.mac)) {
      data.db[p.mac].location = { lon: p.lon, lat: p.lat }
      data.db[p.mac].lastseen = p.time
      data.db[p.mac].rssi = p.rssi
      data.db[p.mac].totalPackets += 1
      data.db[p.mac].totalBytes += p.len
      
      if(data.db[p.mac].type == 'sta' && (!data.db[p.mac].hosts.includes(p.ssid)))
        data.db[p.mac].hosts.push(p.ssid)
  
      data.stats.packets += 1
    }

    // history? sensors? rssi ring buffer?
  

  } catch (e) {
    console.error(`Decode Packet: ${e}`)
    data.stats.errors += 1
  }
}

function latest(since) {
  var out = {}
  updateStats()
  
  const now = new Date() / 1000
  
  Object.keys(data.db).forEach(k => {
    const dev = data.db[k]

    if(now < (dev.lastseen + (since))) {
      out[k] = data.db[k]
    }
  })
  
  return { sensors: data.sensors, info: data.info, stats: data.stats, db: out }
}

const wss = new WS.Server({ port: cfg.ws.port});
 
console.info(`Listening on port ${cfg.ws.port}`)


wss.on('connection', (ws, req) => {
  const ip = req.connection.remoteAddress
  const port = req.connection.remotePort

  const id = `${ip}_${port}`

  if(!data.clients.hasOwnProperty(id))
    data.clients[id] = { mode: null, host: ip, port: port,
                    firstseen: new Date(), lastseen: new Date() }

  console.info(`Connection from ${id}}`)
  
  ws.on('message', message => {
    const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
    //console.info(`Message from ${id} / ${message}`)
    
    try {
      var msg = JSON.parse(message)
    } catch (e) {
      console.error(`Bad message format from ${id}: ${message}`)
      return
    }

    data.clients[id].lastseen = new Date()
    
    if(msg.hasOwnProperty('type')) {
      if(msg.type == 'data') {
        read_packet(msg)
      } else
      if(msg.type == 'log') {
        //read_log(msg)
      } else
      if (msg.type == 'status') {
        //setStatus(msg)
      } else
      if (msg.type == 'time') {
        //checkTime(msg)
      }
    } else
    if(msg.hasOwnProperty('cmd')) {
      if (msg.cmd == 'stream') {
        if(msg.hasOwnProperty('arg')) {
          if(msg.arg == 'start') {}
          else if(msg.arg == 'stop') {}
        }
      } else
      if (msg.cmd == 'latest') {
        var duration
        
        if(msg.hasOwnProperty('arg'))
          duration = parseInt(msg.arg)
        else
          duration = cfg.ws.subscribe_interval
        
        ws.send(JSON.stringify({ type: 'latest', location: data.location,
                                 time: new Date(), data: latest(duration)}))
      } else
      if (msg.cmd == 'status') {
        updateStats()
        ws.send(JSON.stringify({ type: 'status', time: new Date(),
                                 data: {sensors: data.sensors, stats: data.stats, info: data.info }}))
      } else
      if (msg.cmd == 'dump') {
        updateStats()
        ws.send(JSON.stringify({ type: 'dump', time: new Date(), data: data}))
      } else
      if (msg.cmd == 'subscribe') {
        console.info(`New Subscriber: ${id}`)
        
        // subscribe to latest, subscribe to logs, subscribe to status
        // subscribe to location, etc
        if(msg.hasOwnProperty('arg')) {
          if(msg.arg !== null)
            var interval = msg.arg
        }
        
        data.clients[id].timer = setInterval(() => { 
          const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
          
          if (ws.readyState === WS.OPEN) {
            ws.send(JSON.stringify({ type: 'latest', time: new Date(),
                                     location: data.location,
                                     data: latest(cfg.ws.subscribe_interval)}))
          } else {
            console.debug(`Connection closed, terminating ${id}`)
            try {
              ws.terminate()
              
              if(data.clients[id].hasOwnProperty('timer')) {
                clearInterval(data.clients[id].timer)
                delete data.clients[id].timer
              }
            } catch(e) {
              console.error(`Terminating connection: ${e}`)
          }
        }
        
        }, cfg.ws.subscribe_interval * 1000) 
        
        ws.send(JSON.stringify({ type: 'latest', time: new Date(),
                                 location: data.location,
                                 data: latest(cfg.ws.subscribe_interval)}))
        
      } else
      if (msg.cmd == 'unsubscribe') {
        if(data.clients[id].hasOwnProperty('timer')) {
          clearInterval(data.clients[id].timer)
          delete data.clients[id].timer
        }
      }
    } else {
      console.error(`Invalid packet: ${message}`)
    }
  })
})
