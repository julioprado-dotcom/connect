#!/bin/bash
# Start Connect server as a detached daemon
# This prevents the process from being killed when the parent shell exits

cd /home/z/my-project/connect
pkill -9 -f "next start" 2>/dev/null
pkill -9 -f "server-wrapper" 2>/dev/null
sleep 1

# Use setsid to create new session (detached from parent)
setsid node /tmp/server-wrapper.mjs </dev/null >/tmp/connect-server.log 2>&1 &

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -s -m 2 -o /dev/null -w "%{http_code}" http://localhost:3000/api/stats 2>/dev/null | grep -q "200"; then
    echo "READY after ${i}s"
    exit 0
  fi
  sleep 1
done
echo "TIMEOUT waiting for server"
exit 1
