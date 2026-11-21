"""Notifications. In-app messages are real (visible in the Inbox). SMS, WhatsApp and email are SIMULATED: each is written as a
labelled row instead of being sent, so the channel logic can be tested without any real message leaving the system."""
from sqlalchemy.orm import Session

from .models import Notification

MOCK_PREFIX = {"sms": "[MOCK SMS] ", "whatsapp": "[MOCK WHATSAPP] ", "email": "[MOCK EMAIL] "}


def notify(db: Session, user_id: str, text: str, *, short: str | None = None, channels: tuple[str, ...] = ("in_app", "sms")) -> None:
    """Queue a notification on each channel. `short` is the compact text used for SMS/WhatsApp."""
    for ch in channels:
        body = text if ch in ("in_app", "email") else (short or text)
        db.add(Notification(user_id=user_id, channel=ch, body=MOCK_PREFIX.get(ch, "") + body))
