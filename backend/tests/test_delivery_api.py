"""
Backend API Tests for Multi-Category Delivery Platform
Tests: Auth, Categories, Products, Cart, Orders, Admin
"""
import pytest
import requests
import os

# Read from frontend .env or use default
BASE_URL = "https://order-now-platform.preview.emergentagent.com"

class TestHealth:
    """Basic health checks"""
    
    def test_backend_reachable(self):
        """Test if backend is reachable"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code in [200, 401], f"Backend not reachable: {response.status_code}"
        print(f"✓ Backend reachable at {BASE_URL}")


class TestAuth:
    """Authentication tests"""
    
    def test_login_user_success(self):
        """Test user login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@test.com",
            "password": "user123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token missing in response"
        assert "user" in data, "User missing in response"
        assert data["user"]["email"] == "user@test.com"
        assert data["user"]["role"] == "user"
        print(f"✓ User login successful: {data['user']['name']}")
    
    def test_login_admin_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@delivery.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, "Should return 401 for invalid credentials"
        print("✓ Invalid credentials rejected correctly")
    
    def test_get_profile_with_token(self):
        """Test getting user profile with valid token"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@test.com",
            "password": "user123"
        })
        token = login_response.json()["token"]
        
        # Get profile
        response = requests.get(f"{BASE_URL}/api/auth/profile", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["email"] == "user@test.com"
        assert "addresses" in data
        print(f"✓ Profile retrieved: {data['name']}")
    
    def test_get_profile_without_token(self):
        """Test getting profile without token"""
        response = requests.get(f"{BASE_URL}/api/auth/profile")
        assert response.status_code == 401, "Should return 401 without token"
        print("✓ Unauthorized access blocked correctly")


class TestCategories:
    """Category endpoint tests"""
    
    def test_get_categories_returns_5(self):
        """Test GET /api/categories returns 5 categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        
        categories = response.json()
        assert isinstance(categories, list), "Categories should be a list"
        assert len(categories) == 5, f"Expected 5 categories, got {len(categories)}"
        
        # Verify category structure
        for cat in categories:
            assert "id" in cat
            assert "name" in cat
            assert "icon" in cat
            assert "is_active" in cat
            assert cat["is_active"] == True
        
        category_names = [c["name"] for c in categories]
        print(f"✓ Categories retrieved: {category_names}")
    
    def test_categories_have_correct_names(self):
        """Test categories have expected names"""
        response = requests.get(f"{BASE_URL}/api/categories")
        categories = response.json()
        
        expected_names = ["Water & Beverages", "Fresh Meat", "Fruits & Veggies", "Grocery", "Kids Products"]
        actual_names = [c["name"] for c in categories]
        
        for expected in expected_names:
            assert expected in actual_names, f"Missing category: {expected}"
        
        print("✓ All expected categories present")


