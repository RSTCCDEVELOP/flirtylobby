# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
