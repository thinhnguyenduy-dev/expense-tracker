# Free Cloud Deployment Guide

This guide describes how to deploy the **Expense Tracker** application to the cloud for free using top-tier providers: **Vercel** (Frontend), **Render** (Backend), **Neon** (Database), and **Upstash** (Redis).

## 1. Prerequisites
- A **GitHub** account.
- The project code pushed to a GitHub repository.

## 2. Infrastructure Setup (Database & Cache)

### A. Database: Neon.tech (PostgreSQL)
Neon offers a serverless PostgreSQL database with a generous free tier.
1. Go to [Neon.tech](https://neon.tech) and sign up.
2. Create a new project (e.g., `expense-tracker-db`).
3. On the Dashboard, copy the **Connection String** (it looks like `postgres://user:pass@ep-xyz.aws.neon.tech/dbname...`).
   *   *Note: Select the "Pooled" connection string if available, but "Direct" works for Alembic migrations.*
   *   **Save this as `DATABASE_URL` for later.**

### B. Caching: Upstash (Redis) - *Optional*
> **Note:** If you use **Render Blueprint** (Method A below), a native Redis instance will be created automatically on Render. You can SKIP this step.
> Follow this step ONLY if you plan to use Manual Setup (Method B) or prefer an external Redis provider.

Upstash provides serverless Redis compatible caching.
1. Go to [Upstash.com](https://upstash.com) and sign up.
2. Create a new Redis database.
3. Scroll down to "REST API" or "Connect" -> "Python" sections to find the **UPSTASH_REDIS_URL** or just the standard `rediss://...` URL.
   *   **Save this as `REDIS_URL` for later.**

## 3. Backend Deployment (Render)

### Option A: Use Render Blueprint (Recommended)
This method automates the backend and Redis setup using the `render.yaml` file included in the repository.

1. Go to [Render.com](https://render.com) and create an account.
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository.
4. Give your blueprint a name (e.g., `expense-tracker-stack`).
5. Render will automatically detect the `render.yaml` configuration.
   - It will identify the **Web Service** (`expense-tracker-api`) and the **Redis Service** (`expense-tracker-redis`).
6. You will be prompted to provide the `DATABASE_URL` environment variable.
   - Paste your **Neon Connection String**.
7. Click **Apply**.
   - Render will deploy the backend and provision a private Redis instance.
   - The `REDIS_URL` will be automatically injected into your backend service.
8. Once "Live", copy the **Service URL** of the Web Service.

### Option B: Manual Setup
Follow these steps if you prefer to configure services manually or don't want to use the Blueprint.

1. Go to [Render.com](https://render.com) and create an account.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. **Configuration**:
    - **Name**: `expense-tracker-api` (or similar)
    - **Root Directory**: `backend` (Important!)
    - **Runtime**: `Python 3`
    - **Build Command**: `pip install -r requirements.txt`
    - **Start Command**: `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 10000`
        *   *This command installs dependencies, runs database migrations, and starts the server.*
5. **Environment Variables** (Section "Environment"):
    - Add the following keys and values:
        - `PYTHON_VERSION`: `3.11.0` (Recommended)
        - `DATABASE_URL`: *(Paste your Neon Connection String)*
        - `REDIS_URL`: *(Paste your Redis Connection String)*
          *   **For Render Redis:**
              1. Dashboard -> New + -> New Key Value.
              2. Name it (e.g., `expense-tracker-redis-manual`).
              3. Copy the **Internal Connection String** (starts with `redis://...`).
              4. Paste it here.
          *   **For Upstash:** Paste the URL you saved earlier.
        - `JWT_SECRET`: *(Generate a random strong string)*
        - `LOG_LEVEL`: `INFO`
        - `BACKEND_CORS_ORIGINS`: `["*"]` *(Start with * to allow Vercel later, or update after Frontend deploy)*
6. Click **Create Web Service**.
    - Wait for the build to finish.
    - Once "Live", copy the **Service URL** (e.g., `https://expense-tracker-api.onrender.com`).

## 4. Frontend Deployment (Vercel)

Vercel is the best place to host Next.js apps.

1. Go to [Vercel.com](https://vercel.com) and sign up.
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. **Configure Project**:
    - **Root Directory**: Click "Edit" and select `frontend`.
    - **Framework Preset**: Next.js (should be auto-detected).
5. **Environment Variables**:
    - Add the following:
        - `NEXT_PUBLIC_API_URL`: *(Paste your Render Service URL, e.g., `https://expense-tracker-api.onrender.com`)*
          *   *Note: Remove any trailing slash `/`.*
6. Click **Deploy**.
    - Wait for the build to complete.
    - Once live, you will get a Frontend URL (e.g., `https://expense-tracker-frontend.vercel.app`).

## 5. Final Configuration Steps

1. **Update CORS on Backend**:
   - Go back to your **Render** Dashboard -> "Environment".
   - Edit `BACKEND_CORS_ORIGINS` to include your specific Vercel URL for security (instead of `*`).
     - Example: `["https://expense-tracker-frontend.vercel.app", "http://localhost:3000"]`
     - *Note: Render might expect a standard JSON list string or just comma-separated depending on your code parser. Your code expects a JSON list string.*

2. **Verify**:
   - Open your Vercel URL.
   - Try to Register/Login.
   - Check if data persists to your Neon Database.

## Troubleshooting

- **Database Connection Error**: Ensure the IPs are not blocked (Neon is usually open) and the `DATABASE_URL` is correct.
- **CORS Errors**: Check the browser console. If you see CORS errors, double-check `BACKEND_CORS_ORIGINS` in Render env vars.
- **Build Failures**: Check the logs in Render/Vercel. Ensure `requirements.txt` and `package.json` are up to date.
