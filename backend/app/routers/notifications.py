from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Notification, User
from ..security import current_user

router = APIRouter(tags=["notifications"])


def _out(n: Notification) -> dict:
    return {"id": n.id, "channel": n.channel, "body": n.body, "read": n.read, "created_at": n.created_at.isoformat(),
            "simulated": n.channel != "in_app"}


@router.get("/notifications", summary="My inbox (in-app is real; SMS / WhatsApp / email rows are clearly marked simulated)")
def inbox(unread_only: bool = False, limit: int = Query(50, le=200), user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Notification).filter_by(user_id=user.id)
    if unread_only:
        q = q.filter_by(read=False)
    rows = q.order_by(Notification.created_at.desc()).limit(limit).all()
    unread = db.query(Notification).filter_by(user_id=user.id, read=False, channel="in_app").count()
    return {"unread": unread, "items": [_out(n) for n in rows]}


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Notification not found")
    n.read = True
    db.commit()
    return _out(n)


@router.post("/notifications/read-all")
def mark_all_read(user: User = Depends(current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter_by(user_id=user.id, read=False).update({"read": True})
    db.commit()
    return {"marked": n}
