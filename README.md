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

configure: `npm install`

see below notes on installing node pcap.

copy etc/config.js.dist to config.js and edit  
install node-red flow and dependent modules  
edit the configuration in the 'default configuration' node  

pm2 is recommended as a daemon supervisor.  

server:

```text
npm install -g pm2
pm2 start bin/wss.js
```

sensor:  
configure gpsd, pointing it toward the BlueNMEA  
or Share GPS mobile apps, for instance.  

configure wireless interface, setting it to monitor mode  


install pcap:  
node_pcap requires the LTS version of nodejs - 10.16.3.  
Using `n` is recommended to manage multiple installed  
versions of npm.  

```text
npm install -g n
n lts
```

then, use the git versions of node_pcap and socketwatcher.  
after npm finishes, cd to the build directoy of each  
package and issue a `make` command.  

for more info check out the [pcap issues](https://github.com/node-pcap/node_pcap/issues) page.

`pm2 start bin/sensor.js`

after the flow is deployed, the map will be available at your node-red URL with the endpoint */map*.  


# node red map

![wifi map](doc/sigmonmap-flow.png)

The flow requires the node red [worldmap](https://www.npmjs.com/package/node-red-contrib-web-worldmap)
and [configuration](https://www.npmjs.com/package/node-red-contrib-config) nodes.  

Currently this flow is primarily for mapping devices while traveling.  
Node-red is configured to save context data to disk, but right now nothing else is saved.  
_its just a phase._


TODO:
- [ ] Learn to code
- [x] Convert node-red code to new format and publish flow
- [x] Clarify package requirements, still testing
- [x] Fix 'empty' SSIDs
- [x] Easier way to launch/maintain daemons (pm2?)
- [x] Figure out node-pcap build issues
- [x] Handle disconnections/crashes/poor connections - bad GPS packets still crash though.
- [ ] Enable listening on multiple interfaces
- [ ] File logging - pm2 keeps logs, but need to finish custom logger.js
- [ ] Simple console UI - trying blessed contrib - lacks in interactivity but might work
- [ ] Add NeDB as buffer to MongoDB

This is a continuation of the fascination begun with [sigmon](http://github.com/terbo/sigmon).
