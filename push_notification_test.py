#!/usr/bin/env python3

import requests
import json

# API Configuration
BASE_URL = "https://git-runner-5.preview.emergentagent.com/api"

# Test credentials from review request
ADMIN_CREDENTIALS = {
    "email": "admin@delivery.com",
    "password": "admin123"
}

USER_CREDENTIALS = {
    "email": "user@test.com", 
    "password": "user123"
}

def login(credentials):
    """Login and return JWT token"""
    response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
    if response.status_code == 200:
        data = response.json()
        return data.get('token') or data.get('access_token')
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_push_notifications():
    """Test push notification endpoints exactly as specified in review request"""
    print("🚀 Testing Push Notification Endpoints")
    print("=" * 60)
    
    # Step 1: Login as admin
    print("\n1. Login as admin...")
    admin_token = login(ADMIN_CREDENTIALS)
    if not admin_token:
        return False
    print("✅ Admin login successful")
    
    # Step 2: Register admin push token
    print("\n2. Register admin push token...")
    admin_headers = {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}
    admin_payload = {
        "token": "ExponentPushToken[admin-test-123]",
        "device_name": "Admin iPhone"
    }
    
    response = requests.post(f"{BASE_URL}/auth/push-token", json=admin_payload, headers=admin_headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200 and response.json().get('message') == 'Push token registered':
        print("✅ Admin push token registered successfully")
    else:
        print("❌ Admin push token registration failed")
        return False
    
    # Step 3: Login as regular user
    print("\n3. Login as regular user...")
    user_token = login(USER_CREDENTIALS)
    if not user_token:
        return False
    print("✅ User login successful")
    
    # Step 4: Register user push token
    print("\n4. Register user push token...")
    user_headers = {'Authorization': f'Bearer {user_token}', 'Content-Type': 'application/json'}
    user_payload = {
        "token": "ExponentPushToken[user-test-456]",
        "device_name": "User Android"
    }
    
    response = requests.post(f"{BASE_URL}/auth/push-token", json=user_payload, headers=user_headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200 and response.json().get('message') == 'Push token registered':
        print("✅ User push token registered successfully")
    else:
        print("❌ User push token registration failed")
        return False
    
    # Step 5: Test duplicate token registration (upsert)
    print("\n5. Test duplicate admin token registration...")
    response = requests.post(f"{BASE_URL}/auth/push-token", json=admin_payload, headers=admin_headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200 and response.json().get('message') == 'Push token registered':
        print("✅ Duplicate token registration handled correctly (upsert)")
    else:
        print("❌ Duplicate token registration failed")
        return False
    
    # Step 6: Remove user push token
    print("\n6. Remove user push token...")
    remove_payload = {"token": "ExponentPushToken[user-test-456]"}
    
    response = requests.delete(f"{BASE_URL}/auth/push-token", json=remove_payload, headers=user_headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200 and response.json().get('message') == 'Push token removed':
        print("✅ User push token removed successfully")
    else:
        print("❌ User push token removal failed")
        return False
    
    print("\n" + "=" * 60)
    print("🎉 ALL PUSH NOTIFICATION TESTS PASSED!")
    return True

if __name__ == "__main__":
    success = test_push_notifications()
    if success:
        print("\n✅ Push notification backend endpoints are working correctly")
    else:
        print("\n❌ Some push notification tests failed")