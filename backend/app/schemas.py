from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class WasteEntryCreate(BaseModel):
    item: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=40)
    quantity: float = Field(gt=0, le=10000)
    unit: str = Field(min_length=1, max_length=10)
    reason: str = Field(min_length=1, max_length=40)
    wasted_on: date
    note: Optional[str] = None


class WasteEntryOut(WasteEntryCreate):
    id: str
    user_id: str
    created_at: datetime


class DonationCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: Optional[str] = None
    food_type: str = Field(min_length=1, max_length=60)
    quantity: float = Field(gt=0, le=10000)
    unit: str = Field(min_length=1, max_length=10)
    pickup_from: datetime
    pickup_until: datetime
    address_line: str = Field(min_length=5, max_length=300)
    city: Optional[str] = None
    contact_phone: Optional[str] = None
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class DonationOut(DonationCreate):
    id: str
    donor_id: str
    approx_lat: Optional[float] = None
    approx_lng: Optional[float] = None
    status: str
    claimed_by: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    handover_code: Optional[str] = None
    address_verified: bool
    address_verified_label: Optional[str] = None
    created_at: datetime


class CollectorApplicationCreate(BaseModel):
    organization: str = Field(min_length=2, max_length=160)
    contact_phone: str = Field(min_length=3, max_length=40)
    service_area: Optional[str] = None
    note: Optional[str] = None


class CollectorApplicationOut(CollectorApplicationCreate):
    id: str
    user_id: str
    status: str
    created_at: datetime


class CollectorStatusOut(BaseModel):
    isCollector: bool
    application: Optional[CollectorApplicationOut] = None


class ClaimDonationInput(BaseModel):
    id: str


class SchedulePickupInput(BaseModel):
    id: str
    scheduled_at: datetime


class VerifyCodeInput(BaseModel):
    id: str
    code: str


class PickupEventOut(BaseModel):
    id: str
    donation_id: str
    event: str
    note: Optional[str] = None
    actor_id: Optional[str] = None
    created_at: datetime


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    read_at: Optional[datetime] = None
    created_at: datetime
