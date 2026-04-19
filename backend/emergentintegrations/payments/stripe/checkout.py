"""Mock Stripe checkout module for development."""

from pydantic import BaseModel
from typing import Optional, Dict, Any


class CheckoutSessionRequest(BaseModel):
    """Request model for creating checkout session."""
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: Dict[str, Any] = {}


class CheckoutSessionResponse(BaseModel):
    """Response model for checkout session."""
    session_id: str
    url: str
    status: str = "open"


class CheckoutStatusResponse(BaseModel):
    """Response model for checkout status."""
    status: str
    payment_status: str
    amount_total: float
    currency: str
    session_id: str
    metadata: Dict[str, Any] = {}


class StripeCheckout:
    """Mock Stripe checkout implementation."""
    
    def __init__(self, api_key: str, webhook_url: str):
        """Initialize Stripe checkout with API key and webhook URL."""
        self.api_key = api_key
        self.webhook_url = webhook_url
        self.sessions = {}  # In-memory storage for mock sessions
    
    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        """Create a checkout session."""
        # Mock implementation - create a fake session
        session_id = f"cs_test_{id(request)}"
        self.sessions[session_id] = {
            "status": "open",
            "payment_status": "unpaid",
            "amount_total": request.amount,
            "currency": request.currency,
            "metadata": request.metadata
        }
        return CheckoutSessionResponse(
            session_id=session_id,
            url=f"https://checkout.stripe.com/test/{session_id}",
            status="open"
        )
    
    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        """Get checkout session status."""
        session = self.sessions.get(session_id, {})
        return CheckoutStatusResponse(
            status=session.get("status", "open"),
            payment_status=session.get("payment_status", "unpaid"),
            amount_total=session.get("amount_total", 0),
            currency=session.get("currency", "usd"),
            session_id=session_id,
            metadata=session.get("metadata", {})
        )
    
    async def handle_webhook(self, body: bytes, signature: str) -> CheckoutStatusResponse:
        """Handle Stripe webhook."""
        # Mock webhook handling
        return CheckoutStatusResponse(
            status="completed",
            payment_status="unpaid",
            amount_total=0,
            currency="usd",
            session_id="mock_session",
            metadata={}
        )
