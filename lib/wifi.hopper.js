// wifi channel hopper
'use strict';

require('console-stamp')(console, { pattern: 'HH:MM:ss' })

var path = require('path'),
    cfg  = require('../etc/config')

module.paths.unshift(path.join(cfg.baseDir, 'lib'))

const process = require('process'),
      child_process = require('child_process'),
      spawn = child_process.spawn,
      spawnSync = child_process.spawnSync,
      shuffle = require('sigmon.utils').shuffle,
      chanre = new RegExp(/Channel\s*(\d+)\s*:\s*([\d.Ghz]*)/)

var channels = [], all_channels = [], timer, max_errors = 5, running = false

let errors = 0


function toggle() {
  cfg.wifi.hopper.enabled = !cfg.wifi.hopper.enabled
}

function rand_channels() {
  return shuffle(all_channels)
}

// one day, check errors, expand code..
function get_channels(iface) {
  var chans = [],
      match = [],
      output = '',
      child = spawnSync('/sbin/iwlist', [iface, 'frequency'])

  child.output.toString().split('\n').forEach(line => { match = chanre.exec(line); if(match && match.length) { chans.push(parseInt(match[1])) } })

  return chans
}

function list_channels() {
  return channels
}

function set_channel(c=1) {
  var output,
      child = spawn(cfg.wifi.hopper.binary, ['dev', cfg.wifi.interface, 'set','channel', parseInt(c)])

  if(!child || !child.stderr) {
    errors += 1
    console.error(`Failed to spawn ${cfg.wifi.hopper.binary}`)

    if(errors > max_errors) {
      console.error('Too many errors, exiting.')
      process.exit()
    }
  }

  child.stderr.on('data', (data) => { output += data })
  child.stdout.on('data', (data) => { output += data })

  function checkexit(code) {
    if(code != 0) {
      errors += 1
      console.error(`Setting channel ${c} on ${cfg.wifi.interface}: ${output}`)

      if(errors > max_errors) {
        console.error('Too many errors, exiting.')
        process.exit()
      }

    return
    }
  }

  child.on('close', checkexit)
  child.on('exit',  checkexit)

  if(errors)
    errors -= 1
}

function hop_channels() {
if(cfg.wifi.hopper.enabled) {
  running = true
  channels = rand_channels()
    wifiHopper()
  }
}

function hop () {
  if(!cfg.wifi.hopper.enabled)
    return

  if(!channels.length)
    return hop_channels()

  set_channel(channels.pop())
  wifiHopper()
}

function wifiHopper() {
  if(running)
    timer = setTimeout(hop, cfg.wifi.hopper.dwell)
}

function start(iface=cfg.wifi.interface, fixed_channel = null) {
  if(iface != cfg.wifi.interface)
    cfg.wifi.interface = iface

  if(fixed_channel === null) {
    cfg.wifi.hopper.enabled = true
    all_channels = channels = get_channels(cfg.wifi.interface)
    console.info(`Wifi channel hopper over ${channels.length} channels dwelling ${cfg.wifi.hopper.dwell}ms`)
    hop_channels()
  } else {
    //channels = [cfg.wifi.hopper.channel]
    set_channel(cfg.wifi.hopper.channel)
    console.info(`Setting channel to ${cfg.wifi.hopper.channel}`)
  } 
}

function stop() {
  if(running && timer) {
    console.log('Stopping channel hopper.')
    cfg.wifi.hopper.enabled = false
    clearTimeout(timer)
    running = false
  }
}

module.exports = { cfg, start, stop, toggle, set_channel, get_channels, list_channels, channels }
