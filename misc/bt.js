#!/usr/bin/env node
"use strict"

const bluetooth = require('node-bluetooth');
require('console-stamp')(console, { pattern: 'HH:MM:ss' });
const progress = require('./progress')

// create bluetooth device instance
const device = new bluetooth.DeviceINQ();

var btdevs = {}
var nLen, oLen

function scan() {
  //progress.spinner(1)
  device
    .on('finished', console.info('Scan finished.'))
    .on('found', (address, name) => {
      if(!address in btdevs)
        btdevs[address] = {name: name, firstseen: new Date(), lastseen: new Date() }
      else
        btdevs[address].lastseen = new Date()
    
    console.log(`${address} - ${name}`);
   }).scan();
}

console.log('Bluetooth scan initiated.\n')

scan()
