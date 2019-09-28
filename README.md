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

# usage

Incomplete code, beware.

configure:
```text
copy etc/config.js.dist to config.js and edit
install node-red flow and dependent modules
edit the configuration in the 'default configuration' node
```

server:
```text
  pm2 install bin/wss.js
  pm2 start bin/wss.js
```

sensor:
```text
  configure gpsd, pointing it toward the BlueNMEA or Share GPS mobile apps, for instance.
  configure wireless interface, setting it to monitor mode
  run bin/sensor.js
```

after the flow is deployed, the map will be available at your node-red URL with the endpoint /map.


# node red map

![wifi map](doc/sigmonmap-flow.png)

Currently this flow is primarily for mapping devices while traveling.
Node-red is configured to save context data to disk, but right now nothing else is saved.

The flow requires the node red [worldmap](https://www.npmjs.com/package/node-red-contrib-web-worldmap)
and [configuration](https://www.npmjs.com/package/node-red-contrib-config) nodes.

TODO:
- [ ] Learn to code
- [x] Convert node-red code to new format and publish flow
- [x] Clarify package requirements, still testing
- [x] Fix 'empty' SSIDs
- [ ] Enable listening on multiple interfaces
- [ ] File logging
- [ ] Simple console UI
- [ ] Easier way to launch/maintain daemons (pm2?)
- [ ] Figure out node-pcap build issues
- [ ] Add NeDB as buffer to MongoDB

This is a continuation of the fascination begun with [sigmon](http://github.com/terbo/sigmon).
