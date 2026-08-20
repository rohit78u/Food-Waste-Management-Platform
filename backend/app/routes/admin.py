from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CollectorApplication, Donation, Notification, PickupEvent, User, WasteEntry
from app.schemas import CollectorApplicationOut, DonationOut, PickupEventOut
from app.security import require_admin

router = APIRouter()


@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    total_waste = db.query(func.sum(WasteEntry.quantity)).scalar() or 0.0
    total_donations = db.query(func.count(Donation.id)).scalar() or 0
    total_pickups = db.query(func.count(PickupEvent.id)).scalar() or 0
    approved_collectors = db.query(func.count(CollectorApplication.id)).filter(CollectorApplication.status == "approved").scalar() or 0
    pending_collectors = db.query(func.count(CollectorApplication.id)).filter(CollectorApplication.status == "pending").scalar() or 0

    return {
        "total_waste_kg": round(total_waste, 2),
        "total_donations": total_donations,
        "total_pickups": total_pickups,
        "approved_collectors": approved_collectors,
        "pending_collectors": pending_collectors,
        "donations_by_status": {
            "open": db.query(func.count(Donation.id)).filter(Donation.status == "open").scalar() or 0,
            "claimed": db.query(func.count(Donation.id)).filter(Donation.status == "claimed").scalar() or 0,
            "scheduled": db.query(func.count(Donation.id)).filter(Donation.status == "scheduled").scalar() or 0,
            "collected": db.query(func.count(Donation.id)).filter(Donation.status == "collected").scalar() or 0,
        },
    }


@router.get("/collectors", response_model=list[CollectorApplicationOut])
def get_all_collectors(status: str | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    query = db.query(CollectorApplication)
    if status:
        query = query.filter(CollectorApplication.status == status)
    return query.order_by(CollectorApplication.created_at.desc()).all()


@router.get("/donations", response_model=list[DonationOut])
def get_all_donations(status: str | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    query = db.query(Donation)
    if status:
        query = query.filter(Donation.status == status)
    return query.order_by(Donation.created_at.desc()).all()


@router.get("/waste")
def get_all_waste(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    entries = db.query(WasteEntry).order_by(WasteEntry.created_at.desc()).all()
    return [
        {
            "id": e.id,
            "user_id": e.user_id,
            "item": e.item,
            "category": e.category,
            "quantity": e.quantity,
            "unit": e.unit,
            "reason": e.reason,
            "wasted_on": e.wasted_on.isoformat(),
            "created_at": e.created_at.isoformat(),
        }
        for e in entries
    ]


@router.post("/verify-collector/{collector_id}")
def verify_collector(collector_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    collector = db.query(CollectorApplication).filter(CollectorApplication.id == collector_id).first()
    if not collector:
        raise HTTPException(status_code=404, detail="Collector not found")

    collector.status = "approved"
    collector.user.role = "collector"
    db.add(Notification(
        user_id=collector.user_id,
        title="Application Approved",
        body=f"Your application to {collector.organization} has been approved. You can now claim pickups.",
    ))
    db.commit()
    return {"status": "success", "collector_id": collector_id, "new_status": "approved", "role": "collector"}


@router.post("/reject-collector/{collector_id}")
def reject_collector(collector_id: str, reason: str = "", db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    collector = db.query(CollectorApplication).filter(CollectorApplication.id == collector_id).first()
    if not collector:
        raise HTTPException(status_code=404, detail="Collector not found")

    collector.status = "rejected"
    msg = "Your collector application was not approved at this time."
    if reason:
        msg += f" Reason: {reason}"
    db.add(Notification(user_id=collector.user_id, title="Application Status", body=msg))
    db.commit()
    return {"status": "success", "collector_id": collector_id, "new_status": "rejected"}


@router.get("/pickup-events", response_model=list[PickupEventOut])
def get_pickup_events(donation_id: str | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    query = db.query(PickupEvent)
    if donation_id:
        query = query.filter(PickupEvent.donation_id == donation_id)
    return query.order_by(PickupEvent.created_at.desc()).all()
