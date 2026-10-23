#!/bin/sh
# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

set -e

# The application is copied here by the Dockerfile.  Use an explicit working
# directory so management commands cannot depend on the runtime's cwd.
cd /app/backend

python manage.py migrate --noinput
python manage.py ensure_admin
python manage.py site_defaults apply --if-new
python manage.py collectstatic --noinput
exec "$@"
