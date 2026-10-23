#!/bin/sh
# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

# Reload nginx every 6h so renewed certificates are picked up (runs in background)
( while :; do sleep 6h; nginx -s reload; done ) >/dev/null 2>&1 &
