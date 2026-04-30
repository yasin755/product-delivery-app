#!/usr/bin/env python3
"""
Backend API Testing Script for Payment URL Formation Verification
Tests the specific issue where payment URLs might be incorrectly formed.
"""

import requests
import json
import sys
import re
from typing import Dict, Any

# Backend URL from environment
BACKEND_URL = "https://code-preview-155.preview.emergentagent.com/api"

# Test credentials
TEST_USER = {
    "email": "user@test.com",
    "password": "user123"
}

class PaymentURLTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_token = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            for key, value in details.items():
                print(f"  {key}: {value}")
        print()

    def login_user(self) -> bool:
        """Login as test user and get token"""
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json=TEST_USER,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.user_token = data.get('token') or data.get('access_token')
                if self.user_token:
                    self.session.headers.update({'Authorization': f'Bearer {self.user_token}'})
                    self.log_result("User Login", True, "Successfully logged in as test user")
                    return True
                else:
                    self.log_result("User Login", False, "No access token in response", {"response": data})
                    return False
            else:
                self.log_result("User Login", False, f"Login failed with status {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("User Login", False, f"Login request failed: {str(e)}")
            return False

    def add_item_to_cart(self) -> bool:
        """Add an item to cart for checkout"""
        try:
            # First get available products
            response = self.session.get(f"{BACKEND_URL}/products", timeout=10)
            if response.status_code != 200:
                self.log_result("Get Products", False, f"Failed to get products: {response.status_code}")
                return False
                
            products = response.json().get('products', [])
            if not products:
                self.log_result("Get Products", False, "No products available")
                return False
                
            product = products[0]  # Use first available product
            
            # Add to cart
            cart_item = {
                "product_id": product['id'],
                "quantity": 1
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/cart/add",
                json=cart_item,
                timeout=10
            )
            
            if response.status_code == 200:
                self.log_result("Add to Cart", True, f"Added product {product['name']} to cart")
                return True
            else:
                self.log_result("Add to Cart", False, f"Failed to add to cart: {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("Add to Cart", False, f"Add to cart failed: {str(e)}")
            return False

    def test_payment_url_formation(self) -> bool:
        """Test the main issue: payment URL formation"""
        try:
            # Create checkout with specific origin_url
            origin_url = "https://code-preview-155.preview.emergentagent.com"
            checkout_data = {
                "payment_method": "card",
                "origin_url": origin_url,
                "address": {
                    "label": "Home",
                    "address_line": "123 Test Street",
                    "city": "Test City",
                    "state": "Test State",
                    "pincode": "123456",
                    "phone": "+1234567890"
                }
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/orders/checkout",
                json=checkout_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_result("Create Checkout", False, f"Checkout failed: {response.status_code}", 
                              {"response": response.text})
                return False
                
            checkout_response = response.json()
            checkout_url = checkout_response.get('checkout_url')
            session_id = checkout_response.get('session_id')
            
            if not checkout_url or not session_id:
                self.log_result("Create Checkout", False, "Missing checkout_url or session_id", 
                              {"response": checkout_response})
                return False
                
            self.log_result("Create Checkout", True, "Checkout session created successfully", {
                "checkout_url": checkout_url,
                "session_id": session_id,
                "order_id": checkout_response.get('order_id')
            })
            
            # Now test the payment page URL formation
            success = self.test_payment_page_urls(checkout_url, session_id, origin_url)
            
            # Also test the payment completion endpoint
            if success:
                self.test_payment_completion(session_id)
            
            return success
            
        except Exception as e:
            self.log_result("Create Checkout", False, f"Checkout request failed: {str(e)}")
            return False

    def test_payment_page_urls(self, checkout_url: str, session_id: str, origin_url: str) -> bool:
        """Test the payment page and verify URL formation"""
        try:
            # Request the simulated payment page
            response = self.session.get(checkout_url, timeout=10)
            
            if response.status_code != 200:
                self.log_result("Payment Page Request", False, f"Payment page failed: {response.status_code}")
                return False
                
            html_content = response.text
            self.log_result("Payment Page Request", True, "Payment page loaded successfully")
            
            # Extract the pay_action URL from the HTML
            # Look for the form action or any URL containing the complete endpoint
            pay_action_pattern = r'(https://[^"\'>\s]+/api/payment/simulate/[^/]+/complete)'
            matches = re.findall(pay_action_pattern, html_content)
            
            if not matches:
                # Try alternative patterns
                alternative_patterns = [
                    r'action="([^"]+/complete)"',
                    r'action=\'([^\']+/complete)\'',
                    r'(https://[^"\'>\s]+api/payment/simulate/[^/]+/complete)'  # Missing slash pattern
                ]
                
                for pattern in alternative_patterns:
                    matches = re.findall(pattern, html_content)
                    if matches:
                        break
                        
            if not matches:
                self.log_result("URL Extraction", False, "Could not find pay_action URL in HTML", 
                              {"html_snippet": html_content[:500]})
                return False
                
            pay_action_url = matches[0]
            expected_url = f"{origin_url}/api/payment/simulate/{session_id}/complete"
            
            # Check for the specific issue: missing slash
            incorrect_url = f"{origin_url}api/payment/simulate/{session_id}/complete"  # Missing slash
            
            url_correct = pay_action_url == expected_url
            url_has_missing_slash = pay_action_url == incorrect_url
            
            if url_correct:
                self.log_result("URL Formation Check", True, "Payment URL correctly formed", {
                    "expected": expected_url,
                    "actual": pay_action_url
                })
                return True
            elif url_has_missing_slash:
                self.log_result("URL Formation Check", False, "Payment URL missing slash - CRITICAL BUG", {
                    "expected": expected_url,
                    "actual": pay_action_url,
                    "issue": "Missing slash between domain and /api"
                })
                return False
            else:
                self.log_result("URL Formation Check", False, "Payment URL format unexpected", {
                    "expected": expected_url,
                    "actual": pay_action_url
                })
                return False
                
        except Exception as e:
            self.log_result("Payment Page Test", False, f"Payment page test failed: {str(e)}")
            return False

    def test_payment_completion(self, session_id: str) -> bool:
        """Test the payment completion endpoint"""
        try:
            complete_url = f"{BACKEND_URL}/payment/simulate/{session_id}/complete"
            
            # Test GET request to completion endpoint
            response = self.session.get(complete_url, timeout=10, allow_redirects=False)
            
            if response.status_code == 302:
                redirect_url = response.headers.get('Location', '')
                self.log_result("Payment Completion", True, "Payment completion returns redirect", {
                    "redirect_url": redirect_url,
                    "status_code": response.status_code
                })
                return True
            else:
                self.log_result("Payment Completion", False, f"Unexpected status: {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("Payment Completion", False, f"Payment completion failed: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all payment URL formation tests"""
        print("🧪 Starting Payment URL Formation Tests")
        print("=" * 60)
        
        # Step 1: Login
        if not self.login_user():
            print("❌ Cannot proceed without login")
            return False
            
        # Step 2: Add item to cart
        if not self.add_item_to_cart():
            print("❌ Cannot proceed without items in cart")
            return False
            
        # Step 3: Test payment URL formation (main test)
        if not self.test_payment_url_formation():
            print("❌ Payment URL formation test failed")
            return False
            
        print("✅ All payment URL formation tests completed successfully!")
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
                    
        print("\n" + "=" * 60)

def main():
    """Main test execution"""
    tester = PaymentURLTester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        if not success:
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()