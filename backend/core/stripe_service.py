"""
Stripe service for subscription management.
"""

from typing import Optional, Dict, Any
import stripe

from .config import settings


def init_stripe():
    """Initialize Stripe with API key."""
    if settings.STRIPE_SECRET_KEY:
        stripe.api_key = settings.STRIPE_SECRET_KEY


def create_checkout_session(
    user_id: str,
    user_email: str,
    tier: str,
    success_url: str,
    cancel_url: str
) -> Optional[Dict[str, Any]]:
    """
    Create a Stripe Checkout session for subscription.

    Args:
        user_id: Supabase user ID
        user_email: User's email
        tier: Target tier ('pro' or 'enterprise')
        success_url: URL to redirect after successful payment
        cancel_url: URL to redirect if payment cancelled

    Returns:
        Dict with session_id and checkout_url, or None if error
    """
    init_stripe()

    # Get price ID based on tier
    if tier == 'pro':
        price_id = settings.STRIPE_PRO_PRICE_ID
    elif tier == 'enterprise':
        price_id = settings.STRIPE_ENTERPRISE_PRICE_ID
    else:
        return None

    if not price_id:
        print(f"[STRIPE] No price ID configured for tier: {tier}")
        return None

    try:
        session = stripe.checkout.Session.create(
            mode='subscription',
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user_email,
            metadata={
                'user_id': user_id,
                'tier': tier,
            },
            subscription_data={
                'metadata': {
                    'user_id': user_id,
                    'tier': tier,
                }
            }
        )

        return {
            'session_id': session.id,
            'checkout_url': session.url,
        }

    except stripe.error.StripeError as e:
        print(f"[STRIPE] Error creating checkout session: {e}")
        return None


def create_customer_portal_session(
    customer_id: str,
    return_url: str
) -> Optional[str]:
    """
    Create a Stripe Customer Portal session for managing subscription.

    Args:
        customer_id: Stripe customer ID
        return_url: URL to redirect after portal session

    Returns:
        Portal URL or None if error
    """
    init_stripe()

    if not customer_id:
        return None

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session.url

    except stripe.error.StripeError as e:
        print(f"[STRIPE] Error creating portal session: {e}")
        return None


def construct_webhook_event(
    payload: bytes,
    sig_header: str
) -> Optional[stripe.Event]:
    """
    Construct and verify a Stripe webhook event.

    Args:
        payload: Raw request body
        sig_header: Stripe-Signature header value

    Returns:
        Verified Stripe Event or None if verification fails
    """
    init_stripe()

    webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    if not webhook_secret:
        print("[STRIPE] No webhook secret configured")
        return None

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        return event

    except stripe.error.SignatureVerificationError as e:
        print(f"[STRIPE] Webhook signature verification failed: {e}")
        return None
    except ValueError as e:
        print(f"[STRIPE] Invalid webhook payload: {e}")
        return None


def get_subscription_tier(subscription: stripe.Subscription) -> str:
    """
    Determine tier from a Stripe subscription object.

    Args:
        subscription: Stripe Subscription object

    Returns:
        Tier string ('pro', 'enterprise', or 'free')
    """
    # Check metadata first
    tier = subscription.metadata.get('tier')
    if tier in ('pro', 'enterprise'):
        return tier

    # Fall back to checking price ID
    if subscription.items and subscription.items.data:
        price_id = subscription.items.data[0].price.id

        if price_id == settings.STRIPE_PRO_PRICE_ID:
            return 'pro'
        elif price_id == settings.STRIPE_ENTERPRISE_PRICE_ID:
            return 'enterprise'

    return 'free'


def get_customer_id_from_session(session: stripe.checkout.Session) -> Optional[str]:
    """Extract customer ID from checkout session."""
    return session.customer if isinstance(session.customer, str) else session.customer.id


def get_subscription_from_session(session: stripe.checkout.Session) -> Optional[str]:
    """Extract subscription ID from checkout session."""
    return session.subscription if isinstance(session.subscription, str) else session.subscription.id
