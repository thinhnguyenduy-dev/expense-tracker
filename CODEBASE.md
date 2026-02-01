# 📦 CODEBASE.md - Expense Tracker

> File dependency map for AI-assisted development.

---

## 🏗️ Architecture Overview

```
expense-tracker/
├── backend/            # FastAPI (Python)
├── frontend/           # Next.js 16 (TypeScript)
└── shared/             # Common types & constants
```

---

## 🔗 Backend Dependency Graph

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                      main.py                             │
                              └───────────────────────────┬─────────────────────────────┘
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          │                                │                                │
          ▼                                ▼                                ▼
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│    app/core/        │      │    app/models/      │      │    app/api/         │
├─────────────────────┤      ├─────────────────────┤      ├─────────────────────┤
│ config.py ──────────┼──┐   │ user.py ────────────┼──┐   │ auth.py             │
│   └─ Settings, ENV  │  │   │   └─ User model     │  │   │   └─ login,register │
│                     │  │   │                     │  │   │                     │
│ database.py ◄───────┼──┘   │ category.py ────────┼──┤   │ categories.py       │
│   └─ Engine, Base   │◄─────┼   └─ Category model │  │   │   └─ CRUD           │
│                     │      │                     │  │   │                     │
│ security.py ◄───────┼──────┤ expense.py ─────────┼──┤   │ expenses.py         │
│   └─ JWT, bcrypt    │      │   └─ Expense model  │  │   │   └─ CRUD + filter  │
│                     │      │                     │  │   │                     │
│ deps.py ◄───────────┼──────┼─────────────────────┼──┘   │ dashboard.py        │
│   └─ get_current_   │      │                     │      │   └─ stats          │
│       user          │      │                     │      │                     │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
                                                                    │
                              ┌─────────────────────────────────────┘
                              ▼
                    ┌─────────────────────┐
                    │   app/schemas/      │
                    ├─────────────────────┤
                    │ user.py             │
                    │ category.py         │
                    │ expense.py          │
                    │ dashboard.py        │
                    └─────────────────────┘
```

---

## 📁 Backend Files

### Core Layer

| File | Purpose | Depends On | Dependents |
|------|---------|------------|------------|
| [config.py](backend/app/core/config.py) | Settings, ENV vars | - | database, security, auth.py |
| [database.py](backend/app/core/database.py) | DB engine, session | config | models, deps, all API routes |
| [security.py](backend/app/core/security.py) | JWT, bcrypt | config | deps, auth.py |
| [deps.py](backend/app/core/deps.py) | Auth dependency | database, security, User | all API routes |

### Models Layer

| File | Purpose | Depends On | Dependents |
|------|---------|------------|------------|
| [user.py](backend/app/models/user.py) | User model | database.Base | deps, auth, categories, expenses, dashboard |
| [category.py](backend/app/models/category.py) | Category model | database.Base | categories, expenses, dashboard |
| [expense.py](backend/app/models/expense.py) | Expense model | database.Base | expenses, dashboard |

### Schemas Layer

| File | Purpose | Dependents |
|------|---------|------------|
| [user.py](backend/app/schemas/user.py) | UserCreate, UserResponse, Token | auth.py |
| [category.py](backend/app/schemas/category.py) | CategoryCreate, CategoryResponse | categories.py |
| [expense.py](backend/app/schemas/expense.py) | ExpenseCreate, ExpenseResponse | expenses.py |
| [dashboard.py](backend/app/schemas/dashboard.py) | DashboardStats, CategoryStat | dashboard.py |

### API Layer

| File | Prefix | Methods | Key Dependencies |
|------|--------|---------|------------------|
| [auth.py](backend/app/api/auth.py) | `/api/auth` | register, login, me | security, deps, User |
| [categories.py](backend/app/api/categories.py) | `/api/categories` | CRUD | deps, Category |
| [expenses.py](backend/app/api/expenses.py) | `/api/expenses` | CRUD + filters | deps, Expense, Category |
| [dashboard.py](backend/app/api/dashboard.py) | `/api/dashboard` | stats | deps, Expense, Category |

---

## 🔗 Frontend Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           src/app/layout.tsx                                 │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    src/components/providers/                                 │
│                         auth-provider.tsx                                    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          src/lib/                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  api.ts ◄───────────────── stores/auth-store.ts ◄───────── utils.ts        │
│  (axios, endpoints)        (Zustand state)                 (cn helper)       │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────────────┐
│ /login            │  │ /register         │  │ /(dashboard)/                 │
│   page.tsx        │  │   page.tsx        │  ├───────────────────────────────┤
│   └─ Login form   │  │   └─ Register     │  │ layout.tsx  ◄── sidebar.tsx   │
│                   │  │       form        │  │ page.tsx     (Stats & charts) │
│                   │  │                   │  │ expenses/page.tsx             │
│                   │  │                   │  │ categories/page.tsx           │
└───────────────────┘  └───────────────────┘  └───────────────────────────────┘
```

