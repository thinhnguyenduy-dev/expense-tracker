#!/usr/bin/env python3
"""
Database Seeder for Expense Tracker
Creates realistic test data with idempotent design.
"""
import sys
import argparse
import random
from datetime import datetime, timedelta, date
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User
from app.models.category import Category
from app.models.expense import Expense
from app.models.goal import Goal
from app.models.income import Income
from app.models.recurring_expense import RecurringExpense
from app.models.jar import Jar
from app.models.transfer import Transfer


# Demo users
DEMO_USERS = [
    {"email": "demo@expense-tracker.com", "password": "Demo123!", "name": "Demo User", "currency": "USD"},
    {"email": "test@expense-tracker.com", "password": "Test123!", "name": "Test User", "currency": "USD"},
    {"email": "demo-vi@gmail.com", "password": "Demo123", "name": "Demo User VN", "currency": "VND"},
]

CATEGORIES = [
    {"name": "Rent/Mortgage", "icon": "🏠", "color": "#FF6B6B"},
    {"name": "Food & Groceries", "icon": "🍔", "color": "#4ECDC4"},
    {"name": "Transportation", "icon": "🚗", "color": "#FFE66D"},
    {"name": "Utilities", "icon": "💡", "color": "#95E1D3"},
    {"name": "Entertainment", "icon": "🎮", "color": "#F38181"},
    {"name": "Healthcare", "icon": "🏥", "color": "#AA96DA"},
    {"name": "Shopping", "icon": "🛍️", "color": "#FCBAD3"},
    {"name": "Education", "icon": "📚", "color": "#A8E6CF"},
    {"name": "Travel", "icon": "✈️", "color": "#FFD3B6"},
    {"name": "Subscriptions", "icon": "📱", "color": "#9896DA"},
]

# Recurring expense templates
RECURRING_EXPENSES = [
    {"category": "Rent/Mortgage", "description": "Monthly Rent", "amount_range": (1200, 1500), "day": 1, "frequency": "monthly"},
    {"category": "Subscriptions", "description": "Netflix Subscription", "amount_range": (15, 15), "day": 5, "frequency": "monthly"},
    {"category": "Subscriptions", "description": "Spotify Premium", "amount_range": (10, 10), "day": 8, "frequency": "monthly"},
    {"category": "Utilities", "description": "Electricity Bill", "amount_range": (80, 120), "day": 15, "frequency": "monthly"},
    {"category": "Utilities", "description": "Internet Bill", "amount_range": (50, 70), "day": 20, "frequency": "monthly"},
]

# Random expense templates
RANDOM_EXPENSES = [
    {"category": "Food & Groceries", "descriptions": ["Grocery Shopping", "Supermarket", "Farmers Market"], "amount_range": (50, 150)},
    {"category": "Transportation", "descriptions": ["Gas Station", "Uber Ride", "Public Transit"], "amount_range": (10, 60)},
    {"category": "Entertainment", "descriptions": ["Movie Tickets", "Concert", "Gaming"], "amount_range": (15, 100)},
    {"category": "Shopping", "descriptions": ["Clothing", "Electronics", "Home Goods"], "amount_range": (30, 200)},
    {"category": "Healthcare", "descriptions": ["Pharmacy", "Doctor Visit", "Gym Membership"], "amount_range": (20, 150)},
    {"category": "Food & Groceries", "descriptions": ["Restaurant", "Coffee Shop", "Fast Food"], "amount_range": (10, 50)},
]

# Income Sources
INCOME_SOURCES = [
    {"source": "Salary", "amount_range": (4000, 5000), "day": 25},
    {"source": "Freelance Work", "amount_range": (500, 1500), "day": 10},
    {"source": "Dividends", "amount_range": (100, 300), "day": 15},
]

