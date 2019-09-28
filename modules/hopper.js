var cfg = require('../etc/config')

const process = require('process'),
        spawn = require('child_process').spawn,
           ws = require('ws')

// then can turn on/off hop, select channels, etc.
var channels, timer

function toggle() {
  cfg.hopper.hop = !cfg.hopper.hop
}

function rand_channels() {
  return Array.from(Array(cfg.hopper.channels + 1).keys())
              .slice(1, cfg.hopper.channels + 1)
              .sort(() => Math.random())
}

function set_channel(c) {
  var output,
      child = spawn('/sbin/iwconfig', [cfg.sensor.interface, 'channel', c])
  
  child.stderr.on('data', (data) => { output += data })
  child.stdout.on('data', (data) => { output += data })

	child.on('close', checkexit)
	child.on('exit',  checkexit)

  function checkexit(code) {
    if(code != 0) {
      console.error(`Setting channel: ${e} (${output})`)
      process.exit()
    }
	}
}

function hop_channels() {
  if(cfg.hopper.hop == true) {
    channels = rand_channels()
    hopper()
  }
}

function hop () {
  if(!cfg.hopper.hop)
    return

  if(!channels.length)
    return hop_channels()
    
  //console.log('Channel: ' + channels.pop())
  set_channel(channels.pop())
  timer = setTimeout(hop, cfg.hopper.dwell)
}

function hopper() {
  timer = setTimeout(hop, cfg.hopper.dwell)
}

function start() {
  console.log('Channel hopper initiated')
  hop_channels()
}

module.exports = { start: start, config: cfg.hopper, toggle: toggle}
