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


@router.delete("/notifications/{notification_id}", summary="Delete an unwanted notification")
def delete_notification(notification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Notification not found")
    db.delete(n)
    db.commit()
    return {"deleted": True, "id": notification_id}


@router.post("/notifications/{notification_id}/delete", summary="Delete an unwanted notification (POST alias)")
def delete_notification_post(notification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return delete_notification(notification_id, user, db)


@router.delete("/notifications", summary="Clear all notifications for current user")
def clear_notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    deleted = db.query(Notification).filter_by(user_id=user.id).delete()
    db.commit()
    return {"deleted": deleted}


@router.post("/notifications/clear", summary="Clear all notifications for current user (POST alias)")
def clear_notifications_post(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return clear_notifications(user, db)

