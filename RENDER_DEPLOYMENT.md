# Render Cloud Deployment Guide

This guide explains how to deploy your FastAPI backend and React Native frontend to Render.

## Backend Deployment (FastAPI)

### Step 1: Prepare Backend Files

Your backend has been updated to work with Render:
- ✅ `backend/run.py` - Now reads `HOST` and `PORT` from environment variables
- ✅ `backend/start.sh` - Now supports dynamic port allocation
- ✅ Reload disabled in production mode (when `RENDER=true`)

### Step 2: Create Render Service

1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Fill in the settings:

   **Name**: `your-app-backend` (or your preferred name)
   
   **Environment**: `Python 3`
   
   **Build Command**:
   ```bash
   pip install -r backend/requirements.txt
   ```
   
   **Start Command**:
   ```bash
   cd backend && python3 -m uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
   
   **Environment Variables** (click "Add Environment Variable"):
   - `MONGO_URL`: Your MongoDB Atlas connection string
   - `RENDER`: `true` (disables auto-reload in production)
   - Any other environment variables from your `.env` file
   
5. Select a plan and deploy

### Step 3: Get Your Backend URL

After deployment, Render will provide a URL like:
```
https://your-app-backend.onrender.com
```

Note this URL - you'll need it for the frontend configuration.

---

## Frontend Deployment (React Native/Expo)

### Step 1: Update Environment Variables

Create/update your `.env` file in the `frontend/` directory:

```env
EXPO_PUBLIC_BACKEND_URL=https://your-app-backend.onrender.com
```

Replace `your-app-backend` with your actual Render service name.

### Step 2: Build and Deploy with EAS (Expo Application Services)

If building with EAS:

```bash
cd frontend
eas build --platform ios --profile production
eas build --platform android --profile production
```

Configure `eas.json` to include:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://your-app-backend.onrender.com"
      }
    }
  }
}
```

### Step 3: For Web Version

If you have a web version, deploy to Render:

1. Create another Render service for the web frontend
2. Build command: `cd frontend && npm install && npm run build`
3. Start command: `cd frontend && npm start`

---

## Important Configuration Notes

### Backend (FastAPI)

- **Host**: Now defaults to `0.0.0.0` (required for Render)
- **Port**: Reads from `PORT` environment variable (Render sets this automatically)
- **CORS**: Already configured with `allow_origins=["*"]`
- **MongoDB**: Make sure `MONGO_URL` is set in Render environment variables

### Frontend (React Native)

- **API Base URL**: Read from `EXPO_PUBLIC_BACKEND_URL` environment variable
- Priority order for URL selection:
  1. `EXPO_PUBLIC_BACKEND_URL` environment variable (highest priority - use this for Render)
  2. Extracted from Expo's `hostUri` (local development)
  3. Fallback defaults (local dev with hardcoded IPs)

---

## Troubleshooting

### Connection Issues

If your frontend cannot reach the backend:

1. **Verify backend URL**: Check that `EXPO_PUBLIC_BACKEND_URL` matches your Render backend URL
2. **Check CORS**: Backend has `allow_origins=["*"]`, so CORS shouldn't be the issue
3. **Enable debug logging**: The API module logs connection attempts to help debug

### MongoDB Connection Issues

If you see MongoDB connection errors:

1. Ensure your Render service has the correct `MONGO_URL` environment variable
2. If using MongoDB Atlas, verify:
   - Connection string is correct
   - IP whitelist includes Render's IPs (or set to `0.0.0.0/0`)
   - Database user credentials are correct

### Backend Not Starting

1. Check Render logs for errors
2. Ensure all Python dependencies are listed in `requirements.txt`
3. Verify `MONGO_URL` and other required environment variables are set

---

## Environment Variables Summary

### Backend (Render Dashboard)

```
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/dbname
RENDER=true
[Any other variables from your .env file]
```

### Frontend (`.env` file in `frontend/`)

```
EXPO_PUBLIC_BACKEND_URL=https://your-app-backend.onrender.com
```

---

## Production Best Practices

1. **Never commit `.env` files** - Use Render's environment variables dashboard
2. **Update the backend URL immediately after deployment** - Don't use localhost
3. **Monitor logs** - Check Render dashboard for any errors
4. **Test endpoints** - Use the `/docs` endpoint (Swagger UI) to test API after deployment
5. **Set up error tracking** - Consider adding Sentry or similar for production

---

## Testing Your Deployment

1. **Test backend directly**:
   ```
   curl https://your-app-backend.onrender.com/docs
   ```

2. **Test from frontend**: 
   - Start your app with the updated `EXPO_PUBLIC_BACKEND_URL`
   - Check browser/device console for connection logs (API logs connection attempts)

3. **Monitor Render logs**: Watch the Render dashboard for any errors during requests

---

## Free Tier Notes

Render's free tier:
- Services spin down after 15 minutes of inactivity
- Full functionality when active
- Use paid plan for 24/7 uptime if needed

---

For more help, visit [Render Documentation](https://render.com/docs)
