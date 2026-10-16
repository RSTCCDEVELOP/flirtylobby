#!/bin/sh
# Reload nginx every 6h so renewed certificates are picked up (runs in background)
( while :; do sleep 6h; nginx -s reload; done ) >/dev/null 2>&1 &
