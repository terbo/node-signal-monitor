"use strict"

var cfg = require('../etc/config')

cfg = cfg.sensor.hopper

require('console-stamp')(console, { pattern: 'HH:MM:ss' })

const process = require('process'),
        spawn = require('child_process').spawn

var channels, timer

function toggle() {
  cfg.enabled = !cfg.enabled
}

function rand_channels() {
  return Array.from(Array(cfg.channels + 1).keys())
              .slice(1, cfg.channels + 1)
              .sort(() => Math.random())
}

function set_channel(c=1) {
  var output,
      child = spawn('/sbin/iwconfig', [cfg.iface, 'channel', c])
  
  child.stderr.on('data', (data) => { output += data })
  child.stdout.on('data', (data) => { output += data })

  child.on('close', checkexit)
  child.on('exit',  checkexit)

  function checkexit(code) {
    if(code != 0) {
      console.error(`Setting channel: (${output})`)
      process.exit()
    }
  }
}

function hop_channels() {
  if(cfg.enabled) {
    channels = rand_channels()
    hopper()
  }
}

function hop () {
  if(!cfg.enabled)
    return

  if(!channels.length)
    return hop_channels()
    
  set_channel(channels.pop())
  hopper()
}

function hopper() {
  timer = setTimeout(hop, cfg.dwell)
}

function start() {
  if(cfg.enabled) {
    console.log(`Channel hopper initiated with ${cfg.dwell}ms dwell time`)
    hop_channels()
  }
  else if(cfg.channel) {
    set_channel(cfg.channel)
    console.info(`Setting channel to ${cfg.channel}`)
  } 
}

module.exports = { cfg, start, toggle, set_channel }
