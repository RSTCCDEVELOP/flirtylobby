# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Timing-Allow-Origin on the API: without it a browser cannot see how big the answers of the API are, and the page weight would be measured too low."""


class TimingAllowMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        resp = self.get_response(request)
        if request.path.startswith(("/api/", "/media/")) and "Timing-Allow-Origin" not in resp:
            resp["Timing-Allow-Origin"] = "*"
        return resp
