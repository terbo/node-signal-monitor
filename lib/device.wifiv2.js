// container for a wifi device and related data
// TODO: seperate into station and accesspoint containers
// TODO: Create wrapped object like sessions, etc
// # 108 ninjas #
'use strict';

const path = require('path'),
      cfg = require('../etc/config')


//console.dir(config)
//conf = new config.config()

//module.paths.unshift(path.join(conf.get('base'), 'lib'))

const utils         = require('./sigmon.utils'),
      deviceSession = require('./device.session').deviceSession

var wifiDevice = function(packet = null, device = null) {
  var now = new Date()

  if(packet) {
    var vendor = utils.getVendor(packet.mac)
    var macSm = packet.mac.substr(12,14).replace(':','')

    this.type = null
    this.source = 'wifi'
    this.pktype = packet.rftype
    this.seq = packet.seq
    this.lastseq = packet.seq
    this.mac = packet.mac
    this.macSm = macSm
    this.sensors = []
    this.lastseen = now
    this.firstseen = now
    this.vendor = vendor[0]
    this.vendorSm = vendor[1]
    this.dbm = utils.rssi2dbm(packet.rssi)
    this.rssi = packet.rssi
    this.rssis = []
    this.lastrssi = packet.rssi
    this.avgrssi = packet.rssi
    this.minrssi = packet.rssi
    this.maxrssi = packet.rssi
    this.channel = packet.channel
    this.recvchan = packet.rcvchan
    this.ssid = packet.ssid
    // to be changed to 'addrs' 
    this.hosts = []
    this.lostPackets = 0
    this.totalPackets = 1
    this.totalBytes = packet.len
    this.tags = []
    
    this.firstlocation = { lat: packet.lat, lon: packet.lon }
    this.location = { lat: packet.lat, lon: packet.lon }
    this.lastlocation = { lat: packet.lat, lon: packet.lon }

    this.sensors = [packet.sensor]
    this.sessions = new deviceSession(packet)

    if(packet.rftype[0] == 0 || packet.hasOwnProperty('beacon')) {
      if([1,3,5,8].includes(packet.rftype[1])) {
        this.type = 'ap'
        this.pktags = packet.beacon
        
        var booted = packet.uptime
        
        if(booted)
          this.uptime = new Date().getTime() - new Date(booted).getTime()
      }
      else if([0,2,4].includes(packet.rftype[1]) || packet.hasOwnProperty('probe')) {
        this.type = 'sta'
        this.pktags = packet.probe
      }
    }

    if(utils.checkDevice('owned', this.mac)) {
      console.log(`Adding ${this.mac} to 'owned' device list`)
      this.tags.push('owned')
    } else
    if(utils.checkDevice('alert', this.mac)) {
      console.log(`Adding ${this.mac} to 'alert' device list`)
      this.tags.push('alert')
    } else
    if(utils.checkDevice('track', this.mac)) {
      console.log(`Adding ${this.mac} to 'track' device list`)
      this.tags.push('watch')
    } else
    if(utils.checkDevice('ignore', this.mac)) {
      console.log(`Adding ${this.mac} to 'ignore' device list`)
      this.tags.push('ignore')
    }
  } else {
    // if being re-instantiated from device 
    this.type = device.type
    this.source = device.source
    this.pktype = device.pktype
    this.seq = device.seq
    this.lastseq = device.lastseq
    this.mac = device.mac
    this.macSm = device.macSm
    this.sensors = device.sensors
    this.lastseen = device.lastseen
    this.firstseen = device.firstseen
    this.vendor = device.vendor
    this.vendorSm = device.vendorSm
    this.dbm = device.dbm
    this.rssi = device.rssi
    this.rssis = device.rssis
    this.lastrssi = device.lastrssi
    this.avgrssi = device.rssi
    this.minrssi = device.minrssi
    this.maxrssi = device.maxrssi
    this.channel = device.channel
    this.recvchan = device.rcvchan
    this.ssid = device.ssid
    // to be changed to 'addrs' 
    this.hosts = device.hosts
    this.lostPackets = device.lostPackets
    this.totalPackets = device.totalPackets
    this.totalBytes = device.totalBytes
    this.tags = ['new']
   
    this.pktags = device.pktags || []

    try {
      this.location = { lat: device.location.lat, lon: device.location.lon }
      this.lastlocation = { lat: device.location.lat, lon: device.location.lon }
    } catch (e) {}

    this.sensors = device.sensors
    this.sessions = new deviceSession(false, device.sessions.sessions)
  }
 
  return this
}

