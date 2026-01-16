"""
Semantic Network Analyzer - Backend API
FastAPI application for processing text data and building semantic networks.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import tempfile
import os

from api.routes import router as api_router
from core.config import settings
from core import preload_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: preload embedding model
    print("Preloading embedding model...")
    preload_model()
    print("Model preloaded successfully")
    yield
    # Shutdown: cleanup if needed
    print("Shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Semantic Network Analyzer API",
    description="API for analyzing and comparing semantic networks from text data",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "status": "ok",
        "message": "Semantic Network Analyzer API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        timeout_keep_alive=settings.REQUEST_TIMEOUT
    )
