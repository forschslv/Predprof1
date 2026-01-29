import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, DateTime, Float, func, Date
from sqlalchemy.orm import sessionmaker, Session, relationship, declarative_base
from passlib.context import CryptContext
from jose import JWTError, jwt

# --- КОНФИГУРАЦИЯ ---
SECRET_KEY = "secret_key_school_olympiad"
ALGORITHM = "HS256"
DATABASE_URL = "sqlite:///./canteen.db"

# --- DB SETUP ---
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- МОДЕЛИ ДАННЫХ ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)  # 'student', 'cook', 'admin'
    allergies = Column(String, default="")
    dietary_preferences = Column(String, default="")
    balance = Column(Float, default=0.0)

class MenuItem(Base):
    __tablename__ = "menu_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    price = Column(Float)
    category = Column(String) # 'breakfast', 'lunch'
    quantity = Column(Integer, default=100)
    description = Column(String, default="")
    is_available = Column(Boolean, default=True)

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    item_id = Column(Integer, ForeignKey("menu_items.id"))
    is_paid = Column(Boolean, default=True)
    is_received = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User")
    item = relationship("MenuItem")

class SupplyRequest(Base):
    __tablename__ = "supply_requests"
    id = Column(Integer, primary_key=True, index=True)
    cook_id = Column(Integer, ForeignKey("users.id"))
    item_name = Column(String)
    amount = Column(Integer)
    unit = Column(String, default="кг")
    status = Column(String, default="pending") # 'pending', 'approved', 'rejected'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    cook = relationship("User")

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    meals_remaining = Column(Integer)
    total_meals = Column(Integer)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime)
    user = relationship("User")

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    item_id = Column(Integer, ForeignKey("menu_items.id"))
    rating = Column(Integer)
    comment = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User")
    item = relationship("MenuItem")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User")

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String, unique=True)
    quantity = Column(Float)
    unit = Column(String)
    min_threshold = Column(Float, default=10.0)

Base.metadata.create_all(bind=engine)

# --- PYDANTIC SCHEMAS ---
class UserRegister(BaseModel):
    username: str
    password: str
    role: str
    allergies: Optional[str] = ""
    dietary_preferences: Optional[str] = ""

class UserLogin(BaseModel):
    username: str
    password: str

class SupplyCreate(BaseModel):
    item_name: str
    amount: int
    unit: Optional[str] = "кг"

class ReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = ""

class MenuItemCreate(BaseModel):
    name: str
    price: float
    category: str
    description: Optional[str] = ""
    quantity: int = 100

class BalanceTopup(BaseModel):
    amount: float

# --- AUTH UTILS ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_token(data: dict):
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str, db: Session):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- УТИЛИТЫ ---
def create_notification(db: Session, user_id: int, message: str):
    notification = Notification(user_id=user_id, message=message)
    db.add(notification)
    db.commit()

