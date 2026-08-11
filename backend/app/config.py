from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "FoodSave API"
    database_url: str = "sqlite:///./foodsave.db"
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None

    class Config:
        env_file = (Path(__file__).resolve().parents[2] / ".env", ".env")
        extra = "ignore"


settings = Settings()
