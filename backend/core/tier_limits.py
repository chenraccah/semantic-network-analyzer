"""
Tier limits configuration for subscription plans.
"""

from typing import Optional, Dict, Any

TIER_LIMITS: Dict[str, Dict[str, Any]] = {
    "free": {
        "max_groups": 1,
        "max_analyses_per_day": 3,
        "max_words": 100,
        "max_file_size_mb": 5,
        "semantic_enabled": False,
        "chat_enabled": False,
        "chat_messages_per_month": 0,
        "export_enabled": False,
        "save_analyses_days": 0,
        "api_access": False,
    },
    "pro": {
        "max_groups": 2,
        "max_analyses_per_day": None,  # Unlimited
        "max_words": 500,
        "max_file_size_mb": 25,
        "semantic_enabled": True,
        "chat_enabled": True,
        "chat_messages_per_month": 10,
        "export_enabled": True,
        "save_analyses_days": 7,
        "api_access": False,
    },
    "enterprise": {
        "max_groups": 5,
        "max_analyses_per_day": None,  # Unlimited
        "max_words": None,  # Unlimited
        "max_file_size_mb": 50,
        "semantic_enabled": True,
        "chat_enabled": True,
        "chat_messages_per_month": None,  # Unlimited
        "export_enabled": True,
        "save_analyses_days": 90,
        "api_access": True,
    }
}

# Pricing information for display
TIER_PRICING = {
    "free": {
        "name": "Free",
        "price": 0,
        "price_display": "Free",
        "description": "Get started with basic analysis"
    },
    "pro": {
        "name": "Pro",
        "price": 9,
        "price_display": "$9/month",
        "description": "For researchers and professionals"
    },
    "enterprise": {
        "name": "Enterprise",
        "price": 49,
        "price_display": "$49/month",
        "description": "For teams and organizations"
    }
}


def get_tier_limits(tier: str) -> Dict[str, Any]:
    """Get limits for a specific tier."""
    return TIER_LIMITS.get(tier, TIER_LIMITS["free"])


def get_limit(tier: str, limit_name: str) -> Any:
    """Get a specific limit for a tier."""
    limits = get_tier_limits(tier)
    return limits.get(limit_name)


def is_feature_enabled(tier: str, feature: str) -> bool:
    """Check if a feature is enabled for a tier."""
    limits = get_tier_limits(tier)
    return limits.get(feature, False)


def check_limit(tier: str, limit_name: str, current_value: int) -> bool:
    """
    Check if current value is within the tier's limit.
    Returns True if within limit, False if exceeded.
    None limit means unlimited.
    """
    limit = get_limit(tier, limit_name)
    if limit is None:
        return True
    return current_value < limit
