#!/usr/bin/env node
"use strict"
// something like how kismet 'fingerprints' devices

const pcap = require('pcap'),
	    sha1 = require('sha1'),
      process = require('process')

if(process.argv.length < 3) {
  console.error('$0 interface')
  process.exit(2)
}

var uuid,
    sniffer = pcap.createSession(process.argv[2])
var ids = []

function uuid_from_tags(p) {
	var type, tags = '', tmp = []

  try{
		const pkt = pcap.decode(p),
        frame = pkt.payload.ieee802_11Frame,
          mac = frame.shost.toString()
  
  if(frame.hasOwnProperty('beacon') && frame.beacon !== undefined) {
    tags = frame.beacon.tags
    type = 'ap'
  } else
  if (frame.hasOwnProperty('probe') && frame.probe !== undefined) {
    tags = pkt.probe.tags
    type = 'st'
  } else
    return
  
  if(tags) {
    Object.keys(tags).forEach(tag => {
      var tagVal = String(tags[tag].value).trim()
      
      if(tagVal && tagVal.length)
        tmp.push(tagVal)
    })
    
    uuid = sha1(tmp.join())
    //console.info(mac, uuid)
  }
  /*if(uuid in ids) {
    if(ids[uuid] == mac)
      console.log(`${mac} => ${uuid}`)
    else
      console.log(`${mac} -- ${uuid}`)
  } else {
    ids[uuid] = mac
  }*/
  console.log(`\t(${type}) ${mac}  =>  ${uuid}  - ${tags.length}\n`)
	} catch(e){
   //console.log(e)
		return
  }

}

// now just need the packets that kizmet marks

sniffer.on('packet', uuid_from_tags)