---

## 📁 Frontend Files

### Lib Layer

| File | Purpose | Dependents |
|------|---------|------------|
| [api.ts](frontend/src/lib/api.ts) | Axios instance, API wrappers | auth-store, all pages |
| [auth-store.ts](frontend/src/lib/stores/auth-store.ts) | Auth state (Zustand) | auth-provider, login, dashboard |
| [utils.ts](frontend/src/lib/utils.ts) | `cn()` helper | UI components |

### Component Layers

| Directory | Contents |
|-----------|----------|
| `components/ui/` | shadcn components (button, input, dialog, etc.) |
| `components/providers/` | AuthProvider, ThemeProvider |
| `components/layout/` | Sidebar |
| `components/expenses/` | ExpenseDialog, ExpenseFilters, ExpenseTable, ExpenseBulkActions, ExpenseCard |
| `components/settings/` | ProfileTab, SecurityTab, PreferencesTab, DataTab, FamilyTab |
| `components/incomes/` | AddIncomeModal |
| `components/jars/` | JarCard, TransferModal |

### Page Structure

| Route | File | Purpose |
|-------|------|---------|
| `/` | [page.tsx](frontend/src/app/page.tsx) | Redirect to dashboard |
| `/login` | [login/page.tsx](frontend/src/app/login/page.tsx) | Login form |
| `/register` | [register/page.tsx](frontend/src/app/register/page.tsx) | Register form |
| `/dashboard` | [(dashboard)/page.tsx](frontend/src/app/(dashboard)/page.tsx) | Stats & charts |
| `/dashboard/expenses` | [(dashboard)/expenses/page.tsx](frontend/src/app/(dashboard)/expenses/page.tsx) | Expense CRUD |
| `/dashboard/categories` | [(dashboard)/categories/page.tsx](frontend/src/app/(dashboard)/categories/page.tsx) | Category CRUD |

---

## 📡 API Flow

```
Frontend                    Backend
─────────────────────────────────────────────
api.ts                      main.py
  │                           │
  │ POST /api/auth/login    ──┼──► auth.py
  │                           │      └─ security.py (JWT)
  │ GET /api/auth/me        ──┼──► deps.py → User
  │                           │
  │ GET /api/categories     ──┼──► categories.py → Category
  │ POST /api/categories    ──┼──►
  │                           │
  │ GET /api/expenses       ──┼──► expenses.py → Expense
  │ POST /api/expenses      ──┼──►
  │                           │
  │ GET /api/dashboard      ──┼──► dashboard.py → Stats
```

---

## ⚠️ Critical Dependencies

> **Modify these carefully** - they affect multiple files.

| File | Impact | Affected Files |
|------|--------|----------------|
| `config.py` | ENV breaking | All backend |
| `database.py` | DB connection | All models, API routes |
| `deps.py` | Auth breaking | All protected routes |
| `api.ts` | Frontend API | All frontend pages |
| `auth-store.ts` | Auth state | Login, dashboard, sidebar |

---

## 🔄 Modification Checklist

When modifying:

- [ ] **Models**: Update schema, run `alembic revision --autogenerate`
- [ ] **Schemas**: Update API response types
- [ ] **API Routes**: Update `api.ts` on frontend
- [ ] **UI Components**: Check all pages using them
- [ ] **Auth**: Check both `deps.py` and `auth-store.ts`

---

*Last updated: 2026-02-01*
