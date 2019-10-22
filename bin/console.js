#!/usr/bin/env node
'use strict';

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
# fifth page?
# all ssids/grouped clients
# settings
*/

const cfg = require('../etc/config.js'),
      wifiChannels = require('../lib/wifichannel')

const extend   = require('extend'),
      sortkeys = require('sort-keys'),
      sprintf  = require('sprintf-js').sprintf,
       player  = require('node-wav-player'),
           hmn = require('human-number'),
           RWS = require('reconnecting-websocket'),
            WS = require('ws')

require('console-stamp')(console, { pattern: 'HH:MM:ss' })


var blessed = require('blessed'),
     contrib = require('blessed-contrib'),
     screen = blessed.screen({ debug: true,
															 smartCSR: true,
                               dockBorders: true,
                               ignoreDockContrast: true,
                               autoPadding: true
                              })
var devices = {},
    packetGraph = {},
    channelGraph = []

var sortType     = 2,
    filterType   = 0,
    reverse      = true,
    displayType  = 1,
    displayTypes = ['all','ap','sta'],
    redraw = true,
    drawJSON = false,
    gpsLock = false

Object.keys(wifiChannels.frequencyMap).forEach(f => {
  channelGraph.push(0)
})


//               //
/*               */
 // Sort Funcs  //
/*               */
//               //


const sortFn = [ sortByType, sortVendor, sortRSSI, sortSSID, sortChannel, sortLast, sortClients, sortBytes ]
const sortTypes = ['Type', 'Vendor', 'RSSI', 'SSID', 'Channel','Lastseen','STAs','Bytes']
const filterTypes = ['None','Proximity','Far','OUI','Unknown','Regular','New', 'Alert'] //,'Owned']

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


/*               */
/*               */
 //   Output    //
/*               */
/*               */


function playwav(wav) {
  status1.log(`Playing '${wav}.wav'`)
  player.play({path: `./data/wav/${wav}.wav`}).then(() => {
    }).catch((error) => { })
}

