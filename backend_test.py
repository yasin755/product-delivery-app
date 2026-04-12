#!/usr/bin/env python3
"""
Backend API Testing for Delivery App
Tests all address CRUD and coupon system endpoints
"""

import requests
import json
import sys
from typing import Dict, Any

# Configuration
BASE_URL = "https://order-tracking-demo-2.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

# Test credentials
USER_CREDENTIALS = {"email": "user@test.com", "password": "user123"}
ADMIN_CREDENTIALS = {"email": "admin@delivery.com", "password": "admin123"}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def log_pass(self, test_name: str):
        self.passed += 1
        print(f"✅ PASS: {test_name}")
        
    def log_fail(self, test_name: str, error: str):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ FAIL: {test_name} - {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} passed")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}")
        return self.failed == 0

def make_request(method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> Dict[str, Any]:
    """Make HTTP request and return response data"""
    url = f"{BASE_URL}{endpoint}"
    req_headers = HEADERS.copy()
    if headers:
        req_headers.update(headers)
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=req_headers)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=req_headers)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=req_headers)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=req_headers)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        return {
            "status_code": response.status_code,
            "data": response.json() if response.content else {},
            "success": response.status_code < 400
        }
    except requests.exceptions.RequestException as e:
        return {
            "status_code": 0,
            "data": {"error": str(e)},
            "success": False
        }
    except json.JSONDecodeError:
        return {
            "status_code": response.status_code,
            "data": {"error": "Invalid JSON response"},
            "success": False
        }

def test_auth_login(results: TestResults) -> Dict[str, str]:
    """Test user and admin login, return tokens"""
    tokens = {}
    
    # Test user login
    response = make_request("POST", "/auth/login", USER_CREDENTIALS)
    if response["success"] and "token" in response["data"]:
        tokens["user"] = response["data"]["token"]
        results.log_pass("User login")
    else:
        results.log_fail("User login", f"Status: {response['status_code']}, Data: {response['data']}")
    
    # Test admin login
    response = make_request("POST", "/auth/login", ADMIN_CREDENTIALS)
    if response["success"] and "token" in response["data"]:
        tokens["admin"] = response["data"]["token"]
        results.log_pass("Admin login")
    else:
        results.log_fail("Admin login", f"Status: {response['status_code']}, Data: {response['data']}")
    
    return tokens

def test_address_crud(results: TestResults, user_token: str):
    """Test address CRUD operations"""
    auth_headers = {"Authorization": f"Bearer {user_token}"}
    
    # Test 1: Add address
    address_data = {
        "label": "Office",
        "address_line": "456 Business Ave",
        "city": "San Francisco",
        "state": "CA",
        "pincode": "94102",
        "phone": "+1555123456"
    }
    
    response = make_request("POST", "/auth/address", address_data, auth_headers)
    if response["success"] and "address" in response["data"]:
        address_id = response["data"]["address"]["id"]
        results.log_pass("Add address")
    else:
        results.log_fail("Add address", f"Status: {response['status_code']}, Data: {response['data']}")
        return
    
    # Test 2: Verify address in profile
    response = make_request("GET", "/auth/profile", headers=auth_headers)
    if response["success"] and "addresses" in response["data"]:
        addresses = response["data"]["addresses"]
        found_address = next((addr for addr in addresses if addr["id"] == address_id), None)
        if found_address and found_address["label"] == "Office":
            results.log_pass("Verify address in profile")
        else:
            results.log_fail("Verify address in profile", "Address not found or incorrect data")
    else:
        results.log_fail("Verify address in profile", f"Status: {response['status_code']}, Data: {response['data']}")
        return
    
    # Test 3: Update address
    updated_address = {
        "label": "Updated Office",
        "address_line": "789 Updated Business Ave",
        "city": "San Francisco",
        "state": "CA",
        "pincode": "94103",
        "phone": "+1555654321"
    }
    
    response = make_request("PUT", f"/auth/address/{address_id}", updated_address, auth_headers)
    if response["success"]:
        results.log_pass("Update address")
    else:
        results.log_fail("Update address", f"Status: {response['status_code']}, Data: {response['data']}")
    
    # Test 4: Verify address update
    response = make_request("GET", "/auth/profile", headers=auth_headers)
    if response["success"] and "addresses" in response["data"]:
        addresses = response["data"]["addresses"]
        found_address = next((addr for addr in addresses if addr["id"] == address_id), None)
        if found_address and found_address["label"] == "Updated Office":
            results.log_pass("Verify address update")
        else:
            results.log_fail("Verify address update", "Address not updated correctly")
    else:
        results.log_fail("Verify address update", f"Status: {response['status_code']}, Data: {response['data']}")
    
    # Test 5: Delete address
    response = make_request("DELETE", f"/auth/address/{address_id}", headers=auth_headers)
    if response["success"]:
        results.log_pass("Delete address")
    else:
        results.log_fail("Delete address", f"Status: {response['status_code']}, Data: {response['data']}")
    
    # Test 6: Verify address deletion
    response = make_request("GET", "/auth/profile", headers=auth_headers)
    if response["success"] and "addresses" in response["data"]:
        addresses = response["data"]["addresses"]
        found_address = next((addr for addr in addresses if addr["id"] == address_id), None)
        if not found_address:
            results.log_pass("Verify address deletion")
        else:
            results.log_fail("Verify address deletion", "Address still exists after deletion")
    else:
        results.log_fail("Verify address deletion", f"Status: {response['status_code']}, Data: {response['data']}")

