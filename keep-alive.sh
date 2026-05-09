#!/bin/bash
cd /home/z/my-project/connect
while true; do
  NODE_OPTIONS=--max-old-space-size=512 npx next dev -p 3000 --webpack 2>&1
  echo "$(date): Server crashed, restarting in 3s..."
  sleep 3
done
