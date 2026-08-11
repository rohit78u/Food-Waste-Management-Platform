import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, String, Text
from sqlalchemy.exc import SQLAlchemyError

from app.database import Base


class WasteEntry(Base):
    __tablename__ = "waste_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    item = Column(String, nullable=False)
    category = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    wasted_on = Column(Date, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Donation(Base):
    __tablename__ = "donations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    donor_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    food_type = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    pickup_from = Column(DateTime, nullable=False)
    pickup_until = Column(DateTime, nullable=False)
    address_line = Column(String, nullable=False)
    city = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    approx_lat = Column(Float, nullable=True)
    approx_lng = Column(Float, nullable=True)
    status = Column(String, default="open")
    claimed_by = Column(String, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    handover_code = Column(String, nullable=True)
    address_verified = Column(Boolean, default=True)
    address_verified_label = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CollectorApplication(Base):
    __tablename__ = "collector_applications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    organization = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)
    service_area = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    # Applications must be reviewed by an administrator before a collector can
    # claim donations.
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)


class PickupEvent(Base):
    __tablename__ = "pickup_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    donation_id = Column(String, nullable=False, index=True)
    event = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    actor_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