# Demo Goals
GOALS = [
    {
        "name": "New Trip to Japan",
        "description": "Saving for a 2-week vacation in Tokyo and Kyoto",
        "target_amount": 2000,
        "current_amount": 600,
        "deadline_months": 12,  # 1 year from now
        "color": "#FF6B6B"
    },
    {
        "name": "Emergency Fund",
        "description": "3 months of living expenses",
        "target_amount": 5000,
        "current_amount": 1000,
        "deadline_months": 24,  # 2 years from now
        "color": "#4ECDC4"
    },
    {
        "name": "New Laptop",
        "description": "Upgrade to latest MacBook Pro",
        "target_amount": 2500,
        "current_amount": 500,
        "deadline_months": 6,
        "color": "#FFE66D"
    }
]

# ===== VIETNAMESE TRANSLATIONS =====

CATEGORIES_VI = [
    {"name": "Thuê nhà/Vay thế chấp", "icon": "🏠", "color": "#FF6B6B"},
    {"name": "Thực phẩm & Tạp hóa", "icon": "🍔", "color": "#4ECDC4"},
    {"name": "Di chuyển", "icon": "🚗", "color": "#FFE66D"},
    {"name": "Tiện ích", "icon": "💡", "color": "#95E1D3"},
    {"name": "Giải trí", "icon": "🎮", "color": "#F38181"},
    {"name": "Y tế", "icon": "🏥", "color": "#AA96DA"},
    {"name": "Mua sắm", "icon": "🛍️", "color": "#FCBAD3"},
    {"name": "Giáo dục", "icon": "📚", "color": "#A8E6CF"},
    {"name": "Du lịch", "icon": "✈️", "color": "#FFD3B6"},
    {"name": "Đăng ký dịch vụ", "icon": "📱", "color": "#9896DA"},
]

# Vietnamese recurring expense templates
RECURRING_EXPENSES_VI = [
    {"category": "Thuê nhà/Vay thế chấp", "description": "Tiền thuê nhà hàng tháng", "amount_range": (1200, 1500), "day": 1, "frequency": "monthly"},
    {"category": "Đăng ký dịch vụ", "description": "Đăng ký Netflix", "amount_range": (15, 15), "day": 5, "frequency": "monthly"},
    {"category": "Đăng ký dịch vụ", "description": "Spotify Premium", "amount_range": (10, 10), "day": 8, "frequency": "monthly"},
    {"category": "Tiện ích", "description": "Tiền điện", "amount_range": (80, 120), "day": 15, "frequency": "monthly"},
    {"category": "Tiện ích", "description": "Tiền Internet", "amount_range": (50, 70), "day": 20, "frequency": "monthly"},
]

# Vietnamese random expense templates
RANDOM_EXPENSES_VI = [
    {"category": "Thực phẩm & Tạp hóa", "descriptions": ["Mua sắm thực phẩm", "Siêu thị", "Chợ"], "amount_range": (50, 150)},
    {"category": "Di chuyển", "descriptions": ["Đổ xăng", "Đi Grab", "Xe buýt"], "amount_range": (10, 60)},
    {"category": "Giải trí", "descriptions": ["Xem phim", "Hòa nhạc", "Chơi game"], "amount_range": (15, 100)},
    {"category": "Mua sắm", "descriptions": ["Quần áo", "Đồ điện tử", "Đồ gia dụng"], "amount_range": (30, 200)},
    {"category": "Y tế", "descriptions": ["Thuốc", "Khám bệnh", "Phòng gym"], "amount_range": (20, 150)},
    {"category": "Thực phẩm & Tạp hóa", "descriptions": ["Nhà hàng", "Quán cà phê", "Đồ ăn nhanh"], "amount_range": (10, 50)},
]

# Vietnamese Income Sources
INCOME_SOURCES_VI = [
    {"source": "Lương", "amount_range": (4000, 5000), "day": 25},
    {"source": "Làm thêm", "amount_range": (500, 1500), "day": 10},
    {"source": "Cổ tức", "amount_range": (100, 300), "day": 15},
]

