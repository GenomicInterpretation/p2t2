#!/usr/bin/env bash
cp -r /usr/src/cache/node_modules/. /usr/src/p2t2/node_modules/
cp /usr/src/cache/package.json .
cp /usr/src/cache/package-lock.json .

exec node server.js