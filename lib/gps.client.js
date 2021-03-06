'use strict';

require('console-stamp')(console, { pattern: 'HH:MM:ss' })

const path = require('path'),
      cfg  = require('../etc/config').gps


const node_gpsd = require('node-gpsd'),
      gpsd_reconnect = true,
      gpsd_events = cfg.events.split(',')

var gpsd = null,
    is_connected = false,
    location = { lon: 0, lat: 0, time: 0, sats: 0,
                 acc: 0, speed: 0, track: 0, time: null }

function connect(host=null, port=null) {
  if(host)
    cfg.hostname = host

  if(port)
    cfg.port = port

  gpsd = new node_gpsd.Listener(cfg)

  gpsd_events.forEach(ev => {
    gpsd.on(ev.toUpperCase(), data => {
      try {
        if(data.class == 'SKY') {
          if(!location.sats)
            console.log(`Tracking ${data.satellites.length} Satellites`)
          location.sats = Number(data.satellites.length)
        }
        if(data.class == 'TPV') {
          if(data.mode == 3) {
            gpsd.is_connected = true
            location.lon = data.lon
            location.lat = data.lat
            location.time = data.time

            if(data.hasOwnProperty('speed'))
              location.speed = data.speed
            if(data.hasOwnProperty('alt'))
              location.alt  = data.alt
            if(data.hasOwnProperty('track'))
              location.track = data.track
          } else
          if(data.mode == 2)
            gpsd.is_connected = true
          else {
            gpsd.is_connected = false
          }
        } else {
          //console.log(data)
        }
      } catch (e) {
        console.error(`GPSD: ${e}`)
        return
      }
    })
  })

  gpsd.on('disconnected', () => {
    if(gpsd_reconnect !== null)
      return

    gpsd_reconnect = setInterval(() => {
      console.warn('GPSD Disconnected, reconnecting ...')

      gpsd.connect(() => {
        if(gpsd_reconnect !== null) {
          clearInterval(gpsd_reconnect)
          gpsd_reconnect = null
          gpsd.watch()
          console.warn('GPSD reconnected.')
        }
      })
    }, cfg.reconnect_delay)
  })

  gpsd.connect(() => {
    console.log(`Connected to GPSD ${cfg.hostname}:${cfg.port}`)
    gpsd.watch()
  })

  gpsd.on('error', (error) => {
    console.error(`GPSD: ${error.error}`)
  })

}

if(cfg.auto_connect)
  connect()

module.exports = { connect, is_connected, location , gpsd}
