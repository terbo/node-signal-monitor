#!/usr/bin/env node
/*# first page
#  status | keys
#  device table | device info
#  log
# second page
#  hosts/channel
#  channel graph
# third page
#  packets per sensor
#  packets per channel
#  packets per minute
#  packets per hour ...
# fourth page
#  full status table
#  status of each sensor
#  status of database
#  connected clients
*/

"use strict";

const cfg = require('../etc/config.js'),
      wifiChannels = require('../lib/wifichannel')

const extend   = require('extend'),
      sprintf  = require('util').format,
      sortkeys = require('sort-keys'),
           hmn = require('human-number'),
           RWS = require('reconnecting-websocket'),
            WS = require('ws')

require('console-stamp')(console, { pattern: 'HH:MM:ss' });

const ws = new WS(`ws://${cfg.sensor.ws.hostname}:${cfg.sensor.ws.port}/ws`, [], { WebSocket: WS })

const dim = {
  scr:  {r: 10, c: 12},
  st1:  {h: 0, w: 0, x: 2, y: 10},
  tb1:  {h: 1, w: 0, x: 8, y: 10},
  bar:  {h: 5, w: 12, x: 0, y: 0},
  gr1:  {h: 5, w: 0, x: 5, y: 12},
  st2:  {h: 1, w: 9, x: 9, y: 0},
  keys: {h: 2, w: 3, x: 0, y: 9},
  info: {h: 9, w: 3, x: 1, y: 9},
  col1: [4, 8, 18, 32, 4, 2, 10, 12, 8, 12],
}

var blessed = require('blessed')
     , contrib = require('blessed-contrib')
     , screen = blessed.screen({smartCSR: true, ignoreLocked: true,
                                debug: true, dockBorders: true,
                                ignoreDockContrast: true, autoPadding: true})

var devices = {},
    packetGraph = {},
    channelGraph = []

var sortType     = 0,
    filterType   = 0,
    reverse      = false,
    displayType  = 1,
    displayTypes = ['all','ap','sta'],
    redraw = true,
    drawJSON = false

const sortFn = [ sortByType, sortVendor, sortRSSI, sortSSID, sortChannel, sortLast, sortClients, sortBytes ]
const sortTypes = ['Type', 'Vendor', 'RSSI', 'SSID', 'Channel','Lastseen','Clients','Bytes']
const filterTypes = ['None','Proximity','Far','OUI','Unknown','Regular','New', 'Alert'] //,'Owned']

var colors = ['yellow','cyan','red','white','blue','green']

Object.keys(wifiChannels.frequencyMap).forEach(f => {
  channelGraph.push(0)
})

var devices_grid, device_table, graphics_grid, status_markdown, device_markdown, channel_graph, packet_graph
var status_log, server_log, packet_graph, channel_bar, device_markdown, status_info, keys, info_markdown

function devices_page() {
	devices_grid = new contrib.grid({rows: dim.scr.r, cols: dim.scr.c, screen: screen})
	
	status_markdown = devices_grid.set(dim.st1.h, dim.st1.w, dim.st1.x,dim.st1.y, contrib.markdown, {
    tags: true
   , interactive: false
  })

  keys = devices_grid.set(dim.keys.x,dim.keys.y,dim.keys.h,dim.keys.w, contrib.markdown)
  keys.setMarkdown('__Keys__:\n[tab/1/2] change tab [s] sort [r] reverse\n[enter] info [f] filter [z] pause [q] quit')

  device_table = devices_grid.set(dim.tb1.h, dim.tb1.w, dim.tb1.x,dim.tb1.y, contrib.table,
     { keys: true
     , mouse: true
     , vi: true
     , tags: true
     , fg: 'white'
     , selectedFg: 'white'
     , selectedBg: 'blue'
     , label: 'Active'
     , interactive: true
     , width: '60%'
     , height: '50%'
     , border: {type: "none", fg: "cyan"}
     , columnSpacing: 3 //in chars
     , columnWidth: dim.col1 })
	
	device_table.rows.on('select',(i,idx) => {
    var selected = i.content.match(/[0-9a-f]{1,2}([\.:-])(?:[0-9a-f]{1,2}\1){4}[0-9a-f]{1,2}/)
    drawInfo(selected[0])
	})

  info_markdown = devices_grid.set(dim.info.x,dim.info.y, dim.info.h, dim.info.w, contrib.markdown,
   {
	   label: 'info'
   , tags: true
	}
 )

  status_log = devices_grid.set(dim.st2.x,dim.st2.y,dim.st2.h,dim.st2.w, contrib.log,
      { fg: "green"
      , mouse: true
      , tags: true
      , selectedFg: "green"
      , label: 'log'})
  
  device_table.focus()
}

