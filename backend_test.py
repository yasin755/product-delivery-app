#!/usr/bin/env python3
"""
Backend Payment Flow Testing Script
Tests the payment flow endpoints for the delivery platform
"""

import requests
import json
import sys
import time
from urllib.parse import urlparse, parse_qs

# Configuration
BASE_URL = "https://code-preview-155.preview.emergentagent.com/api"
USER_EMAIL = "user@test.com"
USER_PASSWORD = "user123"
ADMIN_EMAIL = "admin@delivery.com"
ADMIN_PASSWORD = "admin123"

class PaymentFlowTester:
    def __init__(self):
        self.user_token = None
        self.admin_token = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
    def log(self, message, level="INFO"):
        print(f"[{level}] {message}")
        
    def login_user(self):
        """Login as regular user"""
        self.log("Logging in as user...")
        response = self.session.post(f"{BASE_URL}/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.user_token = data.get('token')
            self.log(f"✅ User login successful, token: {self.user_token[:20]}...")
            return True
        else:
            self.log(f"❌ User login failed: {response.status_code} - {response.text}", "ERROR")
            return False
            
    def add_item_to_cart(self):
        """Add an item to cart for testing checkout"""
        if not self.user_token:
            self.log("❌ No user token available", "ERROR")
            return False
            
        # First get available products
        response = self.session.get(f"{BASE_URL}/products")
        if response.status_code != 200:
            self.log(f"❌ Failed to get products: {response.status_code}", "ERROR")
            return False
            
        data = response.json()
        products = data.get('products', [])
        if not products:
            self.log("❌ No products available", "ERROR")
            return False
            
        # Use first available product
        product = products[0]
        product_id = product['id']
        
        self.log(f"Adding product to cart: {product['name']} (₹{product['price']})")
        
        # Add to cart
        headers = {'Authorization': f'Bearer {self.user_token}'}
        response = self.session.post(f"{BASE_URL}/cart/add", 
                                   json={"product_id": product_id, "quantity": 2},
                                   headers=headers)
        
        if response.status_code == 200:
            self.log("✅ Item added to cart successfully")
            return True
        else:
            self.log(f"❌ Failed to add item to cart: {response.status_code} - {response.text}", "ERROR")
            return False
            
    def test_cod_checkout(self):
        """Test COD (Cash on Delivery) checkout flow"""
        self.log("\n=== Testing COD Checkout Flow ===")
        
        if not self.user_token:
            self.log("❌ No user token available", "ERROR")
            return False
            
        # Add item to cart first
        if not self.add_item_to_cart():
            return False
            
        # Create COD checkout
        headers = {'Authorization': f'Bearer {self.user_token}'}
        checkout_data = {
            "payment_method": "cod",
            "address": {
                "label": "Home",
                "address_line": "123 Test Street",
                "city": "Mumbai",
                "state": "Maharashtra", 
                "pincode": "400001",
                "phone": "9876543210"
            },
            "origin_url": "https://code-preview-155.preview.emergentagent.com"
        }
        
        response = self.session.post(f"{BASE_URL}/orders/checkout", 
                                   json=checkout_data,
                                   headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            order_id = data.get('order_id')
            checkout_url = data.get('checkout_url')
            payment_method = data.get('payment_method')
            
            self.log(f"✅ COD checkout successful")
            self.log(f"   Order ID: {order_id}")
            self.log(f"   Checkout URL: {checkout_url}")
            self.log(f"   Payment Method: {payment_method}")
            
            # Verify expected COD behavior
            if checkout_url is None and payment_method == 'cod':
                self.log("✅ COD checkout correctly returns null checkout_url")
                
                # Verify order was created with correct status
                order_response = self.session.get(f"{BASE_URL}/orders", headers=headers)
                if order_response.status_code == 200:
                    orders = order_response.json()
                    cod_order = next((o for o in orders if o['id'] == order_id), None)
                    if cod_order:
                        if cod_order['status'] == 'confirmed' and cod_order['payment_status'] == 'cod':
                            self.log("✅ COD order created with correct status: confirmed, payment_status: cod")
                            return True
                        else:
                            self.log(f"❌ COD order has incorrect status: {cod_order['status']}, payment_status: {cod_order['payment_status']}", "ERROR")
                    else:
                        self.log("❌ COD order not found in orders list", "ERROR")
                else:
                    self.log(f"❌ Failed to get orders: {order_response.status_code}", "ERROR")
            else:
                self.log(f"❌ COD checkout returned unexpected values: checkout_url={checkout_url}, payment_method={payment_method}", "ERROR")
        else:
            self.log(f"❌ COD checkout failed: {response.status_code} - {response.text}", "ERROR")
            
        return False
        
    def test_card_payment_checkout(self):
        """Test card payment checkout flow"""
        self.log("\n=== Testing Card Payment Checkout Flow ===")
        
        if not self.user_token:
            self.log("❌ No user token available", "ERROR")
            return False, None
            
        # Add item to cart first
        if not self.add_item_to_cart():
            return False, None
            
        # Create card payment checkout
        headers = {'Authorization': f'Bearer {self.user_token}'}
        checkout_data = {
            "payment_method": "card",
            "address": {
                "label": "Home",
                "address_line": "123 Test Street",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001", 
                "phone": "9876543210"
            },
            "origin_url": "https://code-preview-155.preview.emergentagent.com"
        }
        
        response = self.session.post(f"{BASE_URL}/orders/checkout",
                                   json=checkout_data,
                                   headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            order_id = data.get('order_id')
            checkout_url = data.get('checkout_url')
            session_id = data.get('session_id')
            payment_method = data.get('payment_method')
            
            self.log(f"✅ Card checkout successful")
            self.log(f"   Order ID: {order_id}")
            self.log(f"   Checkout URL: {checkout_url}")
            self.log(f"   Session ID: {session_id}")
            self.log(f"   Payment Method: {payment_method}")
            
            # Verify checkout URL points to local simulated endpoint
            if checkout_url and "/api/payment/simulate/" in checkout_url and session_id:
                self.log("✅ Checkout URL correctly points to local simulated endpoint")
                return True, session_id
            else:
                self.log(f"❌ Checkout URL does not point to expected simulated endpoint: {checkout_url}", "ERROR")
        else:
            self.log(f"❌ Card checkout failed: {response.status_code} - {response.text}", "ERROR")
            
        return False, None
        
    def test_simulated_payment_page(self, session_id):
        """Test simulated payment page endpoint"""
        self.log(f"\n=== Testing Simulated Payment Page (Session: {session_id}) ===")
        
        if not session_id:
            self.log("❌ No session ID provided", "ERROR")
            return False
            
        response = self.session.get(f"{BASE_URL}/payment/simulate/{session_id}")
        
        if response.status_code == 200:
            content = response.text
            if "Secure Payment - Test Mode" in content and "TEST MODE" in content:
                self.log("✅ Simulated payment page loaded successfully")
                self.log("   Page contains expected test mode indicators")
                return True
            else:
                self.log("❌ Simulated payment page missing expected content", "ERROR")
        else:
            self.log(f"❌ Failed to load simulated payment page: {response.status_code} - {response.text}", "ERROR")
            
        return False
        
    def test_process_simulated_payment(self, session_id):
        """Test processing simulated payment"""
        self.log(f"\n=== Testing Process Simulated Payment (Session: {session_id}) ===")
        
        if not session_id:
            self.log("❌ No session ID provided", "ERROR")
            return False
            
        response = self.session.post(f"{BASE_URL}/payment/simulate/{session_id}/pay")
        
        if response.status_code == 200:
            data = response.json()
            success = data.get('success')
            redirect_url = data.get('redirect_url')
            
            self.log(f"✅ Payment processing successful")
            self.log(f"   Success: {success}")
            self.log(f"   Redirect URL: {redirect_url}")
            
            if success and redirect_url and 'status=success' in redirect_url:
                self.log("✅ Payment processing returned expected success response")
                return True
            else:
                self.log(f"❌ Payment processing returned unexpected response: success={success}, redirect_url={redirect_url}", "ERROR")
        else:
            self.log(f"❌ Payment processing failed: {response.status_code} - {response.text}", "ERROR")
            
        return False
        
    def test_payment_status_check(self, session_id):
        """Test payment status check endpoint"""
        self.log(f"\n=== Testing Payment Status Check (Session: {session_id}) ===")
        
        if not session_id:
            self.log("❌ No session ID provided", "ERROR")
            return False
            
        response = self.session.get(f"{BASE_URL}/payments/status/{session_id}")
        
        if response.status_code == 200:
            data = response.json()
            payment_status = data.get('payment_status')
            status = data.get('status')
            
            self.log(f"✅ Payment status check successful")
            self.log(f"   Payment Status: {payment_status}")
            self.log(f"   Status: {status}")
            
            if payment_status == 'paid' and status == 'complete':
                self.log("✅ Payment status correctly shows 'paid' and 'complete'")
                return True
            else:
                self.log(f"❌ Payment status unexpected: payment_status={payment_status}, status={status}", "ERROR")
        else:
            self.log(f"❌ Payment status check failed: {response.status_code} - {response.text}", "ERROR")
            
        return False
        
    def verify_order_payment_status(self, session_id):
        """Verify that the order's payment status was updated correctly"""
        self.log(f"\n=== Verifying Order Payment Status Update ===")
        
        if not self.user_token:
            self.log("❌ No user token available", "ERROR")
            return False
            
        headers = {'Authorization': f'Bearer {self.user_token}'}
        response = self.session.get(f"{BASE_URL}/orders", headers=headers)
        
        if response.status_code == 200:
            orders = response.json()
            # Find the most recent order (should be our test order)
            if orders:
                latest_order = orders[0]  # Orders are sorted by created_at desc
                if latest_order['payment_status'] == 'paid' and latest_order['status'] == 'confirmed':
                    self.log("✅ Order payment status correctly updated to 'paid' and status to 'confirmed'")
                    return True
                else:
                    self.log(f"❌ Order payment status not updated correctly: payment_status={latest_order['payment_status']}, status={latest_order['status']}", "ERROR")
            else:
                self.log("❌ No orders found", "ERROR")
        else:
            self.log(f"❌ Failed to get orders: {response.status_code}", "ERROR")
            
        return False
        
    def run_all_tests(self):
        """Run all payment flow tests"""
        self.log("🚀 Starting Payment Flow Backend Testing")
        self.log(f"Base URL: {BASE_URL}")
        
        results = {
            'user_login': False,
            'cod_checkout': False,
            'card_checkout': False,
            'simulated_payment_page': False,
            'process_payment': False,
            'payment_status_check': False,
            'order_status_verification': False
        }
        
        # Test 1: User Login
        results['user_login'] = self.login_user()
        if not results['user_login']:
            self.log("❌ Cannot proceed without user login", "ERROR")
            return results
            
        # Test 2: COD Checkout Flow
        results['cod_checkout'] = self.test_cod_checkout()
        
        # Test 3: Card Payment Checkout Flow
        card_success, session_id = self.test_card_payment_checkout()
        results['card_checkout'] = card_success
        
        if card_success and session_id:
            # Test 4: Simulated Payment Page
            results['simulated_payment_page'] = self.test_simulated_payment_page(session_id)
            
            # Test 5: Process Simulated Payment
            results['process_payment'] = self.test_process_simulated_payment(session_id)
            
            # Test 6: Payment Status Check
            results['payment_status_check'] = self.test_payment_status_check(session_id)
            
            # Test 7: Verify Order Status Update
            results['order_status_verification'] = self.verify_order_payment_status(session_id)
        else:
            self.log("❌ Skipping remaining tests due to card checkout failure", "ERROR")
            
        return results
        
    def print_summary(self, results):
        """Print test summary"""
        self.log("\n" + "="*60)
        self.log("PAYMENT FLOW TESTING SUMMARY")
        self.log("="*60)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
            
        self.log(f"\nOverall: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            self.log("🎉 ALL PAYMENT FLOW TESTS PASSED!", "SUCCESS")
            return True
        else:
            self.log(f"⚠️  {total_tests - passed_tests} test(s) failed", "WARNING")
            return False

def main():
    tester = PaymentFlowTester()
    results = tester.run_all_tests()
    success = tester.print_summary(results)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()