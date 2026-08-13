from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, WasteEntry
from app.security import get_current_user

router = APIRouter()


@router.get("/summary")
def get_summary(days: int = 30, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if days < 1 or days > 365:
        raise HTTPException(status_code=422, detail="days must be between 1 and 365")

    cutoff = datetime.utcnow().date() - timedelta(days=days)
    entries = db.query(WasteEntry).filter(WasteEntry.user_id == user.id, WasteEntry.wasted_on >= cutoff).all()
    total_kg = sum(entry.quantity for entry in entries)
    by_category: dict[str, float] = {}
    for entry in entries:
        by_category[entry.category] = round(by_category.get(entry.category, 0.0) + entry.quantity, 2)

    return {
        "days": days,
        "entries": len(entries),
        "total_kg": round(total_kg, 2),
        "by_category": by_category,
    }