function graphics_page() {
	graphics_grid = new contrib.grid({rows: dim.scr.r, cols: dim.scr.c, screen: screen})
	
  keys = devices_grid.set(dim.keys.x,dim.keys.y,dim.keys.h,dim.keys.w, contrib.markdown)
  keys.setMarkdown('__Keys__:\n[tab/1/2] change tab [s] sort [r] reverse\n[enter] info [f] filter [z] pause [q] quit')
	
  channel_bar = graphics_grid.set(dim.bar.x,dim.bar.y,dim.bar.h,dim.bar.w, contrib.bar,
       { label: 'Channel Usage'
       , barWidth: 10
       , mouse: true
       , draggable: true
       , barSpacing: 10
       , xOffset: 10
       , maxHeight: 30})

	packet_graph = graphics_grid.set(dim.gr1.h, dim.gr1.w, dim.gr1.x, dim.gr1.y, contrib.line,
       { style:
         { line: "yellow"
         , text: "green"
         , baseline: "black"}
       , mouse: true
       , xLabelPadding: 4
       , xPadding: 4
       , showLegend: true
       , wholeNumbersOnly: true //true=do not show fraction in y axis
       , label: 'Packets'})
}

function sortByType(a,b) {
  if(devices[a].type > devices[b].type)
    if(reverse) return -1
    else return 1
  if(devices[a].type < devices[b].type)
    if(reverse) return 1
    else return -1
  return 0
}

function sortClients(a,b) {
  if(reverse)
    return devices[b].hosts.length - devices[a].hosts.length
  else
    return devices[a].hosts.length - devices[b].hosts.length
}

function sortFirst(a,b) {
  if(reverse)
    return devices[b].firstseen - devices[a].firstseen
  else
    return devices[a].firstseen - devices[b].firstseen
}

function sortBytes(a,b) {
  if(reverse)
    return devices[b].totalBytes - devices[a].totalBytes
  else
    return devices[a].totalBytes - devices[b].totalBytes
}

function sortLast(a,b) {
  if(reverse)
    return devices[b].lastseen - devices[a].lastseen
  else
    return devices[a].lastseen - devices[b].lastseen
}

