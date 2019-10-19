"use strict"

const frequencyMap = { // 'US':
  '2412':'1', '2417':'2',
  '2422':'3', '2427':'4',
  '2432':'5', '2437':'6',
  '2442':'7', '2447':'8',
  '2452':'9', '2457':'10',
  '2462':'11', '2467':'12',
  '2472':'13', '2484': '13'}

const frameTypes =
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
      40:  'QoSData',
      41:  'QoSData+CFACK',
      42:  'QoSData+CFPoll',
      43:  'QoSData+CFACK+CF Poll   ',
      44:  'NullQoSData',
      46:  'NullQoSData+CFPoll',
      47:  'NullQoSData+CFACK+CFPol' }
                        }

function getChannel(freq) {
  return frequencyMap[freq] || null
}

module.exports = { frameTypes: frameTypes,
                   frequencyMap: frequencyMap,
                   get: getChannel
                 }
