"""Mock Stripe checkout module for development with simulated payment page."""

from pydantic import BaseModel
from typing import Optional, Dict, Any
import time


class CheckoutSessionRequest(BaseModel):
    """Request model for creating checkout session."""
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: Dict[str, Any] = {}
    base_url: str = ""  # Base URL for simulated payment page


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


# Global session storage (shared across instances)
_sessions_storage: Dict[str, Dict[str, Any]] = {}


class StripeCheckout:
    """Mock Stripe checkout implementation with simulated payment page."""
    
    def __init__(self, api_key: str, webhook_url: str):
        """Initialize Stripe checkout with API key and webhook URL."""
        self.api_key = api_key
        self.webhook_url = webhook_url
    
    @property
    def sessions(self) -> Dict[str, Dict[str, Any]]:
        """Access global sessions storage."""
        return _sessions_storage
    
    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        """Create a checkout session with a simulated payment page URL."""
        # Generate unique session ID
        session_id = f"cs_sim_{int(time.time() * 1000)}_{id(request)}"
        
        # Store session data globally including base_url for the payment page
        _sessions_storage[session_id] = {
            "status": "open",
            "payment_status": "unpaid",
            "amount_total": request.amount,
            "currency": request.currency,
            "metadata": request.metadata,
            "success_url": request.success_url,
            "cancel_url": request.cancel_url,
            "base_url": request.base_url  # Store base_url for use in payment page
        }
        
        # Return URL pointing to simulated payment page endpoint
        # The base_url should be provided by the server
        simulated_url = f"{request.base_url}api/payment/simulate/{session_id}"
        
        return CheckoutSessionResponse(
            session_id=session_id,
            url=simulated_url,
            status="open"
        )
    
    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        """Get checkout session status."""
        session = _sessions_storage.get(session_id, {})
        return CheckoutStatusResponse(
            status=session.get("status", "open"),
            payment_status=session.get("payment_status", "unpaid"),
            amount_total=session.get("amount_total", 0),
            currency=session.get("currency", "usd"),
            session_id=session_id,
            metadata=session.get("metadata", {})
        )
    
    async def mark_session_paid(self, session_id: str) -> bool:
        """Mark a session as paid (called when user completes simulated payment)."""
        if session_id in _sessions_storage:
            _sessions_storage[session_id]["status"] = "complete"
            _sessions_storage[session_id]["payment_status"] = "paid"
            return True
        return False
    
    async def mark_session_cancelled(self, session_id: str) -> bool:
        """Mark a session as cancelled."""
        if session_id in _sessions_storage:
            _sessions_storage[session_id]["status"] = "cancelled"
            _sessions_storage[session_id]["payment_status"] = "cancelled"
            return True
        return False
    
    async def handle_webhook(self, body: bytes, signature: str) -> CheckoutStatusResponse:
        """Handle Stripe webhook."""
        # Mock webhook handling
        return CheckoutStatusResponse(
            status="completed",
            payment_status="paid",
            amount_total=0,
            currency="usd",
            session_id="mock_session",
            metadata={}
        )
