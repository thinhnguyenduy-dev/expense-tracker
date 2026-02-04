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
30: ├─────────────────────┤      ├─────────────────────┤      ├─────────────────────┤
│ config.py ──────────┼──┐   │ user.py ────────────┼──┐   │ auth.py             │
│   └─ Settings, ENV  │  │   │   └─ User           │  │   │   └─ login,register │
│                     │  │   │                     │  │   │                     │
│ database.py ◄───────┼──┘   │ category.py ────────┼──┤   │ categories.py       │
│   └─ Engine, Base   │◄─────┼   └─ Category       │  │   │   └─ CRUD           │
│                     │      │                     │  │   │                     │
│ security.py ◄───────┼──────┤ expense.py ─────────┼──┤   │ expenses.py         │
│   └─ JWT, bcrypt    │      │   └─ Expense        │  │   │   └─ CRUD + filter  │
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
                    │ (+others)           │
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
| [user.py](backend/app/models/user.py) | User model | database.Base | deps, auth, others |
| [category.py](backend/app/models/category.py) | Category model | database.Base | categories, expenses |
| [expense.py](backend/app/models/expense.py) | Expense model | database.Base | expenses, dashboard |
| [income.py](backend/app/models/income.py) | Income model | database.Base | incomes |
| [goal.py](backend/app/models/goal.py) | Goal model | database.Base | goals |
| [jar.py](backend/app/models/jar.py) | Jar model | database.Base | jars |
| [transfer.py](backend/app/models/transfer.py) | Transfer model | database.Base | transfers |
| [family.py](backend/app/models/family.py) | Family model | database.Base | families |
| [recurring_expense.py](backend/app/models/recurring_expense.py) | Rec. Expense model | database.Base | recurring_expenses |

### API Layer

| File | Prefix | Methods | Key Dependencies |
|------|--------|---------|------------------|
| [auth.py](backend/app/api/auth.py) | `/api/auth` | register, login, me | security, deps, User |
| [categories.py](backend/app/api/categories.py) | `/api/categories` | CRUD | deps, Category |
| [expenses.py](backend/app/api/expenses.py) | `/api/expenses` | CRUD + filters | deps, Expense, Category |
| [incomes.py](backend/app/api/incomes.py) | `/api/incomes` | CRUD | deps, Income |
| [goals.py](backend/app/api/goals.py) | `/api/goals` | CRUD | deps, Goal |
| [jars.py](backend/app/api/jars.py) | `/api/jars` | CRUD | deps, Jar |
| [transfers.py](backend/app/api/transfers.py) | `/api/transfers` | CRUD | deps, Transfer |
| [families.py](backend/app/api/families.py) | `/api/families` | CRUD | deps, Family |
| [dashboard.py](backend/app/api/dashboard.py) | `/api/dashboard` | stats | deps, various |

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
│                         query-provider.tsx                                   │
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
                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ src/app/ (Pages)                                                                  │
│ ├─ (dashboard)/           ├─ [locale]/              ├─ login/      ├─ register/   │
│ │  ├─ dashboard/          │  └─ page.tsx            │  └─ page.tsx │  └─ page.tsx │
│ │  ├─ expenses/           │                         └──────────────┴──────────────┘
│ │  ├─ incomes/            │                                                       │
│ │  ├─ categories/         │                                                       │
│ │  ├─ goals/              │                                                       │
│ │  ├─ jars/               │                                                       │
│ │  └─ ...                 │                                                       │
└───────────────────────────┴───────────────────────────────────────────────────────┘
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
| `components/providers/` | AuthProvider, ThemeProvider, QueryProvider |
| `components/layout/` | Sidebar |
| `components/expenses/` | ExpenseDialog, ExpenseFilters, ExpenseTable, ExpenseBulkActions |
| `components/incomes/` | AddIncomeModal, IncomeTable |
| `components/jars/` | JarCard, TransferModal, EditJarModal, TransfersHistory |
| `components/settings/` | ProfileTab, SecurityTab, PreferencesTab, DataTab, FamilyTab |

### Page Structure (Key Routes)

| Route | File | Purpose |
|-------|------|---------|
| `/dashboard/dashboard` | [(dashboard)/dashboard/page.tsx](frontend/src/app/(dashboard)/dashboard/page.tsx) | Main Dashboard Stats |
| `/dashboard/expenses` | [(dashboard)/expenses/page.tsx](frontend/src/app/(dashboard)/expenses/page.tsx) | Expense Management |
| `/dashboard/incomes` | [(dashboard)/incomes/page.tsx](frontend/src/app/(dashboard)/incomes/page.tsx) | Income Management |
| `/dashboard/categories`| [(dashboard)/categories/page.tsx](frontend/src/app/(dashboard)/categories/page.tsx) | Category Management |
| `/dashboard/goals` | [(dashboard)/goals/page.tsx](frontend/src/app/(dashboard)/goals/page.tsx) | Goals Management |
| `/dashboard/jars` | [(dashboard)/jars/page.tsx](frontend/src/app/(dashboard)/jars/page.tsx) | Jars (Buckets) Management |
| `/login` | [login/page.tsx](frontend/src/app/login/page.tsx) | Login |

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
- [ ] **I18n**: If adding/changing text, update `messages/*.json`

---
*Last updated: 2026-02-03*
