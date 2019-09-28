# websocket commands

Until I have time to investigate a module that does this..

The web socket server and client are designed to send JSON
messages back and forth in this format:

either msg.type or msg.cmd are required.

message = {
  type: client: [ data | log | status | time ]
  type: server: [ dump | latest | status | location | time ]
  
  cmd: dump | latest | status | stream | subscribe | unsubscribe
  args: [command arguments]
  data: [payload]
}

# current data format

This will replaced by NeDB soon, which will
follow a schema similar to what sigmon uses.


data = {
	type: null, // ap, sta
	mac: str,
	macSm: str, // abbreviated mac
	seen: { first: date, last: date },
	vendor: str,
	vendorSm: str, // abbreviated vendor
	ssid: pkt.ssid,
	rssi: { last: int, max: int, min: int, avg: int},
	location: { lon: long, lat: long },
	hosts: {}, // clients / ssids
	packets: [], // beacons / probes
	totalPackets: int,
	totalBytes: int,
}
