# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Text messages that are not verification codes (notifications, reminders). They only go out when the SMS link (Spryng) is set to "Voor verificatiecodes én berichten"
(API keys -> the link -> Gebruik). Codes go through apps.security.twofa.send_sms (purpose 'verification')."""


class MessageNotAllowed(Exception):
    pass


def messages_allowed():
    from apps.security import twofa

    return twofa.sms_usage()["messages"]


def send_message(phone, text):
    """Send a text message that is no verification code. Raises MessageNotAllowed when the link is for verification only (or there is none), or twofa.DeliveryError."""
    from apps.security import twofa

    if not messages_allowed():
        raise MessageNotAllowed("De SMS-koppeling mag alleen voor verificatiecodes gebruikt worden.")
    twofa.send_sms(phone, text, purpose="message")
