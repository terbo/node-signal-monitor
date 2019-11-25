// TODO: Remove sync callback and properly count changed documents
'use strict';

require('console-stamp')(console, { pattern: 'HH:MM:ss' })

var path = require('path'),
    cfg  = require('../etc/config')

module.paths.unshift(path.join(cfg.baseDir, 'lib'))

var db = null,
    Datastore = require('nedb'),
    utils = require('sigmon.utils'),
    getDuration = utils.getDuration,
    checkDevice = utils.checkDevice,
    indexOptions = { fieldName: 'mac', unique: true }

function DB() {
  return db
}

function read(cb) {
  db.find({}, cb)
}

function count(cb) {
  db.count({}, cb)
}

function sync(docs, cb) {
  try {
  Object.keys(docs).forEach((mac) => {
    if(cfg.device.prune) {
      if(cfg.device.prune_unfamiliar) {
        console.log(`Pruning device: ${mac} ?`)
        checkDevice('owned', mac, docs[mac].ssid)
          return
        //  what? if an owned device is one of the clients/ssids?
        //  if(!cfg.devices.owned.map((dev) => { if(docs[mac].hosts.includes(dev)) return true }).includes(mac))
        //    return
      }
      if(cfg.device.prune_aps && docs[mac].type == 'ap')
        return
      else if(cfg.device.prune_clients && docs[mac].type == 'sta')
        return
      // else if first seen is several hours, no session, unknown mac / no ssid == boot
    }

    db.find({ mac }, (err, res) => {
      if(((!res) || (!res.length))) {
        if(docs[mac].source == 'wifi')
        db.insert({
          mac: mac,
          source: 'wifi',
          type: docs[mac].type,
          pktype: docs[mac].pktype,
          macSm: docs[mac].macSm,
          vendor: docs[mac].vendor,
          vendorSm: docs[mac].vendorSm,
          firstseen: docs[mac].firstseen,
          lastseen: docs[mac].lastseen,
          dbm: docs[mac].dbm,
          seq: docs[mac].seq,
          rssi: docs[mac].rssi,
          rssis: docs[mac].rssis,
          avgrssi: docs[mac].avgrssi,
          minrssi: docs[mac].minrssi,
          maxrssi: docs[mac].maxrssi,
          ssid: docs[mac].ssid,
          firstlocation: docs[mac].firstlocation,
          lastlocation: docs[mac].lastlocation,
          location: docs[mac].location,
          sensors: docs[mac].sensors,
          sessions: docs[mac].sessions,
          channel: docs[mac].channel,
          freq: docs[mac].freq,
          hosts: docs[mac].hosts,
          tags: docs[mac].tags,
          totalPackets: docs[mac].totalPackets,
          totalBytes: docs[mac].totalBytes,
          uptime: docs[mac].uptime,
          lastprobe: docs[mac].lastprobe
        }, cb)
        else if(docs[mac].source == 'sdr')
          console.log('Gotcha!')
      }
      else {
        if(docs[mac].source == 'wifi')
        db.update({ mac },
          { $set: { 
            lastseen: docs[mac].lastseen,
            seq: docs[mac].seq,
            lastseq: docs[mac].seq,
            seq: docs[mac].seq,
            lastrssi: docs[mac].lastrssi,
            rssi: docs[mac].rssi,
            rssis: docs[mac].rssis,
            avgrssi: docs[mac].avgrssi,
            minrssi: docs[mac].minrssi,
            maxrssi: docs[mac].maxrssi,
            dbm: docs[mac].dbm,
            firstlocation: docs[mac].firstlocation,
            lastlocation: docs[mac].lastlocation,
            location: docs[mac].location,
            sensors: docs[mac].sensors,
            sessions: docs[mac].sessions,
            channel: docs[mac].channel,
            freq: docs[mac].freq,
            hosts: docs[mac].hosts,
            tags: docs[mac].tags,
            totalLost: docs[mac].totalLost,
            totalPackets: docs[mac].totalPackets,
            totalBytes: docs[mac].totalBytes,
            uptime: docs[mac].uptime,
            lastprobe: docs[mac].lastprobe
          }
        }, {}, cb)
        else if(docs[mac].source == 'sdr')
          console.log('Gotcha!')
      }
    }) 
  })} catch (e) { console.error(`docs: ${e}`) }
}

function find(type, query, cb) {
  if(typeof cb != 'function')
    return console.error('last argument must be callback')

  if(cfg.server.verbose)
    console.info(`search: ${type} "${query}"`)

  const query_re = new RegExp(query,'gi')
  try {
  if(type == 'mac')
    db.find({ mac: query_re }, cb)
  else if(type == 'tag')
    db.find({ tags: query_re }, cb)
  else if(type == 'vendor')
    db.find({ vendor: query_re }, cb)
  else if(type == 'ssid')
    db.find({ ssid: query_re }, cb)
  else if(type == 'type')
    db.find({ type: query_re }, cb)
  else if(type == 'model')
    db.find({ model: query_re }, cb)
  else if(type == 'tags')
    db.find({ tags: query_re }, cb)
  else return console.error(`invalid find query: ${type}`)
  } catch (e) { console.error(`find: ${e}`) }
}

function load(dbFile) {
  if(dbFile === null)
    dbFile = path.join(cfg.baseDir, 'data', cfg.db.file)

  console.info(`Using ${dbFile} for JSON database`)
  db = new Datastore({ filename: dbFile, autoload: false})

  db.loadDatabase()

  // nedb appends new records to the db file, then periodically replaces
  // older entries with the new data. this can result in the size of the
  // db file increasing quite a bit, default compacts 10 seconds before syncing.

  db.persistence.setAutocompactionInterval(cfg.db.compact_interval)

  if(cfg.device.prune && cfg.device.expire_after)
    if((parseInt(cfg.device.expire_after) > 0)) {
      console.info(`Devices expire after ${getDuration(cfg.device.expire_after * 1000)}`)
      indexOptions.expireAfterSeconds = parseInt(cfg.device.expire_after)
    }  
  db.ensureIndex(indexOptions, (error) => {
    if(error)
      console.error(`NeDB indexOptions: ${error.error} (${indexOptions} `)
  })
}

module.exports = { DB, read, sync, find, load, count, indexOptions }
