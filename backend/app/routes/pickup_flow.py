import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Donation, Notification, PickupEvent, User
from app.schemas import ClaimDonationInput, DonationOut, NotificationOut, PickupEventOut, SchedulePickupInput, VerifyCodeInput
from app.security import get_current_user, require_collector

router = APIRouter()


def _emit_event(db: Session, donation_id: str, event: str, note: str | None = None, actor_id: str | None = None):
    db.add(PickupEvent(donation_id=donation_id, event=event, note=note, actor_id=actor_id))


def _emit_notification(db: Session, user_id: str, title: str, body: str):
    db.add(Notification(user_id=user_id, title=title, body=body))


def _new_handover_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


@router.get("/open", response_model=list[DonationOut])
def list_open_donations(_: User = Depends(require_collector), db: Session = Depends(get_db)):
    return db.query(Donation).filter(Donation.status == "open").order_by(Donation.created_at.desc()).all()


@router.get("/claims", response_model=list[DonationOut])
def list_my_claims(user: User = Depends(require_collector), db: Session = Depends(get_db)):
    return db.query(Donation).filter(Donation.claimed_by == user.id).order_by(Donation.pickup_until.asc()).all()


@router.post("/claim")
def claim_donation(
    payload: ClaimDonationInput,
    user: User = Depends(require_collector),
    db: Session = Depends(get_db),
):
    donation = db.query(Donation).filter(Donation.id == payload.id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.donor_id == user.id:
        raise HTTPException(status_code=400, detail="Donors cannot claim their own donation")

    handover_code = _new_handover_code()
    result = db.execute(
        update(Donation)
        .where(Donation.id == payload.id, Donation.status == "open", Donation.claimed_by.is_(None))
        .values(status="claimed", claimed_by=user.id, handover_code=handover_code)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Donation is no longer available")

    db.refresh(donation)
    _emit_event(db, donation.id, "claimed", "Collector claimed the donation", actor_id=user.id)
    _emit_notification(db, donation.donor_id, "Pickup claimed", f"A collector claimed {donation.title}")
    db.commit()
    return {"ok": True, "status": donation.status}


@router.post("/schedule")
def schedule_pickup(
    payload: SchedulePickupInput,
    user: User = Depends(require_collector),
    db: Session = Depends(get_db),
):
    donation = db.query(Donation).filter(Donation.id == payload.id, Donation.claimed_by == user.id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Claimed donation not found")
    if donation.status != "claimed":
        raise HTTPException(status_code=409, detail="Only claimed donations can be scheduled")
    if payload.scheduled_at < donation.pickup_from or payload.scheduled_at > donation.pickup_until:
        raise HTTPException(status_code=422, detail="Scheduled pickup must be within the donor's availability window")

    donation.scheduled_at = payload.scheduled_at
    donation.status = "scheduled"
    _emit_event(db, donation.id, "pickup scheduled", payload.scheduled_at.isoformat(), actor_id=user.id)
    _emit_notification(db, donation.donor_id, "Pickup scheduled", "The pickup time has been confirmed")
    db.commit()
    return {"ok": True, "status": donation.status}


@router.post("/verify")
def verify_pickup_code(
    payload: VerifyCodeInput,
    user: User = Depends(require_collector),
    db: Session = Depends(get_db),
):
    donation = db.query(Donation).filter(Donation.id == payload.id, Donation.claimed_by == user.id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Claimed donation not found")
    if donation.status != "scheduled":
        raise HTTPException(status_code=409, detail="Pickup must be scheduled before verification")
    if not donation.handover_code or not secrets.compare_digest(payload.code, donation.handover_code):
        raise HTTPException(status_code=400, detail="Incorrect handover code")

    donation.status = "collected"
    _emit_event(db, donation.id, "collected", "Pickup completed", actor_id=user.id)
    _emit_notification(db, donation.donor_id, "Pickup completed", "The donation was collected successfully")
    db.commit()
    return {"ok": True, "status": donation.status}


@router.get("/events/{donation_id}", response_model=list[PickupEventOut])
def list_events(
    donation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    donation = db.query(Donation).filter(Donation.id == donation_id).first()
    if not donation or (donation.donor_id != user.id and donation.claimed_by != user.id and user.role != "admin"):
        raise HTTPException(status_code=403, detail="You cannot view this pickup history")
    return db.query(PickupEvent).filter(PickupEvent.donation_id == donation_id).order_by(PickupEvent.created_at.desc()).all()


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).all()


@router.post("/notifications/read")
def mark_notifications_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.read_at.is_(None)).update({"read_at": datetime.utcnow()})
    db.commit()
    return {"ok": True}