function update() {
  const headers = ['Type', 'Sensor', 'MAC', 'SSID', 'RSSI', 'Ch', 'Vendor','Last Seen','STAs','Bytes']
  
  var rows = [],
      now = new Date(),
      nowH = now.getMinutes() + ':' + now.getSeconds()
  
  Object.keys(sortkeys(devices,{compare: sortFn[sortType]})).forEach(mac => {
    var dev = devices[mac],
        sensors

    dev.tags = []

    if(mac in cfg.sensor.alert) { // that wascally wabbit...
      playwav('alert')
      status1.log(`${mac} seen @ ${now}`)
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

    if(dev.channel && dev.channel >= 1 && dev.channel <= 11) {
      if(dev.type == 'ap')
        channelGraph[dev.channel - 1] += 1
     } else
       dev.channel = 13

    if(filterType == 6 && now > dev.lastseen + cfg.console.device_timeout)
      return
    
    if(displayTypes[displayType] == 'ap' && dev.type == 'sta')
      return
    
    if(displayTypes[displayType] == 'sta' && dev.type == 'ap')
      return
    
    dev.ssid = dev.ssid.toLocaleString()

    if(carousel.currPage == 0) {
      var lastseen = dev.lastseen
      
      if(now > (dev.firstseen + cfg.console.device_timeout))
        dev.tags.push('new')
      
      else if(((dev.firstseen - now) > 30000) && (now < (dev.lastseen + 3000)))
        dev.tags.push('session')

      if(dev.rssi > -45)
        dev.tags.push('proximity')
      else if(dev.rssi < -65)
        dev.tags.push('far')
      
      if(dev.vendor == 'Unknown')
        dev.tags.push('unknown')
      else
        dev.tags.push('oui')
     
      if(dev.sensor.length > 1)
        sensors = `${dev.sensor[0]},+${(dev.sensor.length) - 1}`
      else
        sensors = dev.sensor[0]

      if(filterType === 0 || dev.tags.includes(filterTypes[filterType].toLowerCase()))
        try {
          rows.push([ dev.type.toUpperCase(), sensors, dev.mac, sprintf('%-.24s',dev.ssid), dev.rssi, dev.channel,
                    dev.vendorSm, lastseen, dev.hosts.length, hmn(dev.totalBytes.toPrecision(3))])
        } catch(e) {
          console.log(e) //console.table(dev)
        }
    }
  })
  
  if(carousel.currPage == 0 && status_info) {
    var out,
        out2,
        mem = 0,
        cpu = 0,
        dbsize = 0,
        running = 0,

    mem = hmn(status_info[0].memory.rss.toPrecision(3))
    dbsize = hmn(status_info[0].dbsize.toPrecision(3)) 
    if(!gpsLock && (status_info[3].sats >= 5)) {
      playwav('gpslock')
      gpsLock = true
    }
    else if (gpsLock && (status_info[3].sats <= 4)) {
      playwav('gpslost')
      gpsLock = false
    }
      
    out = ` Total APs: __${status_info[0].aps}__ STAs: __${status_info[0].stas}__` +
          ` Packets: __${hmn(status_info[0].packets.toPrecision(3))}__\n` +
           ` Showing ${displayTypes[displayType].toUpperCase()} Filtering ${filterTypes[filterType]} ` +
           `sorting${reverse ? ' reverse ' : ' '}by ${sortTypes[sortType]}\n` +
           `${ !redraw ? '{bold}{red-fg}\t\t\t\t\tPaused updating{/}{/}' : ''}`

    out2 = ` Lon/Lat: __${status_info[3].lon.toPrecision(7)}__, __${status_info[3].lat.toPrecision(7)}__` +
           `  Sats: __${status_info[3].sats}__\n` +
           ` Mem: {bold}${mem}{/} DB: {bold}${dbsize}{/}\n\n` +
           ` Server: {bold}${status_info[1].hostname}{/}:{bold}${status_info[1].port}` +
           ` / {green-fg}${status_info[1].version}{/}`

    running = status_info[0].uptime
    
    var sensors = ''
    now = new Date()
    
    Object.keys(status_info[2]).forEach(sensor => {
      sensors += `__${sensor}__ (${hmn(status_info[2][sensor].packets.toPrecision(3))}) `
      var last = status_info[2][sensor].lastseen
      var lastseen = now - last
      
      if(lastseen > 60000)
        sensors += '(DC) '
    })
    
    out += `\n ${sensors}`
    
    status1_markdown.setMarkdown(out)
    status2_markdown.setMarkdown(out2)
  }
  
  if(redraw && carousel.currPage == 1) {
    if(Object.keys(packetGraph).length)
      packet_graph.setData(Object.values(packetGraph))
    
    try{
      channel_bar.setData( {
      titles: Object.values(wifiChannels.frequencyMap) , data: channelGraph }) }
    catch(e) {
      console.log(e)
      console.table(channelGraph)
    }
  } 
  
  if(redraw && carousel.currPage == 0)
    try {
      device_table.setData({ headers: headers, data: rows})
    }
    catch (e) {
      console.error(e)
      console.table(rows)
      do_exit()
    }

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


/*              */
/*              */
 //  Keybinds  //
/*              */
/*              */


screen.key(['escape', 'q', 'C-c'], do_exit)

screen.key('C-d', () => { ws.send(JSON.stringify({'cmd': 'dump'})) })

screen.key(['s'], (ch, key) => {
  if(carousel.currPage !== 0)
    return

  sortType = (sortType < Object.keys(sortFn).length - 1) ? sortType + 1 : 0
  
  status1.log(`Sorting by ${sortTypes[sortType]}`)
  update()
})

screen.key(['a'], (ch, key) => {
  if(carousel.currPage !== 0)
    return 
  
  displayType = displayType < displayTypes.length - 1? displayType + 1 : 0
  
  status1.log(`Displaying ${displayTypes[displayType].toUpperCase()}`)
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
  status1.log(`Filtering ${filterTypes[filterType]}`)
  update()
})

screen.key(['i'], (ch, key) => {
  if(carousel.currPage !== 0)
    return 
  drawJSON = !drawJSON
  if(drawJSON)
    status1.log('Drawing JSON in Info Window')
  else
    status1.log('Drawing Markdown in Info Window')
  update()
})

screen.key(['z'], (ch, key) => {
  if(carousel.currPage !== 0)
    return 
  redraw = !redraw
  
  if(redraw)
    status1.log('Redraw enabled')
  else
    status1.log('Redraw disabled')
  
  update()
})

screen.key('h', () => {
  helpBox.show()
  helpBox.focus()
  screen.render()
})

screen.key('/', () => {
  searchBox.show()
  searchBox.focus()
	searchBox.input('Search:', '', function(err, data) {
		if (process.argv[2] === 'resume') {
			process.stdin.resume();
		} else if (process.argv[2] === 'end') {
			process.stdin.setRawMode(false);
			process.stdin.end();
		}
		if (err) throw err;
		searchBox.hide()
    //status1.log(`Got: '${data}'`)
    Object.keys(device_table.rows.children).forEach(i => {
      var row = device_table.rows.children[i]
      
      if(row.content.match(data)) {
        status1.log(row.content)
      }
    })
	})
  screen.render()
})

screen.key(['tab'], () => {
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


//               //
/*               */
 //  Web Socket //
/*               */
//               //


const ws = new WS(`ws://${cfg.sensor.ws.hostname}:${cfg.sensor.ws.port}/ws`, [], { WebSocket: WS })

ws.addEventListener('open', () => {
  status1.log('Connected to websocket ' + cfg.sensor.ws.hostname)
  ws.send(JSON.stringify({'cmd': 'subscribe'}))
})

ws.addEventListener('message', message => {
  var msg = JSON.parse(message.data)
  extend(true, devices, devices, msg.data.db)
  status_info  = [msg.data.stats, msg.data.info, msg.data.sensors, msg.data.location || msg.location]
  
  update()
})

ws.addEventListener('error', e => {
  status1.log(`WS Client: ${e.error}`)
})

function drawInfo(mac) {
  var dev = devices[mac],
      out
  
  if(!drawJSON) {
      out =  `${dev.mac} - ${dev.vendor}`
      out += `\n\nFirst seen: ${dev.firstseen.toLocaleString()}\n`
      out += `Last seen: ${new Date(dev.lastseen).toLocaleString()}`
      out += `Last RSSI/Seq# ${dev.rssi}/${dev.seq}\n`
      out += `\nTotal Packets/Bytes: ${hmn(dev.totalPackets.toPrecision(3))}/${hmn(dev.totalBytes.toPrecision(3))}\n`
      out += `\n`

    if(dev.type == 'ap')
      out += `Clients:\n`
    else
      out += `Probed SSIDs:\n`

      dev.hosts.forEach(h => {
        if(dev.type == 'ap' && devices.hasOwnProperty(h)) {
          out += `* __${devices[h].mac}__  ${devices[h].vendorSm} (${devices[h].rssi})\n`
          out += `* . Last Seen: ${new Date(devices[h].lastseen).toLocaleString()}\n`
        } else {
          out += `* __${h}__\n`
        }
      })
  } else
    out = JSON.stringify(dev,null,2)

  info_markdown.setMarkdown(out)
  update()
}

    //             //
   /*             */
  //  Widgets    //
 /*             */
//             //

var colors = ['yellow','cyan','red','white','blue','green']

var devices_grid, device_table, graphics_grid, status1_markdown, status2_markdown, device_markdown, channel_graph, packet_graph
var status1, status2, server_log, packet_graph, channel_bar, device_markdown, status_info, keys, info_markdown

// Dimensions for table - yaml?
const dim = {
  scr:  {r: 10, c: 11},
  status1:  {h: 0, w: 0, x: 1, y: 6},
  status2:  {h: 0, w: 5, x: 1, y: 8},
  devTable:  {h: 1, w: 0, x: 8, y: 10},
  chanbar:  {h: 5, w: 11, x: 0, y: 0},
  pktGraph:  {h: 5, w: 0, x: 5, y: 11},
  logger:  {h: 1, w: 8, x: 9, y: 0},
  info: {h: 10, w: 3, x: 0, y: 8},
  devTbCols: [4, 11, 18, 24, 4, 3, 11, 11, 5, 12],
}

function devices_page() {
devices_grid = new contrib.grid({rows: dim.scr.r, cols: dim.scr.c, screen: screen})

status1_markdown = devices_grid.set(dim.status1.h, dim.status1.w, dim.status1.x,dim.status1.y, contrib.markdown, {
    tags: true,
    interactive: false
  })
  
  status2_markdown = devices_grid.set(dim.status2.h, dim.status2.w, dim.status2.x,dim.status2.y, contrib.markdown, {
    tags: true,
    interactive: false
  })

  device_table = devices_grid.set(dim.devTable.h, dim.devTable.w, dim.devTable.x,dim.devTable.y, contrib.table,
     { keys: true,
       mouse: true,
       vi: true,
       tags: true,
       fg: 'white',
       selectedFg: 'white',
       selectedBg: 'blue',
       label: 'Active',
       noCellBorders: true,
       interactive: true,
       width: '60%',
       height: '50%',
       border: {
        type: 'ascii',
        fg: 'cyan'},
       columnSpacing: 3, // in chars
       columnWidth: dim.devTbCols })
  
  device_table.rows.on('select',(i,idx) => {
    try {
      var selected = i.content.match(/[0-9a-f]{1,2}([\.:-])(?:[0-9a-f]{1,2}\1){4}[0-9a-f]{1,2}/)
      drawInfo(selected[0])
    } catch (e) {}
  })

  info_markdown = devices_grid.set(dim.info.x,dim.info.y, dim.info.h, dim.info.w, contrib.markdown,
   {
     label: 'info',
     tags: true
  }
 )

  status1 = devices_grid.set(dim.logger.x,dim.logger.y,dim.logger.h,dim.logger.w, contrib.log,
      { fg: 'green',
        padding: 2,
        tags: true,
        selectedFg: 'green',
        label: 'log'})
  
  device_table.focus()
}

function graphics_page() {
  graphics_grid = new contrib.grid({rows: dim.scr.r, cols: dim.scr.c, screen: screen})
  
  channel_bar = graphics_grid.set(dim.chanbar.x,dim.chanbar.y,dim.chanbar.h,dim.chanbar.w, contrib.bar,
       { label: 'Channel Usage',
         barWidth: 10,
         barSpacing: 10,
         xOffset: 10,
         maxHeight: 30
       })

  packet_graph = graphics_grid.set(dim.pktGraph.h, dim.pktGraph.w, dim.pktGraph.x, dim.pktGraph.y, contrib.line,
       { style:
         { line: 'yellow',
           text: 'green',
           baseline: 'black'},
         xLabelPadding: 4,
         xPadding: 4,
         showLegend: true,
         wholeNumbersOnly: true, //true=do not show fraction in y axis
         label: 'Packets'
        })
}

var searchBox = blessed.prompt({
  parent: screen,
  left: 'center',
  top: 'center',
  width: '40%',
  height: 'shrink',
  border: 'line'
})

var helpText,
    helpBox = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 'shrink',
    draggable: true,
    height: 11,
    padding: 1,
    tags: true,
    border: {
      type: 'ascii',
      fg: 'green'
      },
    })

// Workaround for centering shrunken box.
  helpBox.on('prerender', function() {
  var lpos = helpBox._getCoords(true)
  if (lpos) {
    helpBox.rleft = (screen.width - (lpos.xl - lpos.xi)) / 2 | 0
  }
})

helpText = `{bold}sigmon console version ${cfg.version}{/}` +
           '\n\n' +
           '[tab] change view [a] display type\n' +
           '[s] sort [r] reverse [enter] info\n' +
           '[f] filter [z] pause [q] quit' +
           '\n\n' +
           'press enter to exit this help screen'

helpBox.setContent(helpText)

helpBox.on('keypress', () => {
  helpBox.hide()
  screen.render()
})
  
var carousel = new contrib.carousel( [devices_page, graphics_page]
                                     , { screen: screen
                                     , interval: 0
                                     , controlKeys: false })

carousel.start()

screen.append(helpBox)
screen.append(searchBox)

setTimeout(() => { helpBox.hide() }, 1000)
