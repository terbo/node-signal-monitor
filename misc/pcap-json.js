'use strict'

const pcap = require('pcap'),
      os = require('os'),
      iface = 'monitor0',
      host = os.hostname()

var startTime = 0,
		endTime = 0,
    //sniffer = pcap.PcapSession(iface),//pcap.createSession(iface),
    // we create a session below to allow for saving pcaps by recreating it
    packets = [],
    stopped = false,
    timerPt = null,
    savePt  = null,
    stats   = {},
      //raw   = [],
    session

let errors = 0

function show_stats() {
  var now
  if(!stopped)
    now = new Date(),
      stats.cap = session.stats()
  else
    now = endTime

  stats.errors = errors
  stats.pps = (stats.cap.ps_recv / ((now - startTime) / 1000)).toPrecision(4)
  stats.pps_corrected = ( ( stats.cap.ps_recv - errors ) / ((now- startTime) / 1000)).toPrecision(4)
  console.log(stats)
}

function packet_cb(packet) {
  try {
   //raw.push(packet)
   packets.push(pcap.decode(packet))
  }
  catch(e) { errors++; if(stopped) console.error(e); return }
}

function decode(packet) {
  try {
    return pcap.decode(packet)
  } catch (e) {
    console.error(e)
    console.debug(packet)
    return null
  }
}

function save_pcap() {
  if(!stopped) {
    var pcap_file = `${host}-${iface}-${new Date().getTime()}.pcap`
    session.session.open_live(iface, '', 0, pcap_file, makePacket, true)
  }
}

function PacketWithHeader(buf, header, link_type) {
	this.buf = buf;
	this.header = header;
	this.link_type = link_type;
}

function makePacket() {
	var full_packet = new PacketWithHeader(session.buf, session.header, session.link_type);
	packet_cb(full_packet);
}

function start(timer=true, interval=5000, save_packets=true, save_interval=5000) {
  console.info('Listening on ' + iface)
  session = pcap.createSession(iface)
  session.on_packet_ready = makePacket
  
  startTime = new Date()
  
  stopped = false
  
  if(timer)
    timerPt = setInterval(show_stats, interval)
  
	if(save_packets) {
    savePt = setInterval(save_pcap, save_interval)
	}
}

function stop() {
  show_stats()
  pcap.on_packet_ready = null

  endTime = new Date()
  console.log('Closed interface ' + iface)
  
  clearInterval(timerPt)
  setTimeout(() => {session.close();stopped=true},750)
}

module.exports = { start, stop, packets, pcap, raw, decode, stats, show_stats , session}
