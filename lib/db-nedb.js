"use strict";

var cfg  = require('../etc/config'),
    Datastore = require('nedb'),
    
    dbFile = cfg.baseDir + cfg.db.file
    
console.debug(`Using ${dbFile} for json database`)
    var db        = new Datastore({ filename: dbFile, autoload: cfg.db.autoload})

db.loadDatabase()
db.persistence.setAutocompactionInterval(cfg.db.sync_interval + 5000)

db.ensureIndex({ fieldName: 'mac', unique: true }, function (err) { });
function read(cb) {
  db.find({}, cb)
}

function sync(docs, cb) {
  Object.keys(docs).forEach((mac) => {
    if((!docs.hasOwnProperty(mac)) || (mac.length === 0))
      return
    if(docs[mac].mac === undefined)
      return
    db.find({ mac }, (err, res) => {
      if(((!res) || (!res.length))) {
        
        if(docs[mac].mac === undefined)
          return
        
        //console.debug(`insert ${docs[mac].mac} -> ${docs[mac].lastseen} -> ${mac}`)
        db.insert({
          mac: mac,
          type: docs[mac].type,
          pktype: docs[mac].pktype,
          macSm: docs[mac].macSm,
          vendor: docs[mac].vendor,
          vendorSm: docs[mac].vendorSm,
          firstseen: docs[mac].firstseen,
          lastseen: docs[mac].lastseen,
          seq: docs[mac].seq,
          rssi: docs[mac].rssi,
          ssid: docs[mac].ssid,
          location: docs[mac].location,
          sensor: docs[mac].sensor,
          channel: docs[mac].channel,
          hosts: docs[mac].hosts,
          totalPackets: docs[mac].totalPackets,
          totalBytes: docs[mac].totalBytes,
        }, cb)
      }
      else {
        if((docs === undefined) || (docs[mac].mac === undefined))
          return
        //console.debug(`update ${docs[mac].mac} -->> ${docs[mac].lastseen} -->> ${mac}`)
        db.update({ mac },
          { $set: { 
            lastseen: docs[mac].lastseen,
            seq: docs[mac].seq,
            rssi: docs[mac].rssi,
            location: docs[mac].location,
            sensor: docs[mac].sensor,
            channel: docs[mac].channel,
            hosts: docs[mac].hosts,
            totalPackets: docs[mac].totalPackets,
            totalBytes: docs[mac].totalBytes,
          }
        }, {}, cb)
      }
    })
  })
}

function find(type, query, cb) {
  console.info(`search: ${type} "${query}"`)
  if(type == 'mac')
    db.findOne({ mac: query }, cb)
  else if(type == 'tag')
    db.findOne({ tags: query }, cb)
  else if(type == 'ssid')
    db.findOne({ ssid: query }, cb)
  else console.error('etf!')
}

module.exports = { db, read, sync, find }
