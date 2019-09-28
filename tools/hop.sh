#!/bin/bash

# wifi channel hopper
# TODO: allow listening to selected channels

IFACE=$1; shift
MAXCHANNELS=$1; shift
HOPTIME=$1; shift

test -z "$IFACE" && IFACE='mon0'
test -z "$MAXCHANS" && MAXCHANS=11
test -z "$HOPTIME" && HOPTIME=.2

while true; do
  for channel in $(shuf -i1-${MAXCHANS} -n${MAXCHANS}); do
    echo iwconfig $IFACE channel $channel
    sleep $HOPTIME
  done
done