# Vietnamese Demo Goals
GOALS_VI = [
    {
        "name": "Du lịch Nhật Bản",
        "description": "Tiết kiệm cho chuyến du lịch 2 tuần tại Tokyo và Kyoto",
        "target_amount": 2000,
        "current_amount": 600,
        "deadline_months": 12,
        "color": "#FF6B6B"
    },
    {
        "name": "Quỹ khẩn cấp",
        "description": "Chi phí sinh hoạt 3 tháng",
        "target_amount": 5000,
        "current_amount": 1000,
        "deadline_months": 24,
        "color": "#4ECDC4"
    },
    {
        "name": "Laptop mới",
        "description": "Nâng cấp lên MacBook Pro mới nhất",
        "target_amount": 2500,
        "current_amount": 500,
        "deadline_months": 6,
        "color": "#FFE66D"
    }
]

# Weekly grocery descriptions
WEEKLY_GROCERY_VI = ["Đi chợ tuần", "Mua thực phẩm", "Siêu thị cuối tuần"]
WEEKLY_GROCERY_EN = ["Weekly Groceries", "Grocery Shopping", "Supermarket Run"]


class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RED = '\033[91m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def log(message: str, color: str = Colors.RESET, verbose: bool = True):
    """Print colored log message"""
    if verbose:
        print(f"{color}{message}{Colors.RESET}")



def get_currency_multiplier(user_email: str) -> int:
    """Get multiplier for currency conversion based on user"""
    for user in DEMO_USERS:
        if user["email"] == user_email:
            if user.get("currency") == "VND":
                return 25000
    return 1