function sortSSID(a,b) {
  if(devices[a].ssid.toUpperCase() > devices[b].ssid.toUpperCase())
    if(reverse) return -1
    else return 1
  
  if(devices[a].ssid.toUpperCase() < devices[b].ssid.toUpperCase())
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

function update() {
  const headers = ['Type', 'Sensor', 'MAC', 'SSID', 'RSSI', 'Ch', 'Vendor','Last Seen','Clients','Bytes']
  
  var rows = [],
      now = new Date(),
      nowH = now.getMinutes() + ':' + now.getSeconds()
  
  Object.keys(sortkeys(devices,{compare: sortFn[sortType]})).forEach(mac => {
    var dev = devices[mac]

    dev.tags = []

    if(mac in cfg.sensor.alert) { // that wascally wabbit...
      status_log.log(`${mac} seen @ ${new Date()}`)
      dev.tags.push('alert')
    } 
    
    if(mac in cfg.sensor.ignore)
      return
    
    dev.sensor.forEach(sensor => {
      if(!packetGraph.hasOwnProperty(sensor))
      packetGraph[sensor] = { title: sensor, style: { line: colors.pop()}, x: [], y: [] }

    var l = packetGraph[sensor].x.length - 1

    if(packetGraph[sensor].x[l] != nowH)
      packetGraph[sensor].x.push(nowH)
    
    var y = packetGraph[sensor].y.length - 1
    
    if(y < l)
      packetGraph[sensor].y[l] = 1
    else
      packetGraph[sensor].y[l] += 1
    })

    if(dev.type == 'ap')
      if(dev.channel)
        channelGraph[dev.channel - 1] += 1
      else
        dev.channel = 13
    dev.rssi = -30

    if(filterType == 6 && (now / 1000) > (dev.lastseen + cfg.console.device_timeout))
      return
    
    if(displayTypes[displayType] == 'ap' && dev.type == 'sta')
      return
    
    if(displayTypes[displayType] == 'sta' && dev.type == 'ap')
      return

    if(carousel.currPage == 0) {
      var lastseen = new Date(dev.lastseen * 1000).toLocaleTimeString()
      
      if((now / 1000) > (dev.firstseen + cfg.console.device_timeout))
        dev.tags.push('new')
      
      else if((dev.firstseen - (now / 1000) > 300) && (now / 1000) < (dev.lastseen + 30))
        dev.tags.push('session')

      if(dev.rssi > -45)
        dev.tags.push('proximity')
      else if(dev.rssi < -65)
        dev.tags.push('far')
      
      if(dev.vendor == 'Unknown')
        dev.tags.push('unknown')
      else
        dev.tags.push('oui')
      
      if(filterType === 0 || dev.tags.includes(filterTypes[filterType].toLowerCase()))
        try{rows.push([ dev.type.toUpperCase(), dev.sensor.toString(), dev.mac, dev.ssid, dev.rssi, dev.channel,
                    dev.vendorSm, lastseen, dev.hosts.length, hmn(dev.totalBytes)])} catch(e) { console.log(e)} //console.table(dev) }
    }
  })
  
  if(carousel.currPage == 0 && status_info) {
    var out = [],
        mem = 0,
        cpu = 0,
        dbsize = 0,
        running = 0,

    mem = hmn(status_info[0].memory.rss)
    dbsize = hmn(status_info[0].dbsize) 
    
    out.push(`Total APs: __${status_info[0].aps}__ STAs: __${status_info[0].stas}__ Packets: __${hmn(status_info[0].packets)}__`)
    out[0] += ` Lon/Lat: __${status_info[3].lon.toPrecision(7)}__, __${status_info[3].lat.toPrecision(7)}__  Sats: __${status_info[3].sats}__`

    running = status_info[0].uptime
    
    var sensors = ''
    now = new Date()
    
    Object.keys(status_info[2]).forEach(sensor => {
      sensors += `__${sensor}__ (${hmn(status_info[2][sensor].packets)}) `
      var last = status_info[2][sensor].lastseen
      var lastseen = (now - new Date(last)) / 1000
      
      if(lastseen > 60)
        sensors += '(DC) '
    })
    
    out.push(`{center} ${sensors} {/}`)
    
    out.push(`Showing ${displayTypes[displayType].toUpperCase()} Filtering ${filterTypes[filterType]} sorting${reverse ? ' reverse ' : ' '}by ${sortTypes[sortType]} \t\t\t Mem: ${mem} DB: ${dbsize} {/}\n${ !redraw ? 'Paused updating.' : ''}`)
    status_markdown.setMarkdown(out.join('\n'))
  }
  
  if(redraw && carousel.currPage == 1) {
    if(Object.keys(packetGraph).length) {
      packet_graph.setData(Object.values(packetGraph))
    }
    try{channel_bar.setData( { titles: Object.values(wifiChannels.frequencyMap) , data: channelGraph }) }catch(e){console.log(e);console.table(channelGraph)}
  } 
  

 if(redraw && carousel.currPage == 0)
      try { device_table.setData({ headers: headers, data: rows}) } catch (e) { console.error(e); console.table(rows); do_exit() }

  screen.render()
}

function do_exit(s) {
  screen.destroy()
  screen.program.clear()
  screen.program.disableMouse()
  screen.program.showCursor()
  screen.program.normalBuffer()
	ws.close()
	
	process.exit(2)
}

screen.key(['escape', 'q', 'C-c'], do_exit)

screen.key(['s'], (ch, key) => {
  if(carousel.currPage !== 0)
    return

  sortType = (sortType < Object.keys(sortFn).length - 1) ? sortType + 1 : 0
  update()
})

screen.key(['a'], (ch, key) => {
  if(carousel.currPage !== 0)
    return 
  
  displayType = displayType < displayTypes.length - 1? displayType + 1 : 0
  update()
})

screen.key(['r'], (ch, key) => {
  if(carousel.currPage !== 0)
    return 
  reverse = !reverse
  update()
})

screen.key(['f'], (ch, key) => {
  if(carousel.currPage !== 0)
    return

  filterType = filterType < filterTypes.length - 1? filterType + 1 : 0
  update()
})

screen.key(['i'], (ch, key) => {
  if(carousel.currPage !== 0)
    return 
  drawJSON = !drawJSON
  update()
})

screen.key(['z'], (ch, key) => {
  if(carousel.currPage !== 0)
    return 
  redraw = !redraw
  update()
})

screen.key(['tab'], (ch, key) => {
  if(carousel.currPage == (carousel.pages.length - 1))
    carousel.home()
  else
    carousel.next()
  
  redraw = true 
  update()
})

screen.key(['1','2'], (ch, key) => {
  carousel.currPage = ch - 1
  carousel.move()
  
  redraw = true 
  update()
})

ws.addEventListener('open', () => {
  status_log.log('Connected to websocket ' + cfg.sensor.ws.hostname)
  ws.send(JSON.stringify({'cmd': 'subscribe'}))
})

ws.addEventListener('message', message => {
  var msg = JSON.parse(message.data)
  extend(true, devices, devices, msg.data.db)
  status_info  = [msg.data.stats, msg.data.info, msg.data.sensors, msg.data.location || msg.location]
  
  update()
})

ws.addEventListener('error', e => {
  status_log.log(`WS Client: ${e.error}`)
})

function drawInfo(mac) {
  var dev = devices[mac],
      out
  if(!drawJSON) {
      out =  `${dev.mac} - ${dev.vendor}`
      out += `\n\nFirst seen: ${new Date(dev.firstseen*1000).toLocaleString()}`
      out += `\nLast seen: ${new Date(dev.lastseen*1000).toLocaleString()}`
      out += `\nLast RSSI/Seq# ${dev.rssi}/${dev.seq}`
      out += `\n\nTotal Packets/Bytes: ${hmn(dev.totalPackets)}/${hmn(dev.totalBytes)}`
      out += `\n\n`

    if(dev.type == 'ap')
      out += `Clients:\n`
    else
      out += `Probed SSIDs:\n`

      dev.hosts.forEach(h => {
        if(dev.type == 'ap' && devices.hasOwnProperty(h)) {
          out += `* __${devices[h].mac}__  ${devices[h].vendorSm} (${devices[h].rssi})\n`
          out += `* . Last Seen: ${new Date(devices[h].lastseen*1000).toLocaleString()}\n`
        } else {
          out += `* __${h}__\n`
        }
      })
  } else
    out = JSON.stringify(dev,null,2)

  info_markdown.setMarkdown(out)
  update()
}

var carousel = new contrib.carousel( [devices_page, graphics_page]
                                     , { screen: screen
                                     , interval: 0
                                     , controlKeys: false })
carousel.start()
