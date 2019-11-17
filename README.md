# node signal monitor v 0.0.19a

Simple inspection of WiFi networks & devices


Web Socket Server: smwss
WiFi Sensor Client: smwifi


```text                             
                                smrtl.js
wifi sta -> probe  \    wifi      v
     wifi data      >  smwifi.js  -
wifi ap -> beacon  /    pcap      |
                                smwss
                                  |
                     ?MongoDB? -- | -- NeDB
node-red leaflet map           -- |
                                  |-- smcli.js
```

Incomplete code, beware.

Further information: [wiki](https://github.com/terbo/node-signal-monitor/wiki/Overview)

Install/Setup: [Setup](https://github.com/terbo/node-signal-monitor/wiki/Setup)

Development: [Changes](https://github.com/terbo/node-signal-monitor/wiki/Development#Changes)
