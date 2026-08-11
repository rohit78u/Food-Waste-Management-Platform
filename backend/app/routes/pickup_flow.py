from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models import Donation, Notification, PickupEvent
from app.schemas import ClaimDonationInput, DonationOut, NotificationOut, PickupEventOut, SchedulePickupInput, VerifyCodeInput

router = APIRouter()


def _emit_event(db: Session, donation_id: str, event: str, note: str | None = None, actor_id: str | None = None):
    db.add(PickupEvent(donation_id=donation_id, event=event, note=note, actor_id=actor_id))


def _emit_notification(db: Session, user_id: str, title: str, body: str):
    db.add(Notification(user_id=user_id, title=title, body=body))


@router.get("/open", response_model=List[DonationOut])
def list_open_donations(db: Session = Depends(get_db)):
    try:
        return db.query(Donation).filter(Donation.status == "open").order_by(Donation.created_at.desc()).all()
    except SQLAlchemyError:
        return []


@router.get("/claims", response_model=List[DonationOut])
def list_my_claims(db: Session = Depends(get_db)):
    try:
        return db.query(Donation).filter(Donation.claimed_by == "demo-user").order_by(Donation.pickup_until.asc()).all()
    except SQLAlchemyError:
        return []


@router.post("/claim")
def claim_donation(payload: ClaimDonationInput, db: Session = Depends(get_db)):
    donation = db.query(Donation).filter(Donation.id == payload.id).first()
    if not donation:
        return {"ok": False, "message": "Donation not found"}
    donation.status = "claimed"
    donation.claimed_by = "demo-user"
    donation.handover_code = "123456"
    _emit_event(db, donation.id, "claimed", "Collector claimed the donation", actor_id="demo-user")
    _emit_notification(db, donation.donor_id, "Pickup claimed", f"A collector claimed {donation.title}")
    db.commit()
    return {"ok": True}


@router.post("/schedule")
def schedule_pickup(payload: SchedulePickupInput, db: Session = Depends(get_db)):
    donation = db.query(Donation).filter(Donation.id == payload.id).first()
    if not donation:
        return {"ok": False, "message": "Donation not found"}
    donation.scheduled_at = payload.scheduled_at
    _emit_event(db, donation.id, "pickup scheduled", payload.scheduled_at.isoformat(), actor_id="demo-user")
    _emit_notification(db, donation.donor_id, "Pickup time set", "The pickup time has been updated")
    db.commit()
    return {"ok": True}


@router.post("/verify")
def verify_pickup_code(payload: VerifyCodeInput, db: Session = Depends(get_db)):
    donation = db.query(Donation).filter(Donation.id == payload.id).first()
    if not donation:
        return {"ok": False, "message": "Donation not found"}
    if payload.code != donation.handover_code:
        return {"ok": False, "message": "Incorrect code"}
    donation.status = "collected"
    _emit_event(db, donation.id, "collected", "Pickup completed", actor_id="demo-user")
    _emit_notification(db, donation.donor_id, "Pickup completed", "The pickup was completed successfully")
    db.commit()
    return {"ok": True}


@router.get("/events/{donation_id}", response_model=List[PickupEventOut])
def list_events(donation_id: str, db: Session = Depends(get_db)):
    return db.query(PickupEvent).filter(PickupEvent.donation_id == donation_id).order_by(PickupEvent.created_at.desc()).all()


@router.get("/notifications", response_model=List[NotificationOut])
def list_notifications(db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == "demo-user").order_by(Notification.created_at.desc()).all()


@router.post("/notifications/read")
def mark_notifications_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == "demo-user", Notification.read_at.is_(None)).update({"read_at": __import__("datetime").datetime.utcnow()})
    db.commit()
    return {"ok": True}
