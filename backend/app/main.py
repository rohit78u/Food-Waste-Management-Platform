from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routes import admin, auth, donations, pickup_flow, reports, waste

init_db()

app = FastAPI(title="FoodSave API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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
