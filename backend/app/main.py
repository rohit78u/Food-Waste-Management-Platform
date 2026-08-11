from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine, init_db
from app.models import CollectorApplication, Donation, Notification, PickupEvent, WasteEntry
from app.routes import admin, auth, donations, pickup_flow, reports, waste

init_db()


def seed_demo_data() -> None:
    db: Session = SessionLocal()
    try:
        if db.query(WasteEntry).filter(WasteEntry.user_id == "demo-user").count() == 0:
            db.add(
                WasteEntry(
                    user_id="demo-user",
                    item="Mixed vegetables",
                    category="produce",
                    quantity=3.5,
                    unit="kg",
                    reason="overstock",
                    wasted_on=datetime.utcnow().date(),
                    note="Ready for donation",
                )
            )

        if db.query(Donation).count() == 0:
            donation = Donation(
                donor_id="demo-user",
                title="Fresh vegetable boxes",
                description="Packed this morning and ready for pickup",
                food_type="vegetables",
                quantity=4,
                unit="kg",
                pickup_from=datetime.utcnow() + timedelta(hours=1),
                pickup_until=datetime.utcnow() + timedelta(hours=4),
                address_line="12 Rosewood Lane",
                city="Seattle",
                contact_phone="555-0101",
                lat=47.6062,
                lng=-122.3321,
                approx_lat=47.6062,
                approx_lng=-122.3321,
                status="open",
                address_verified=True,
                address_verified_label="Rosewood Lane",
            )
            db.add(donation)
            db.flush()
            db.add(PickupEvent(donation_id=donation.id, event="listed", note="Donation posted", actor_id="demo-user"))
            db.add(Notification(user_id="demo-user", title="New listing posted", body="Collectors can now claim your donation"))

        db.commit()
    finally:
        db.close()


seed_demo_data()

app = FastAPI(title="FoodSave API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(waste.router, prefix="/api/waste", tags=["waste"])
app.include_router(donations.router, prefix="/api/donations", tags=["donations"])
app.include_router(pickup_flow.router, prefix="/api/pickups", tags=["pickups"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