def seed_users(db: Session, verbose: bool = True, dry_run: bool = False) -> list[User]:
    """Create demo users if they don't exist"""
    log(f"\n{Colors.BOLD}📥 Seeding Users{Colors.RESET}", verbose=verbose)
    
    users = []
    created_count = 0
    
    for user_data in DEMO_USERS:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        
        if existing:
            log(f"  ⏭️  User '{user_data['email']}' already exists (ID: {existing.id})", Colors.YELLOW, verbose)
            users.append(existing)
        else:
            if dry_run:
                log(f"  [DRY RUN] Would create user: {user_data['email']}", Colors.CYAN, verbose)
            else:
                user = User(
                    email=user_data["email"],
                    hashed_password=get_password_hash(user_data["password"]),
                    name=user_data["name"],
                    language="vi" if user_data.get("currency") == "VND" else "en"
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                users.append(user)
                created_count += 1
                log(f"  ✅ Created user: {user.email} (ID: {user.id})", Colors.GREEN, verbose)
    
    if not dry_run and created_count > 0:
        log(f"  {Colors.BOLD}Created {created_count} new user(s){Colors.RESET}", Colors.GREEN, verbose)
    
    return users


JARS_DATA = [
    {"name": "Necessities (NEC)", "percentage": 55.0},
    {"name": "Financial Freedom (FFA)", "percentage": 10.0},
    {"name": "Education (EDU)", "percentage": 10.0},
    {"name": "Long-term Savings (LTSS)", "percentage": 10.0},
    {"name": "Play (PLAY)", "percentage": 10.0},
    {"name": "Give (GIVE)", "percentage": 5.0},
]

JARS_DATA_VI = [
    {"name": "Chi tiêu thiết yếu (NEC)", "percentage": 55.0},
    {"name": "Tự do tài chính (FFA)", "percentage": 10.0},
    {"name": "Giáo dục (EDU)", "percentage": 10.0},
    {"name": "Tiết kiệm dài hạn (LTSS)", "percentage": 10.0},
    {"name": "Hưởng thụ (PLAY)", "percentage": 10.0},
    {"name": "Cho đi (GIVE)", "percentage": 5.0},
]


def seed_jars(db: Session, users: list[User], verbose: bool = True, dry_run: bool = False) -> None:
    """Create default jars for users"""
    log(f"\n{Colors.BOLD}🏺 Seeding Jars{Colors.RESET}", verbose=verbose)
    
    total_created = 0
    
    for user in users:
        created_count = 0
        
        # Use Vietnamese jars for VN users
        is_vietnamese = user.language == "vi" or user.email == "demo-vi@gmail.com"
        jars_data = JARS_DATA_VI if is_vietnamese else JARS_DATA
        
        # Check if user already has jars (any jars)
        existing_jars = db.query(Jar).filter(Jar.user_id == user.id).count()
        if existing_jars > 0:
            log(f"  ⏭️  User {user.email} already has {existing_jars} jars, skipping", Colors.YELLOW, verbose)
            continue
        
        for jar_data in jars_data:
            if dry_run:
                log(f"  [DRY RUN] Would create jar '{jar_data['name']}' for {user.email}", Colors.CYAN, verbose)
            else:
                jar = Jar(
                    name=jar_data["name"],
                    percentage=jar_data["percentage"],
                    user_id=user.id
                )
                db.add(jar)
                created_count += 1
        
        if not dry_run and created_count > 0:
            db.commit()
            total_created += created_count
            log(f"  ✅ Created {created_count} jars for {user.email}", Colors.GREEN, verbose)
            
    if not dry_run and total_created > 0:
        log(f"  {Colors.BOLD}Created {total_created} new jar(s){Colors.RESET}", Colors.GREEN, verbose)


def seed_categories(db: Session, users: list[User], verbose: bool = True, dry_run: bool = False) -> dict[int, list[Category]]:
    """Create categories for each user if they don't exist"""
    log(f"\n{Colors.BOLD}🏷️  Seeding Categories{Colors.RESET}", verbose=verbose)
    
    user_categories = {}
    total_created = 0
    
    for user in users:
        user_categories[user.id] = []
        created_count = 0
        
        # Use Vietnamese categories for VN users
        is_vietnamese = user.language == "vi" or user.email == "demo-vi@gmail.com"
        categories_data = CATEGORIES_VI if is_vietnamese else CATEGORIES
        
        # Check if user already has categories
        existing_cats = db.query(Category).filter(Category.user_id == user.id).all()
        if existing_cats:
            user_categories[user.id] = existing_cats
            log(f"  ⏭️  User {user.email} already has {len(existing_cats)} categories, skipping", Colors.YELLOW, verbose)
            continue
        
        for cat_data in categories_data:
            if dry_run:
                log(f"  [DRY RUN] Would create category '{cat_data['name']}' for {user.email}", Colors.CYAN, verbose)
            else:
                category = Category(
                    name=cat_data["name"],
                    icon=cat_data["icon"],
                    color=cat_data["color"],
                    user_id=user.id
                )
                db.add(category)
                db.commit()
                db.refresh(category)
                user_categories[user.id].append(category)
                created_count += 1
        
        if not dry_run and created_count > 0:
            log(f"  ✅ Created {created_count} categories for {user.email}", Colors.GREEN, verbose)
            total_created += created_count
    
    if not dry_run and total_created > 0:
        log(f"  {Colors.BOLD}Created {total_created} new category(ies){Colors.RESET}", Colors.GREEN, verbose)
    
    return user_categories


def seed_expenses(
    db: Session,
    users: list[User],
    user_categories: dict[int, list[Category]],
    months: int = 3,
    verbose: bool = True,
    dry_run: bool = False
):
    """Generate realistic expenses for users"""
    log(f"\n{Colors.BOLD}💰 Seeding Expenses ({months} months){Colors.RESET}", verbose=verbose)
    
    total_created = 0
    end_date = date.today()
    start_date = end_date - timedelta(days=months * 30)
    
    for user in users:
        multiplier = get_currency_multiplier(user.email)
        categories = user_categories[user.id]
        if not categories:
            log(f"  ⚠️  No categories found for {user.email}, skipping", Colors.RED, verbose)
            continue
        
        # Use Vietnamese data for VN users
        is_vietnamese = user.language == "vi" or user.email == "demo-vi@gmail.com"
        recurring_expenses = RECURRING_EXPENSES_VI if is_vietnamese else RECURRING_EXPENSES
        random_expenses = RANDOM_EXPENSES_VI if is_vietnamese else RANDOM_EXPENSES
        weekly_grocery = WEEKLY_GROCERY_VI if is_vietnamese else WEEKLY_GROCERY_EN
        grocery_category = "Thực phẩm & Tạp hóa" if is_vietnamese else "Food & Groceries"
        
        # Category name to object mapping
        cat_map = {cat.name: cat for cat in categories}
        created_count = 0
        
        # Check if user already has expenses
        existing_count = db.query(Expense).filter(Expense.user_id == user.id).count()
        if existing_count > 0:
            log(f"  ⏭️  User {user.email} already has {existing_count} expenses, skipping", Colors.YELLOW, verbose)
            continue
        
        expenses_to_create = []
        
        # Generate recurring monthly expenses
        current = start_date
        while current <= end_date:
            for recurring in recurring_expenses:
                if recurring["category"] in cat_map:
                    expense_date = date(current.year, current.month, recurring["day"])
                    if start_date <= expense_date <= end_date:
                        amount = Decimal(str(random.randint(recurring["amount_range"][0], recurring["amount_range"][1]) * multiplier))
                        expenses_to_create.append({
                            "amount": amount,
                            "description": recurring["description"],
                            "date": expense_date,
                            "category_id": cat_map[recurring["category"]].id,
                            "user_id": user.id
                        })
            
            # Next month
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)
        
        # Generate weekly groceries (every Sunday)
        current = start_date
        while current <= end_date:
            if current.weekday() == 6 and grocery_category in cat_map:  # Sunday
                amount = Decimal(str(random.randint(80, 150) * multiplier))
                expenses_to_create.append({
                    "amount": amount,
                    "description": random.choice(weekly_grocery),
                    "date": current,
                    "category_id": cat_map[grocery_category].id,
                    "user_id": user.id
                })
            current += timedelta(days=1)
        
        # Generate random expenses
        num_random = random.randint(20, 40)
        for _ in range(num_random):
            template = random.choice(random_expenses)
            if template["category"] in cat_map:
                random_date = start_date + timedelta(days=random.randint(0, (end_date - start_date).days))
                amount = Decimal(str(round(random.uniform(template["amount_range"][0], template["amount_range"][1]) * multiplier, 2)))
                expenses_to_create.append({
                    "amount": amount,
                    "description": random.choice(template["descriptions"]),
                    "date": random_date,
                    "category_id": cat_map[template["category"]].id,
                    "user_id": user.id
                })
        
        # Create expenses in database
        if dry_run:
            log(f"  [DRY RUN] Would create {len(expenses_to_create)} expenses for {user.email}", Colors.CYAN, verbose)
        else:
            for exp_data in expenses_to_create:
                expense = Expense(**exp_data)
                db.add(expense)
            db.commit()
            created_count = len(expenses_to_create)
            total_created += created_count
            log(f"  ✅ Created {created_count} expenses for {user.email}", Colors.GREEN, verbose)
    
    if not dry_run and total_created > 0:
        log(f"  {Colors.BOLD}Created {total_created} new expense(s){Colors.RESET}", Colors.GREEN, verbose)


