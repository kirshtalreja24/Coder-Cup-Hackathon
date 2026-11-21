from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .. import receipts
from ..db import get_db
from ..models import Decision, User
from ..security import client_ip, current_user, rate_limited
from .cases import _load, _owner_check

router = APIRouter(tags=["receipts"])


def _latest(db: Session, case_id: str, user: User) -> Decision:
    c = _load(db, case_id, user)
    _owner_check(db, c, user)  # only the citizen (or their unlocked, consented helper) carries the receipt
    d = db.query(Decision).filter_by(case_id=c.id).order_by(Decision.created_at.desc()).first()
    if not d:
        raise HTTPException(404, "No decision yet")
    return d


@router.get("/cases/{case_id}/receipt", summary="A signed, verifiable receipt for the latest decision (no personal data inside)")
def get_receipt(case_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = _latest(db, case_id, user)
    token = receipts.make_token(db, d)
    return {"token": token, "verify_url": f"{receipts.web_origin()}/verify?t={token}", "route": d.route, "rule_version": d.rule_version}


@router.get("/cases/{case_id}/receipt.png", summary="The receipt as a QR code image", response_class=Response)
def receipt_qr(case_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = _latest(db, case_id, user)
    url = f"{receipts.web_origin()}/verify?t={receipts.make_token(db, d)}"
    return Response(receipts.qr_png(url), media_type="image/png")


@router.get("/public/verify-receipt", summary="Verify a decision receipt. No login, no personal data.")
def verify_receipt(t: str, request: Request, db: Session = Depends(get_db)):
    if rate_limited(f"verify:{client_ip(request)}", 30, 60):
        raise HTTPException(429, "Slow down a little", headers={"Retry-After": "20"})
    return receipts.verify(db, t)
