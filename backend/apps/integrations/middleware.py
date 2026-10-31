# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""One place to call Claude through the Anthropic link (Admin -> API keys): used by the donation texts and the fake-users tool."""

from . import aiusage


class AiActorMiddleware:
    """Remembers the request that is being handled, so every AI call can be counted for the user who caused it."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = aiusage.set_request(request)
        try:
            return self.get_response(request)
        finally:
            aiusage.clear_request(token)
