from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import WasteEntry
from app.schemas import WasteEntryCreate, WasteEntryOut

router = APIRouter()


@router.get("", response_model=List[WasteEntryOut])
def list_waste_entries(db: Session = Depends(get_db)):
    return db.query(WasteEntry).filter(WasteEntry.user_id == "demo-user").order_by(WasteEntry.created_at.desc()).all()


@router.post("", response_model=WasteEntryOut)
def create_waste_entry(payload: WasteEntryCreate, db: Session = Depends(get_db)):
    entry = WasteEntry(user_id="demo-user", **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_waste_entry(entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(WasteEntry).filter(WasteEntry.id == entry_id, WasteEntry.user_id == "demo-user").first()
    if not entry:
        return {"deleted": False}
    db.delete(entry)
    db.commit()
    return {"deleted": True}
