from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Donation
from app.schemas import DonationCreate, DonationOut

router = APIRouter()


@router.get("", response_model=List[DonationOut])
def list_donations(db: Session = Depends(get_db)):
    return db.query(Donation).filter(Donation.status == "open").order_by(Donation.created_at.desc()).all()


@router.post("", response_model=DonationOut)
def create_donation(payload: DonationCreate, db: Session = Depends(get_db)):
    donation = Donation(donor_id="demo-user", **payload.model_dump())
    donation.approx_lat = round(payload.lat, 2)
    donation.approx_lng = round(payload.lng, 2)
    db.add(donation)
    db.commit()
    db.refresh(donation)
    return donation


@router.delete("/{donation_id}")
def delete_donation(donation_id: str, db: Session = Depends(get_db)):
    donation = db.query(Donation).filter(Donation.id == donation_id, Donation.donor_id == "demo-user").first()
    if not donation:
        return {"deleted": False}
    db.delete(donation)
    db.commit()
    return {"deleted": True}


@router.get("/{donation_id}/handover")
def get_handover_code(donation_id: str, db: Session = Depends(get_db)):
    donation = db.query(Donation).filter(Donation.id == donation_id, Donation.donor_id == "demo-user").first()
    if not donation:
        return {"ok": False, "handover_code": None}
    code = donation.handover_code or "123456"
    return {"ok": True, "handover_code": code}
