# node signal monitor v 0.0.1

Simple inspection of WiFi networks.

Web Socket Server: wss.js
WiFi Sensor Client: sensor.js


```text
wifi sta -> probe  \    wifi
     wifi data      >  sensor.js  -
wifi ap -> beacon  /    pcap      |
                                wss.js
                                  |
                       MongoDB -- | -- NeDB
node-red leaflet map           -- |
```

![wifi map](doc/wifimap.png)


TODO:
- [ ] Learn to code
- [ ] Easier way to launch/maintain daemons (pm2?)
- [ ] Figure out node-pcap build issues
- [ ] Add NeDB as buffer to MongoDB

This is a continuation of the fascination begun with [sigmon](http://github.com/terbo/sigmon).