def seed_incomes(
    db: Session,
    users: list[User],
    months: int = 3,
    verbose: bool = True,
    dry_run: bool = False
):
    """Generate realistic incomes for users"""
    log(f"\n{Colors.BOLD}💵 Seeding Incomes ({months} months){Colors.RESET}", verbose=verbose)
    
    total_created = 0
    end_date = date.today()
    start_date = end_date - timedelta(days=months * 30)
    
    for user in users:
        # Check if user already has incomes
        existing_count = db.query(Income).filter(Income.user_id == user.id).count()
        if existing_count > 0:
            log(f"  ⏭️  User {user.email} already has {existing_count} incomes, skipping", Colors.YELLOW, verbose)
            continue
        
        # Use Vietnamese data for VN users
        is_vietnamese = user.language == "vi" or user.email == "demo-vi@gmail.com"
        income_sources = INCOME_SOURCES_VI if is_vietnamese else INCOME_SOURCES
            
        # Get user jars for distribution
        jars = db.query(Jar).filter(Jar.user_id == user.id).all()
        
        incomes_to_create = []
        
        current = start_date
        while current <= end_date:
            for source in income_sources:
                income_date = date(current.year, current.month, source["day"])
                if start_date <= income_date <= end_date:
                    amount = Decimal(str(random.randint(source["amount_range"][0], source["amount_range"][1]) * get_currency_multiplier(user.email)))
                    incomes_to_create.append({
                        "amount": amount,
                        "source": source["source"],
                        "date": income_date,
                        "user_id": user.id
                    })
            
            # Next month
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)
        
        if dry_run:
            log(f"  [DRY RUN] Would create {len(incomes_to_create)} incomes for {user.email}", Colors.CYAN, verbose)
        else:
            for inc_data in incomes_to_create:
                # Create income
                income = Income(**inc_data)
                db.add(income)
                
                # Distribute to jars
                amount = inc_data["amount"]
                
                # First pass - distribute to jars with explicit percentage
                remaining_percentage = 100.0
                
                for jar in jars:
                    jar_amount = amount * Decimal(str(jar.percentage / 100.0))
                    jar.balance += jar_amount
                    db.add(jar)
                
            db.commit()
            created_count = len(incomes_to_create)
            total_created += created_count
            log(f"  ✅ Created {created_count} incomes for {user.email}", Colors.GREEN, verbose)
            
    if not dry_run and total_created > 0:
        log(f"  {Colors.BOLD}Created {total_created} new income(s){Colors.RESET}", Colors.GREEN, verbose)


