#!/bin/bash
# DECODEX Bolivia - Server startup daemon
cd /home/z/my-project
exec npx next start -p 3000 >> /tmp/next-server.log 2>&1
