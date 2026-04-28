from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
import asyncio
import ssl
import httpx

try:
    import certifi
except ImportError:
    certifi = None

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']

# Determine if TLS is needed based on the connection string
use_tls = 'mongodb+srv' in mongo_url or 'tls=true' in mongo_url.lower() or 'ssl=true' in mongo_url.lower()

if use_tls:
    ca_file = certifi.where() if certifi else ssl.get_default_verify_paths().cafile
    client = AsyncIOMotorClient(
        mongo_url,
        tls=True,
        tlsCAFile=ca_file,
        serverSelectionTimeoutMS=int(os.environ.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', '10000')),
        connectTimeoutMS=int(os.environ.get('MONGO_CONNECT_TIMEOUT_MS', '10000')),
        socketTimeoutMS=int(os.environ.get('MONGO_SOCKET_TIMEOUT_MS', '10000')),
    )
else:
    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=int(os.environ.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', '10000')),
        connectTimeoutMS=int(os.environ.get('MONGO_CONNECT_TIMEOUT_MS', '10000')),
        socketTimeoutMS=int(os.environ.get('MONGO_SOCKET_TIMEOUT_MS', '10000')),
    )
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'delivery-app-secret')
JWT_ALGORITHM = 'HS256'
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---- Pydantic Models ----

class UserRegister(BaseModel):
    name: str
    email: str
    phone: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class AddressModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str = "Home"
    address_line: str
    city: str
    state: str
    pincode: str
    phone: str

class CategoryCreate(BaseModel):
    name: str
    description: str = ""
    image: str = ""
    icon: str = ""
    order: int = 0

class ProductCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    category_id: str
    image: str = ""
    unit: str = "piece"
    stock: int = 100
    weight: str = ""

class CartItem(BaseModel):
    product_id: str
    quantity: int = 1

class CartUpdate(BaseModel):
    product_id: str
    quantity: int

class OrderCreate(BaseModel):
    address: AddressModel
    origin_url: str
    payment_method: str = "card"  # "card" or "cod" (Cash on Delivery)

class OrderStatusUpdate(BaseModel):
    status: str

class PushTokenRegister(BaseModel):
    token: str
    device_name: str = ""

# ---- Push Notification Helper ----

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def send_push_to_admins(title: str, body: str, data: dict = None):
    """Send push notification to all admin users who have registered push tokens."""
    try:
        admin_tokens = await db.push_tokens.find({'role': 'admin'}, {'_id': 0}).to_list(100)
        if not admin_tokens:
            logger.info("No admin push tokens found, skipping notification")
            return

        messages = []
        for token_doc in admin_tokens:
            token = token_doc.get('token', '')
            if token and token.startswith('ExponentPushToken'):
                message = {
                    "to": token,
                    "sound": "default",
                    "title": title,
                    "body": body,
                    "priority": "high",
                }
                if data:
                    message["data"] = data
                messages.append(message)

        if not messages:
            logger.info("No valid Expo push tokens found")
            return

        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )
            logger.info(f"Push notification sent: {response.status_code} - {response.text[:200]}")
    except Exception as e:
        logger.error(f"Push notification error: {e}")

