# 💰 Expense Tracker

A modern full-stack expense management application built with FastAPI and Next.js.

![Tech Stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

## ✨ Features

- 🔐 **Authentication & Family** - Secure JWT auth with Family Sharing capabilities
- 🏺 **6 Jars System** - Money management implementing T. Harv Eker's methodology
- 📊 **Smart Dashboard** - Visual statistics, financial health analysis & Jars overview
- 💳 **Transaction Control** - Complete Income & Expense tracking with date/category filtering
- � **Financial Goals** - Create and track saving goals with progress visualization
- 🔄 **Recurring Billing** - Automated tracking for subscriptions & bills with due date reminders
- � **Multi-Currency** - Native support for multiple currencies (USD, VND, etc.)
- 🏷️ **Customization** - Personalized categories with custom icons and colors
- 📱 **Modern Experience** - Mobile-first design with Dark Mode & Glassmorphism UI

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

### 5. Seed Test Data (Optional)

To populate the database with realistic test data for development and testing:

```bash
# Make sure you're in backend directory with venv activated
cd backend
source venv/bin/activate

# Run seeder
python seed.py --users 2 --months 3 --verbose
```

**Seeder Options:**
- `--users N`: Number of demo users to create (default: 2, max: 2)
- `--months N`: Months of expense history to generate (default: 3)
- `--verbose` or `-v`: Show detailed progress output
- `--dry-run`: Preview what would be created without making changes

**Demo User Credentials:**
- **Email:** `demo@expense-tracker.com` / **Password:** `Demo123!`
- **Email:** `test@expense-tracker.com` / **Password:** `Test123!`

The seeder is **idempotent** - you can run it multiple times, and it will skip existing data automatically.

### 4. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: http://localhost:3000

## 📡 API Documentation

For detailed API endpoints and usage, please visit the interactive documentation:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## 🎨 Screenshots

### Login Page
Modern glassmorphism design with gradient background

### Dashboard
Statistics cards and interactive charts

### Expenses
Filterable table with CRUD operations

### Categories
Grid view with custom icons and colors

##  License

MIT