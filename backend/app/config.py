import os
from pydantic import BaseModel

class Settings(BaseModel):
    app_name: str = "Trading Bot FastAPI Backend"
    environment: str = os.getenv("NODE_ENV", "development")
    
    # Gemini / Google AI Studio
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # IG Markets API Credentials
    ig_api_key: str = os.getenv("IG_API_KEY", "")
    ig_username: str = os.getenv("IG_USERNAME", "")
    ig_password: str = os.getenv("IG_PASSWORD", "")
    ig_acc_number: str = os.getenv("IG_ACC_NUMBER", "")
    ig_is_demo: bool = os.getenv("IG_IS_DEMO", "true").lower() == "true"

settings = Settings()
