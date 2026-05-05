#!/bin/sh
export DATABASE_URL="file:/home/z/my-project/connect/db/custom.db"
export NODE_OPTIONS="--max-old-space-size=128"
cd /home/z/my-project/connect
exec npx next start -p 3000
