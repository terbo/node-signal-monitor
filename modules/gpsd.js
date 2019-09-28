var cfg = require('../etc/config')

const node_gpsd = require('node-gpsd'),
      gpsd_reconnect = true,
      gpsd_events = [ 'tpv', 'sky' ],
      gpsd = new node_gpsd.Listener(cfg.sensor.gpsd)

var location = { lon: 0, lat: 0, time: 0, sats: 0 }

gpsd_events.forEach(function(ev) {
  gpsd.on(ev.toUpperCase(), function(data) {
    try {
      if(data.class == 'SKY') {
        if(!location.sats)
          console.log(`Found ${data.satellites.length} satellites`)
        location.sats = Number(data.satellites.length)
      }
      if(data.class == 'TPV' && data.mode == 3) {
        location.lon = data.lon
        location.lat = data.lat
        location.time = data.time

        if(data.hasOwnProperty('speed'))
          location.speed = data.speed
        if(data.hasOwnProperty('alt'))
          location.alt  = data.alt
        if(data.hasOwnProperty('track'))
          location.track = data.track
      } else {
        //console.log(data)
      }
    } catch (e) {
      console.error(`GPSD: ${e}`)
      return
    }
  })
})

gpsd.on('disconnected', function () {
  if(gpsd_reconnect !== null)
    return

  gpsd_reconnect = setInterval(function() {
    console.warn('GPSD Disconnected, reconnecting ...')
    
    gpsd.connect(function() {
      if(gpsd_reconnect !== null) {
        clearInterval(gpsd_reconnect)
        gpsd_reconnect = null
        gpsd.watch()
        console.warn('GPSD reconnected.')
      }
    })
  }, 3000)
})

gpsd.connect(function() {
  console.log(`Connected to GPSD ${cfg.sensor.gpsd.hostname}:${cfg.sensor.gpsd.port}`)
  gpsd.watch()
})


module.exports = { location: location }
