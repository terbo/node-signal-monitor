// container for a wifi device and related data

function wifiDevice(packet) {
  var now = new Date(),
      buf = { 
      type: null, // ap, sta
      pktype: packet.rftype,
      seq: packet.seq,
      mac: packet.mac, // store as lc alnum, getmac translates?
      // could be renamed to .. not id, ...
      macSm: packet.macSm, 
      sensors: [],
      lastseen: now,
      firstseen: now,
      vendor: packet.vendor, // short, full
      // manuf?
      vendorSm: packet.vendorSm,
      // to be changed to lastrssi
      rssi: packet.rssi,
      channel: packet.channel,
      recvchan: packet.rcvchan,
      // to be changed to 'addresses' 
      // and include mac:ssid pairs for both aps and stas
      ssid: packet.ssid,
      hosts: [], // clients / ssids
      totalPackets: 1,
      totalBytes: packet.len,
      tags: []
    }

  return buf
}

module.exports = { wifiDevice }
