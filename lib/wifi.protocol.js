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
      '5035': { channel: '7', min: '5030', max: '5040' },
      '5040': { channel: '8', min: '5030', max: '5050' },
      '5045': { channel: '9', min: '5040', max: '5050' },
      '5055': { channel: '11', min: '5050', max: '5060' },
      '5060': { channel: '12', min: '5050', max: '5070' },
      '5080': { channel: '16', min: '5070', max: '5090' },
      '5160': { channel: '32', min: '5150', max: '5170' },
      '5170': { channel: '34', min: '5150', max: '5190' },
      '5180': { channel: '36', min: '5170', max: '5190' },
      '5190': { channel: '38', min: '5170', max: '5210' },
      '5200': { channel: '40', min: '5190', max: '5210' },
      '5210': { channel: '42', min: '5170', max: '5250' },
      '5220': { channel: '44', min: '5210', max: '5230' },
      '5230': { channel: '46', min: '5210', max: '5250' },
      '5240': { channel: '48', min: '5230', max: '5250' },
      '5250': { channel: '50', min: '5170', max: '5330' },
      '5260': { channel: '52', min: '5250', max: '5270' },
      '5270': { channel: '54', min: '5250', max: '5290' },
      '5280': { channel: '56', min: '5270', max: '5290' },
      '5290': { channel: '58', min: '5250', max: '5330' },
      '5300': { channel: '60', min: '5290', max: '5310' },
      '5310': { channel: '62', min: '5290', max: '5330' },
      '5320': { channel: '64', min: '5310', max: '5330' },
      '5340': { channel: '68', min: '5330', max: '5350' },
      '5480': { channel: '96', min: '5470', max: '5490' },
      '5500': { channel: '100', min: '5490', max: '5510' },
      '5510': { channel: '102', min: '5490', max: '5530' },
      '5520': { channel: '104', min: '5510', max: '5530' },
      '5530': { channel: '106', min: '5490', max: '5570' },
      '5540': { channel: '108', min: '5530', max: '5550' },
      '5550': { channel: '110', min: '5530', max: '5570' },
      '5560': { channel: '112', min: '5550', max: '5570' },
      '5570': { channel: '114', min: '5490', max: '5650' },
      '5580': { channel: '116', min: '5570', max: '5590' },
      '5590': { channel: '118', min: '5570', max: '5610' },
      '5600': { channel: '120', min: '5590', max: '5610' },
      '5610': { channel: '122', min: '5570', max: '5650' },
      '5620': { channel: '124', min: '5610', max: '5630' },
      '5630': { channel: '126', min: '5610', max: '5650' },
      '5640': { channel: '128', min: '5630', max: '5650' },
      '5660': { channel: '132', min: '5650', max: '5670' },
      '5670': { channel: '134', min: '5650', max: '5690' },
      '5680': { channel: '136', min: '5670', max: '5690' },
      '5690': { channel: '138', min: '5650', max: '5730' },
      '5700': { channel: '140', min: '5690', max: '5710' },
      '5710': { channel: '142', min: '5690', max: '5730' },
      '5720': { channel: '144', min: '5710', max: '5730' },
      '5745': { channel: '149', min: '5735', max: '5755' },
      '5755': { channel: '151', min: '5735', max: '5775' },
      '5765': { channel: '153', min: '5755', max: '5775' },
      '5775': { channel: '155', min: '5735', max: '5815' },
      '5785': { channel: '157', min: '5775', max: '5795' },
      '5795': { channel: '159', min: '5775', max: '5815' },
      '5805': { channel: '161', min: '5795', max: '5815' },
      '5825': { channel: '165', min: '5815', max: '5835' },
      '5845': { channel: '169', min: '5835', max: '5855' },
      '5865': { channel: '173', min: '5855', max: '5875' },
      '4915': { channel: '183', min: '4910', max: '4920' },
      '4920': { channel: '184', min: '4910', max: '4930' },
      '4925': { channel: '185', min: '4920', max: '4930' },
      '4935': { channel: '187', min: '4930', max: '4940' },
      '4940': { channel: '188', min: '4930', max: '4950' },
      '4945': { channel: '189', min: '4940', max: '4950' },
      '4960': { channel: '192', min: '4950', max: '4970' },
      '4980': { channel: '196', min: '4970', max: '4990' },
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
  if(frequencies.g.hasOwnProperty(freq))
    return frequencies.g[freq]
  if(frequencies.ac.hasOwnProperty(freq))
    return frequencies.ac[freq]

  return false
}

function getFrequency(chan, band=false) {
  var result = false

  if((!band) || band == 'g')
    Object.keys(frequencies.g).forEach(freq => {
    if(frequencies.g[freq] == chan)
        result = freq
    })
  
  if((!result) || band == 'ac')
    Object.keys(frequencies.ac).forEach(freq => {
      if(frequencies.ac[freq].channel == chan)
        result = freq
    })

  return result
}

function frameType(t=null, s=null) {
  var result = ''
  
  if(t !== null && frames.type.hasOwnProperty(t))
    result = frames.type[t]
  
  if(s !== null && frames.subtype.hasOwnProperty(s))
    result += '/' + frames.subtype[s]

  return result
}

module.exports = { bands, frames, frequencies, getChannel, getFrequency, frameType }
