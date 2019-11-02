# node signal monitor v 0.0.18

Simple inspection of WiFi networks.

Web Socket Server: smwss
WiFi Sensor Client: smwifi


```text
wifi sta -> probe  \    wifi
     wifi data      >  smwifi.js  -
wifi ap -> beacon  /    pcap      |
                                smwss
                                  |
                     ?MongoDB? -- | -- NeDB
node-red leaflet map           -- |
```

![wifi map](doc/wifimap.png)

# usage

Incomplete code, beware. *Note*: Web UI currently broken.

Documentation will soon be moved to the [wiki](wiki/)

__While the web socket server only needs write access for the database,  
the sensor program either requires root access or some sort of suid-ness.__


configure: `npm install`

see below notes on installing node pcap.

copy etc/config.js.dist to config.js and edit  
install node-red flow and dependent modules  
edit the configuration in the 'default configuration' node  

pm2 is recommended as a daemon supervisor.  

server:

```text
npm install -g pm2
pm2 start bin/smwss
```

sensor:  
configure gpsd, pointing it toward the BlueNMEA or Share GPS mobile apps, for instance.  

configure wireless interface, setting it to [monitor mode](https://wiki.wireshark.org/CaptureSetup/WLAN#Turning_on_monitor_mode)


install pcap:  
node_pcap requires libpcap-dev for pcap.h, and the last LTS version of nodejs - 10.16.3.  
There is experimental support for using pcap on the current LTS of 12.0.0 coming soon.  
Using `n` is recommended to manage multiple installed versions of npm.  

```text
npm install -g n
n lts
```

included in package.json are the git versions of [node_pcap](https://github.com/node-pcap/node_pcap) and [socketwatcher](https://github.com/bytzdev/node-socketwatcher).  
after npm finishes, you may need to cd to each build directoy located in `<this package>/node_modules/<package>/build>`  
and issue `make`.  

for more info check out the [node_pcap issues](https://github.com/node-pcap/node_pcap/issues) page.  

start the sensor:

```text
pm2 start bin/smwifi
```

after the flow is deployed, the map will be available at your node-red URL with the endpoint */worldmap*.  


to save the daemons to be restarted when the machine boots, issue ```pm2 save```

# node red map

![wifi map](doc/sigmonmap-flow.png)

The flow requires the node red [worldmap](https://www.npmjs.com/package/node-red-contrib-web-worldmap)
and [configuration](https://www.npmjs.com/package/node-red-contrib-config) nodes.  

Currently this flow primarily functions well when mapping devices noticed while traveling.  
Node-red is configured to save context data to disk, but right now nothing else is saved.  
_its just a phase._   



TODO:
- [ ] Learn to code
- [ ] Fix CLI crashing due to some display issue
- [ ] Revamp Web UI and add datatable
- [ ] Standalone web server for data display ..
- [ ] Move all/most wifi/websocket related functions to lib/

This is a continuation of the fascination begun with [sigmon](https://github.com/terbo/sigmon).


# node modules
[node-red](https://github.com/node-red/node-red): a programming tool for wiring together hardware devices, APIs and online services in new and interesting ways. 

[node-gpsd](https://github.com/eelcocramer/node-gpsd): Node.js gpsd client for GPS tracking device.  
[node_pcap](https://github.com/node-pcap/node_pcap): libpcap bindings for node  
[oui](https://github.com/silverwind/oui): Look up MAC addresses for their vendor in the IEEE OUI database  
[reconnecting-websocket](https://github.com/pladaria/reconnecting-websocket): Reconnecting WebSocket. For Web, React Native, cli (Node.js)  
[ws](https://github.com/websockets/ws): Simple to use, blazing fast and thoroughly tested WebSocket client and server for Node.js  
[blessed-contrib](https://github.com/yaronn/blessed-contrib/): Build terminal dashboards using ascii/ansi art and javascript  
[commander](https://github.com/tj/commander.js/): node.js command-line interfaces made easy  



