#!/usr/bin/env node
"use strict"
// something like how kismet 'fingerprints' devices

const pcap = require('pcap'),
	    sha1 = require('sha1'),
      process = require('process')

const dot11_beacon_ie_fingerprint=['0,1,45,48,50,61,74,127,191,195,221-00156D-00,221-0050F2-2,221-001018-2,221-506F9A-28']
const dot11_probe_ie_fingerprint=['1,50,59,107,127,221-001018-2,221-00904c-51']

var lastStatus = new Date()
var changed = {}

if(process.argv.length < 3) {
  console.error('$0 interface')
  process.exit(2)
}

var uuid,
    sniffer = pcap.createSession(process.argv[2])

var db = {};

function uuid_from_tags(p) {
	var type, tags = '', tmp = [],
      ssid, fp = '', uuid = ''
  var pkt, frame, mac

  try{
		pkt = pcap.decode(p)
        frame = pkt.payload.ieee802_11Frame
          mac = frame.shost.toString()
  } catch(e) { return }

  if(frame.hasOwnProperty('beacon') && frame.beacon !== undefined) {
    tags = frame.beacon.tags
    type = 'ap'
    ssid = frame.beacon.tags[0].ssid
    fp=dot11_beacon_ie_fingerprint
  } else
  if (frame.hasOwnProperty('probe') && frame.probe !== undefined) {
    tags = frame.probe.tags
    type = 'sta'
    ssid = frame.probe.tags[0].ssid
    fp=dot11_probe_ie_fingerprint
  } else {
    console.log('return')
    return
  }

  if(tags != '') {
    try {
      fp.forEach(key => {
        var tagVal = tags[key]
        
        if(tagVal){
          console.log(`${tagVal} ${key}`)
          tmp.push(tagVal)
        } 
      })

    if(tmp.length)
      uuid = sha1(tmp.join())
    else {
      console.log(tmp)
      return
    }
  
    if(uuid == '')
      return

    } catch(e) { console.log(e) }
        
    
    if(db.hasOwnProperty(uuid)) {
      if((db[uuid].mac != mac) || (db[uuid].ssid != ssid)) {
        if(changed.hasOwnProperty(uuid))
          changed[uuid].push((new Date(),tmp.length))
        else
          changed[uuid] = [(new Date(),tmp.length)]
      }
    } else {
      //console.log({mac, ssid})
      db[uuid] = {mac, ssid, tags: tmp.length}
    }
  }

  if(new Date() - lastStatus > 5000) {
    lastStatus = new Date()
    console.dir(db)
    console.dir(changed)
  }
}

// now just need the packets that kizmet marks

sniffer.on('packet', uuid_from_tags)