def seed_recurring_expenses(
    db: Session,
    users: list[User],
    user_categories: dict[int, list[Category]],
    verbose: bool = True,
    dry_run: bool = False
):
    """Seed recurring expenses setup"""
    log(f"\n{Colors.BOLD}🔄 Seeding Recurring Expenses{Colors.RESET}", verbose=verbose)
    
    total_created = 0
    today = date.today()
    
    for user in users:
        categories = user_categories[user.id]
        if not categories:
            continue
        
        # Use Vietnamese data for VN users
        is_vietnamese = user.language == "vi" or user.email == "demo-vi@gmail.com"
        recurring_templates = RECURRING_EXPENSES_VI if is_vietnamese else RECURRING_EXPENSES
            
        cat_map = {cat.name: cat for cat in categories}
        created_count = 0
        
        # Check existing
        existing_count = db.query(RecurringExpense).filter(RecurringExpense.user_id == user.id).count()
        if existing_count > 0:
            log(f"  ⏭️  User {user.email} already has {existing_count} recurring expenses, skipping", Colors.YELLOW, verbose)
            continue
            
        for template in recurring_templates:
            if template["category"] in cat_map:
                if dry_run:
                    log(f"  [DRY RUN] Would create recurring expense '{template['description']}' for {user.email}", Colors.CYAN, verbose)
                else:
                    amount = Decimal(str(template["amount_range"][0] * get_currency_multiplier(user.email))) # use min amount for template
                    
                    recurring = RecurringExpense(
                        user_id=user.id,
                        category_id=cat_map[template["category"]].id,
                        amount=amount,
                        description=template["description"],
                        frequency=template["frequency"],
                        day_of_month=template["day"],
                        start_date=today,
                        is_active=True
                    )
                    db.add(recurring)
                    created_count += 1
        
        if not dry_run and created_count > 0:
            db.commit()
            total_created += created_count
            log(f"  ✅ Created {created_count} recurring expenses for {user.email}", Colors.GREEN, verbose)
            
    if not dry_run and total_created > 0:
        log(f"  {Colors.BOLD}Created {total_created} new recurring expense(s){Colors.RESET}", Colors.GREEN, verbose)