class TestProducts:
    """Product endpoint tests"""
    
    def test_get_products_returns_data(self):
        """Test GET /api/products returns products"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        data = response.json()
        assert "products" in data
        assert "total" in data
        assert "page" in data
        
        products = data["products"]
        assert len(products) > 0, "Should have products"
        print(f"✓ Products retrieved: {len(products)} products, total: {data['total']}")
    
    def test_get_products_total_count(self):
        """Test total product count is 21"""
        response = requests.get(f"{BASE_URL}/api/products?limit=100")
        data = response.json()
        
        assert data["total"] == 21, f"Expected 21 products, got {data['total']}"
        assert len(data["products"]) == 21
        print(f"✓ Total products count verified: {data['total']}")
    
    def test_product_structure(self):
        """Test product has correct structure"""
        response = requests.get(f"{BASE_URL}/api/products?limit=1")
        data = response.json()
        
        product = data["products"][0]
        required_fields = ["id", "name", "description", "price", "category_id", "image", "unit", "stock", "is_active"]
        
        for field in required_fields:
            assert field in product, f"Missing field: {field}"
        
        assert product["price"] > 0
        assert product["stock"] >= 0
        print(f"✓ Product structure valid: {product['name']}")
    
    def test_get_product_by_id(self):
        """Test GET /api/products/{id}"""
        # Get first product
        list_response = requests.get(f"{BASE_URL}/api/products?limit=1")
        product_id = list_response.json()["products"][0]["id"]
        
        # Get by ID
        response = requests.get(f"{BASE_URL}/api/products/{product_id}")
        assert response.status_code == 200
        
        product = response.json()
        assert product["id"] == product_id
        print(f"✓ Product by ID retrieved: {product['name']}")
    
    def test_search_products(self):
        """Test product search functionality"""
        response = requests.get(f"{BASE_URL}/api/products?search=water")
        assert response.status_code == 200
        
        data = response.json()
        products = data["products"]
        
        # Verify search results contain 'water' in name
        for product in products:
            assert "water" in product["name"].lower(), f"Search result doesn't match: {product['name']}"
        
        print(f"✓ Search working: found {len(products)} products for 'water'")
    
    def test_filter_by_category(self):
        """Test filtering products by category"""
        # Get first category
        cat_response = requests.get(f"{BASE_URL}/api/categories")
        category_id = cat_response.json()[0]["id"]
        
        # Filter by category
        response = requests.get(f"{BASE_URL}/api/products?category_id={category_id}")
        assert response.status_code == 200
        
        data = response.json()
        products = data["products"]
        
        # Verify all products belong to category
        for product in products:
            assert product["category_id"] == category_id
        
        print(f"✓ Category filter working: {len(products)} products in category")


class TestCart:
    """Cart endpoint tests"""
    
    @pytest.fixture
    def user_token(self):
        """Get user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@test.com",
            "password": "user123"
        })
        return response.json()["token"]
    
    def test_get_cart_requires_auth(self):
        """Test GET /api/cart requires authentication"""
        response = requests.get(f"{BASE_URL}/api/cart")
        assert response.status_code == 401
        print("✓ Cart requires authentication")
    
    def test_get_cart_with_auth(self, user_token):
        """Test GET /api/cart with authentication"""
        response = requests.get(f"{BASE_URL}/api/cart", headers={
            "Authorization": f"Bearer {user_token}"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data
        print(f"✓ Cart retrieved: {len(data['items'])} items, total: ${data['total']}")
    
    def test_add_to_cart(self, user_token):
        """Test POST /api/cart/add"""
        # Get a product
        prod_response = requests.get(f"{BASE_URL}/api/products?limit=1")
        product_id = prod_response.json()["products"][0]["id"]
        
        # Add to cart
        response = requests.post(f"{BASE_URL}/api/cart/add", 
            headers={"Authorization": f"Bearer {user_token}"},
            json={"product_id": product_id, "quantity": 2}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✓ Product added to cart: {product_id}")
        
        # Verify cart has item
        cart_response = requests.get(f"{BASE_URL}/api/cart", headers={
            "Authorization": f"Bearer {user_token}"
        })
        cart = cart_response.json()
        assert len(cart["items"]) > 0
        
        # Find the added item
        added_item = next((item for item in cart["items"] if item["product_id"] == product_id), None)
        assert added_item is not None, "Item not found in cart"
        assert added_item["quantity"] >= 2
        print(f"✓ Cart verified: item quantity = {added_item['quantity']}")
    
    def test_update_cart_quantity(self, user_token):
        """Test PUT /api/cart/update"""
        # First add an item
        prod_response = requests.get(f"{BASE_URL}/api/products?limit=1")
        product_id = prod_response.json()["products"][0]["id"]
        
        requests.post(f"{BASE_URL}/api/cart/add", 
            headers={"Authorization": f"Bearer {user_token}"},
            json={"product_id": product_id, "quantity": 1}
        )
        
        # Update quantity
        response = requests.put(f"{BASE_URL}/api/cart/update",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"product_id": product_id, "quantity": 5}
        )
        assert response.status_code == 200
        
        # Verify update
        cart_response = requests.get(f"{BASE_URL}/api/cart", headers={
            "Authorization": f"Bearer {user_token}"
        })
        cart = cart_response.json()
        item = next((i for i in cart["items"] if i["product_id"] == product_id), None)
        assert item["quantity"] == 5
        print(f"✓ Cart quantity updated to {item['quantity']}")
    
    def test_remove_from_cart(self, user_token):
        """Test DELETE /api/cart/item/{product_id}"""
        # Add item first
        prod_response = requests.get(f"{BASE_URL}/api/products?limit=1")
        product_id = prod_response.json()["products"][0]["id"]
        
        requests.post(f"{BASE_URL}/api/cart/add", 
            headers={"Authorization": f"Bearer {user_token}"},
            json={"product_id": product_id, "quantity": 1}
        )
        
        # Remove item
        response = requests.delete(f"{BASE_URL}/api/cart/item/{product_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        # Verify removal
        cart_response = requests.get(f"{BASE_URL}/api/cart", headers={
            "Authorization": f"Bearer {user_token}"
        })
        cart = cart_response.json()
        item = next((i for i in cart["items"] if i["product_id"] == product_id), None)
        assert item is None, "Item should be removed from cart"
        print("✓ Item removed from cart")


class TestOrders:
    """Order endpoint tests"""
    
    @pytest.fixture
    def user_token(self):
        """Get user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@test.com",
            "password": "user123"
        })
        return response.json()["token"]
    
    def test_get_orders_requires_auth(self):
        """Test GET /api/orders requires authentication"""
        response = requests.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 401
        print("✓ Orders require authentication")
    
    def test_get_orders_with_auth(self, user_token):
        """Test GET /api/orders with authentication"""
        response = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {user_token}"
        })
        assert response.status_code == 200
        
        orders = response.json()
        assert isinstance(orders, list)
        print(f"✓ Orders retrieved: {len(orders)} orders")
    
    def test_checkout_requires_cart(self, user_token):
        """Test checkout requires items in cart"""
        # Clear cart first
        requests.delete(f"{BASE_URL}/api/cart/clear", headers={
            "Authorization": f"Bearer {user_token}"
        })
        
        # Try checkout with empty cart
        response = requests.post(f"{BASE_URL}/api/orders/checkout",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "address": {
                    "label": "Home",
                    "address_line": "123 Test St",
                    "city": "Test City",
                    "state": "TS",
                    "pincode": "12345",
                    "phone": "+1234567890"
                },
                "origin_url": BASE_URL
            }
        )
        assert response.status_code == 400
        assert "empty" in response.json()["detail"].lower()
        print("✓ Empty cart checkout blocked correctly")


class TestAdmin:
    """Admin endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@delivery.com",
            "password": "admin123"
        })
        return response.json()["token"]
    
    @pytest.fixture
    def user_token(self):
        """Get user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@test.com",
            "password": "user123"
        })
        return response.json()["token"]
    
    def test_admin_dashboard_requires_admin(self, user_token):
        """Test admin dashboard requires admin role"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers={
            "Authorization": f"Bearer {user_token}"
        })
        assert response.status_code == 403
        print("✓ Admin dashboard blocked for non-admin users")
    
    def test_admin_dashboard_with_admin(self, admin_token):
        """Test GET /api/admin/dashboard with admin token"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["total_orders", "total_users", "total_products", "total_revenue", 
                          "pending_orders", "confirmed_orders", "delivered_orders", "recent_orders"]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        assert data["total_products"] == 21
        assert isinstance(data["recent_orders"], list)
        print(f"✓ Admin dashboard: {data['total_orders']} orders, ${data['total_revenue']} revenue")
    
    def test_admin_get_users(self, admin_token):
        """Test GET /api/admin/users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        
        users = response.json()
        assert isinstance(users, list)
        
        # Verify no password_hash in response
        for user in users:
            assert "password_hash" not in user
            assert user["role"] == "user"
        
        print(f"✓ Admin users list: {len(users)} users")


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup():
    """Cleanup test data after all tests"""
    yield
    # Clear test user's cart
    try:
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@test.com",
            "password": "user123"
        })
        token = login_response.json()["token"]
        requests.delete(f"{BASE_URL}/api/cart/clear", headers={
            "Authorization": f"Bearer {token}"
        })
        print("\n✓ Test cleanup completed")
    except:
        pass
