"""E-mail delivery through the active integration (Postmark or SMTP) using the addresses of the communication page."""
import json
import logging
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage

from django.conf import settings as dj_settings

from apps.core import modules
from apps.integrations.models import Integration

logger = logging.getLogger(__name__)


class DeliveryError(Exception):
    pass


def post_json(url, headers, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Accept": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=10):
            return
    except urllib.error.HTTPError as e:
        raise DeliveryError(f"Verzenden mislukt (HTTP {e.code}).")
    except Exception as e:
        raise DeliveryError(f"Verzenden mislukt: {e}")


def email_integration():
    if not modules.enabled("integrations"):
        return None
    for p in ("postmark", "smtp"):
        obj = Integration.objects.filter(enabled=True, provider=p).first()
        if obj:
            return obj
    return None


def send_email(to, subject, body, purpose=None, from_addr=None, base_url=None, api_base=None, code=None):
    """Send an e-mail (plain text or HTML, see Communicatie -> E-mailopmaak). Sender and reply-to come from the communication page (fallback: the integration's own sender)."""
    from apps.sandbox import service as sandbox

    from .service import sender

    if sandbox.active("email"):  # sandbox: capture instead of sending
        sandbox.capture("email", to, subject, body, sender=from_addr or sender("email_from", purpose) or "")
        return "sandbox"
    obj = email_integration()
    if not obj:
        if dj_settings.DEBUG:
            logger.warning("E-mail to %s (DEBUG, not sent): %s", to, subject)
            return "logged"
        raise DeliveryError("E-mail is niet gekoppeld.")
    from . import layout

    text, html_body, inline = layout.build_full(subject, body, base_url, api_base, code=code)
    c = obj.config
    frm = from_addr or sender("email_from", purpose) or c.get("from_email")
    if not frm:
        raise DeliveryError("Geen afzender ingesteld: voeg er een toe bij Admin → Communicatie.")
    reply = sender("email_reply", purpose)
    if obj.provider == "postmark":
        payload = {"From": frm, "To": to, "Subject": subject, "TextBody": text, "MessageStream": "outbound"}
        if html_body:
            payload["HtmlBody"] = html_body
            if inline:  # the logo travels inside the message
                import base64

                payload["Attachments"] = [{"Name": f"{cid}.{mime.split('/')[-1]}", "Content": base64.b64encode(data).decode(), "ContentType": mime, "ContentID": f"cid:{cid}"} for cid, data, mime in inline]
        if reply:
            payload["ReplyTo"] = reply
        return post_json("https://api.postmarkapp.com/email", {"X-Postmark-Server-Token": c["server_token"]}, payload)
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = frm, to, subject
    if reply:
        msg["Reply-To"] = reply
    msg.set_content(text)
    if html_body:
        msg.add_alternative(html_body, subtype="html")
        for cid, data, mime in inline:  # the logo travels inside the message
            msg.get_payload()[-1].add_related(data, *mime.split("/"), cid=f"<{cid}>")
    try:
        security = c.get("security", "starttls")
        port = int(c.get("port") or (465 if security == "ssl" else 587))
        smtp = smtplib.SMTP_SSL(c["host"], port, timeout=10) if security == "ssl" else smtplib.SMTP(c["host"], port, timeout=10)
        with smtp:
            if security == "starttls":
                smtp.starttls()
            if c.get("username"):
                smtp.login(c["username"], c.get("password", ""))
            smtp.send_message(msg)
    except Exception as e:
        raise DeliveryError(f"Verzenden mislukt: {e}")
