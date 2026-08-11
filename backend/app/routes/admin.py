from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CollectorApplication, Donation, Notification, PickupEvent, WasteEntry
from app.schemas import CollectorApplicationOut, DonationOut, PickupEventOut
from app.security import require_admin

router = APIRouter()


@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    """Get overall platform statistics for admin dashboard."""
    total_waste = db.query(func.sum(WasteEntry.quantity)).scalar() or 0.0
    total_donations = db.query(func.count(Donation.id)).scalar() or 0
    total_pickups = db.query(func.count(PickupEvent.id)).scalar() or 0
    approved_collectors = db.query(func.count(CollectorApplication.id)).filter(
        CollectorApplication.status == "approved"
    ).scalar() or 0
    pending_collectors = db.query(func.count(CollectorApplication.id)).filter(
        CollectorApplication.status == "pending"
    ).scalar() or 0
    
    # Donations by status
    open_donations = db.query(func.count(Donation.id)).filter(Donation.status == "open").scalar() or 0
    claimed_donations = db.query(func.count(Donation.id)).filter(Donation.status == "claimed").scalar() or 0
    collected_donations = db.query(func.count(Donation.id)).filter(Donation.status == "collected").scalar() or 0
    
    return {
        "total_waste_kg": round(total_waste, 2),
        "total_donations": total_donations,
        "total_pickups": total_pickups,
        "approved_collectors": approved_collectors,
        "pending_collectors": pending_collectors,
        "donations_by_status": {
            "open": open_donations,
            "claimed": claimed_donations,
            "collected": collected_donations,
        },
    }


@router.get("/collectors", response_model=List[CollectorApplicationOut])
def get_all_collectors(status: str = None, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    """Get all collector applications, optionally filtered by status."""
    query = db.query(CollectorApplication)
    if status:
        query = query.filter(CollectorApplication.status == status)
    return query.all()


@router.get("/donations", response_model=List[DonationOut])
def get_all_donations(status: str = None, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    """Get all donations, optionally filtered by status."""
    query = db.query(Donation)
    if status:
        query = query.filter(Donation.status == status)
    return query.order_by(Donation.created_at.desc()).all()


@router.get("/waste")
def get_all_waste(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    """Get all waste entries logged by users."""
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
def verify_collector(collector_id: str, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    """Approve a collector application."""
    collector = db.query(CollectorApplication).filter(CollectorApplication.id == collector_id).first()
    if not collector:
        raise HTTPException(status_code=404, detail="Collector not found")
    
    collector.status = "approved"
    db.commit()
    
    # Create notification for the collector
    db.add(
        Notification(
            user_id=collector.user_id,
            title="Application Approved",
            body=f"Congratulations! Your application to {collector.organization} has been approved. You can now claim pickups.",
        )
    )
    db.commit()
    
    return {"status": "success", "collector_id": collector_id, "new_status": "approved"}


@router.post("/reject-collector/{collector_id}")
def reject_collector(collector_id: str, reason: str = "", db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    """Reject a collector application."""
    collector = db.query(CollectorApplication).filter(CollectorApplication.id == collector_id).first()
    if not collector:
        raise HTTPException(status_code=404, detail="Collector not found")
    
    collector.status = "rejected"
    db.commit()
    
    # Create notification for the collector
    msg = f"Your application was not approved at this time."
    if reason:
        msg += f" Reason: {reason}"
    db.add(Notification(user_id=collector.user_id, title="Application Status", body=msg))
    db.commit()
    
    return {"status": "success", "collector_id": collector_id, "new_status": "rejected"}


@router.get("/pickup-events", response_model=List[PickupEventOut])
def get_pickup_events(donation_id: str = None, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    """Get all pickup events, optionally filtered by donation."""
    query = db.query(PickupEvent)
    if donation_id:
        query = query.filter(PickupEvent.donation_id == donation_id)
    return query.order_by(PickupEvent.created_at.desc()).all()
