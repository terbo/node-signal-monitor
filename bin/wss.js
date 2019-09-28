const version = '0.0.1'

var cfg = require('../etc/config.js')

const fs       = require('fs'),
      os       = require('os'),
     oui       = require('oui')
     colors    = require('colors'),
     process   = require('process'),
     WebSocket = require('ws'),

//const logger = require('../modules/logger.js')
require('console-stamp')(console, [{}]);
 
colors.setTheme({
  intro: 'rainbow',
  info: 'green',
  status: 'cyan',
  ap: 'yellow',
  sta: 'white',
  debug: 'grey',
  error: 'red'
});

var data = {
  devs: {ap: [], sta: [], ssid: []},
  db: {},
  sensors: {},
  stats: { packets: 0, errors: 0, runtime: 0, cpu: 0, memory: 0, aps: 0, ssids: 0, stas: 0},
  info: { start_time: new Date(), port: cfg.server.ws.port,
          hostname: os.hostname(), versions: process.versions,
          user: os.userInfo(), pid: process.pid, version: version
          },
}

console.info(`Loading Signal Monitor version ${data.info.version} on ${data.info.hostname}`.intro)

var clients = [] // need to linnk this to sensors..

function updateStats() {
  data.stats.aps = data.devs.ap.length
  data.stats.ssids = data.devs.ssid.length
  data.stats.stas = data.devs.sta.length

  data.stats.cpu = process.cpuUsage()
  data.stats.memory = process.memoryUsage()
  data.stats.runtime = process.uptime()
  data.stats.uptime = os.uptime()

  return data.stats
}

function newDevice(pkt) {
  res = get_vendor(p.mac)
  
  p.vendor = res[0]
  p.vendorSm = res[1]
  p.macSm = p.mac.substr(12,14).replace(':','')
  
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
    console.info(`+ AP '${tmp.ssid}' type ${tmp.vendorSm} rssi ${tmp.rssi.last}`.ap)
  } else {
    //console.info(`+ Probe '${tmp.macSm}' for ${tmp.ssid} type ${tmp.vendorSm} rssi ${tmp.rssi.last}`.sta)
    tmp.type = 'sta'
  }
  
  if(!data.devs[tmp.type].includes(tmp.mac))
    data.devs[tmp.type].push(tmp.mac)
  
  if(!data.devs.ssid.includes(tmp.ssid))
    data.devs.ssid.push(tmp.ssid)
  
  return tmp
}

function get_vendor(mac) {
  res = oui(mac)
  
  if(res !== null) {
    try {
      vendor = res.split('\n')[0]
      sp = vendor.split(' ')
      vendorSm = sp[0].substr(0,7)
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
    p = msg.data
    cur_loc = msg.location
    sensor = msg.sensor
    
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
        data.db[p.mac].rssi.last = {lon: p.lon, lat: p.lat}
        // history? sensors? rssi ring buffer?
    } else if(p.type == 2) { // data packet
      dst = p.dst
      src = p.src
      
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
    console.error(`Decode Packet: ${e}`.error)
    data.stats.errors += 1
  }
}

function latest(since) {
	var out = {}
	Object.keys(data.db).forEach(function(k) {
		const dev = data.db[k]
		now = new Date() / 1000

		if(dev.seen.hasOwnProperty('last')) {
			if((now) < (dev.seen.last + (since / 1000))) {
				out[k] = data.db[k]
			}
		}
	})
	return out
}

function noop() {}

function heartbeat() {
  this.isAlive = true
}

const wss = new WebSocket.Server({ port: cfg.server.ws.port });
 
console.info(`Listening on port ${cfg.server.ws.port}`.info)

wss.on('connection', function connection(ws, req) {
  ws.isAlive = true
  ws.on('pong', heartbeat)

  const ip = req.connection.remoteAddress
  const port = req.connection.remotePort

  const id = `${ip}_${port}`

  clients[id] = {mode: null, host: ip, port: port,
                 firstseen: new Date(), lastseen: new Date()}

  console.info(`Connection from ${id}}`.debug)
  
  ws.on('message', function incoming(message) {
    const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
    
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
        ws.send(JSON.stringify({ type: 'latest', time: new Date(), data: latest(300 * 1000)}))
      } else
      if (msg.cmd == 'status') {
        ws.send(JSON.stringify({ type: 'status', time: new Date(), data: updateStats()}))
      } else
      if (msg.cmd == 'dump') {
        ws.send(JSON.stringify({ type: 'dump', time: new Date(), data: data}))
      } else
      if (msg.cmd == 'subscribe') {
        // subscribe to latest, subscribe to logs, subscribe to status
        // subscribe to location, etc
        if(msg.hasOwnProperty('arg')) {
          if(msg.arg == null)
            var interval = msg.arg
        }
        clients[id].timer = setInterval(function() {
          const id = `${ws._socket._peername.address}_${ws._socket._peername.port}`
          if (ws.readyState === WebSocket.OPEN) {
            // for each device, if lastseen lesss than last msg, send?
            ws.send(JSON.stringify({ type: 'recent', time: new Date(),
                                     data: latest(cfg.server.ws.subscribe_interval)}))
          } else {
            ws.terminate()
            if(clients[id].hasOwnProperty('timer')) {
              clearInterval(clients[id].timer)
              delete clients[id].timer
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
      console.error(`Invalid packet: ${msg}`.error)
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
