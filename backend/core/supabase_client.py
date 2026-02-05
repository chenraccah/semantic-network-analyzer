"""
Supabase client for user profiles and usage tracking.
"""

from typing import Optional, Dict, Any, List
from datetime import date, datetime

from supabase import create_client, Client

from .config import settings
from .tier_limits import get_tier_limits, check_limit, is_feature_enabled

# Initialize Supabase client
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """Get or create Supabase client instance."""
    global _supabase_client

    if _supabase_client is None:
        url = settings.SUPABASE_URL or ""
        # Use service role key for backend operations (can bypass RLS)
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or ""

        if url and key:
            _supabase_client = create_client(url, key)

    return _supabase_client


async def get_user_profile(user_id: str) -> Dict[str, Any]:
    """
    Get user profile with tier info and usage stats.
    Creates profile if it doesn't exist.
    """
    client = get_supabase_client()

    if not client:
        # Return default free tier if Supabase not configured
        return {
            "id": user_id,
            "tier": "free",
            "analyses_today": 0,
            "chat_messages_month": 0,
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
        }

    try:
        # Try to get existing profile
        result = client.table("user_profiles").select("*").eq("id", user_id).execute()

        if result.data and len(result.data) > 0:
            profile = result.data[0]

            # Check if we need to reset daily/monthly counters
            today = date.today()

            # Reset daily analyses count if it's a new day
            if profile.get("analyses_reset_date"):
                reset_date = datetime.fromisoformat(profile["analyses_reset_date"].replace("Z", "+00:00")).date()
                if reset_date < today:
                    client.table("user_profiles").update({
                        "analyses_today": 0,
                        "analyses_reset_date": today.isoformat()
                    }).eq("id", user_id).execute()
                    profile["analyses_today"] = 0

            # Reset monthly chat count if it's a new month
            if profile.get("chat_reset_date"):
                reset_date = datetime.fromisoformat(profile["chat_reset_date"].replace("Z", "+00:00")).date()
                if reset_date.month != today.month or reset_date.year != today.year:
                    client.table("user_profiles").update({
                        "chat_messages_month": 0,
                        "chat_reset_date": today.replace(day=1).isoformat()
                    }).eq("id", user_id).execute()
                    profile["chat_messages_month"] = 0

            return profile

        # Create new profile if doesn't exist
        new_profile = {
            "id": user_id,
            "tier": "free",
            "analyses_today": 0,
            "analyses_reset_date": date.today().isoformat(),
            "chat_messages_month": 0,
            "chat_reset_date": date.today().replace(day=1).isoformat(),
        }

        client.table("user_profiles").insert(new_profile).execute()
        return new_profile

    except Exception as e:
        print(f"Error getting user profile: {e}")
        # Return default profile on error
        return {
            "id": user_id,
            "tier": "free",
            "analyses_today": 0,
            "chat_messages_month": 0,
        }


async def increment_analysis_count(user_id: str) -> bool:
    """
    Increment the daily analysis count for a user.
    Returns True if successful.
    """
    client = get_supabase_client()

    if not client:
        return True  # Allow if Supabase not configured

    try:
        # First get current profile to ensure proper reset
        profile = await get_user_profile(user_id)

        # Increment the count
        client.table("user_profiles").update({
            "analyses_today": profile.get("analyses_today", 0) + 1
        }).eq("id", user_id).execute()

        return True
    except Exception as e:
        print(f"Error incrementing analysis count: {e}")
        return False


async def increment_chat_count(user_id: str) -> bool:
    """
    Increment the monthly chat message count for a user.
    Returns True if successful.
    """
    client = get_supabase_client()

    if not client:
        return True  # Allow if Supabase not configured

    try:
        # First get current profile to ensure proper reset
        profile = await get_user_profile(user_id)

        # Increment the count
        client.table("user_profiles").update({
            "chat_messages_month": profile.get("chat_messages_month", 0) + 1
        }).eq("id", user_id).execute()

        return True
    except Exception as e:
        print(f"Error incrementing chat count: {e}")
        return False


