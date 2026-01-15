"""
Configuration settings for the backend API.
"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
    
    # File Upload
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: List[str] = [".xlsx", ".xls", ".csv", ".tsv"]
    
    # Processing
    MIN_WORD_LENGTH: int = 2
    DEFAULT_MIN_FREQUENCY: int = 1
    DEFAULT_MIN_SCORE_THRESHOLD: float = 2.0
    
    # Temp files
    TEMP_DIR: str = "/tmp/semantic-network"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()

# Ensure temp directory exists
os.makedirs(settings.TEMP_DIR, exist_ok=True)