/*
 * Summary          Updates records for a recorded wifi device
 *
 * Description      The passed packet will update sensors, rssi, lastseen, sequence, total packets and bytes,
 *                    and also calculate rssi stats. It is possible that this could just interact with
 *                    the session object itself, leaving the packet parser to do less work.
 *                    
*/

wifiDevice.prototype.update = function(packet) {
  var now = new Date(),
      output = { dir: '', // connection or disconnection, < or >
                 type: '', // ap or sta
                 name: '', // SSID for AP shortmac for STA
                 action: '',
                 lost: '',
                 lastseen: '' }
      
  output.type = this.type
  output.name    = this.type == 'ap' ? this.ssid : this.macSm

  if(packet.rftype[0] === 0) {
    if(packet.rftype[1] === 0)
      output.action = `associating to ${this.ssid}`,
      output.dir    = '>'
    if(packet.rftype[1] == 2)
      output.action = `re-associating to ${this.ssid}`,
      output.dir    = '>'
    if(packet.rftype[1] == 4)
      output.action = `probed ${this.ssid}`,
      output.dir    = '>'
    if(packet.rftype[1] == 10)
      output.action = `disassociating from ${this.ssid}`,
      output.dir    = '<'
  } else
    output.dir = '>'

  
  if(!this.sensors.includes(packet.sensor))
    this.sensors.push(packet.sensor)

  if(this.type == 'sta' && (!this.hosts.includes(packet.ssid)))
    this.hosts.push(packet.ssid)

  this.rssi = parseInt(packet.rssi)
  this.dbm = utils.rssi2dbm(packet.rssi)
  this.seq =  parseInt(packet.seq)
  
  this.totalPackets += 1
  this.totalBytes += parseInt(packet.len)

  if(this.rssi < this.maxrssi)
    this.maxrssi = this.rssi
  if(this.rssi > this.minrssi)
    this.minrssi = this.minrssi

  // keep 512 records of rssi, then reset with that average
  
  if(this.rssis && typeof this.rssis == 'array' && this.rssis.length > 512)
    this.rssis = [this.avgrssi]
  else {
    if(this.rssis) {
      this.rssis.push(this.rssi)
      this.avgrssi = eval(this.rssis.join('+')) / this.rssis.length
    }
  }

  // now assign this for old clients

  this.seq = this.lastseq
  this.rssi = this.lastrssi

  // no longer a new device
  if(this.tags.includes('new') && (now - this.firstseen < cfg.device.new_timeout))
    this.tags.splice(this.tags.indexOf('new'),1)
 
  if(this.lastrssi > cfg.device.close_rssi && (!this.tags.includes('proximity')))
    this.tags.push('proximity')
  else if(this.rssi < cfg.device.far_rssi && (!this.tags.includes('far')))
    this.tags.push('far')
 
  if((this.vendor == 'Unknown' || this.ssid == '[hidden]') && (!this.tags.includes('unknown')))
    this.tags.push('unknown')
  else if(!this.tags.includes('oui'))
    this.tags.push('oui')
  
  if(!this.tags.includes('loud') && (this.hosts.length > cfg.device.loud_client_min))
    this.tags.push('loud')

  var lastseen = (now.getTime() - new Date(this.lastseen).getTime())
  
  // attempt to calculate how many packets we've not seen
  // by looking at the difference in sequence numbers
  // only valid if lastseen is very low though
  
  if(lastseen < 5) {
    this.lostPackets = this.lastseq - this.seq
    output.lost = this.lostPackets
  }
  

  // has been seen in (4) minutes, extend session exit
  // second time seen
  
  if(lastseen < cfg.device.session_length)
    this.sessions.extend(packet)

  // was seen (10) minutes ago, lets see how long he was here
  else
  if(lastseen > (cfg.device.session_length * 2)) {
    var dwelled = this.sessions.last('duration')

    // if dwelled for more than a session length and has returned, tag, and create a new sessoin
    // however, should simply extend that session, or see how it looks in a chart, could be regular device

    if(dwelled > cfg.device.session_length)
      if(!this.tags.includes('session'))
          this.tags.push('session')
    
    if(!this.tags.includes['repeat'])
      this.tags.push('repeat')

    this.sessions.add(packet)

    output.dir = '+'
    output.lastseen = `lastseen ${utils.getDuration(lastseen)} for ${utils.getDuration(dwelled)}`
  }

  this.location = { lat: this.location.lat, lon: this.location.lon }
  this.lastlocation = { lat: this.location.lat, lon: this.location.lon }
  
  this.lastseen = now
  
  return output
}

module.exports = { wifiDevice }