# ---- Auth Helpers ----

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Not authenticated')
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({'id': payload['user_id']}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

async def get_admin_user(request: Request):
    user = await get_current_user(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    return user

# ---- Auth Routes ----

@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({'email': data.email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    user = {
        'id': str(uuid.uuid4()),
        'name': data.name,
        'email': data.email,
        'phone': data.phone,
        'password_hash': hash_password(data.password),
        'role': 'user',
        'addresses': [],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user['id'], user['role'])
    return {
        'token': token,
        'user': {'id': user['id'], 'name': user['name'], 'email': user['email'], 'phone': user['phone'], 'role': user['role']}
    }

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({'email': data.email}, {'_id': 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    token = create_token(user['id'], user['role'])
    return {
        'token': token,
        'user': {'id': user['id'], 'name': user['name'], 'email': user['email'], 'phone': user['phone'], 'role': user['role']}
    }

@api_router.get("/auth/profile")
async def get_profile(user=Depends(get_current_user)):
    return {
        'id': user['id'], 'name': user['name'], 'email': user['email'],
        'phone': user['phone'], 'role': user['role'], 'addresses': user.get('addresses', [])
    }

@api_router.post("/auth/address")
async def add_address(address: AddressModel, user=Depends(get_current_user)):
    addr_dict = address.dict()
    # Generate unique ID for the address if not provided
    if not addr_dict.get('id'):
        addr_dict['id'] = str(uuid.uuid4())
    await db.users.update_one({'id': user['id']}, {'$push': {'addresses': addr_dict}})
    return {'message': 'Address added', 'address': addr_dict}

@api_router.put("/auth/address/{address_id}")
async def update_address(address_id: str, address: AddressModel, user=Depends(get_current_user)):
    addr_dict = address.dict()
    addr_dict['id'] = address_id
    result = await db.users.update_one(
        {'id': user['id'], 'addresses.id': address_id},
        {'$set': {'addresses.$': addr_dict}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Address not found')
    return {'message': 'Address updated', 'address': addr_dict}

@api_router.delete("/auth/address/{address_id}")
async def delete_address(address_id: str, user=Depends(get_current_user)):
    await db.users.update_one(
        {'id': user['id']},
        {'$pull': {'addresses': {'id': address_id}}}
    )
    return {'message': 'Address deleted'}

# ---- Push Notification Token Routes ----

@api_router.post("/auth/push-token")
async def register_push_token(data: PushTokenRegister, user=Depends(get_current_user)):
    """Register an Expo push token for the current user."""
    if not data.token:
        raise HTTPException(status_code=400, detail='Push token is required')

    # Upsert: update if token exists, otherwise insert
    await db.push_tokens.update_one(
        {'token': data.token},
        {'$set': {
            'token': data.token,
            'user_id': user['id'],
            'role': user['role'],
            'device_name': data.device_name,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    logger.info(f"Push token registered for user {user['id']} (role: {user['role']})")
    return {'message': 'Push token registered'}

@api_router.delete("/auth/push-token")
async def remove_push_token(data: PushTokenRegister, user=Depends(get_current_user)):
    """Remove a push token (e.g., on logout)."""
    await db.push_tokens.delete_one({'token': data.token, 'user_id': user['id']})
    return {'message': 'Push token removed'}

# ---- Coupon Routes ----

class CouponCreate(BaseModel):
    code: str
    discount_type: str = "percentage"  # percentage or flat
    discount_value: float = 10
    min_order: float = 0
    max_discount: float = 0
    is_active: bool = True

class CouponApply(BaseModel):
    code: str
    cart_total: float

@api_router.get("/coupons")
async def get_coupons():
    coupons = await db.coupons.find({'is_active': True}, {'_id': 0}).to_list(50)
    return coupons

@api_router.post("/coupons")
async def create_coupon(data: CouponCreate, user=Depends(get_admin_user)):
    existing = await db.coupons.find_one({'code': data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail='Coupon code already exists')
    coupon = {
        'id': str(uuid.uuid4()), 'code': data.code.upper(),
        'discount_type': data.discount_type, 'discount_value': data.discount_value,
        'min_order': data.min_order, 'max_discount': data.max_discount,
        'is_active': data.is_active, 'usage_count': 0,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.coupons.insert_one(coupon)
    return {k: v for k, v in coupon.items() if k != '_id'}

@api_router.post("/coupons/apply")
async def apply_coupon(data: CouponApply, user=Depends(get_current_user)):
    coupon = await db.coupons.find_one({'code': data.code.upper(), 'is_active': True}, {'_id': 0})
    if not coupon:
        raise HTTPException(status_code=404, detail='Invalid or expired coupon')
    if data.cart_total < coupon.get('min_order', 0):
        raise HTTPException(status_code=400, detail=f"Minimum order ₹{coupon['min_order']} required")
    if coupon['discount_type'] == 'percentage':
        discount = round(data.cart_total * coupon['discount_value'] / 100, 2)
        if coupon.get('max_discount') and coupon['max_discount'] > 0:
            discount = min(discount, coupon['max_discount'])
    else:
        discount = coupon['discount_value']
    discount = min(discount, data.cart_total)
    return {
        'coupon': coupon, 'discount': round(discount, 2),
        'final_total': round(data.cart_total - discount, 2)
    }

@api_router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, user=Depends(get_admin_user)):
    await db.coupons.update_one({'id': coupon_id}, {'$set': {'is_active': False}})
    return {'message': 'Coupon deleted'}

# ---- Category Routes ----

@api_router.get("/categories")
async def get_categories():
    categories = await db.categories.find({'is_active': True}, {'_id': 0}).sort('order', 1).to_list(100)
    return categories

@api_router.post("/categories")
async def create_category(data: CategoryCreate, user=Depends(get_admin_user)):
    category = {
        'id': str(uuid.uuid4()), **data.dict(),
        'is_active': True, 'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.categories.insert_one(category)
    return {k: v for k, v in category.items() if k != '_id'}

@api_router.put("/categories/{category_id}")
async def update_category(category_id: str, data: CategoryCreate, user=Depends(get_admin_user)):
    result = await db.categories.update_one({'id': category_id}, {'$set': data.dict()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Category not found')
    return {'message': 'Category updated'}

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, user=Depends(get_admin_user)):
    await db.categories.update_one({'id': category_id}, {'$set': {'is_active': False}})
    return {'message': 'Category deleted'}

# ---- Product Routes ----

@api_router.get("/products")
async def get_products(category_id: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 20):
    query: Dict = {'is_active': True}
    if category_id:
        query['category_id'] = category_id
    if search:
        query['name'] = {'$regex': search, '$options': 'i'}
    skip = (page - 1) * limit
    total = await db.products.count_documents(query)
    products = await db.products.find(query, {'_id': 0}).skip(skip).limit(limit).to_list(limit)
    return {'products': products, 'total': total, 'page': page, 'pages': max(1, (total + limit - 1) // limit)}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({'id': product_id, 'is_active': True}, {'_id': 0})
    if not product:
        raise HTTPException(status_code=404, detail='Product not found')
    return product

@api_router.post("/products")
async def create_product(data: ProductCreate, user=Depends(get_admin_user)):
    product = {
        'id': str(uuid.uuid4()), **data.dict(),
        'is_active': True, 'rating': 4.0, 'review_count': 0,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.products.insert_one(product)
    return {k: v for k, v in product.items() if k != '_id'}

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductCreate, user=Depends(get_admin_user)):
    result = await db.products.update_one({'id': product_id}, {'$set': data.dict()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Product not found')
    return {'message': 'Product updated'}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_admin_user)):
    await db.products.update_one({'id': product_id}, {'$set': {'is_active': False}})
    return {'message': 'Product deleted'}

# ---- Cart Routes ----

@api_router.get("/cart")
async def get_cart(user=Depends(get_current_user)):
    cart = await db.carts.find_one({'user_id': user['id']}, {'_id': 0})
    if not cart or not cart.get('items'):
        return {'items': [], 'total': 0.0}
    populated_items = []
    total = 0.0
    for item in cart.get('items', []):
        product = await db.products.find_one({'id': item['product_id']}, {'_id': 0})
        if product:
            populated_items.append({
                'product_id': item['product_id'], 'quantity': item['quantity'], 'product': product
            })
            total += product['price'] * item['quantity']
    return {'items': populated_items, 'total': round(total, 2)}

@api_router.post("/cart/add")
async def add_to_cart(item: CartItem, user=Depends(get_current_user)):
    cart = await db.carts.find_one({'user_id': user['id']})
    if not cart:
        await db.carts.insert_one({
            'id': str(uuid.uuid4()), 'user_id': user['id'],
            'items': [item.dict()], 'updated_at': datetime.now(timezone.utc).isoformat()
        })
    else:
        existing = next((i for i in cart['items'] if i['product_id'] == item.product_id), None)
        if existing:
            await db.carts.update_one(
                {'user_id': user['id'], 'items.product_id': item.product_id},
                {'$set': {'items.$.quantity': existing['quantity'] + item.quantity, 'updated_at': datetime.now(timezone.utc).isoformat()}}
            )
        else:
            await db.carts.update_one(
                {'user_id': user['id']},
                {'$push': {'items': item.dict()}, '$set': {'updated_at': datetime.now(timezone.utc).isoformat()}}
            )
    return {'message': 'Item added to cart'}

@api_router.put("/cart/update")
async def update_cart_item(item: CartUpdate, user=Depends(get_current_user)):
    if item.quantity <= 0:
        await db.carts.update_one({'user_id': user['id']}, {'$pull': {'items': {'product_id': item.product_id}}})
    else:
        await db.carts.update_one(
            {'user_id': user['id'], 'items.product_id': item.product_id},
            {'$set': {'items.$.quantity': item.quantity, 'updated_at': datetime.now(timezone.utc).isoformat()}}
        )
    return {'message': 'Cart updated'}

@api_router.delete("/cart/item/{product_id}")
async def remove_from_cart(product_id: str, user=Depends(get_current_user)):
    await db.carts.update_one({'user_id': user['id']}, {'$pull': {'items': {'product_id': product_id}}})
    return {'message': 'Item removed'}

@api_router.delete("/cart/clear")
async def clear_cart(user=Depends(get_current_user)):
    await db.carts.delete_one({'user_id': user['id']})
    return {'message': 'Cart cleared'}

# ---- Order Routes ----

@api_router.post("/orders/checkout")
async def create_order(data: OrderCreate, request: Request, user=Depends(get_current_user)):
    cart = await db.carts.find_one({'user_id': user['id']}, {'_id': 0})
    if not cart or not cart.get('items'):
        raise HTTPException(status_code=400, detail='Cart is empty')

    order_items = []
    total = 0.0
    for item in cart['items']:
        product = await db.products.find_one({'id': item['product_id']}, {'_id': 0})
        if product:
            order_items.append({
                'product_id': item['product_id'], 'name': product['name'],
                'price': product['price'], 'quantity': item['quantity'],
                'image': product.get('image', '')
            })
            total += product['price'] * item['quantity']
    total = round(total, 2)

    order_id = str(uuid.uuid4())
    payment_method = data.payment_method or "card"
    
    # Handle Cash on Delivery (COD)
    if payment_method == "cod":
        order = {
            'id': order_id, 'user_id': user['id'], 'user_name': user['name'],
            'user_email': user['email'], 'items': order_items, 'total': total,
            'status': 'confirmed', 'payment_status': 'cod',
            'payment_method': 'cod',
            'address': data.address.dict(),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        await db.orders.insert_one(order)
        
        # Clear cart
        await db.carts.delete_one({'user_id': user['id']})
        
        # Send push notification to admins about new COD order
        item_count = sum(item['quantity'] for item in order_items)
        asyncio.create_task(send_push_to_admins(
            title="🛒 New COD Order!",
            body=f"{user['name']} placed a COD order for ₹{total:.2f} ({item_count} items)",
            data={"order_id": order_id, "type": "new_order"}
        ))
        
        return {'order_id': order_id, 'checkout_url': None, 'session_id': None, 'payment_method': 'cod'}
    
    # Card payment - use simulated payment page
    order = {
        'id': order_id, 'user_id': user['id'], 'user_name': user['name'],
        'user_email': user['email'], 'items': order_items, 'total': total,
        'status': 'pending', 'payment_status': 'pending',
        'payment_method': 'card',
        'address': data.address.dict(),
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)

    # Simulated Stripe checkout
    origin_url = data.origin_url.rstrip('/')
    success_url = f"{origin_url}/checkout?session_id={{CHECKOUT_SESSION_ID}}&status=success&order_id={order_id}"
    cancel_url = f"{origin_url}/checkout?status=cancel&order_id={order_id}"

    # Use the origin_url as base_url for simulated payment page
    host_url = origin_url + "/"
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    checkout_request = CheckoutSessionRequest(
        amount=float(total), currency='inr',
        success_url=success_url, cancel_url=cancel_url,
        metadata={'order_id': order_id, 'user_id': user['id']},
        base_url=host_url
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    await db.orders.update_one({'id': order_id}, {'$set': {'stripe_session_id': session.session_id}})

    # Payment transaction record
    await db.payment_transactions.insert_one({
        'id': str(uuid.uuid4()), 'user_id': user['id'], 'order_id': order_id,
        'session_id': session.session_id, 'amount': float(total), 'currency': 'inr',
        'status': 'initiated', 'payment_status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    })

    # Clear cart
    await db.carts.delete_one({'user_id': user['id']})

    # Send push notification to admins about new order
    item_count = sum(item['quantity'] for item in order_items)
    asyncio.create_task(send_push_to_admins(
        title="🛒 New Order Received!",
        body=f"{user['name']} placed an order for ₹{total:.2f} ({item_count} items)",
        data={"order_id": order_id, "type": "new_order"}
    ))

    return {'order_id': order_id, 'checkout_url': session.url, 'session_id': session.session_id, 'payment_method': 'card'}

@api_router.get("/orders")
async def get_orders(user=Depends(get_current_user)):
    if user['role'] == 'admin':
        orders = await db.orders.find({}, {'_id': 0}).sort('created_at', -1).to_list(200)
    else:
        orders = await db.orders.find({'user_id': user['id']}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    order = await db.orders.find_one({'id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail='Order not found')
    if user['role'] != 'admin' and order['user_id'] != user['id']:
        raise HTTPException(status_code=403, detail='Not authorized')
    return order

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, data: OrderStatusUpdate, user=Depends(get_admin_user)):
    result = await db.orders.update_one(
        {'id': order_id},
        {'$set': {'status': data.status, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Order not found')
    return {'message': 'Order status updated'}

# ---- Payment Routes ----

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    checkout_status = await stripe_checkout.get_checkout_status(session_id)

    transaction = await db.payment_transactions.find_one({'session_id': session_id}, {'_id': 0})
    if transaction and transaction.get('payment_status') != 'paid':
        new_status = 'completed' if checkout_status.payment_status == 'paid' else checkout_status.status
        await db.payment_transactions.update_one(
            {'session_id': session_id},
            {'$set': {'status': new_status, 'payment_status': checkout_status.payment_status,
                      'updated_at': datetime.now(timezone.utc).isoformat()}}
        )
        if checkout_status.payment_status == 'paid':
            order_id = transaction.get('order_id')
            if order_id:
                await db.orders.update_one(
                    {'id': order_id},
                    {'$set': {'payment_status': 'paid', 'status': 'confirmed',
                              'updated_at': datetime.now(timezone.utc).isoformat()}}
                )
                # Notify admins about payment confirmation
                order = await db.orders.find_one({'id': order_id}, {'_id': 0})
                if order:
                    asyncio.create_task(send_push_to_admins(
                        title="💰 Payment Confirmed!",
                        body=f"Order #{order_id[:8]} by {order.get('user_name', 'Customer')} - ₹{order.get('total', 0):.2f} paid",
                        data={"order_id": order_id, "type": "payment_confirmed"}
                    ))

    return {
        'status': checkout_status.status, 'payment_status': checkout_status.payment_status,
        'amount_total': checkout_status.amount_total, 'currency': checkout_status.currency,
        'metadata': checkout_status.metadata
    }

@api_router.get("/payments/callback")
async def payment_callback(session_id: str = "", status: str = ""):
    return HTMLResponse(f"""
    <html><head><title>Payment {status}</title></head>
    <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
    <div style="text-align:center"><h1>{'Payment Successful!' if status == 'success' else 'Payment Cancelled'}</h1>
    <p>You can close this window now.</p></div></body></html>
    """)

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    try:
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        if webhook_response.payment_status == 'paid':
            session_id = webhook_response.session_id
            transaction = await db.payment_transactions.find_one({'session_id': session_id}, {'_id': 0})
            if transaction and transaction.get('payment_status') != 'paid':
                await db.payment_transactions.update_one(
                    {'session_id': session_id},
                    {'$set': {'status': 'completed', 'payment_status': 'paid',
                              'updated_at': datetime.now(timezone.utc).isoformat()}}
                )
                order_id = transaction.get('order_id')
                if order_id:
                    await db.orders.update_one(
                        {'id': order_id},
                        {'$set': {'payment_status': 'paid', 'status': 'confirmed',
                                  'updated_at': datetime.now(timezone.utc).isoformat()}}
                    )
        return {'status': 'ok'}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {'status': 'error', 'message': str(e)}

# ---- Simulated Payment Page ----

@api_router.get("/payment/simulate/{session_id}")
async def simulated_payment_page(session_id: str, request: Request):
    """Serve a simulated payment page for testing checkout flow."""
    from emergentintegrations.payments.stripe.checkout import _sessions_storage
    
    session = _sessions_storage.get(session_id, {})
    if not session:
        return HTMLResponse("""
        <html><head><title>Session Not Found</title></head>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f5;">
        <div style="text-align:center;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
            <h1 style="color:#dc3545;margin-bottom:16px;">Session Not Found</h1>
            <p style="color:#666;">This payment session has expired or is invalid.</p>
        </div></body></html>
        """, status_code=404)
    
    amount = session.get('amount_total', 0)
    currency = session.get('currency', 'inr').upper()
    order_id = session.get('metadata', {}).get('order_id', 'N/A')
    success_url = session.get('success_url', '').replace('{CHECKOUT_SESSION_ID}', session_id)
    cancel_url = session.get('cancel_url', '')
    
    # Use the stored base_url from session (the origin URL from the frontend)
    # This ensures the URL works correctly on all devices
    base_url = session.get('base_url', '').rstrip('/')
    if not base_url:
        # Fallback: try to get from request
        base_url = str(request.base_url).rstrip('/')
    
    # Use the base_url stored in session for pay action (ensure proper slash)
    pay_action = f"{base_url}/api/payment/simulate/{session_id}/complete"
    
    logger.info(f"Simulated payment page for session {session_id}")
    logger.info(f"Base URL from session: {session.get('base_url')}")
    logger.info(f"Pay action URL: {pay_action}")
    
    return HTMLResponse(f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Secure Payment - Test Mode</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * {{ box-sizing: border-box; margin: 0; padding: 0; }}
            body {{ 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }}
            .card {{
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                width: 100%;
                max-width: 420px;
                overflow: hidden;
            }}
            .header {{
                background: linear-gradient(135deg, #2d3436 0%, #000000 100%);
                color: white;
                padding: 24px;
                text-align: center;
            }}
            .header .test-badge {{
                background: #ffc107;
                color: #000;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                display: inline-block;
                margin-bottom: 12px;
            }}
            .header h1 {{ font-size: 20px; font-weight: 600; }}
            .header .amount {{ 
                font-size: 36px; 
                font-weight: 700; 
                margin-top: 12px;
            }}
            .header .order-id {{ 
                font-size: 13px; 
                opacity: 0.7; 
                margin-top: 8px;
            }}
            .content {{ padding: 24px; }}
            .card-preview {{
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                border-radius: 12px;
                padding: 20px;
                color: white;
                margin-bottom: 24px;
                position: relative;
                overflow: hidden;
            }}
            .card-preview::before {{
                content: '';
                position: absolute;
                top: -50%;
                right: -50%;
                width: 100%;
                height: 100%;
                background: rgba(255,255,255,0.1);
                border-radius: 50%;
            }}
            .card-number {{ font-size: 18px; letter-spacing: 3px; margin-bottom: 16px; }}
            .card-details {{ display: flex; justify-content: space-between; font-size: 12px; }}
            .form-group {{ margin-bottom: 20px; }}
            .form-group label {{ 
                display: block; 
                font-size: 13px; 
                font-weight: 600; 
                color: #555;
                margin-bottom: 8px;
            }}
            .form-group input {{
                width: 100%;
                padding: 14px 16px;
                border: 2px solid #e0e0e0;
                border-radius: 10px;
                font-size: 16px;
                transition: border-color 0.2s;
                background: #f9f9f9;
            }}
            .form-row {{ display: flex; gap: 16px; }}
            .form-row .form-group {{ flex: 1; }}
            .btn {{
                width: 100%;
                padding: 16px;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                margin-bottom: 12px;
                text-decoration: none;
                display: block;
                text-align: center;
            }}
            .btn-pay {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }}
            .btn-pay:hover {{ transform: translateY(-2px); box-shadow: 0 6px 20px rgba(102,126,234,0.4); }}
            .btn-cancel {{
                background: #f5f5f5;
                color: #666;
            }}
            .btn-cancel:hover {{ background: #e0e0e0; }}
            .secure-badge {{
                text-align: center;
                color: #888;
                font-size: 12px;
                margin-top: 16px;
            }}
            .secure-badge svg {{ vertical-align: middle; margin-right: 4px; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <span class="test-badge">⚠️ TEST MODE</span>
                <h1>Complete Your Payment</h1>
                <div class="amount">{currency} {amount:.2f}</div>
                <div class="order-id">Order: #{order_id[:8]}...</div>
            </div>
            <div class="content">
                <div class="card-preview">
                    <div class="card-number">4242 •••• •••• 4242</div>
                    <div class="card-details">
                        <span>TEST CARD</span>
                        <span>12/26</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Card Number (Pre-filled for testing)</label>
                    <input type="text" value="4242 4242 4242 4242" readonly>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Expiry</label>
                        <input type="text" value="12/26" readonly>
                    </div>
                    <div class="form-group">
                        <label>CVV</label>
                        <input type="text" value="123" readonly>
                    </div>
                </div>
                
                <button onclick="processPayment()" class="btn btn-pay" id="payBtn">
                    Pay {currency} {amount:.2f}
                </button>
                <button onclick="cancelPayment()" class="btn btn-cancel">
                    Cancel Payment
                </button>
                
                <div class="secure-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                    </svg>
                    Secured by Simulated Payment Gateway (Test Mode)
                </div>
            </div>
        </div>
        
        <script>
            function processPayment() {{
                var btn = document.getElementById('payBtn');
                btn.textContent = 'Processing...';
                btn.disabled = true;
                
                // Navigate to the payment completion URL
                // Using window.location.href for better cross-platform compatibility
                window.location.href = '{pay_action}';
            }}
            
            function cancelPayment() {{
                window.location.href = '{cancel_url}';
            }}
        </script>
    </body>
    </html>
    """)


@api_router.post("/payment/simulate/{session_id}/pay")
async def process_simulated_payment(session_id: str, request: Request):
    """Process simulated payment - marks session as paid and redirects."""
    from emergentintegrations.payments.stripe.checkout import _sessions_storage
    
    session = _sessions_storage.get(session_id)
    if not session:
        return {"success": False, "error": "Session not found"}
    
    # Mark session as paid
    _sessions_storage[session_id]["status"] = "complete"
    _sessions_storage[session_id]["payment_status"] = "paid"
    
    # Update database records
    transaction = await db.payment_transactions.find_one({'session_id': session_id}, {'_id': 0})
    if transaction:
        await db.payment_transactions.update_one(
            {'session_id': session_id},
            {'$set': {'status': 'completed', 'payment_status': 'paid',
                      'updated_at': datetime.now(timezone.utc).isoformat()}}
        )
        order_id = transaction.get('order_id')
        if order_id:
            await db.orders.update_one(
                {'id': order_id},
                {'$set': {'payment_status': 'paid', 'status': 'confirmed',
                          'updated_at': datetime.now(timezone.utc).isoformat()}}
            )
            # Send push notification
            order = await db.orders.find_one({'id': order_id}, {'_id': 0})
            if order:
                asyncio.create_task(send_push_to_admins(
                    title="💰 Payment Confirmed!",
                    body=f"Order #{order_id[:8]} by {order.get('user_name', 'Customer')} - ₹{order.get('total', 0):.2f} paid",
                    data={"order_id": order_id, "type": "payment_confirmed"}
                ))
    
    # Get success URL and replace placeholder
    success_url = session.get('success_url', '').replace('{CHECKOUT_SESSION_ID}', session_id)
    
    return {"success": True, "redirect_url": success_url}


@api_router.get("/payment/simulate/{session_id}/complete")
async def complete_simulated_payment(session_id: str, request: Request):
    """Complete simulated payment via GET - processes payment and redirects directly."""
    from emergentintegrations.payments.stripe.checkout import _sessions_storage
    from fastapi.responses import RedirectResponse
    
    logger.info(f"Payment complete request for session: {session_id}")
    logger.info(f"Available sessions: {list(_sessions_storage.keys())}")
    
    session = _sessions_storage.get(session_id)
    if not session:
        logger.error(f"Session {session_id} not found in storage")
        return HTMLResponse("""
        <html><head><title>Session Expired</title></head>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
        <div style="text-align:center"><h1>Session Expired</h1><p>This payment session has expired.</p></div></body></html>
        """, status_code=404)
    
    logger.info(f"Session found: {session}")
    
    # Mark session as paid
    _sessions_storage[session_id]["status"] = "complete"
    _sessions_storage[session_id]["payment_status"] = "paid"
    
    # Update database records
    transaction = await db.payment_transactions.find_one({'session_id': session_id}, {'_id': 0})
    if transaction:
        await db.payment_transactions.update_one(
            {'session_id': session_id},
            {'$set': {'status': 'completed', 'payment_status': 'paid',
                      'updated_at': datetime.now(timezone.utc).isoformat()}}
        )
        order_id = transaction.get('order_id')
        if order_id:
            await db.orders.update_one(
                {'id': order_id},
                {'$set': {'payment_status': 'paid', 'status': 'confirmed',
                          'updated_at': datetime.now(timezone.utc).isoformat()}}
            )
            # Send push notification
            order = await db.orders.find_one({'id': order_id}, {'_id': 0})
            if order:
                asyncio.create_task(send_push_to_admins(
                    title="💰 Payment Confirmed!",
                    body=f"Order #{order_id[:8]} by {order.get('user_name', 'Customer')} - ₹{order.get('total', 0):.2f} paid",
                    data={"order_id": order_id, "type": "payment_confirmed"}
                ))
    
    # Get success URL and replace placeholder
    success_url = session.get('success_url', '').replace('{CHECKOUT_SESSION_ID}', session_id)
    logger.info(f"Redirecting to success URL: {success_url}")
    
    # Redirect to success URL
    return RedirectResponse(url=success_url, status_code=302)


@api_router.post("/payment/simulate/{session_id}/cancel")
async def cancel_simulated_payment(session_id: str):
    """Cancel simulated payment."""
    from emergentintegrations.payments.stripe.checkout import _sessions_storage
    
    session = _sessions_storage.get(session_id)
    if not session:
        return {"success": False, "error": "Session not found"}
    
    _sessions_storage[session_id]["status"] = "cancelled"
    _sessions_storage[session_id]["payment_status"] = "cancelled"
    
    cancel_url = session.get('cancel_url', '')
    return {"success": True, "redirect_url": cancel_url}

# ---- Admin Routes ----

@api_router.get("/admin/dashboard")
async def admin_dashboard(user=Depends(get_admin_user)):
    total_orders = await db.orders.count_documents({})
    total_users = await db.users.count_documents({'role': 'user'})
    total_products = await db.products.count_documents({'is_active': True})
    pipeline = [{'$match': {'payment_status': 'paid'}}, {'$group': {'_id': None, 'total': {'$sum': '$total'}}}]
    rev = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = rev[0]['total'] if rev else 0
    recent_orders = await db.orders.find({}, {'_id': 0}).sort('created_at', -1).to_list(10)
    pending = await db.orders.count_documents({'status': 'pending'})
    confirmed = await db.orders.count_documents({'status': 'confirmed'})
    delivered = await db.orders.count_documents({'status': 'delivered'})
    return {
        'total_orders': total_orders, 'total_users': total_users,
        'total_products': total_products, 'total_revenue': round(total_revenue, 2),
        'pending_orders': pending, 'confirmed_orders': confirmed,
        'delivered_orders': delivered, 'recent_orders': recent_orders
    }

@api_router.get("/admin/users")
async def admin_users(user=Depends(get_admin_user)):
    users = await db.users.find({'role': 'user'}, {'_id': 0, 'password_hash': 0}).to_list(100)
    return users

# ---- Seed Data ----

async def seed_database():
    existing = await db.categories.count_documents({})
    if existing > 0:
        return False

    admin = {
        'id': str(uuid.uuid4()), 'name': 'Admin', 'email': 'admin@delivery.com',
        'phone': '+1234567890', 'password_hash': hash_password('admin123'),
        'role': 'admin', 'addresses': [], 'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin)

    test_user = {
        'id': str(uuid.uuid4()), 'name': 'John Doe', 'email': 'user@test.com',
        'phone': '+1987654321', 'password_hash': hash_password('user123'),
        'role': 'user',
        'addresses': [{'id': str(uuid.uuid4()), 'label': 'Home', 'address_line': '123 Main Street',
                       'city': 'New York', 'state': 'NY', 'pincode': '10001', 'phone': '+1987654321'}],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(test_user)

    categories = [
        {'id': str(uuid.uuid4()), 'name': 'Water & Beverages', 'description': 'Fresh water cans and bottles', 'icon': 'water', 'image': 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400', 'order': 1, 'is_active': True, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Fresh Meat', 'description': 'Premium chicken and mutton', 'icon': 'restaurant', 'image': 'https://images.pexels.com/photos/618775/pexels-photo-618775.jpeg?w=400', 'order': 2, 'is_active': True, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Fruits & Veggies', 'description': 'Farm fresh produce', 'icon': 'leaf', 'image': 'https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?w=400', 'order': 3, 'is_active': True, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Grocery', 'description': 'Daily essentials and staples', 'icon': 'cart', 'image': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', 'order': 4, 'is_active': True, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Kids Products', 'description': 'Everything for your little ones', 'icon': 'happy', 'image': 'https://images.pexels.com/photos/5435599/pexels-photo-5435599.jpeg?w=400', 'order': 5, 'is_active': True, 'created_at': datetime.now(timezone.utc).isoformat()},
    ]
    await db.categories.insert_many(categories)

    products = []
    # Water & Beverages
    cid = categories[0]['id']
    products.extend([
        {'id': str(uuid.uuid4()), 'name': '20L Water Can', 'description': 'Pure filtered drinking water, sourced from natural springs', 'price': 2.99, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400', 'unit': 'can', 'stock': 50, 'weight': '20L', 'is_active': True, 'rating': 4.5, 'review_count': 128, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Water Bottle Pack (12x1L)', 'description': 'Premium spring water, pack of 12', 'price': 5.99, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1564419320461-6262bf721b72?w=400', 'unit': 'pack', 'stock': 100, 'weight': '12L', 'is_active': True, 'rating': 4.3, 'review_count': 85, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Sparkling Water (6pk)', 'description': 'Naturally carbonated mineral water', 'price': 4.49, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1632243575963-3143700087ed?w=400', 'unit': 'pack', 'stock': 75, 'weight': '3L', 'is_active': True, 'rating': 4.1, 'review_count': 42, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': '5L Water Jar', 'description': 'Convenient home water jar', 'price': 1.49, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400', 'unit': 'jar', 'stock': 60, 'weight': '5L', 'is_active': True, 'rating': 4.6, 'review_count': 200, 'created_at': datetime.now(timezone.utc).isoformat()},
    ])
    # Fresh Meat
    cid = categories[1]['id']
    products.extend([
        {'id': str(uuid.uuid4()), 'name': 'Chicken Breast (Boneless)', 'description': 'Fresh boneless chicken breast, hormone-free', 'price': 8.99, 'category_id': cid, 'image': 'https://images.pexels.com/photos/616354/pexels-photo-616354.jpeg?w=400', 'unit': 'kg', 'stock': 30, 'weight': '1kg', 'is_active': True, 'rating': 4.7, 'review_count': 230, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Whole Chicken', 'description': 'Farm-raised whole chicken', 'price': 6.99, 'category_id': cid, 'image': 'https://images.pexels.com/photos/618775/pexels-photo-618775.jpeg?w=400', 'unit': 'piece', 'stock': 25, 'weight': '1.5kg', 'is_active': True, 'rating': 4.5, 'review_count': 156, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Mutton Curry Cut', 'description': 'Premium goat meat cut for curry', 'price': 14.99, 'category_id': cid, 'image': 'https://images.pexels.com/photos/3535383/pexels-photo-3535383.jpeg?w=400', 'unit': 'kg', 'stock': 20, 'weight': '500g', 'is_active': True, 'rating': 4.8, 'review_count': 98, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Chicken Wings', 'description': 'Fresh chicken wings, perfect for grilling', 'price': 5.99, 'category_id': cid, 'image': 'https://images.pexels.com/photos/616354/pexels-photo-616354.jpeg?w=400', 'unit': 'kg', 'stock': 40, 'weight': '500g', 'is_active': True, 'rating': 4.4, 'review_count': 67, 'created_at': datetime.now(timezone.utc).isoformat()},
    ])
    # Fruits & Veggies
    cid = categories[2]['id']
    products.extend([
        {'id': str(uuid.uuid4()), 'name': 'Fresh Tomatoes', 'description': 'Vine-ripened organic tomatoes', 'price': 2.49, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=400', 'unit': 'kg', 'stock': 100, 'weight': '1kg', 'is_active': True, 'rating': 4.3, 'review_count': 89, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Bananas (Bunch)', 'description': 'Sweet ripe bananas, naturally grown', 'price': 1.99, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400', 'unit': 'bunch', 'stock': 80, 'weight': '6pcs', 'is_active': True, 'rating': 4.6, 'review_count': 210, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Fresh Spinach', 'description': 'Organic baby spinach leaves', 'price': 3.49, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400', 'unit': 'pack', 'stock': 60, 'weight': '250g', 'is_active': True, 'rating': 4.2, 'review_count': 55, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Red Apples', 'description': 'Crisp Washington apples', 'price': 4.99, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400', 'unit': 'kg', 'stock': 70, 'weight': '1kg', 'is_active': True, 'rating': 4.5, 'review_count': 134, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Onions', 'description': 'Fresh cooking onions', 'price': 1.29, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400', 'unit': 'kg', 'stock': 150, 'weight': '1kg', 'is_active': True, 'rating': 4.0, 'review_count': 45, 'created_at': datetime.now(timezone.utc).isoformat()},
    ])
    # Grocery
    cid = categories[3]['id']
    products.extend([
        {'id': str(uuid.uuid4()), 'name': 'Basmati Rice (5kg)', 'description': 'Premium aged basmati rice', 'price': 12.99, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', 'unit': 'bag', 'stock': 40, 'weight': '5kg', 'is_active': True, 'rating': 4.8, 'review_count': 320, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Extra Virgin Olive Oil', 'description': 'Cold-pressed Italian olive oil', 'price': 9.99, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', 'unit': 'bottle', 'stock': 50, 'weight': '1L', 'is_active': True, 'rating': 4.6, 'review_count': 178, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Whole Wheat Bread', 'description': 'Freshly baked whole wheat loaf', 'price': 3.49, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', 'unit': 'loaf', 'stock': 60, 'weight': '400g', 'is_active': True, 'rating': 4.4, 'review_count': 92, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Full Cream Milk', 'description': 'Fresh pasteurized whole milk', 'price': 2.99, 'category_id': cid, 'image': 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400', 'unit': 'carton', 'stock': 80, 'weight': '1L', 'is_active': True, 'rating': 4.5, 'review_count': 256, 'created_at': datetime.now(timezone.utc).isoformat()},
    ])
    # Kids Products
    cid = categories[4]['id']
    products.extend([
        {'id': str(uuid.uuid4()), 'name': 'Baby Diapers (40pk)', 'description': 'Ultra-soft absorbent diapers', 'price': 15.99, 'category_id': cid, 'image': 'https://images.pexels.com/photos/3661263/pexels-photo-3661263.jpeg?w=400', 'unit': 'pack', 'stock': 45, 'weight': 'Medium', 'is_active': True, 'rating': 4.7, 'review_count': 412, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Baby Wipes (80ct)', 'description': 'Gentle alcohol-free baby wipes', 'price': 4.99, 'category_id': cid, 'image': 'https://images.pexels.com/photos/3661263/pexels-photo-3661263.jpeg?w=400', 'unit': 'pack', 'stock': 100, 'weight': '80pcs', 'is_active': True, 'rating': 4.5, 'review_count': 189, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Baby Cereal', 'description': 'Organic baby cereal for 6+ months', 'price': 6.49, 'category_id': cid, 'image': 'https://images.pexels.com/photos/5435599/pexels-photo-5435599.jpeg?w=400', 'unit': 'box', 'stock': 55, 'weight': '300g', 'is_active': True, 'rating': 4.6, 'review_count': 134, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'name': 'Kids Toothpaste', 'description': 'Fluoride-free fruity toothpaste', 'price': 3.99, 'category_id': cid, 'image': 'https://images.pexels.com/photos/5435599/pexels-photo-5435599.jpeg?w=400', 'unit': 'tube', 'stock': 70, 'weight': '75g', 'is_active': True, 'rating': 4.3, 'review_count': 76, 'created_at': datetime.now(timezone.utc).isoformat()},
    ])
    await db.products.insert_many(products)

    # Indexes
    await db.users.create_index('email', unique=True)
    await db.users.create_index('id', unique=True)
    await db.products.create_index('category_id')
    await db.products.create_index('id', unique=True)
    await db.categories.create_index('id', unique=True)
    await db.orders.create_index('user_id')
    await db.orders.create_index('id', unique=True)
    await db.carts.create_index('user_id', unique=True)
    await db.payment_transactions.create_index('session_id')
    await db.coupons.create_index('code', unique=True)
    await db.coupons.create_index('id', unique=True)

    # Seed coupons
    coupons = [
        {'id': str(uuid.uuid4()), 'code': 'WELCOME10', 'discount_type': 'percentage', 'discount_value': 10, 'min_order': 5, 'max_discount': 50, 'is_active': True, 'usage_count': 0, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'code': 'FLAT20', 'discount_type': 'flat', 'discount_value': 20, 'min_order': 30, 'max_discount': 0, 'is_active': True, 'usage_count': 0, 'created_at': datetime.now(timezone.utc).isoformat()},
        {'id': str(uuid.uuid4()), 'code': 'FRESH15', 'discount_type': 'percentage', 'discount_value': 15, 'min_order': 10, 'max_discount': 100, 'is_active': True, 'usage_count': 0, 'created_at': datetime.now(timezone.utc).isoformat()},
    ]
    await db.coupons.insert_many(coupons)

    return True

@api_router.post("/seed")
async def seed_endpoint():
    result = await seed_database()
    if not result:
        return {'message': 'Data already seeded'}
    return {'message': 'Data seeded successfully', 'admin': {'email': 'admin@delivery.com', 'password': 'admin123'}, 'user': {'email': 'user@test.com', 'password': 'user123'}}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    logger.info("Starting delivery app backend...")
    try:
        # Try to seed database with a 5 second timeout
        await asyncio.wait_for(seed_database(), timeout=5)
        logger.info("Database seeded (if needed)")
    except asyncio.TimeoutError:
        logger.warning("Database seeding timed out - MongoDB may not be available")
        logger.info("Server is starting without database seeding")
    except Exception as e:
        logger.warning(f"Could not seed database: {e}")
        logger.info("Server is starting without database seeding")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
