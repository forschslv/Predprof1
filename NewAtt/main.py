import random
import string
import os
import csv
import io
import hashlib
import secrets
from datetime import date
from typing import List, Dict

from dotenv import load_dotenv

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()
from logger import logger
import uvicorn
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from auth import JWTAuthMiddleware, create_access_token, require_admin, get_current_user_id
from passlib.context import CryptContext
from menu_parser import parse_menu_text
from models import (
    Dish, DishType, User, ModuleMenu, Order, OrderItem, OrderStatus,
    Base
)
from schemas import (
    DishCreate, DishResponse, DishUpdate, RegisterResponse, UserCreate,
    UserResponse, UserUpdate, VerifyCodeRequest, VerifyCodeResponse, ResendCodeRequest,
    ResendCodeResponse, AdminUpdateRequest, ModuleMenuRequest,
    OrderCreate, OrderResponse, DishBase, AdminUpdateByEmailRequest,
    ModuleMenuResponse, LoginRequest, TokenResponse, SetPasswordRequest
)
import docx_utils

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware


engine = create_engine("sqlite:///./app.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

# Ensure DB has the new column `password_hash` to stay backward compatible
def ensure_password_hash_column():
    try:
        with engine.connect() as conn:
            res = conn.execute(text("PRAGMA table_info('users')")).all()
            cols = [row[1] for row in res]
            if 'password_hash' not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_hash TEXT"))
                logger.info('Added column password_hash to users table')
    except Exception as e:
        logger.warning(f'Could not ensure password_hash column: {e}')

ensure_password_hash_column()

# Инициализация контекста для хеширования паролей
# Используем PBKDF2-SHA256 как основной метод
# Поддерживаем bcrypt для обратной совместимости со старыми хешами
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
    pbkdf2_sha256__rounds=100000  # Уменьшено для совместимости
)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля против хеша"""
    if not hashed_password:
        return False

    try:
        # Очищаем пароль
        plain_password = plain_password.strip()

        # bcrypt имеет ограничение в 72 байта
        if len(plain_password) > 72:
            plain_password = plain_password[:72]

        # Пробуем встроенную верификацию passlib
        is_valid = pwd_context.verify(plain_password, hashed_password)
        return is_valid
    except Exception as e:
        logger.debug(f"CryptContext verification failed: {e}")

        # Резервная попытка: проверить вручную если это наш формат
        if hashed_password.startswith("pbkdf2:sha256:"):
            try:
                parts = hashed_password.split("$")
                if len(parts) == 3:
                    rounds = int(parts[0].split(":")[-1])
                    salt = parts[1]
                    stored_hash = parts[2]

                    test_hash = hashlib.pbkdf2_hmac(
                        'sha256',
                        plain_password.encode(),
                        salt.encode(),
                        rounds
                    )

                    is_valid = test_hash.hex() == stored_hash
                    if is_valid:
                        logger.debug(f"Password verified using fallback method")
                    return is_valid
            except Exception as e2:
                logger.debug(f"Fallback verification failed: {e2}")

        logger.error(f"Error verifying password: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Хеширование пароля с безопасностью"""
    # Убедимся, что пароль это строка
    if not isinstance(password, str):
        password = str(password)

    # Очищаем от пробелов
    password = password.strip()

    # bcrypt имеет ограничение в 72 байта
    if len(password) > 72:
        logger.warning(f"Password truncated from {len(password)} to 72 bytes")
        password = password[:72]

    try:
        # Используем встроенный PBKDF2 из passlib
        hash_result = pwd_context.hash(password)
        logger.debug(f"Password hashed successfully using pbkdf2_sha256")
        return hash_result
    except Exception as e:
        logger.error(f"Error with CryptContext: {e}")
        # Резервный вариант - ручной PBKDF2
        try:
            salt = secrets.token_hex(32)
            password_hash = hashlib.pbkdf2_hmac(
                'sha256',
                password.encode(),
                salt.encode(),
                100000
            )
            # Формат совместимый с нашей верификацией
            hash_result = f"pbkdf2:sha256:100000${salt}${password_hash.hex()}"
            logger.debug(f"Password hashed using fallback PBKDF2 method")
            return hash_result
        except Exception as e2:
            logger.critical(f"Critical error hashing password: {e2}")
            raise HTTPException(status_code=500, detail="Error hashing password")


def get_db() -> Session:
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()


security_scheme = HTTPBearer(auto_error=False)

