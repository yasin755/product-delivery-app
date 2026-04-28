#!/usr/bin/env python3

import requests
import json
import sys
from urllib.parse import urlparse, parse_qs

# Configuration
BASE_URL = "https://code-preview-155.preview.emergentagent.com/api"
TEST_USER = {
    "email": "user@test.com",
    "password": "user123"
}

def test_payment_complete_endpoint():
    """Test the new payment complete endpoint to verify redirect flow works."""
    print("🧪 Testing Payment Complete Endpoint Flow")
    print("=" * 60)
    
    session = requests.Session()
    
    # Step 1: Login as user to get token
    print("1️⃣ Logging in as user...")
    login_response = session.post(f"{BASE_URL}/auth/login", json=TEST_USER)
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
        return False
    
    login_data = login_response.json()
    token = login_data.get('token')
    if not token:
        print(f"❌ No token in login response: {login_data}")
        return False
    
    print(f"✅ Login successful, token received")
    
    # Set authorization header
    session.headers.update({'Authorization': f'Bearer {token}'})
    
    # Step 2: Get available products to add to cart
    print("\n2️⃣ Getting available products...")
    products_response = session.get(f"{BASE_URL}/products")
    
    if products_response.status_code != 200:
        print(f"❌ Failed to get products: {products_response.status_code}")
        return False
    
    products_data = products_response.json()
    products = products_data.get('products', [])
    
    if not products:
        print("❌ No products available")
        return False
    
    product = products[0]  # Use first available product
    product_id = product['id']
    print(f"✅ Found product: {product['name']} (ID: {product_id})")
    
    # Step 3: Add item to cart
    print("\n3️⃣ Adding item to cart...")
    cart_data = {
        "product_id": product_id,
        "quantity": 2
    }
    
    cart_response = session.post(f"{BASE_URL}/cart/add", json=cart_data)
    
    if cart_response.status_code != 200:
        print(f"❌ Failed to add to cart: {cart_response.status_code} - {cart_response.text}")
        return False
    
    print(f"✅ Added {cart_data['quantity']} items to cart")
    
    # Step 4: Create checkout with payment_method='card'
    print("\n4️⃣ Creating checkout with card payment...")
    checkout_data = {
        "payment_method": "card",
        "origin_url": "https://code-preview-155.preview.emergentagent.com",
        "address": {
            "label": "Test Address",
            "address_line": "123 Test Street",
            "city": "Test City",
            "state": "Test State",
            "pincode": "123456",
            "phone": "9876543210"
        }
    }
    
    checkout_response = session.post(f"{BASE_URL}/orders/checkout", json=checkout_data)
    
    if checkout_response.status_code != 200:
        print(f"❌ Checkout failed: {checkout_response.status_code} - {checkout_response.text}")
        return False
    
    checkout_result = checkout_response.json()
    session_id = checkout_result.get('session_id')
    order_id = checkout_result.get('order_id')
    
    if not session_id:
        print(f"❌ No session_id in checkout response: {checkout_result}")
        return False
    
    print(f"✅ Checkout created successfully")
    print(f"   Order ID: {order_id}")
    print(f"   Session ID: {session_id}")
    print(f"   Checkout URL: {checkout_result.get('checkout_url')}")
    
    # Step 5: Call GET /api/payment/simulate/{session_id}/complete
    print(f"\n5️⃣ Calling payment complete endpoint...")
    complete_url = f"{BASE_URL}/payment/simulate/{session_id}/complete"
    
    # Use allow_redirects=False to capture the redirect response
    complete_response = session.get(complete_url, allow_redirects=False)
    
    print(f"   Complete URL: {complete_url}")
    print(f"   Response Status: {complete_response.status_code}")
    print(f"   Response Headers: {dict(complete_response.headers)}")
    
    # Step 6: Verify it returns a 302 redirect
    if complete_response.status_code != 302:
        print(f"❌ Expected 302 redirect, got {complete_response.status_code}")
        print(f"   Response body: {complete_response.text}")
        return False
    
    # Get the redirect location
    redirect_url = complete_response.headers.get('location')
    if not redirect_url:
        print("❌ No redirect location in response headers")
        return False
    
    print(f"✅ Got 302 redirect to: {redirect_url}")
    
    # Step 7: Verify redirect URL contains session_id and status=success
    parsed_url = urlparse(redirect_url)
    query_params = parse_qs(parsed_url.query)
    
    print(f"   Redirect URL components:")
    print(f"   - Base URL: {parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}")
    print(f"   - Query params: {query_params}")
    
    # Check if session_id is in the URL (either as query param or in path)
    session_in_url = (session_id in redirect_url or 
                     'session_id' in query_params or
                     session_id in parsed_url.path)
    
    status_success = ('status' in query_params and 'success' in query_params['status'])
    
    if not session_in_url:
        print(f"❌ Session ID {session_id} not found in redirect URL")
        return False
    
    if not status_success:
        print(f"❌ status=success not found in redirect URL query params")
        return False
    
    print(f"✅ Redirect URL contains session_id and status=success")
    
    # Step 8: Verify the order's payment_status is updated to 'paid'
    print(f"\n6️⃣ Verifying order payment status...")
    
    # Get order details
    orders_response = session.get(f"{BASE_URL}/orders")
    
    if orders_response.status_code != 200:
        print(f"❌ Failed to get orders: {orders_response.status_code}")
        return False
    
    orders_data = orders_response.json()
    
    # Handle both list and dict response formats
    if isinstance(orders_data, list):
        orders = orders_data
    else:
        orders = orders_data.get('orders', [])
    
    # Find our order
    target_order = None
    for order in orders:
        if order.get('id') == order_id:
            target_order = order
            break
    
    if not target_order:
        print(f"❌ Order {order_id} not found in orders list")
        return False
    
    payment_status = target_order.get('payment_status')
    order_status = target_order.get('status')
    
    print(f"   Order ID: {target_order.get('id')}")
    print(f"   Payment Status: {payment_status}")
    print(f"   Order Status: {order_status}")
    print(f"   Total: ₹{target_order.get('total', 0)}")
    
    if payment_status != 'paid':
        print(f"❌ Expected payment_status='paid', got '{payment_status}'")
        return False
    
    if order_status != 'confirmed':
        print(f"❌ Expected order status='confirmed', got '{order_status}'")
        return False
    
    print(f"✅ Order payment status correctly updated to 'paid'")
    print(f"✅ Order status correctly updated to 'confirmed'")
    
    # Additional verification: Check payment status endpoint
    print(f"\n7️⃣ Verifying payment status endpoint...")
    status_response = session.get(f"{BASE_URL}/payments/status/{session_id}")
    
    if status_response.status_code == 200:
        status_data = status_response.json()
        print(f"   Payment Status API Response: {status_data}")
        
        api_payment_status = status_data.get('payment_status')
        api_status = status_data.get('status')
        
        if api_payment_status == 'paid' and api_status in ['complete', 'completed']:
            print(f"✅ Payment status API confirms payment_status='paid' and status='{api_status}'")
        else:
            print(f"⚠️ Payment status API shows payment_status='{api_payment_status}', status='{api_status}'")
    else:
        print(f"⚠️ Payment status API returned {status_response.status_code}")
    
    print(f"\n🎉 ALL TESTS PASSED! Payment complete endpoint working correctly")
    print(f"✅ GET /api/payment/simulate/{session_id}/complete returns 302 redirect")
    print(f"✅ Redirect URL contains session_id and status=success")
    print(f"✅ Order payment_status updated to 'paid'")
    print(f"✅ Order status updated to 'confirmed'")
    
    return True

def main():
    """Run the payment complete endpoint test."""
    try:
        success = test_payment_complete_endpoint()
        if success:
            print(f"\n🎯 SUMMARY: Payment complete endpoint test PASSED")
            sys.exit(0)
        else:
            print(f"\n❌ SUMMARY: Payment complete endpoint test FAILED")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 UNEXPECTED ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()