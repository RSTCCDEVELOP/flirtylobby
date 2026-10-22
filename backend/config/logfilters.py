import logging

# Pages ask these addresses every few seconds. A page of someone who is logged out (or of a module that is off) gets 401 / 403 each time: that is not worth a warning in the log.
POLLS = ("/api/chat/signals/", "/api/direct/rooms/", "/api/notify/")


class QuietPolls(logging.Filter):
    def filter(self, record):
        if record.name == "django.request" and getattr(record, "status_code", 0) in (401, 403):
            path = getattr(getattr(record, "request", None), "path", "") or ""
            if path in POLLS:
                return False
        return True
