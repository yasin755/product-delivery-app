# Product Requirements Document - Multi-Category Delivery Platform

## Overview
A scalable, cross-platform delivery application (similar to Zomato/BigBasket) where users can order water cans, fresh meat, vegetables, fruits, grocery items, and kids products. Includes customer mobile app and admin dashboard.

## Tech Stack
- **Frontend**: Expo (React Native) with expo-router
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Stripe (test mode)
- **Authentication**: JWT-based

## Features

### Customer App
- [x] User registration & login (JWT)
- [x] Browse 5 product categories
- [x] Search products with real-time results
- [x] Product detail pages with ratings
- [x] Shopping cart (add/update/remove)
- [x] Checkout with Stripe payment
- [x] Order history & tracking
- [x] Profile management

### Admin Dashboard
- [x] Admin login with role-based access
- [x] Dashboard analytics (revenue, orders, users, products)
- [x] Product management (view, delete)
- [x] Order management (view, update status)
- [x] User listing

### Backend API
- [x] Auth endpoints (register, login, profile, address)
- [x] Categories CRUD
- [x] Products CRUD with search/pagination
- [x] Cart management
- [x] Order lifecycle (checkout → confirmed → delivered)
- [x] Stripe payment integration
- [x] Admin analytics endpoints
- [x] Auto-seeding with 5 categories, 21 products

## Database Schema (MongoDB Collections)
- **users**: id, name, email, phone, password_hash, role, addresses, created_at
- **categories**: id, name, description, image, icon, order, is_active
- **products**: id, name, description, price, category_id, image, unit, stock, weight, rating, review_count
- **carts**: id, user_id, items[{product_id, quantity}]
- **orders**: id, user_id, items, total, status, payment_status, address, stripe_session_id
- **payment_transactions**: id, user_id, order_id, session_id, amount, currency, status

## Demo Credentials
- **User**: user@test.com / user123
- **Admin**: admin@delivery.com / admin123

## API Endpoints
- POST /api/auth/register, /api/auth/login, GET /api/auth/profile
- GET /api/categories, POST/PUT/DELETE /api/categories/{id}
- GET /api/products, GET /api/products/{id}, POST/PUT/DELETE /api/products/{id}
- GET /api/cart, POST /api/cart/add, PUT /api/cart/update, DELETE /api/cart/item/{id}
- POST /api/orders/checkout, GET /api/orders, GET /api/orders/{id}, PUT /api/orders/{id}/status
- GET /api/payments/status/{session_id}
- GET /api/admin/dashboard, GET /api/admin/users

## Mocked Features
- Push notifications (mocked for MVP)

## Future Enhancements
- Coupon/discount system
- Ratings & reviews
- Multi-vendor support
- Wishlist
- Real push notifications with Firebase