def test_coupon_system(results: TestResults, user_token: str, admin_token: str):
    """Test coupon system operations"""
    user_auth_headers = {"Authorization": f"Bearer {user_token}"}
    admin_auth_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test 1: Get available coupons
    response = make_request("GET", "/coupons")
    if response["success"] and isinstance(response["data"], list):
        coupons = response["data"]
        expected_codes = {"WELCOME10", "FLAT20", "FRESH15"}
        found_codes = {coupon["code"] for coupon in coupons}
        if expected_codes.issubset(found_codes):
            results.log_pass("Get available coupons")
        else:
            results.log_fail("Get available coupons", f"Missing expected coupons. Found: {found_codes}")
    else:
        results.log_fail("Get available coupons", f"Status: {response['status_code']}, Data: {response['data']}")
    
    # Test 2: Apply WELCOME10 coupon (10% discount)
    apply_data = {"code": "WELCOME10", "cart_total": 50.0}
    response = make_request("POST", "/coupons/apply", apply_data, user_auth_headers)
    if response["success"] and "discount" in response["data"]:
        discount = response["data"]["discount"]
        expected_discount = 5.0  # 10% of 50
        if abs(discount - expected_discount) < 0.01:
            results.log_pass("Apply WELCOME10 coupon")
        else:
            results.log_fail("Apply WELCOME10 coupon", f"Expected discount ₹{expected_discount}, got ₹{discount}")
    else:
        results.log_fail("Apply WELCOME10 coupon", f"Status: {response['status_code']}, Data: {response['data']}")
    
    # Test 3: Apply FLAT20 coupon (₹20 flat discount)
    apply_data = {"code": "FLAT20", "cart_total": 50.0}
    response = make_request("POST", "/coupons/apply", apply_data, user_auth_headers)
    if response["success"] and "discount" in response["data"]:
        discount = response["data"]["discount"]
        expected_discount = 20.0  # Flat ₹20
        if abs(discount - expected_discount) < 0.01:
            results.log_pass("Apply FLAT20 coupon")
        else:
            results.log_fail("Apply FLAT20 coupon", f"Expected discount ₹{expected_discount}, got ₹{discount}")
    else:
        results.log_fail("Apply FLAT20 coupon", f"Status: {response['status_code']}, Data: {response['data']}")
    
    # Test 4: Try invalid coupon
    apply_data = {"code": "INVALID123", "cart_total": 50.0}
    response = make_request("POST", "/coupons/apply", apply_data, user_auth_headers)
    if not response["success"] and response["status_code"] == 404:
        results.log_pass("Invalid coupon rejection")
    else:
        results.log_fail("Invalid coupon rejection", f"Expected 404 error, got status: {response['status_code']}")
    
    # Test 5: Try coupon with cart below minimum order
    apply_data = {"code": "FLAT20", "cart_total": 10.0}  # FLAT20 requires min ₹30
    response = make_request("POST", "/coupons/apply", apply_data, user_auth_headers)
    if not response["success"] and response["status_code"] == 400:
        results.log_pass("Minimum order validation")
    else:
        results.log_fail("Minimum order validation", f"Expected 400 error, got status: {response['status_code']}")
    
    # Test 6: Admin create new coupon
    new_coupon = {
        "code": "TEST50",
        "discount_type": "percentage",
        "discount_value": 50,
        "min_order": 100,
        "max_discount": 200,
        "is_active": True
    }
    response = make_request("POST", "/coupons", new_coupon, admin_auth_headers)
    if response["success"] and "id" in response["data"]:
        coupon_id = response["data"]["id"]
        results.log_pass("Admin create coupon")
    else:
        results.log_fail("Admin create coupon", f"Status: {response['status_code']}, Data: {response['data']}")
        return
    
    # Test 7: Admin delete coupon
    response = make_request("DELETE", f"/coupons/{coupon_id}", headers=admin_auth_headers)
    if response["success"]:
        results.log_pass("Admin delete coupon")
    else:
        results.log_fail("Admin delete coupon", f"Status: {response['status_code']}, Data: {response['data']}")

def main():
    """Main test execution"""
    print("🚀 Starting Backend API Tests for Delivery App")
    print(f"Testing against: {BASE_URL}")
    print("="*60)
    
    results = TestResults()
    
    # Test authentication and get tokens
    print("\n📋 Testing Authentication...")
    tokens = test_auth_login(results)
    
    if "user" not in tokens or "admin" not in tokens:
        print("❌ Cannot proceed without valid tokens")
        return False
    
    # Test address CRUD operations
    print("\n🏠 Testing Address CRUD Operations...")
    test_address_crud(results, tokens["user"])
    
    # Test coupon system
    print("\n🎫 Testing Coupon System...")
    test_coupon_system(results, tokens["user"], tokens["admin"])
    
    # Print final results
    success = results.summary()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)