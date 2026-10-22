#!/bin/sh
set -e

# The application is copied here by the Dockerfile.  Use an explicit working
# directory so management commands cannot depend on the runtime's cwd.
cd /app/backend

python manage.py migrate --noinput
python manage.py ensure_admin
python manage.py site_defaults apply --if-new
python manage.py collectstatic --noinput
exec "$@"