def seed_goals(db: Session, users: list[User], verbose: bool = True, dry_run: bool = False) -> None:
    """Create demo goals for users"""
    log(f"\n{Colors.BOLD}🎯 Seeding Goals{Colors.RESET}", verbose=verbose)
    
    total_created = 0
    today = date.today()
    
    for user in users:
        created_count = 0
        
        # Use Vietnamese data for VN users
        is_vietnamese = user.language == "vi" or user.email == "demo-vi@gmail.com"
        goals_data = GOALS_VI if is_vietnamese else GOALS
        
        # Check if user already has goals
        existing_count = db.query(Goal).filter(Goal.user_id == user.id).count()
        if existing_count > 0:
            log(f"  ⏭️  User {user.email} already has {existing_count} goals, skipping", Colors.YELLOW, verbose)
            continue
        
        for goal_data in goals_data:
            if dry_run:
                log(f"  [DRY RUN] Would create goal '{goal_data['name']}' for {user.email}", Colors.CYAN, verbose)
            else:
                multiplier = get_currency_multiplier(user.email)
                deadline = today + timedelta(days=goal_data["deadline_months"] * 30)
                
                goal = Goal(
                    name=goal_data["name"],
                    description=goal_data["description"],
                    target_amount=Decimal(str(goal_data["target_amount"] * multiplier)),
                    current_amount=Decimal(str(goal_data["current_amount"] * multiplier)),
                    deadline=deadline,
                    color=goal_data["color"],
                    user_id=user.id
                )
                db.add(goal)
                created_count += 1
        
        if not dry_run and created_count > 0:
            db.commit()
            total_created += created_count
            log(f"  ✅ Created {created_count} goals for {user.email}", Colors.GREEN, verbose)
            
    if not dry_run and total_created > 0:
        log(f"  {Colors.BOLD}Created {total_created} new goal(s){Colors.RESET}", Colors.GREEN, verbose)


def main():
    parser = argparse.ArgumentParser(description="Seed expense tracker database with test data")
    parser.add_argument("--users", type=int, default=3, help="Number of demo users (max 3)")
    parser.add_argument("--months", type=int, default=3, help="Months of expense history to generate")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed progress")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    
    args = parser.parse_args()
    
    # Limit users to available demo accounts
    num_users = min(args.users, len(DEMO_USERS))
    
    log(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}", verbose=True)
    log(f"  💰 Expense Tracker Database Seeder", verbose=True)
    log(f"{'='*60}{Colors.RESET}", verbose=True)
    
    if args.dry_run:
        log(f"\n{Colors.YELLOW}{Colors.BOLD}🔍 DRY RUN MODE - No changes will be made{Colors.RESET}\n", verbose=True)
    
    log(f"Configuration:", verbose=True)
    log(f"  Users: {num_users}", verbose=True)
    log(f"  Months: {args.months}", verbose=True)
    log(f"  Verbose: {args.verbose}", verbose=True)
    
    db = SessionLocal()
    
    try:
        # Seed users
        users_to_seed = DEMO_USERS[:num_users]
        users = seed_users(db, verbose=args.verbose or True, dry_run=args.dry_run)
        
        # Seed jars
        seed_jars(db, users, verbose=args.verbose or True, dry_run=args.dry_run)
        
        # Seed categories
        user_categories = seed_categories(db, users, verbose=args.verbose or True, dry_run=args.dry_run)
        
        # Seed incomes - AFTER jars (for distribution)
        seed_incomes(db, users, months=args.months, verbose=args.verbose or True, dry_run=args.dry_run)
        
        # Seed expenses
        seed_expenses(db, users, user_categories, months=args.months, verbose=args.verbose or True, dry_run=args.dry_run)
        
        # Seed recurring expenses
        seed_recurring_expenses(db, users, user_categories, verbose=args.verbose or True, dry_run=args.dry_run)
        
        # Seed goals
        seed_goals(db, users, verbose=args.verbose or True, dry_run=args.dry_run)
        
        # Summary
        log(f"\n{Colors.BOLD}{Colors.GREEN}{'='*60}", verbose=True)
        log(f"  ✅ Seeding Complete!", verbose=True)
        log(f"{'='*60}{Colors.RESET}", verbose=True)
        
        if not args.dry_run:
            log(f"\n{Colors.BOLD}Demo Credentials:{Colors.RESET}", verbose=True)
            for user_data in users_to_seed:
                log(f"  📧 Email: {user_data['email']}", verbose=True)
                log(f"  🔑 Password: {user_data['password']}\n", verbose=True)
        
    except Exception as e:
        log(f"\n{Colors.RED}❌ Error during seeding: {e}{Colors.RESET}", verbose=True)
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
