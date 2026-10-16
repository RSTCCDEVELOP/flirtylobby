FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app/backend

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY . .

RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Default development command; production Compose can override CMD
CMD ["python", "manage.py", "runserver", "0.0.0.0:8001"]
