"""
Authentication middleware for Supabase JWT verification.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
from pydantic import BaseModel

from .config import settings


# Supabase JWK public key for ES256 verification
SUPABASE_JWK = {
    "x": "LNDJ9LLq36Ylf6MD8Gkp9Q4fVvd1nffRXVqtzA9vqug",
    "y": "MAfC416KdYe2igkObyK6fGb7KrvKAlUP9ItR_lm-xNg",
    "alg": "ES256",
    "crv": "P-256",
    "ext": True,
    "kid": "e676781b-6292-4d60-bf1a-ac4d818a3699",
    "kty": "EC",
    "key_ops": ["verify"]
}


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
        # Use Supabase JWK public key for ES256 verification
        payload = jwt.decode(
            token,
            SUPABASE_JWK,
            algorithms=["ES256"],
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
