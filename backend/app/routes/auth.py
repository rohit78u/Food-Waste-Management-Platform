from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CollectorApplication, User
from app.schemas import CollectorApplicationCreate, CollectorApplicationOut, CollectorStatusOut, UserOut
from app.security import get_current_user, require_collector

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.get("/collector-status", response_model=CollectorStatusOut)
def get_collector_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    application = (
        db.query(CollectorApplication)
        .filter(CollectorApplication.user_id == user.id)
        .order_by(CollectorApplication.created_at.desc())
        .first()
    )
    return {"isCollector": user.role in {"collector", "admin"}, "application": application}


@router.post("/collector-applications", response_model=CollectorApplicationOut)
def create_collector_application(
    payload: CollectorApplicationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role in {"collector", "admin"}:
        raise HTTPException(status_code=409, detail="User already has collector access")

    existing = (
        db.query(CollectorApplication)
        .filter(
            CollectorApplication.user_id == user.id,
            CollectorApplication.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A collector application is already pending")

    application = CollectorApplication(user_id=user.id, **payload.model_dump())
    db.add(application)
    db.commit()
    db.refresh(application)
    return application
