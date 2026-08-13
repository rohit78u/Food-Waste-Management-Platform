from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, WasteEntry
from app.schemas import WasteEntryCreate, WasteEntryOut
from app.security import get_current_user

router = APIRouter()


@router.get("", response_model=list[WasteEntryOut])
def list_waste_entries(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(WasteEntry).filter(WasteEntry.user_id == user.id).order_by(WasteEntry.created_at.desc()).all()


@router.post("", response_model=WasteEntryOut)
def create_waste_entry(
    payload: WasteEntryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = WasteEntry(user_id=user.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_waste_entry(
    entry_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(WasteEntry).filter(WasteEntry.id == entry_id, WasteEntry.user_id == user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Waste entry not found")
    db.delete(entry)
    db.commit()
    return {"deleted": True}