# --- APP ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. АВТОРИЗАЦИЯ
@app.post("/register")
def register(user: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(400, "User already exists")
    hashed = pwd_context.hash(user.password)
    new_user = User(
        username=user.username,
        hashed_password=hashed,
        role=user.role,
        allergies=user.allergies,
        dietary_preferences=user.dietary_preferences
    )
    db.add(new_user)
    db.commit()
    return {"msg": "User created successfully"}

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(400, "Invalid credentials")
    token = create_token({"sub": db_user.username, "role": db_user.role})
    return {"access_token": token, "role": db_user.role}

@app.get("/me")
def me(token: str, db: Session = Depends(get_db)):
    return get_current_user(token, db)

# 2. МЕНЮ
@app.get("/menu")
def get_menu(db: Session = Depends(get_db)):
    if not db.query(MenuItem).first():
        db.add(MenuItem(name="Борщ", price=150, category="lunch", description="Традиционный русский суп"))
        db.add(MenuItem(name="Каша овсяная", price=80, category="breakfast", description="Здоровый завтрак"))
        db.add(MenuItem(name="Котлета с пюре", price=120, category="lunch", description="Классическое блюдо"))
        db.commit()
    return db.query(MenuItem).filter(MenuItem.is_available == True).all()

@app.get("/menu/{item_id}")
def get_menu_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    return item

# 3. УЧЕНИК
@app.post("/buy/{item_id}")
async def buy_food(item_id: int, token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "student":
        raise HTTPException(403, "Only students can buy food")
    
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item or not item.is_available:
        raise HTTPException(404, "Item not available")
    if item.quantity < 1:
        raise HTTPException(400, "Item out of stock")
    
    subscription = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.meals_remaining > 0,
        Subscription.expires_at > datetime.datetime.utcnow()
    ).first()
    
    if subscription:
        subscription.meals_remaining -= 1
        payment_method = "subscription"
    else:
        if user.balance < item.price:
            raise HTTPException(400, "Insufficient balance")
        user.balance -= item.price
        payment_method = "balance"
    
    item.quantity -= 1
    new_order = Order(user_id=user.id, item_id=item.id)
    db.add(new_order)
    db.commit()
    
    message = f"Заказ #{new_order.id} оформлен: {item.name} ({payment_method})"
    create_notification(db, user.id, message)
    
    return {"msg": "Order placed successfully", "order_id": new_order.id, "payment_method": payment_method}

@app.put("/receive/{order_id}")
async def receive_food(order_id: int, token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.is_received:
        raise HTTPException(400, "Order already received")
    order.is_received = True
    db.commit()
    return {"msg": "Food received successfully"}

@app.get("/my_orders")
async def get_my_orders(token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    orders = db.query(Order).filter(Order.user_id == user.id).order_by(Order.created_at.desc()).all()
    return [{
        "id": o.id,
        "item_name": o.item.name,
        "price": o.item.price,
        "is_received": o.is_received,
        "created_at": o.created_at
    } for o in orders]

@app.post("/topup_balance")
async def topup_balance(token: str, data: BalanceTopup, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    user.balance += data.amount
    db.commit()
    create_notification(db, user.id, f"Баланс пополнен на {data.amount}₽")
    return {"msg": "Balance topped up", "new_balance": user.balance}

@app.post("/buy_subscription")
async def buy_subscription(token: str, meals_count: int = Query(..., ge=5), db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "student":
        raise HTTPException(403, "Only students can buy subscriptions")
    
    prices = {5: 450, 10: 850, 20: 1600, 30: 2250}
    if meals_count not in prices:
        raise HTTPException(400, "Invalid subscription size")
    
    price = prices[meals_count]
    if user.balance < price:
        raise HTTPException(400, "Insufficient balance")
    
    user.balance -= price
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=30)
    subscription = Subscription(
        user_id=user.id,
        meals_remaining=meals_count,
        total_meals=meals_count,
        expires_at=expires_at
    )
    db.add(subscription)
    db.commit()
    
    create_notification(db, user.id, f"Абонемент на {meals_count} обедов активирован!")
    return {"msg": "Subscription purchased", "meals_remaining": meals_count}

@app.post("/review/{item_id}")
async def add_review(item_id: int, token: str, review: ReviewCreate, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "student":
        raise HTTPException(403, "Only students can leave reviews")
    
    order = db.query(Order).filter(
        Order.user_id == user.id,
        Order.item_id == item_id,
        Order.is_received == True
    ).first()
    if not order:
        raise HTTPException(400, "You can only review items you have received")
    
    existing = db.query(Review).filter(Review.user_id == user.id, Review.item_id == item_id).first()
    if existing:
        raise HTTPException(400, "You have already reviewed this item")
    
    new_review = Review(
        user_id=user.id,
        item_id=item_id,
        rating=review.rating,
        comment=review.comment
    )
    db.add(new_review)
    db.commit()
    return {"msg": "Review added successfully"}

@app.get("/reviews/{item_id}")
def get_reviews(item_id: int, db: Session = Depends(get_db)):
    reviews = db.query(Review).filter(Review.item_id == item_id).order_by(Review.created_at.desc()).all()
    return [{
        "id": r.id,
        "username": r.user.username,
        "rating": r.rating,
        "comment": r.comment,
        "created_at": r.created_at
    } for r in reviews]

@app.get("/my_profile")
async def get_profile(token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    subscription = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.meals_remaining > 0,
        Subscription.expires_at > datetime.datetime.utcnow()
    ).first()
    
    return {
        "username": user.username,
        "balance": user.balance,
        "allergies": user.allergies,
        "dietary_preferences": user.dietary_preferences,
        "subscription": {
            "meals_remaining": subscription.meals_remaining,
            "expires_at": subscription.expires_at
        } if subscription else None
    }

@app.put("/update_profile")
async def update_profile(token: str, allergies: Optional[str] = None, dietary_preferences: Optional[str] = None, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if allergies is not None:
        user.allergies = allergies
    if dietary_preferences is not None:
        user.dietary_preferences = dietary_preferences
    db.commit()
    return {"msg": "Profile updated successfully"}

# 4. ПОВАР
@app.post("/supply")
async def request_supply(token: str, req: SupplyCreate, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "cook":
        raise HTTPException(403, "Only cooks can request supplies")
    
    new_req = SupplyRequest(cook_id=user.id, item_name=req.item_name, amount=req.amount, unit=req.unit)
    db.add(new_req)
    db.commit()
    
    admins = db.query(User).filter(User.role == "admin").all()
    for admin in admins:
        create_notification(db, admin.id, f"Новая заявка: {req.item_name} ({req.amount} {req.unit})")
    
    return {"msg": "Supply request submitted"}

@app.get("/cook/dishes")
async def get_dish_inventory(token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "cook":
        raise HTTPException(403, "Only cooks can access this")
    items = db.query(MenuItem).filter(MenuItem.category.in_(["breakfast", "lunch"])).all()
    return [{
        "id": item.id,
        "name": item.name,
        "quantity": item.quantity,
        "category": item.category
    } for item in items]

@app.put("/cook/dishes/{item_id}/quantity")
async def update_dish_quantity(item_id: int, token: str, quantity: int, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "cook":
        raise HTTPException(403, "Only cooks can update dish quantities")
    
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    
    item.quantity = quantity
    db.commit()
    return {"msg": "Quantity updated successfully"}

@app.get("/cook/inventory")
async def get_inventory(token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "cook":
        raise HTTPException(403, "Only cooks can access inventory")
    return db.query(Inventory).all()

@app.post("/cook/inventory")
async def add_inventory_item(token: str, name: str, quantity: float, unit: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "cook":
        raise HTTPException(403, "Only cooks can manage inventory")
    
    existing = db.query(Inventory).filter(Inventory.item_name == name).first()
    if existing:
        existing.quantity += quantity
    else:
        new_item = Inventory(item_name=name, quantity=quantity, unit=unit)
        db.add(new_item)
    
    db.commit()
    return {"msg": "Inventory item updated"}

@app.put("/cook/inventory/{item_id}")
async def update_inventory_item(item_id: int, token: str, quantity: float, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "cook":
        raise HTTPException(403, "Only cooks can update inventory")
    
    item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    
    item.quantity = quantity
    db.commit()
    return {"msg": "Inventory updated"}

# 5. АДМИН
@app.get("/admin/stats")
async def get_stats(token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "admin":
        raise HTTPException(403, "Admins only")
    
    total_sales = db.query(Order).count()
    revenue = db.query(func.sum(MenuItem.price)).join(Order).scalar() or 0
    
    pending_supplies = db.query(SupplyRequest).filter(SupplyRequest.status == "pending").all()
    
    return {
        "total_sales": total_sales,
        "revenue": revenue,
        "pending_supplies": [{
            "id": req.id,
            "item_name": req.item_name,
            "amount": req.amount,
            "unit": req.unit,
            "cook_name": req.cook.username,
            "created_at": req.created_at
        } for req in pending_supplies]
    }

@app.put("/admin/approve_supply/{req_id}")
async def approve_supply(req_id: int, token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "admin":
        raise HTTPException(403, "Admins only")
    
    req = db.query(SupplyRequest).filter(SupplyRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Request not found")
    
    req.status = "approved"
    item = db.query(MenuItem).first()
    if item:
        item.quantity += req.amount
    
    db.commit()
    create_notification(db, req.cook_id, f"Ваша заявка на {req.item_name} одобрена")
    return {"msg": "Supply request approved"}

@app.post("/admin/menu")
async def create_menu_item(token: str, item: MenuItemCreate, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "admin":
        raise HTTPException(403, "Admins only")
    
    new_item = MenuItem(**item.dict())
    db.add(new_item)
    db.commit()
    create_notification(db, 0, f"Добавлено новое блюдо: {item.name}")
    return {"msg": "Menu item created", "id": new_item.id}

@app.put("/admin/menu/{item_id}")
async def update_menu_item(item_id: int, token: str, item: MenuItemCreate, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "admin":
        raise HTTPException(403, "Admins only")
    
    db_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(404, "Item not found")
    
    for key, value in item.dict().items():
        setattr(db_item, key, value)
    
    db.commit()
    return {"msg": "Menu item updated"}

@app.delete("/admin/menu/{item_id}")
async def delete_menu_item(item_id: int, token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "admin":
        raise HTTPException(403, "Admins only")
    
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    
    db.delete(item)
    db.commit()
    return {"msg": "Menu item deleted"}

@app.get("/admin/reports")
async def get_reports(token: str, start_date: str, end_date: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    if user.role != "admin":
        raise HTTPException(403, "Admins only")
    
    try:
        start = datetime.datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.datetime.strptime(end_date, "%Y-%m-%d")
    except:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
    
    orders = db.query(Order, MenuItem, User).join(MenuItem).join(User).filter(
        Order.created_at >= start,
        Order.created_at <= end
    ).all()
    
    report = []
    for order, menu_item, user in orders:
        report.append({
            "order_id": order.id,
            "student_name": user.username,
            "item_name": menu_item.name,
            "price": menu_item.price,
            "category": menu_item.category,
            "date": order.created_at,
            "is_received": order.is_received
        })
    
    total_revenue = sum([r["price"] for r in report])
    total_orders = len(report)
    
    return {
        "period": f"{start_date} - {end_date}",
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "details": report
    }

# 6. УВЕДОМЛЕНИЯ
@app.get("/notifications")
async def get_notifications(token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    notifications = db.query(Notification).filter(
        (Notification.user_id == user.id) | (Notification.user_id == 0)
    ).order_by(Notification.created_at.desc()).limit(20).all()
    
    return [{
        "id": n.id,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at
    } for n in notifications]

@app.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, token: str, db: Session = Depends(get_db)):
    user = await get_current_user(token, db)
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id.in_([user.id, 0])
    ).first()
    if not notification:
        raise HTTPException(404, "Notification not found")
    
    notification.is_read = True
    db.commit()
    return {"msg": "Notification marked as read"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8070)