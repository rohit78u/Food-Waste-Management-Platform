from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import WasteEntry

router = APIRouter()


@router.get("/summary")
def get_summary(days: int = 30, db: Session = Depends(get_db)):
    cutoff = datetime.utcnow().date() - timedelta(days=days)
    entries = db.query(WasteEntry).filter(WasteEntry.user_id == "demo-user", WasteEntry.wasted_on >= cutoff).all()

    total_kg = sum(entry.quantity for entry in entries)
    return {
        "days": days,
        "entries": len(entries),
        "total_kg": round(total_kg, 2),
        "by_category": {},
    }
