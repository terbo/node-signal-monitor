#!/usr/bin/python

# just generate some random probes

from faker import Factory
import time
from datetime import timedelta
import random


faker = Factory.create()
defaultssids = '/data/sigmon/etc/default-ssids.txt'
random.seed(time.time())

def _minutes(m):
  return timedelta(seconds=60 * int(m))
  
class Probe():
  def __init__(self):
    self.duration = 5
    self.session_limit = 20
    self.data = {
      'time': time.time(),
      'rssi': False,
      'seq': False,
      'mac': False,
      'sensor': False,
      'ssid': False,
    }
    
    self.sensornames = ['drone','sensor','wrt','pc','linux','desktop','box']
    #self.ssids = ['linksys','default','Internet','Free WiFi','ATT','dlink','TimeWarner','Mobi']
    
    ssidfile = open(defaultssids)
    self.ssids = [] 
    
    for line in ssidfile:
        line = line[:-1]
        if line.startswith('#') or len(line) == 0:
            next
        self.ssids.append(line)

  def mac(self):
    if self.ended():
      self.data['mac'] = faker.mac_address()
    return self.data['mac']
  def sensor(self):
    random.seed(time.time())
    #if self.ended() or not self.data['sensor']:
    name = random.choice(self.sensornames)
    self.data['sensor'] = '%s%s' % (name, random.choice([random.choice(['-','.','_']),
                        random.randint(0,25),
                      chr(random.randint(48,57)),
                      chr(random.randint(65,90)),
                      chr(random.randint(97,122))]))
    return self.data['sensor']
  def ssid(self):
    random.seed(time.time())
    #if self.ended() or not self.data['ssid']:
    self.data['ssid'] = random.choice(self.ssids)
    return self.data['ssid']
  def time(self):
    random.seed(time.time())
    if self.ended():
      self.data['time'] = time.time()
    else:
      self.data['time'] += timedelta(seconds=random.randint(0,60)).total_seconds() + \
                           timedelta(microseconds=random.randint(10000,600000)).total_seconds()
    return self.data['time']
  def ended(self):
    return self.data['time'] < time.time() + _minutes(self.session_limit).total_seconds()
  def rssi(self):
    random.seed(time.time())
    if self.ended() or not self.data['rssi']:
      self.data['rssi'] = random.randint(35,80) - 100
    else:
      if random.randint(0,1) > .700:
        self.data['rssi'] += random.randint(0,3)
      else:
        self.data['rssi'] -= random.randint(0,3)
    return self.data['rssi']
  def seq(self):
    random.seed(time.time())
    if self.ended() or not self.data['seq']:
      self.data['seq'] = random.randint(0,4095)
    else:
      self.data['seq'] += random.randint(1,4)
    return self.data['seq']
  def next(self):
    random.seed(time.time())
    if self.ended():
      self.duration = random.randint(1,20)
    self.data['mac'] = self.mac()
    self.data['time'] = self.time()
    self.data['seq'] = self.seq()
    self.data['sensor'] = self.sensor()
    self.data['rssi'] = self.rssi()
    self.data['ssid'] = self.ssid()
    return self.json()
  def json(self):
     return {key:self.data[key] for key in self.data.keys() }
