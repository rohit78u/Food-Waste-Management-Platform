from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import CollectorApplicationCreate, CollectorApplicationOut

router = APIRouter()


@router.get("/me")
def get_me():
    return {"message": "Auth placeholder"}


@router.post("/collector-applications", response_model=CollectorApplicationOut)
def create_collector_application(payload: CollectorApplicationCreate, db: Session = Depends(get_db)):
    from app.models import CollectorApplication

    app = CollectorApplication(
        user_id="demo-user",
        organization=payload.organization,
        contact_phone=payload.contact_phone,
        service_area=payload.service_area,
        note=payload.note,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app
