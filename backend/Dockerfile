# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app/backend

# The build context is the project folder (not backend/): the library of plugins, themes and languages (resource/) is part of the image,
# so a server does not depend on a folder that is mounted next to it (Coolify mounts an empty folder there).
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY backend/ .
COPY resource /app/resource
ENV RESOURCE_DIR=/app/resource
COPY manuals /app/manuals

RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Default development command (ASGI: the WebSocket for notifications needs it); production Compose can override CMD
CMD ["python", "-m", "uvicorn", "config.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--reload"]