async def check_analysis_limit(user_id: str) -> Dict[str, Any]:
    """
    Check if user has reached their daily analysis limit.
    Returns dict with 'allowed' bool and 'message' if blocked.
    """
    profile = await get_user_profile(user_id)
    tier = profile.get("tier", "free")
    analyses_today = profile.get("analyses_today", 0)
    limits = get_tier_limits(tier)

    max_analyses = limits.get("max_analyses_per_day")

    if max_analyses is None:
        return {"allowed": True, "remaining": None, "tier": tier}

    if analyses_today >= max_analyses:
        return {
            "allowed": False,
            "remaining": 0,
            "tier": tier,
            "message": f"Daily analysis limit reached ({max_analyses} analyses). Upgrade to Pro for unlimited analyses.",
            "limit": max_analyses,
            "used": analyses_today
        }

    return {
        "allowed": True,
        "remaining": max_analyses - analyses_today,
        "tier": tier,
        "limit": max_analyses,
        "used": analyses_today
    }


async def check_chat_limit(user_id: str) -> Dict[str, Any]:
    """
    Check if user has reached their monthly chat limit.
    Returns dict with 'allowed' bool and 'message' if blocked.
    """
    profile = await get_user_profile(user_id)
    tier = profile.get("tier", "free")
    chat_messages = profile.get("chat_messages_month", 0)
    limits = get_tier_limits(tier)

    if not limits.get("chat_enabled"):
        return {
            "allowed": False,
            "remaining": 0,
            "tier": tier,
            "message": "Chat is a Pro feature. Upgrade to Pro to discuss your analysis with AI."
        }

    max_messages = limits.get("chat_messages_per_month")

    if max_messages is None:
        return {"allowed": True, "remaining": None, "tier": tier}

    if chat_messages >= max_messages:
        return {
            "allowed": False,
            "remaining": 0,
            "tier": tier,
            "message": f"Monthly chat limit reached ({max_messages} messages). Upgrade to Enterprise for unlimited chat.",
            "limit": max_messages,
            "used": chat_messages
        }

    return {
        "allowed": True,
        "remaining": max_messages - chat_messages,
        "tier": tier,
        "limit": max_messages,
        "used": chat_messages
    }


async def check_groups_limit(user_id: str, requested_groups: int) -> Dict[str, Any]:
    """
    Check if user can analyze the requested number of groups.
    """
    profile = await get_user_profile(user_id)
    tier = profile.get("tier", "free")
    limits = get_tier_limits(tier)
    max_groups = limits.get("max_groups", 1)

    if requested_groups > max_groups:
        return {
            "allowed": False,
            "tier": tier,
            "max_groups": max_groups,
            "message": f"Your plan allows up to {max_groups} group(s). Upgrade to analyze more groups."
        }

    return {"allowed": True, "tier": tier, "max_groups": max_groups}


async def check_semantic_enabled(user_id: str) -> Dict[str, Any]:
    """
    Check if user can use semantic analysis.
    """
    profile = await get_user_profile(user_id)
    tier = profile.get("tier", "free")
    enabled = is_feature_enabled(tier, "semantic_enabled")

    if not enabled:
        return {
            "allowed": False,
            "tier": tier,
            "message": "Semantic analysis is a Pro feature. Upgrade to find semantically related words."
        }

    return {"allowed": True, "tier": tier}


async def check_export_enabled(user_id: str) -> Dict[str, Any]:
    """
    Check if user can export data.
    """
    profile = await get_user_profile(user_id)
    tier = profile.get("tier", "free")
    enabled = is_feature_enabled(tier, "export_enabled")

    if not enabled:
        return {
            "allowed": False,
            "tier": tier,
            "message": "CSV export is a Pro feature. Upgrade to export your analysis data."
        }

    return {"allowed": True, "tier": tier}


async def update_user_tier(user_id: str, tier: str) -> bool:
    """
    Update user's subscription tier.
    Used by Stripe webhook to update tier after payment.
    """
    client = get_supabase_client()

    if not client:
        return False

    try:
        client.table("user_profiles").update({
            "tier": tier
        }).eq("id", user_id).execute()
        return True
    except Exception as e:
        print(f"Error updating user tier: {e}")
        return False


