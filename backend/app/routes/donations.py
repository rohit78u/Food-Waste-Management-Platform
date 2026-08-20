import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Donation, User
from app.schemas import DonationCreate, DonationOut, HandoverCodeOut, NearbyDonationOut
from app.security import get_current_user, require_collector

router = APIRouter()


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    return earth_radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("", response_model=list[DonationOut])
def list_donations(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Donation).filter(Donation.status == "open").order_by(Donation.created_at.desc()).all()


@router.get("/nearby", response_model=list[NearbyDonationOut])
def list_nearby_donations(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10, gt=0, le=100),
    _: User = Depends(require_collector),
    db: Session = Depends(get_db),
):
    donations = db.query(Donation).filter(Donation.status == "open").all()
    nearby = []
    for donation in donations:
        distance = _distance_km(lat, lng, donation.lat, donation.lng)
        if distance <= radius_km:
            item = NearbyDonationOut.model_validate(donation)
            item.distance_km = round(distance, 2)
            nearby.append(item)
    return sorted(nearby, key=lambda item: item.distance_km)


@router.post("", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
def create_donation(
    payload: DonationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.pickup_until <= payload.pickup_from:
        raise HTTPException(status_code=422, detail="pickup_until must be later than pickup_from")

    donation = Donation(
        donor_id=user.id,
        **payload.model_dump(),
        approx_lat=round(payload.lat, 2),
        approx_lng=round(payload.lng, 2),
    )
    db.add(donation)
    db.commit()
    db.refresh(donation)
    return donation


@router.delete("/{donation_id}")
def delete_donation(
    donation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    donation = db.query(Donation).filter(Donation.id == donation_id, Donation.donor_id == user.id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status != "open":
        raise HTTPException(status_code=409, detail="Only open donations can be deleted")
    db.delete(donation)
    db.commit()
    return {"deleted": True}


@router.get("/{donation_id}/handover", response_model=HandoverCodeOut)
def get_handover_code(
    donation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    donation = db.query(Donation).filter(Donation.id == donation_id, Donation.donor_id == user.id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status not in {"claimed", "scheduled"} or not donation.handover_code:
        raise HTTPException(status_code=409, detail="Handover code is not available yet")
    return {"ok": True, "handover_code": donation.handover_code}
