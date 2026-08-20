import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, default="user", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    waste_entries = relationship("WasteEntry", back_populates="user", cascade="all, delete-orphan")
    donations = relationship("Donation", back_populates="donor", foreign_keys="Donation.donor_id")
    claimed_donations = relationship("Donation", back_populates="collector", foreign_keys="Donation.claimed_by")
    collector_applications = relationship("CollectorApplication", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    pickup_events = relationship("PickupEvent", back_populates="actor")


class WasteEntry(Base):
    __tablename__ = "waste_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item = Column(String, nullable=False)
    category = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    wasted_on = Column(Date, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="waste_entries")


class Donation(Base):
    __tablename__ = "donations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    donor_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
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
    status = Column(String, default="open", nullable=False, index=True)
    claimed_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    scheduled_at = Column(DateTime, nullable=True)
    handover_code = Column(String, nullable=True)
    address_verified = Column(Boolean, default=True, nullable=False)
    address_verified_label = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    donor = relationship("User", back_populates="donations", foreign_keys=[donor_id])
    collector = relationship("User", back_populates="claimed_donations", foreign_keys=[claimed_by])
    pickup_events = relationship("PickupEvent", back_populates="donation", cascade="all, delete-orphan")


class CollectorApplication(Base):
    __tablename__ = "collector_applications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)
    service_area = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    status = Column(String, default="pending", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="collector_applications")


class PickupEvent(Base):
    __tablename__ = "pickup_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    donation_id = Column(String, ForeignKey("donations.id", ondelete="CASCADE"), nullable=False, index=True)
    event = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    actor_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    donation = relationship("Donation", back_populates="pickup_events")
    actor = relationship("User", back_populates="pickup_events")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")
