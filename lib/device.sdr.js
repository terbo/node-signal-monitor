// container for a device detected via rtl_433, etc
// idk what to do with all of the fields right now
// or if all packets will even have the 24-bit mac field/'id'

function rtlDevice(packet) {
  var now = new Date(),
    buf = { 
      sensors: [packet.sensor],
      firstseen: now,
      lastseen: now,
      frequency: packet.frequency,

      location: packet.location,
      packet: null,
      totalPackets: 1,
      tags: ['new'],
    }

  delete packet.location, packet.frequency, packet.sensor

  buf.packet = packet

  return buf
}

module.exports = { rtlDevice }
