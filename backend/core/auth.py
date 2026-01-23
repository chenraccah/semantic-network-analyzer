"""
Authentication middleware for Supabase JWT verification.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
from pydantic import BaseModel

from .config import settings


# Security scheme for Bearer token
security = HTTPBearer(auto_error=False)


class TokenData(BaseModel):
    """Extracted token data."""
    user_id: str
    email: Optional[str] = None


def verify_jwt(token: str) -> TokenData:
    """
    Verify a Supabase JWT token and extract user data.

    Args:
        token: JWT token string

    Returns:
        TokenData with user_id and email

    Raises:
        HTTPException: If token is invalid or expired
    """
    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication not configured"
        )

    try:
        # Decode the JWT using the Supabase JWT secret
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )

        # Extract user ID from 'sub' claim
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )

        # Extract email if available
        email: Optional[str] = payload.get("email")

        return TokenData(user_id=user_id, email=email)

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}"
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> TokenData:
    """
    FastAPI dependency to get the current authenticated user.

    Usage:
        @router.get("/protected")
        async def protected_route(user: TokenData = Depends(get_current_user)):
            return {"user_id": user.user_id}

    Args:
        credentials: HTTP Bearer credentials from request header

    Returns:
        TokenData with authenticated user info

    Raises:
        HTTPException: If no credentials or invalid token
    """
    # Check if auth is configured - if not, skip authentication
    if not settings.SUPABASE_JWT_SECRET:
        # Return a dummy user for development without auth
        return TokenData(user_id="dev-user", email="dev@example.com")

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return verify_jwt(credentials.credentials)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[TokenData]:
    """
    FastAPI dependency to optionally get the current user.
    Returns None if no valid credentials provided.

    Useful for routes that work with or without authentication.
    """
    if credentials is None:
        return None

    try:
        return verify_jwt(credentials.credentials)
    except HTTPException:
        return None
