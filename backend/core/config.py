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
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
    ]
    
    # File Upload
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: List[str] = [".xlsx", ".xls", ".csv", ".tsv"]
    
    # Processing
    MIN_WORD_LENGTH: int = 2
    DEFAULT_MIN_FREQUENCY: int = 1
    DEFAULT_MIN_SCORE_THRESHOLD: float = 2.0

    # Semantic Analysis
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"  # Fast, 80MB model
    SIMILARITY_THRESHOLD: float = 0.5
    EMBEDDING_BATCH_SIZE: int = 32

    # OpenAI Chat (cost-efficient settings)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-3.5-turbo"  # Cheapest option
    OPENAI_MAX_TOKENS: int = 500  # Limit response length
    OPENAI_TEMPERATURE: float = 0.7

    # Supabase Authentication
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Timeouts
    REQUEST_TIMEOUT: int = 300  # 5 minutes
    
    # Temp files
    TEMP_DIR: str = "/tmp/semantic-network"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()

# Ensure temp directory exists
os.makedirs(settings.TEMP_DIR, exist_ok=True)
