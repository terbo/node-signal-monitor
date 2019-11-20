// little utilities
'use strict';

require('console-stamp')(console, { pattern: 'HH:MM:ss' })

const path = require('path'),
      cfg = require('../etc/config.js'),
      dfl = require('duration-format-let'),
      oui = require('oui'),
      fs  = require('fs'),
      ouiFile = path.join(cfg.baseDir, 'data', cfg.oui.file)


var   mac_filter = /[^a-f0-9]/gi,
      mac_re5 = /^05\d0/gi,
      mac_ref = /ffff/gi,
      mac_re0 = /[01][0-9]00$/gi,
      mac_valid = /^[a-fA-F0-9:]{17}|[a-fA-F0-9]{12}$/g

// return duration from milliseconds
function getDuration(ts) {
  return dfl(ts, {disableUnits: ['s','ms']} )
}

// return array of long and shortened vendor from mac address
function getVendor(mac) {
  const res = oui(mac, { file: ouiFile })

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

function shuffle(arra1) {
    var arra = [...arra1],
        ctr = arra1.length,
        temp = null,
        index = 0

    while (ctr > 0) {                           // While there are elements in the array
        index = Math.floor(Math.random() * ctr) // Pick a random index
        ctr--                                   // Decrease ctr by 1
        temp = arra1[ctr]                       // And swap the last element with it
        arra1[ctr] = arra1[index]
        arra1[index] = temp
    }
    return arra
}

function updateOUI(e, s) {
  if(e)
    console.error(e)
  else
    if(s.mtime < (new Date() - (cfg.oui.interval * 1000 * 60 * 60 * 24))) {
      if(cfg.server.verbose)
        console.info(`Updating OUI file ${ouiFile}`)

      try {
        oui.update({ file: ouiFile })
      } catch (e) {
        console.error(`Updating ${ouiFile}: ${e}`)
    }
  }
}

// checkDevice('owned', mac, ssid, ...)
function checkDevice() {
  var found = false

  if(arguments.length == 1) {
    if(cfg.devices.hasOwnProperty(arguments[0]))
      return cfg.devices[arguments[0]]
    else {
      console.log(`need at least 2 arguments, deviceType and Name, or valid deviceType to return list: ${JSON.stringify(arguments)}`)
      return found
    }
  }

  var query = Array.from(arguments),
    devtype = query.shift()

  try {
    Object.values(query).forEach(query => {
      if(found)
        return found

      Object.values(cfg.devices[devtype]).forEach(key => {
        if(found)
          return found

        var device = Object.keys(key)[0]

        if(device.toLowerCase() == query.toLowerCase())
          found = true
      })
    })
  } catch (e) {
    console.error(`checkDevs: ${e}`)
    return found
  }

  return found
}

function dbm2rssi(dBm) {
  dBm = parseInt(dBm)
  if(dBm <= -100 && dbm >= -50)
    return 2 * (dBm + 100)
  return false
}

function rssi2dbm(rssi) {
  rssi = parseInt(rssi)
  if(rssi >= 0 && rssi <= 100)
    return ( rssi / 2 ) - 100
  return false
}

// could make an signal level class that keeps average, max, and min
// and will return any of these conversions ..

function rssi2meters(rssi, multiplier=1, txpower=-27) {
  rssi=parseInt(rssi)
  return Math.pow(10, ((rssi*multiplier) + 38.45) / txpower)
}

// check if mac is a valid single machine address, sorta

function validmac(mac) {
  var valid = false

  mac = String(mac).toLowerCase()
  mac = mac.replace(mac_filter,'')

  if(mac_valid.test(mac))
    valid = true

  if(mac_ref.test(mac)) valid = false
  if(mac_re5.test(mac)) valid = false
  if(mac_re0.test(mac)) valid = false

  return valid
}


// https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits
const Cleanup = function Cleanup(callback) {

  // attach user callback to the process event emitter
  // if no callback, it will still exit gracefully on Ctrl-C
  callback = callback || noOp
  process.on('cleanup',callback)

  // do app specific cleaning before exiting
  process.on('exit', function () {
    process.emit('cleanup')
  })

  // catch ctrl+c event and exit normally
  process.on('SIGINT', function () {
    console.log('Ctrl-C recieved ..')
    process.exit(2)
  })

  //catch uncaught exceptions, trace, then exit normally
  process.on('uncaughtException', function(e) {
    console.log('Uncaught Exception...')
    console.log(e.stack)
    process.exit(99)
  })
}

module.exports = { getDuration, getVendor, shuffle, checkDevice, updateOUI, rssi2dbm, dbm2rssi, rssi2meters, validmac, Cleanup }
