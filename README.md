# 💰 Expense Tracker

A modern full-stack expense management application built with FastAPI and Next.js.

![Tech Stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

## ✨ Features

- 🔐 **JWT Authentication** - Secure user registration and login
- 📊 **Dashboard** - Visual statistics with charts (Recharts)
- 💳 **Expense Management** - Full CRUD with filtering by date/category
- 🏷️ **Category Management** - Custom icons and colors
- 🎨 **Modern UI** - Dark theme with glassmorphism design
- 📱 **Responsive** - Mobile-friendly interface

## 🏗️ Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Migrations**: Alembic
- **Auth**: JWT (python-jose)
- **Validation**: Pydantic

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **State**: Zustand
- **HTTP**: Axios

## 📁 Project Structure

```
expense-tracker/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Config, security, database
│   │   ├── models/         # SQLAlchemy models
│   │   └── schemas/        # Pydantic schemas
│   ├── alembic/            # Database migrations
│   └── main.py
├── frontend/               # Next.js frontend
│   └── src/
│       ├── app/           # App Router pages
│       ├── components/    # UI components
│       └── lib/           # API client, stores
└── shared/                 # Shared types & constants
```

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL

### 1. Clone the repository

```bash
git clone https://github.com/thinhnguyenduy-dev/expense-tracker.git
cd expense-tracker
```

### 2. Setup Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE expense_tracker;
\q
```

### 3. Setup Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment (edit .env if needed)
cp .env.example .env

# Run migrations
alembic upgrade head

# Start server
uvicorn main:app --reload
```

Backend runs at: http://localhost:8000

### 4. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: http://localhost:3000

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (get JWT) |
| GET | `/api/auth/me` | Current user info |
| GET/POST | `/api/categories` | List/Create categories |
| PUT/DELETE | `/api/categories/{id}` | Update/Delete category |
| GET/POST | `/api/expenses` | List/Create expenses |
| PUT/DELETE | `/api/expenses/{id}` | Update/Delete expense |
| GET | `/api/dashboard` | Dashboard statistics |

API Documentation: http://localhost:8000/docs

## 🎨 Screenshots

### Login Page
Modern glassmorphism design with gradient background

### Dashboard
Statistics cards and interactive charts

### Expenses
Filterable table with CRUD operations

### Categories
Grid view with custom icons and colors

## 📄 Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/expense_tracker
JWT_SECRET=your-super-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
BACKEND_CORS_ORIGINS=["http://localhost:3000"]
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📝 License

MIT