async def update_stripe_customer(
    user_id: str,
    customer_id: str,
    subscription_id: Optional[str] = None
) -> bool:
    """
    Update user's Stripe customer and subscription IDs.
    """
    client = get_supabase_client()

    if not client:
        return False

    try:
        update_data = {"stripe_customer_id": customer_id}
        if subscription_id:
            update_data["stripe_subscription_id"] = subscription_id

        client.table("user_profiles").update(update_data).eq("id", user_id).execute()
        return True
    except Exception as e:
        print(f"Error updating Stripe customer: {e}")
        return False


async def log_usage(user_id: str, action: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
    """
    Log a usage event for analytics.
    """
    client = get_supabase_client()

    if not client:
        return False

    try:
        client.table("usage_logs").insert({
            "user_id": user_id,
            "action": action,
            "metadata": metadata or {}
        }).execute()
        return True
    except Exception as e:
        print(f"Error logging usage: {e}")
        return False


# ============================================================
# SAVED ANALYSES
# ============================================================

async def save_analysis(
    user_id: str,
    name: str,
    config: Dict[str, Any],
    results: Dict[str, Any],
    expires_days: int
) -> Optional[str]:
    """
    Save an analysis for later retrieval.

    Args:
        user_id: User ID
        name: Name for the saved analysis
        config: Analysis configuration
        results: Analysis results
        expires_days: Number of days until expiration (0 = no expiration)

    Returns:
        ID of saved analysis, or None if failed
    """
    client = get_supabase_client()

    if not client:
        return None

    try:
        from datetime import datetime, timedelta

        expires_at = None
        if expires_days > 0:
            expires_at = (datetime.utcnow() + timedelta(days=expires_days)).isoformat()

        result = client.table("saved_analyses").insert({
            "user_id": user_id,
            "name": name,
            "config": config,
            "results": results,
            "expires_at": expires_at
        }).execute()

        if result.data and len(result.data) > 0:
            return result.data[0].get("id")
        return None

    except Exception as e:
        print(f"Error saving analysis: {e}")
        return None


async def get_saved_analyses(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all saved analyses for a user.
    Excludes expired analyses.
    """
    client = get_supabase_client()

    if not client:
        return []

    try:
        from datetime import datetime

        result = client.table("saved_analyses").select(
            "id, name, created_at, expires_at"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()

        # Filter out expired analyses
        now = datetime.utcnow()
        analyses = []
        for item in result.data:
            expires_at = item.get("expires_at")
            if expires_at:
                exp_date = datetime.fromisoformat(expires_at.replace("Z", "+00:00")).replace(tzinfo=None)
                if exp_date < now:
                    continue
            analyses.append(item)

        return analyses

    except Exception as e:
        print(f"Error getting saved analyses: {e}")
        return []


async def get_saved_analysis(user_id: str, analysis_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific saved analysis by ID.
    """
    client = get_supabase_client()

    if not client:
        return None

    try:
        result = client.table("saved_analyses").select("*").eq(
            "id", analysis_id
        ).eq("user_id", user_id).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]
        return None

    except Exception as e:
        print(f"Error getting saved analysis: {e}")
        return None


async def delete_saved_analysis(user_id: str, analysis_id: str) -> bool:
    """
    Delete a saved analysis.
    """
    client = get_supabase_client()

    if not client:
        return False

    try:
        client.table("saved_analyses").delete().eq(
            "id", analysis_id
        ).eq("user_id", user_id).execute()
        return True

    except Exception as e:
        print(f"Error deleting saved analysis: {e}")
        return False


async def check_save_enabled(user_id: str) -> Dict[str, Any]:
    """
    Check if user can save analyses and get their save limit.
    """
    profile = await get_user_profile(user_id)
    tier = profile.get("tier", "free")
    limits = get_tier_limits(tier)
    save_days = limits.get("save_analyses_days", 0)

    # None means saved forever (enterprise), positive int means N days (pro), 0 means disabled (free)
    if save_days is not None and save_days == 0:
        return {
            "allowed": False,
            "tier": tier,
            "message": "Saving analyses is a Pro feature. Upgrade to save your work."
        }

    return {
        "allowed": True,
        "tier": tier,
        "expires_days": save_days if save_days is not None else 0
    }
