# Backend Setup & Running Guide

## ✅ Current Status
Your FastAPI backend server is **running** on `http://127.0.0.1:8000`

### Access Points:
- **API Swagger Docs**: http://127.0.0.1:8000/docs
- **API ReDoc Docs**: http://127.0.0.1:8000/redoc
- **API Endpoint**: http://127.0.0.1:8000/api

## ⚙️ What's Been Done
1. **Backend dependencies updated** and MongoDB TLS support improved
2. **Core dependencies installed**:
   - FastAPI 0.128.8
   - Uvicorn (ASGI server)
   - Motor (async MongoDB driver)
   - PyMongo, Pydantic, PyJWT, bcrypt, etc.
3. **Environment file created** at `backend/.env`
4. **Mock Stripe integration** created (for development without live keys)
5. **Server startup optimized** to handle missing MongoDB gracefully

> On macOS, the system Python may use LibreSSL and can fail TLS handshakes with MongoDB Atlas. If login still fails, install Python via Homebrew and run the backend with the new `backend/start.sh` helper script.

## 📋 Next Steps to Enable Full Functionality

### Option 1: Use MongoDB Atlas (Cloud - Recommended for Development)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account and cluster
3. Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net`)
4. Update `backend/.env`:
   ```
   MONGO_URL=mongodb+srv://your_username:your_password@cluster.mongodb.net
   DB_NAME=product_delivery_db
   ```

### Option 2: Run MongoDB Locally (Using Docker)
```bash
# Install Docker from https://www.docker.com/products/docker-desktop

# Start MongoDB container
docker run -d --name mongodb -p 27017:27017 mongo:latest

# MongoDB will be available at mongodb://localhost:27017
```

### Option 3: Install MongoDB Locally (macOS)
```bash
# Using Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# MongoDB will be available at mongodb://localhost:27017
```

## 🚀 Running the Server

The server is currently running! To run it again in the future:

```bash
cd backend
python3 run.py
```

Or with uvicorn directly:
```bash
cd backend
python3 -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

## 📝 Environment File (.env)
Located at `backend/.env` - contains:
- `MONGO_URL`: MongoDB connection string
- `DB_NAME`: Database name  
- `JWT_SECRET`: Secret for JWT token signing
- `STRIPE_API_KEY`: Your Stripe API key (get from https://stripe.com)

## 🔐 Default Test Credentials (After MongoDB Setup)
Once MongoDB is available and seeded:
- **Admin**: admin@delivery.com / admin123
- **User**: user@test.com / user123

## 📚 API Routes Available
Once MongoDB is configured:
- **Auth**: `/api/auth/register`, `/api/auth/login`, `/api/auth/profile`, etc.
- **Products**: `/api/products`, `/api/categories`
- **Cart**: `/api/cart`, `/api/cart/add`
- **Orders**: `/api/orders`, `/api/orders/checkout`
- **Coupons**: `/api/coupons`, `/api/coupons/apply`
- **Payments**: `/api/payments/status`
- **Admin**: `/api/admin/dashboard`, `/api/admin/users`

## ✨ Features
- FastAPI with async support
- MongoDB integration with Motor
- JWT-based authentication
- Stripe payment integration
- Coupon system
- Cart management
- Order tracking
- Admin dashboard

## ⚠️ Current Limitations
- Server runs without MongoDB (graceful degradation)
- API endpoints require MongoDB connection to function
- Stripe integration is mocked for development

## 🎯 Next Steps
1. **Set up MongoDB** (choose from options above)
2. **Update `.env`** with your MongoDB connection string
3. **Restart the server** - it will seed the database
4. **Test the API** at http://127.0.0.1:8000/docs

---
**Happy coding!** 🎉
