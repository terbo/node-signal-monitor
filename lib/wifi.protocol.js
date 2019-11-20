'use strict';

//references:
//en.wikipedia.org/wiki/IEEE_802.11
//niviuk.free.fr/wifi_band.php
//mrncciew.com/2014/10/08/802-11-mgmt-beacon-frame/
//www.rhyshaden.com/wifi_frm.htm

require('console-stamp')(console, { pattern: 'HH:MM:ss' })

// wifi protocol information
// a list of the 2.4Ghz and 5Ghz wireless channels and related frequency/ranges
// frame types and their names

// SOON

// rate decoding info
// encryption info
// cypher info

// exports:
// getChannel(2412) => 1
// getFrequency(14) => 2484
// getFrequency(9,'ac') => 5045
// frameType(0,4) => 'Management/Probe'

const frequencies = {
  'g': {
      '2412': '1',
      '2417': '2',
      '2422': '3',
      '2427': '4',
      '2432': '5',
      '2437': '6',
      '2442': '7',
      '2447': '8',
      '2452': '9',
      '2457': '10',
      '2462': '11',
      '2467': '12',
      '2472': '13',
      '2484': '14',
    },

  'ac': {
      '5035': '7',
      '5040': '8',
      '5045': '9',
      '5055': '11',
      '5060': '12',
      '5080': '16',
      '5160': '32',
      '5170': '34',
      '5180': '36',
      '5190': '38',
      '5200': '40',
      '5210': '42',
      '5220': '44',
      '5230': '46',
      '5240': '48',
      '5250': '50',
      '5260': '52',
      '5270': '54',
      '5280': '56',
      '5290': '58',
      '5300': '60',
      '5310': '62',
      '5320': '64',
      '5340': '68',
      '5480': '96',
      '5500': '100',
      '5510': '102',
      '5520': '104',
      '5530': '106',
      '5540': '108',
      '5550': '110',
      '5560': '112',
      '5570': '114',
      '5580': '116',
      '5590': '118',
      '5600': '120',
      '5610': '122',
      '5620': '124',
      '5630': '126',
      '5640': '128',
      '5660': '132',
      '5670': '134',
      '5680': '136',
      '5690': '138',
      '5700': '140',
      '5710': '142',
      '5720': '144',
      '5745': '149',
      '5755': '151',
      '5765': '153',
      '5775': '155',
      '5785': '157',
      '5795': '159',
      '5805': '161',
      '5825': '165',
      '5845': '169',
      '5865': '173',
      '4915': '183',
      '4920': '184',
      '4925': '185',
      '4935': '187',
      '4940': '188',
      '4945': '189',
      '4960': '192',
      '4980': '196'
    }
},

  bands = Object.keys(frequencies),

  frames =
    {
    type: {
      0: 'Mgmt Frame',
      1: 'Ctrl Frame',
      2: 'Data Frame'
    },

    subtype: {
      0: 'AssocReq',
      1: 'AssocResp',
      2: 'ReassocReq',
      3: 'ReassocResp',
      4: 'ProbeReq',
      5: 'ProbeResp',
      8: 'Beacon',
      9: 'ATIM',
      10: 'Disassoc',
      11: 'Auth',
      12: 'Deauth',
      13: 'ActionFrame',
      24: 'BlockACKReq',
      25: 'BlockACK',
      26: 'PwrSavePoll',
      27: 'ReqtoSend',
      28: 'CleartoSend',
      29: 'ACK',
      30: 'CFPEnd',
      31: 'CFPEndACK',
      33: 'Data+CFACK',
      34: 'Data+CFPoll',
      35: 'Data+CFACK+CFPoll',
      36: 'NullData',
      40: 'QoSData',
      41: 'QoSData+CFACK',
      42: 'QoSData+CFPoll',
      43: 'QoSData+CFACK+CF Poll',
      44: 'NullQoSData',
      46: 'NullQoSData+CFPoll',
      47: 'NullQoSData+CFACK+CFPol' }
                        }

function getChannel(freq) {
  var result = false
  freq = parseInt(freq)

  if(frequencies.g.hasOwnProperty(freq))
    return parseInt(frequencies.g[freq])
  if(frequencies.ac.hasOwnProperty(freq))
    return parseInt(frequencies.ac[freq])

  return false
}

function getFrequency(chan, band=false) {
  var result = false
  chan = parseInt(chan)

  if((!band) || band == 'g')
    Object.keys(frequencies.g).forEach(freq => {
    if(frequencies.g[freq] == chan)
        result = parseInt(freq)
    })

  if(((!band) && !(result)) || band == 'ac')
    Object.keys(frequencies.ac).forEach(freq => {
      if(frequencies.ac[freq] == chan)
        result = parseInt(freq)
    })

  return result
}

function frameType(t=null, s=null) {
  var result = ''

  if(t !== null && frames.type.hasOwnProperty(t))
    result = parseInt(frames.type[t])

  if(s !== null && frames.subtype.hasOwnProperty(s))
    result += '/' + parseInt(frames.subtype[s])

  return result
}

module.exports = { bands, frames, frequencies, getChannel, getFrequency, frameType }
