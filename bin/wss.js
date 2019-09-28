#!/usr/bin/env node

const version = '0.0.1'

var cfg  = require('../etc/config.js')

const fs       = require('fs'),
      os       = require('os'),
      oui      = require('oui'),
      WS       = require('ws'),
      process  = require('process')

var clients = [] // need to linnk this to sensors..

var data = {
  devs: {ap: [], sta: [], ssid: []},
  db: {},
  sensors: {},
  location: {lon: 0, lat: 0},
  stats: { packets: 0, errors: 0, runtime: 0, cpu: 0,
           memory: 0, aps: 0, ssids: 0, stas: 0, vendors: 0
         },
  info: { start_time: new Date(), port: cfg.server.ws.port,
          hostname: os.hostname(), versions: process.versions,
          user: os.userInfo(), pid: process.pid, version: version
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
  const vendor = get_vendor(pkt.mac)
  
  pkt.vendor = vendor[0]
  pkt.vendorSm = vendor[1]
  pkt.macSm = pkt.mac.substr(12,14).replace(':','')
  
  var tmp = { 
      type: null, // ap, sta
      mac: pkt.mac, // store as lc alnum, getmac translates?
      macSm: pkt.macSm, 
      seen: { first: pkt.time, last: pkt.time },
      vendor: pkt.vendor, // short, full
      vendorSm: pkt.vendorSm,
      ssid: pkt.ssid,
      rssi: { last: pkt.rssi, max: 0, min: 0, avg: 0},
      location: { lon: pkt.lon, lat: pkt.lat },
      hosts: {}, // clients / ssids
      packets: [], // beacons / probes
      totalPackets: 1,
      totalBytes: pkt.len,
  }

  
  if(pkt.type == 0 && pkt.subtype == 8) {
    tmp.type = 'ap'
    console.info(`+ AP '${tmp.ssid}' type ${tmp.vendorSm} rssi ${tmp.rssi.last}`)
  } else {
    //console.info(`+ Probe '${tmp.macSm}' for ${tmp.ssid} type ${tmp.vendorSm} rssi ${tmp.rssi.last}`)
    tmp.type = 'sta'
  }
  
  if(!data.devs[tmp.type].includes(tmp.mac))
    data.devs[tmp.type].push(tmp.mac)
  
  if(!data.devs.ssid.includes(tmp.ssid))
    data.devs.ssid.push(tmp.ssid)
  
  return tmp
}

function get_vendor(mac) {
  const res = oui(mac)
  
  if(res !== null) {
    try {
      var vendor = res.split('\n')[0]
      var sp = vendor.split(' ')
      var vendorSm = sp[0].substr(0,7)
      
      if(sp.length > 1)
          vendorSm += sp[1].substr(0,1).toUpperCase() + sp[1].substr(1,2)
      return [vendor, vendorSm]
    } catch (e) {
      console.error(`OUI: ${e}`.error)
    }
  }
  return ['Unknown', 'Unknwn']
}

function read_packet(msg) {
  try {
    var p = msg.data
    var sensor = msg.sensor
    
    data.location = msg.location
    
    if(data.sensors.hasOwnProperty(sensor))
      data.sensors[sensor] += 1
    else
      data.sensors[sensor] = 1

    if(p.type == 0 && [4,8].includes(p.subtype)) {
        if(p.subtype == 8 && (!data.devs.ap.includes(p.mac)))
          data.db[p.mac] = newDevice(p) // ap beacon

        if(p.subtype == 4 && (!data.devs.sta.includes(p.mac)))
          data.db[p.mac] = newDevice(p) // probe request
                                        // add probe response, etc..

        data.db[p.mac].location = {lon: p.lon, lat: p.lat}
        data.db[p.mac].seen.last = p.time
        data.db[p.mac].rssi.last = p.rssi
        // history? sensors? rssi ring buffer?
    } else if(p.type == 2) { // data packet
      var dst = p.dst
      var src = p.src
      
      if(data.devs.ap.includes(src)) {
        data.db[src].hosts[dst] = get_vendor(dst)[0]
        p.mac = dst
        p.ssid = data.db[src].ssid
      } else
      if (data.devs.ap.includes(dst)) {
        data.db[dst].hosts[src] = get_vendor(src)[0]
        p.mac = src
        p.ssid = data.db[dst].ssid
      }
    }
  
  data.stats.packets += 1
  
  } catch (e) {
    console.error(`Decode Packet: ${e}`)
    data.stats.errors += 1
  }
}

function latest(since) {
	var out = {}
  updateStats()

	Object.keys(data.db).forEach(function(k) {
		const dev = data.db[k]
		const now = new Date() / 1000

		if(dev.seen.hasOwnProperty('last')) {
			if((now) < (dev.seen.last + (since / 1000))) {
				out[k] = data.db[k]
			}
		}
	})
  return {db: out}
}

function noop() {}

function heartbeat() {
  this.isAlive = true
}

const wss = new WS.Server({ port: cfg.server.ws.port });
 
console.info(`Listening on port ${cfg.server.ws.port}`)

wss.on('connection', function connection(ws, req) {
  ws.isAlive = true
  ws.on('pong', heartbeat)

  const ip = req.connection.remoteAddress
  const port = req.connection.remotePort

  const id = `${ip}_${port}`

  clients[id] = {mode: null, host: ip, port: port,
                 firstseen: new Date(), lastseen: new Date()}

  console.info(`Connection from ${id}}`)
  
  ws.on('message', function incoming(message) {
    const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
    //console.info(`Message from ${id}: ${message}`.debug)
    
    const msg = JSON.parse(message)
    clients[id].lastseen = new Date()
    
    if(msg.hasOwnProperty('type')) {
      if(msg.type == 'data') {
        read_packet(msg)
      } else
      if(msg.type == 'log') {
        read_log(msg)
      } else
      if (msg.type == 'status') {
        setStatus(msg)
      } else
      if (msg.type == 'time') {
        checkTime(msg)
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
          duration = Number(msg.arg)
        else
          duration = cfg.server.latest_period
        
        ws.send(JSON.stringify({ type: 'latest', location: data.location,
                                 time: new Date(), data: latest(duration)}))
      } else
      if (msg.cmd == 'status') {
        updateStats()
        ws.send(JSON.stringify({ type: 'status', time: new Date(), data: data.stats}))
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
        
        // should client have to request state data then send another request for new data?
        ws.send(JSON.stringify({ type: 'dump', time: new Date(), data: data}))
        
        clients[id].timer = setInterval(function() {
          const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
          
          if (ws.readyState === WS.OPEN) {
            ws.send(JSON.stringify({ type: 'latest', time: new Date(),
                                     location: data.location,
                                     data: latest(cfg.server.ws.subscribe_interval)}))
          } else {
            console.warn(`Connection closed, terminating ${id}`)
            
            try {
              ws.terminate()
              
              if(clients[id].hasOwnProperty('timer')) {
                clearInterval(clients[id].timer)
                delete clients[id].timer
              }
            } catch(e) {
              console.log(`Terminating connection: ${e}`)
            }
          }
        }, cfg.server.ws.subscribe_interval)
      } else
      if (msg.cmd == 'unsubscribe') {
        if(clients[id].hasOwnProperty('timer')) {
          clearInterval(clients[id].timer)
          delete clients[id].timer
        }
      }
    } else {
      console.error(`Invalid packet: ${msg}`)
    }
  })
})

const clientCheck = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate()

    ws.isAlive = false
    ws.ping(noop)
  })
}, cfg.server.ws.ping_interval)
