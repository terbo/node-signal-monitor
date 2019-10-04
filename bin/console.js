#!/usr/bin/env node

const cfg = require('../etc/config.js')

const highlight = require('cli-highlight').highlight
      
const channelMap = require('../modules/wifichannel'),
      freqmap    = channelMap.frequencyMap,
      ftypes     = channelMap.frameTypes

const sprintf = require('util').format
const sortkeys = require('sort-keys')

const WS = require('ws')

var ws = new WS(cfg.sensor.ws.server)

const dim = {
  scr: {r: 10, c: 12},
  st:  {h: 0, w: 0, x: 1, y: 8},
  tb1: {h: 1, w: 0, x: 7, y: 8},
  bar: {h: 2, w: 5, x: 8, y: 7},
  log: {h: 8, w: 5, x: 0, y: 8},
  col1: [4, 5, 18, 32, 4, 4, 24],
  col2: [80],
}

var blessed = require('blessed')
     , contrib = require('blessed-contrib')
     , screen = blessed.screen()
     , grid = new contrib.grid({rows: dim.scr.r, cols: dim.scr.c, screen: screen})

var devices = {},
    chanmap = []


Object.keys(freqmap).forEach(function(f) {
  chanmap.push(0)
})

function sortByType(a,b) {
  if(devices[a].type > devices[b].type)
    if(reverse) return -1
    else return 1
  if(devices[a].type < devices[b].type)
    if(reverse) return 1
    else return -1
  return 0
}

function sortSSID(a,b) {
  if(devices[a].ssid.toUpperCase() > devices[b].ssid.toUpperCase())
    if(reverse) return -1
    else return 1
  
  if(devices[a].ssid.toUpperCase() < devices[b].channel)
    if(reverse) return 1
    else return -1
  return 0
}

function sortChannel(a,b) {
  if(reverse)
		return devices[b].channel - devices[a].channel
	else
		return devices[a].channel - devices[b].channel
}

function sortRSSI(a,b) {
  if(reverse)
    return devices[b].rssi - devices[a].rssi
	else
    return devices[a].rssi - devices[b].rssi
}

function sortVendor(a,b) {
  if(devices[a].vendor.toUpperCase() > devices[b].vendor.toUpperCase())
    if(reverse) return 1
    else return -1
  if(devices[a].vendor.toUpperCase() < devices[b].vendor.toUpperCase())
    if(reverse) return -1
    else return 1
  return 0
}

var sortType = 't'
const sortFn = { v: sortVendor, t: sortByType, r: sortRSSI, s: sortSSID, c: sortChannel}
const Sorts={ v:'Vendor', t:'Type', s: 'SSID', m: 'Mac', c: 'Channel', r: 'RSSI' }
var reverse = false


function update() {
  const headers = ['Type', 'Sensor', 'MAC', 'SSID', 'RSSi', 'Ch', 'Vendor']
  var status = { total: 0, total: {ap: 0, sta: 0}, ap: 0, sta: 0, unknown: 0, known: 0}
  var rows = []
  const now = new Date() / 1000
 
  Object.keys(sortkeys(devices,{compare: sortFn[sortType]})).forEach(function(mac) {
    var dev = devices[mac]
    
    status.total[dev.type] += 1
    
    if(now > dev.lastseen + cfg.console.device_timeout)
      return
    
    status.total[dev.type] -= 1
    status[dev.type] += 1

    if(dev.vendor == 'Unknown')
      status.unknown ++
    else
      status.known ++

    rows.push([ dev.type.toUpperCase(), dev.sensor, dev.mac, dev.ssid, dev.rssi, dev.channel, dev.vendor ])
    chanmap[dev.channel-1] += 1
  })
  channel_bar.setData( { titles: Object.values(freqmap) , data: chanmap }) 
  status_markdown.setMarkdown(`APs: ${status.ap} STAs: ${status.sta}\nKnown: ${status.known} Unknown ${status.unknown}`)
  device_table.setData({ headers: headers, data: rows})

  screen.render()
}

var status_markdown = grid.set(dim.st.h, dim.st.w, dim.st.x,dim.st.y, contrib.markdown)

var device_table = grid.set(dim.tb1.h, dim.tb1.w, dim.tb1.x,dim.tb1.y, contrib.table,
     { keys: true
     , fg: 'white'
     , selectedFg: 'white'
     , selectedBg: 'blue'
     , interactive: true
     , label: 'Active Devices'
     , width: '60%'
     , height: '50%'
     , border: {type: "line", fg: "cyan"}
     , columnSpacing: 3 //in chars
     , columnWidth: dim.col1 })

var channel_bar = grid.set(dim.bar.x,dim.bar.y,dim.bar.h,dim.bar.w, contrib.bar,
       { label: 'Channel Usage'
       , barWidth: 1
       , barSpacing: 2
       , xOffset: 0
       , maxHeight: 12})

var packet_log = grid.set(dim.log.x,dim.log.y,dim.log.h,dim.log.w, contrib.log,
      { fg: "green"
      , selectedFg: "green"
      , label: 'Packets'})

screen.key(['escape', 'q', 'C-c'], (ch, key) => { return process.exit(0); });

screen.key(['v'], (ch, key) => { sortType = 'v'; packet_log.log(`Sorting${reverse ? ' reverse ' : ' '}by ${Sorts[sortType]}`); update() });
screen.key(['s'], (ch, key) => { sortType = 's'; packet_log.log(`Sorting${reverse ? ' reverse ' : ' '}by ${Sorts[sortType]}`); update() });
screen.key(['c'], (ch, key) => { sortType = 'c'; packet_log.log(`Sorting${reverse ? ' reverse ' : ' '}by ${Sorts[sortType]}`); update() });
screen.key(['m'], (ch, key) => { sortType = 'm'; packet_log.log(`Sorting${reverse ? ' reverse ' : ' '}by ${Sorts[sortType]}`); update() });
screen.key(['t'], (ch, key) => { sortType = 't'; packet_log.log(`Sorting${reverse ? ' reverse ' : ' '}by ${Sorts[sortType]}`); update() });
screen.key(['r'], (ch, key) => { sortType = 'r'; packet_log.log(`Sorting${reverse ? ' reverse ' : ' '}by ${Sorts[sortType]}`); update() });

screen.key(['space'], (ch, key) => { reverse = !reverse; packet_log.log(`Sorting${reverse ? ' reverse ' : ' '}by ${Sorts[sortType]}`); update() });

ws.on('open', () => {
  packet_log.log('Connected to websocket ' + cfg.sensor.ws.server)
  ws.send(JSON.stringify({'cmd': 'subscribe'}))
})

ws.on('message', message => {
  devices = JSON.parse(message).data.db
  Object.keys(devices).forEach( (d) => {
    var dev = devices[d]
    packet_log.log(sprintf('%s %s %s %s', dev.sensor, dev.pktype, dev.mac, dev.ssid))
  })
  update()
})

ws.on('error', (e) => {
  packet_log.log('WS Client:' + e)
})

device_table.focus()

screen.render()