app = FastAPI(
    title="Canteen API",
    dependencies=[Depends(security_scheme)]
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:63342",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://10.92.59.143:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(JWTAuthMiddleware)


def get_admin_user(request: Request, db: Session = Depends(get_db)) -> User:
    return require_admin(request, db)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    a = request.items()
    print(a)
    user_id = get_current_user_id(request)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def generate_verification_code() -> str:
    return ''.join(random.choices(string.digits, k=6))


SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


def send_verification_email(to_email: str, code: str) -> None:
    print(f"--- EMAIL SIMULATION (No Credentials): Code for {to_email} is {code} ---")
    # print(to_email, code)
    # if not SMTP_USER or not SMTP_PASSWORD:
    #     return
    # msg = MIMEMultipart()
    # msg['From'] = SMTP_USER
    # msg['To'] = to_email
    # msg['Subject'] = "Ваш код подтверждения"
    #
    # body = f"""
    # <html>
    #     <body>
    #         <h2>Код подтверждения</h2>
    #         <p>Ваш код для входа: <b>{code}</b></p>
    #         <p>Никому не сообщайте этот код.</p>
    #     </body>
    # </html>
    # """
    #
    # msg.attach(MIMEText(body, 'html'))
    #
    # server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    # server.ehlo()
    # server.starttls()
    # server.ehlo()
    #
    # server.login(SMTP_USER, SMTP_PASSWORD)
    #
    # server.sendmail(SMTP_USER, to_email, msg.as_string())
    #
    # server.quit()



@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()

    if existing:
        code = generate_verification_code()
        existing.verification_code = code
        db.commit()
        db.refresh(existing)
        send_verification_email(user_data.email, code)
        return RegisterResponse(message="Code resent", user=UserResponse.model_validate(existing))

    # Создание нового пользователя
    if not user_data.name or not user_data.secondary_name:
        raise HTTPException(status_code=400, detail="Для новых пользователей требуются имя и отчество")
    if user_data.status not in {"active", "inactive"}:
        raise HTTPException(status_code=400, detail="Статус должен быть 'активен' или 'неактивен'")

    code = generate_verification_code()

    # При регистрации допускаем, что клиент может передать пароль в body (необязательно)
    password_hash = None
    if user_data.password:
        # Пароль передан при регистрации
        password_hash = get_password_hash(user_data.password)

    new_user = User(
        name=user_data.name,
        secondary_name=user_data.secondary_name,
        email=user_data.email,
        status=user_data.status,
        verification_code=code,
        password_hash=password_hash
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    send_verification_email(new_user.email, code)
    return RegisterResponse(message="Registered", user=UserResponse.model_validate(new_user))

@app.get("/users/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    logger.debug(f"Current user: {current_user}")
    return current_user

@app.patch("/users/me", response_model=UserResponse)
def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление данных текущего пользователя"""
    update_data = user_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    # Исключаем поле status из обновления - оно управляется только на бэкенде
    update_data.pop('status', None)

    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/verify-code", response_model=VerifyCodeResponse)
def verify_code(data: VerifyCodeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or user.verification_code != data.code:
        raise HTTPException(status_code=400, detail="Неверный код")

    user.email_verified = True
    user.verification_code = None
    db.commit()
    token = create_access_token(data={"sub": str(user.id)})
    return VerifyCodeResponse(access_token=token, token_type="bearer", user=UserResponse.model_validate(user))


@app.post("/auth/token", response_model=TokenResponse)
def login_for_access_token(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user:
        # Для обратной совместимости можно отправить код подтверждения
        raise HTTPException(status_code=400, detail="Пользователь не найден или неверные данные")

    if user.password_hash:
        if not verify_password(login_data.password, user.password_hash):
            raise HTTPException(status_code=400, detail="Неверный пароль")
    else:
        # Пользователь не имеет пароля — отвергаем попытку входа по паролю
        raise HTTPException(status_code=400, detail="У пользователя не настроен пароль. Войдите через подтверждение по почте.")

    token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=token, token_type="bearer", user=UserResponse.model_validate(user))


@app.post("/set-password", response_model=UserResponse)
def set_password(
    password_data: SetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Установка пароля для текущего пользователя"""
    # Валидация пароля
    if password_data.password != password_data.password_confirm:
        raise HTTPException(status_code=400, detail="Пароли не совпадают")

    if len(password_data.password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 6 символов")

    # Установка хеша пароля
    current_user.password_hash = get_password_hash(password_data.password)
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)



@app.get("/menu", response_model=List[DishResponse])
def get_global_menu(db: Session = Depends(get_db)):
    temp = db.query(Dish).all()
    logger.debug(f"Global menu: {temp}")
    return temp


@app.post("/menu/dish", response_model=DishResponse)
def create_dish(dish: DishCreate, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    new_dish = Dish(**dish.model_dump())
    db.add(new_dish)
    db.commit()
    db.refresh(new_dish)
    return new_dish


@app.post("/menu/upload")
async def upload_menu_file(
    file: UploadFile = File(...),
    is_provider: bool = True,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    content = await file.read()
    content_str = content.decode("utf-8")

    dishes_data = parse_menu_text(content_str)



    db.query(Dish).filter(Dish.is_provider == is_provider).delete(synchronize_session=False)

    new_dishes = []
    for item in dishes_data:
        dish = Dish(
            name=item.name,
            type=item.type,
            composition=item.composition,
            quantity_grams=item.quantity_grams,
            price_rub=item.price_rub,
            is_provider=is_provider
        )
        db.add(dish)
        new_dishes.append(dish)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка в базе данных: {e}")

    return {
        "message": "Menu updated successfully",
        "deleted_old": True,
        "added_new": len(new_dishes),
        "menu_type": "Provider" if is_provider else "Own Kitchen"
    }



@app.post("/module-menu", status_code=201)
def set_module_menu(
        menu_data: ModuleMenuRequest,
        db: Session = Depends(get_db),
        admin: User = Depends(get_admin_user)
):
    db.query(ModuleMenu).filter(ModuleMenu.week_start_date == menu_data.week_start_date).delete()

    for day_entry in menu_data.schedule:
        day_idx = day_entry.day_of_week
        dishes = db.query(Dish).filter(Dish.id.in_(day_entry.dish_ids)).all()

        type_counts = {}
        for d in dishes:
            type_counts[d.type] = type_counts.get(d.type, 0) + 1

        for dtype, count in type_counts.items():
            if count > 2:
                raise HTTPException(
                    status_code=400,
                    detail=f"Day {day_idx}: Too many dishes of type {dtype} (Max 2)"
                )

        for d_id in day_entry.dish_ids:
            mm = ModuleMenu(day_of_week=day_idx, dish_id=d_id, week_start_date=menu_data.week_start_date)
            db.add(mm)

    db.commit()
    return {"message": "Module menu saved successfully for week starting " + str(menu_data.week_start_date)}


@app.get("/module-menu", response_model=List[ModuleMenuResponse])
def get_module_menu(week_start_date: date, db: Session = Depends(get_db)):
    menu_items = db.query(ModuleMenu).filter(ModuleMenu.week_start_date == week_start_date).all()
    return menu_items



@app.post("/orders", response_model=OrderResponse)
def create_order(
        order_data: OrderCreate,
        request: Request,
        db: Session = Depends(get_db)
):
    user = get_current_user(request, db)

    total_price = 0.0
    new_order = Order(
        user_id=user.id,
        week_start_date=order_data.week_start_date,
        status=OrderStatus.PENDING
    )
    db.add(new_order)
    db.flush()

    for day_req in order_data.days:
        for item in day_req.items:
            if item.quantity > 0:
                dish = db.query(Dish).filter(Dish.id == item.dish_id).first()
                if not dish: continue

                cost = dish.price_rub * item.quantity
                total_price += cost

                order_item = OrderItem(
                    order_id=new_order.id,
                    dish_id=dish.id,
                    day_of_week=day_req.day_of_week,
                    quantity=item.quantity
                )
                db.add(order_item)

    new_order.total_amount = total_price
    db.commit()
    db.refresh(new_order)
    return new_order


@app.post("/orders/{order_id}/pay")
async def pay_order(
        order_id: int,
        request: Request,
        file: UploadFile = File(...),
        db: Session = Depends(get_db)
):
    user = get_current_user(request, db)
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    # Проверка типа файла
    allowed_mime_types = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/bmp",
        "image/webp",
    ]
    if file.content_type not in allowed_mime_types:
        raise HTTPException(status_code=400, detail="Недопустимый тип файла. Разрешены только PDF и изображения (JPEG, PNG, JPG, BMP, WEBP).")

    # Дополнительная проверка по расширению
    forbidden_extensions = {".exe", ".zip", ".rar", ".7z", ".tar", ".gz", ".sh", ".bat", ".cmd", ".msi", ".dmg"}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext in forbidden_extensions:
        raise HTTPException(status_code=400, detail="Загрузка исполняемых файлов и архивов запрещена.")

    os.makedirs("uploads", exist_ok=True)
    file_location = f"uploads/{order_id}_{file.filename}"
    with open(file_location, "wb+") as file_object:
        file_object.write(await file.read())

    order.payment_proof_path = file_location
    order.status = OrderStatus.ON_REVIEW

    db.commit()
    return {"message": "Payment proof uploaded"}


@app.get("/orders/{order_id}/receipt")
async def download_receipt(
        order_id: int,
        request: Request,
        db: Session = Depends(get_db)
):
    user = get_current_user(request, db)
    if user.is_admin:
        order = db.query(Order).filter(Order.id == order_id).first()
    else:
        order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()

    if not order:
        logger.debug(f"Order not found for user {user.id}: {order_id}")
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    if not order.payment_proof_path:
        logger.debug(f"Receipt not found for order {order_id}")
        raise HTTPException(status_code=404, detail="Квитанция не найдена")
    
    if not os.path.exists(order.payment_proof_path):
        logger.debug(f"Receipt file not found for order {order_id}: {order.payment_proof_path}")
        raise HTTPException(status_code=404, detail="Файл квитанции не найден")
    logger.debug(f"Returning receipt file for order {order_id}: {order.payment_proof_path}")
    # Определяем Content-Type по расширению файла
    file_path_lower = order.payment_proof_path.lower()
    if file_path_lower.endswith('.pdf'):
        media_type = "application/pdf"
    elif file_path_lower.endswith('.png'):
        media_type = "image/png"
    elif file_path_lower.endswith('.jpg') or file_path_lower.endswith('.jpeg'):
        media_type = "image/jpeg"
    elif file_path_lower.endswith('.bmp'):
        media_type = "image/bmp"
    elif file_path_lower.endswith('.webp'):
        media_type = "image/webp"
    else:
        media_type = "application/octet-stream"
    return FileResponse(
        order.payment_proof_path,
        filename=os.path.basename(order.payment_proof_path),
        media_type=media_type
    )


@app.get("/orders", response_model=List[OrderResponse])
def get_my_orders(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    orders = db.query(Order).filter(Order.user_id == user.id).order_by(Order.id.desc()).all()
    return orders


@app.get("/orders/{order_id}", response_model=OrderResponse)
def get_order_details(order_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    return order


@app.patch("/admin/orders/{order_id}/status")
def update_order_status(
        order_id: int,
        status: OrderStatus,
        db: Session = Depends(get_db),
        admin: User = Depends(get_admin_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order: raise HTTPException(404, "Заказ не найден")
    order.status = status
    db.commit()
    return {"message": f"Order marked as {status}"}


@app.get("/admin/orders/ids")
def get_order_ids_by_status(
        status: OrderStatus,
        db: Session = Depends(get_db),
        admin: User = Depends(get_admin_user)
):
    """
    Возвращает список ID заказов с указанным статусом.
    """
    orders = db.query(Order.id).filter(Order.status == status).order_by(Order.id).all()
    return {"order_ids": [order_id for (order_id,) in orders]}


@app.get("/admin/reports/docx")
def download_table_report(date_query: date, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    day_idx = date_query.weekday()

    items = db.query(OrderItem).join(Order).join(User).join(Dish) \
        .filter(OrderItem.day_of_week == day_idx) \
        .filter(Order.status == OrderStatus.PAID) \
        .all()

    user_map = {}
    for it in items:
        uid = it.order.user_id
        if uid not in user_map:
            user_map[uid] = {
                "user_name": f"{it.order.user.name} {it.order.user.secondary_name}",
                "user_class": it.order.user.status,
                "dishes": []
            }

        d_name = it.dish.short_name if it.dish.short_name else it.dish.name

        for _ in range(it.quantity):
            user_map[uid]["dishes"].append(d_name)

    report_data = list(user_map.values())

    path = docx_utils.generate_table_setting_report(report_data, filename=f"Report_{date_query}.docx")

    return FileResponse(path, filename=f"Table_Report_{date_query}.docx")

@app.get("/module-menu/export")
def export_module_menu(db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    menu_items = db.query(ModuleMenu).join(Dish).order_by(ModuleMenu.day_of_week).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Day', 'Dish Name', 'Type', 'Grams', 'Price'])

    days_map = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for item in menu_items:
        writer.writerow([
            days_map[item.day_of_week],
            item.dish.name,
            item.dish.type,
            item.dish.quantity_grams,
            item.dish.price_rub
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=module_menu.csv"}
    )


@app.get("/admin/reports/summary")
def get_summary_report(date_query: date, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):

    day_idx = date_query.weekday()


    stats = db.query(
        Dish.name,
        func.sum(OrderItem.quantity).label("total_qty"),
        func.sum(OrderItem.quantity * Dish.price_rub).label("total_revenue")
    ).join(OrderItem, OrderItem.dish_id == Dish.id) \
        .join(Order, OrderItem.order_id == Order.id) \
        .filter(OrderItem.day_of_week == day_idx) \
        .filter(Order.status == OrderStatus.PAID) \
        .group_by(Dish.id).all()

    total_day_revenue = sum(s.total_revenue for s in stats) if stats else 0

    return {
        "date": date_query,
        "total_revenue": total_day_revenue,
        "items": [
            {
                "dish": s.name,
                "count": s.total_qty,
                "revenue": s.total_revenue
            }
            for s in stats
        ]
    }

@app.patch("/admin/users/by-email", response_model=UserResponse)
def update_admin_status_by_email(data: AdminUpdateByEmailRequest, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.is_admin = data.is_admin
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)

if __name__ == "__main__":
    import init_db
    init_db.init_db()
    uvicorn.run(app, host="0.0.0.0", port=8000)