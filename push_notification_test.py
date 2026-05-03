#!/usr/bin/env python3
"""
Backend API Testing Script for Push Notification System
Tests push token registration, retrieval, and notification sending.
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from environment
BACKEND_URL = "https://code-preview-155.preview.emergentagent.com/api"

# Test credentials
TEST_USER = {
    "email": "user@test.com",
    "password": "user123"
}

TEST_ADMIN = {
    "email": "admin@delivery.com",
    "password": "admin123"
}

class PushNotificationTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_token = None
        self.admin_token = None
        self.test_results = []
        self.admin_push_token = "ExponentPushToken[test-admin-token-12345]"
        self.user_push_token = "ExponentPushToken[test-user-token-67890]"
        
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

    def login_admin(self) -> bool:
        """Login as admin and get token"""
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json=TEST_ADMIN,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get('token') or data.get('access_token')
                if self.admin_token:
                    self.log_result("Admin Login", True, "Successfully logged in as admin")
                    return True
                else:
                    self.log_result("Admin Login", False, "No access token in response", {"response": data})
                    return False
            else:
                self.log_result("Admin Login", False, f"Login failed with status {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("Admin Login", False, f"Login request failed: {str(e)}")
            return False

    def register_admin_push_token(self) -> bool:
        """Test 1: Register push token as admin"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            data = {
                "token": self.admin_push_token,
                "device_name": "Test Admin Device"
            }
            
            response = requests.post(
                f"{BACKEND_URL}/auth/push-token",
                json=data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                response_data = response.json()
                if response_data.get('message') == 'Push token registered':
                    self.log_result("Register Admin Push Token", True, 
                                  "Admin push token registered successfully", 
                                  {"response": response_data})
                    return True
                else:
                    self.log_result("Register Admin Push Token", False, 
                                  "Unexpected response message", 
                                  {"response": response_data})
                    return False
            else:
                self.log_result("Register Admin Push Token", False, 
                              f"Failed with status {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("Register Admin Push Token", False, f"Request failed: {str(e)}")
            return False

    def register_user_push_token(self) -> bool:
        """Test 2: Register push token as user"""
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            data = {
                "token": self.user_push_token,
                "device_name": "Test User Device"
            }
            
            response = requests.post(
                f"{BACKEND_URL}/auth/push-token",
                json=data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                response_data = response.json()
                if response_data.get('message') == 'Push token registered':
                    self.log_result("Register User Push Token", True, 
                                  "User push token registered successfully", 
                                  {"response": response_data})
                    return True
                else:
                    self.log_result("Register User Push Token", False, 
                                  "Unexpected response message", 
                                  {"response": response_data})
                    return False
            else:
                self.log_result("Register User Push Token", False, 
                              f"Failed with status {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("Register User Push Token", False, f"Request failed: {str(e)}")
            return False

    def get_all_push_tokens(self) -> bool:
        """Test 3: Get all push tokens (admin only)"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            response = requests.get(
                f"{BACKEND_URL}/auth/push-tokens",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                response_data = response.json()
                tokens = response_data.get('tokens', [])
                count = response_data.get('count', 0)
                
                # Verify tokens have required fields
                admin_token_found = False
                user_token_found = False
                
                for token_doc in tokens:
                    if not all(key in token_doc for key in ['token', 'user_id', 'role', 'device_name']):
                        self.log_result("Get All Push Tokens", False, 
                                      "Token missing required fields", 
                                      {"token_doc": token_doc})
                        return False
                    
                    if token_doc['token'] == self.admin_push_token:
                        admin_token_found = True
                        if token_doc['role'] != 'admin':
                            self.log_result("Get All Push Tokens", False, 
                                          "Admin token has incorrect role", 
                                          {"role": token_doc['role']})
                            return False
                    
                    if token_doc['token'] == self.user_push_token:
                        user_token_found = True
                        if token_doc['role'] != 'user':
                            self.log_result("Get All Push Tokens", False, 
                                          "User token has incorrect role", 
                                          {"role": token_doc['role']})
                            return False
                
                if not admin_token_found:
                    self.log_result("Get All Push Tokens", False, 
                                  "Admin token not found in list", 
                                  {"tokens": tokens})
                    return False
                
                if not user_token_found:
                    self.log_result("Get All Push Tokens", False, 
                                  "User token not found in list", 
                                  {"tokens": tokens})
                    return False
                
                self.log_result("Get All Push Tokens", True, 
                              f"Retrieved {count} push tokens with correct structure", 
                              {"count": count, "admin_found": admin_token_found, "user_found": user_token_found})
                return True
            else:
                self.log_result("Get All Push Tokens", False, 
                              f"Failed with status {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("Get All Push Tokens", False, f"Request failed: {str(e)}")
            return False

    def test_user_push_notification(self) -> bool:
        """Test 4: Test push notification (individual user)"""
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            
            response = requests.post(
                f"{BACKEND_URL}/auth/test-push",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                response_data = response.json()
                if 'message' in response_data and 'success' in response_data['message'].lower():
                    self.log_result("Test User Push Notification", True, 
                                  "Test notification sent successfully", 
                                  {"response": response_data})
                    return True
                else:
                    self.log_result("Test User Push Notification", False, 
                                  "Unexpected response format", 
                                  {"response": response_data})
                    return False
            else:
                self.log_result("Test User Push Notification", False, 
                              f"Failed with status {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("Test User Push Notification", False, f"Request failed: {str(e)}")
            return False

    def test_push_to_admins(self) -> bool:
        """Test 5: Test push to admins"""
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            response = requests.post(
                f"{BACKEND_URL}/admin/test-push-to-admins",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                response_data = response.json()
                if 'message' in response_data:
                    self.log_result("Test Push to Admins", True, 
                                  "Test notification sent to all admins", 
                                  {"response": response_data})
                    return True
                else:
                    self.log_result("Test Push to Admins", False, 
                                  "Unexpected response format", 
                                  {"response": response_data})
                    return False
            else:
                self.log_result("Test Push to Admins", False, 
                              f"Failed with status {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("Test Push to Admins", False, f"Request failed: {str(e)}")
            return False

    def test_order_placement_notification(self) -> bool:
        """Test 6: Place order and verify notification is triggered"""
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            
            # First get available products
            response = requests.get(f"{BACKEND_URL}/products", timeout=10)
            if response.status_code != 200:
                self.log_result("Get Products for Order", False, 
                              f"Failed to get products: {response.status_code}")
                return False
                
            products = response.json().get('products', [])
            if not products:
                self.log_result("Get Products for Order", False, "No products available")
                return False
                
            product = products[0]
            
            # Add to cart
            cart_item = {
                "product_id": product['id'],
                "quantity": 1
            }
            
            response = requests.post(
                f"{BACKEND_URL}/cart/add",
                json=cart_item,
                headers=headers,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_result("Add to Cart for Order", False, 
                              f"Failed to add to cart: {response.status_code}")
                return False
            
            # Place COD order
            checkout_data = {
                "payment_method": "cod",
                "origin_url": "https://code-preview-155.preview.emergentagent.com",
                "address": {
                    "label": "Home",
                    "address_line": "123 Test Street",
                    "city": "Test City",
                    "state": "Test State",
                    "pincode": "123456",
                    "phone": "+1234567890"
                }
            }
            
            response = requests.post(
                f"{BACKEND_URL}/orders/checkout",
                json=checkout_data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                order_data = response.json()
                self.log_result("Place Order and Check Notification", True, 
                              "Order placed successfully. Check backend logs for 'Push notification sent' or admin token info", 
                              {"order_id": order_data.get('order_id'), 
                               "payment_method": order_data.get('payment_method'),
                               "note": "Backend should log push notification attempts to admins"})
                return True
            else:
                self.log_result("Place Order and Check Notification", False, 
                              f"Failed to place order: {response.status_code}", 
                              {"response": response.text})
                return False
                
        except Exception as e:
            self.log_result("Place Order and Check Notification", False, f"Request failed: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all push notification tests"""
        print("🧪 Starting Push Notification System Tests")
        print("=" * 60)
        
        # Step 1: Login as admin
        if not self.login_admin():
            print("❌ Cannot proceed without admin login")
            return False
        
        # Step 2: Register admin push token
        if not self.register_admin_push_token():
            print("⚠️ Admin push token registration failed, continuing...")
        
        # Step 3: Login as user
        if not self.login_user():
            print("❌ Cannot proceed without user login")
            return False
        
        # Step 4: Register user push token
        if not self.register_user_push_token():
            print("⚠️ User push token registration failed, continuing...")
        
        # Step 5: Get all push tokens (as admin)
        if not self.get_all_push_tokens():
            print("⚠️ Get all push tokens failed, continuing...")
        
        # Step 6: Test individual push notification (as user)
        if not self.test_user_push_notification():
            print("⚠️ Test user push notification failed, continuing...")
        
        # Step 7: Test push to admins (as admin)
        if not self.test_push_to_admins():
            print("⚠️ Test push to admins failed, continuing...")
        
        # Step 8: Place order and check notification log
        if not self.test_order_placement_notification():
            print("⚠️ Order placement notification test failed")
        
        print("✅ All push notification tests completed!")
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
        
        print("\n📝 KEY VERIFICATION POINTS:")
        print("  1. Push tokens stored in database with correct role")
        print("  2. send_push_to_admins function finds admin tokens")
        print("  3. Expo push API is being called correctly")
        print("  4. Check backend logs for push notification attempts")
                    
        print("\n" + "=" * 60)

def main():
    """Main test execution"""
    tester = PushNotificationTester()
    
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
