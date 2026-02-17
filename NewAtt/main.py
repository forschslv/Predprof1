import random
import string
import os
import csv
import io
import hashlib
import secrets
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional

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

from auth import JWTAuthMiddleware, create_access_token, require_admin, get_current_user_id, require_cook_or_admin
from passlib.context import CryptContext
from menu_parser import parse_menu_text
from models import (
    Dish, DishType, User, ModuleMenu, Order, OrderItem, OrderStatus, TopupStatus, BalanceTopup,
    Base
)
from schemas import (
    DishCreate, DishResponse, DishUpdate, RegisterResponse, UserCreate,
    UserResponse, UserUpdate, VerifyCodeRequest, VerifyCodeResponse, ResendCodeRequest,
    ResendCodeResponse, AdminUpdateRequest, ModuleMenuRequest,
    OrderCreate, OrderResponse, DishBase, AdminUpdateByEmailRequest,
    ModuleMenuResponse, LoginRequest, TokenResponse, SetPasswordRequest,
    ChangePasswordRequest, PasswordResetConfirmRequest, TopupCreateRequest, TopupResponse
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

# Ensure DB has the new column `is_cook` for the new role
def ensure_is_cook_column():
    try:
        with engine.connect() as conn:
            res = conn.execute(text("PRAGMA table_info('users')")).all()
            cols = [row[1] for row in res]
            if 'is_cook' not in cols:
                # SQLite uses INTEGER for booleans
                conn.execute(text("ALTER TABLE users ADD COLUMN is_cook BOOLEAN DEFAULT 0"))
                logger.info('Added column is_cook to users table')
    except Exception as e:
        logger.warning(f'Could not ensure is_cook column: {e}')

ensure_is_cook_column()

# Ensure DB has the new column `password_reset_code` for password reset flow
def ensure_password_reset_code_column():
    try:
        with engine.connect() as conn:
            res = conn.execute(text("PRAGMA table_info('users')")).all()
            cols = [row[1] for row in res]
            if 'password_reset_code' not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_reset_code TEXT"))
                logger.info('Added column password_reset_code to users table')
    except Exception as e:
        logger.warning(f'Could not ensure password_reset_code column: {e}')

ensure_password_reset_code_column()

# Ensure DB has the new column `balance`
def ensure_balance_column():
    try:
        with engine.connect() as conn:
            res = conn.execute(text("PRAGMA table_info('users')")).all()
            cols = [row[1] for row in res]
            if 'balance' not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN balance REAL DEFAULT 0.0"))
                logger.info('Added column balance to users table')
    except Exception as e:
        logger.warning(f'Could not ensure balance column: {e}')

ensure_balance_column()

# Ensure table balance_topups exists (simple check)
def ensure_balance_topups_table():
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='balance_topups';")).all()
            if not res:
                conn.execute(text('''
                    CREATE TABLE balance_topups (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        amount REAL DEFAULT 0.0,
                        status TEXT DEFAULT 'PENDING',
                        payment_proof_path TEXT,
                        created_at TEXT
                    )
                '''))
                logger.info('Created table balance_topups')
    except Exception as e:
        logger.warning(f'Could not ensure balance_topups table: {e}')

ensure_balance_topups_table()

# Ensure DB has the new column `allergies` for storing user allergies text
def ensure_allergies_column():
    try:
        with engine.connect() as conn:
            res = conn.execute(text("PRAGMA table_info('users')")).all()
            cols = [row[1] for row in res]
            if 'allergies' not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN allergies TEXT"))
                logger.info('Added column allergies to users table')
    except Exception as e:
        logger.warning(f'Could not ensure allergies column: {e}')

ensure_allergies_column()

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


def get_db():
    """Dependency generator that yields a DB session and ensures it's closed after use.

    Previously this function returned a session and closed it immediately in a finally block,
    which resulted in closed sessions being used by request handlers and eventually exhausted
    the connection pool. FastAPI expects database dependencies to be generator functions that
    yield the session so the framework can manage lifecycle correctly.
    """
    db = SessionLocal()
    try:
        yield db
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

# Wrapper to use require_cook_or_admin as a dependency (so FastAPI can resolve get_db correctly)
def get_cook_or_admin_user(request: Request, db: Session = Depends(get_db)) -> User:
    return require_cook_or_admin(request, db)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    # Получаем user_id, который устанавливает JWTAuthMiddleware через request.state.user_id
    user_id = get_current_user_id(request)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def generate_verification_code() -> str:
    return ''.join(random.choices(string.digits, k=6))

def generate_random_code(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


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

@app.post('/password/reset')
def password_reset_request(data: ResendCodeRequest, db: Session = Depends(get_db)):
    """Запрос кода сброса пароля по почте"""
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        # Не раскрываем, что пользователя нет — возвращаем 200
        logger.info(f'Password reset requested for unknown email: {data.email}')
        return ResendCodeResponse(message='If the email exists, a code has been sent')

    code = generate_random_code()
    user.password_reset_code = code
    db.commit()
    db.refresh(user)
    logger.info(f'Password reset code generated for {user.email}: {code}')
    # Отправим на почту тот же текст (симуляция)
    send_verification_email(str(user.email), code)
    return ResendCodeResponse(message='If the email exists, a code has been sent')


@app.post('/password/reset/confirm', response_model=UserResponse)
def password_reset_confirm(data: PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    """Подтверждение кода сброса и установка нового пароля"""
    # Нормализуем входные данные
    code = (data.code or '').strip()
    email = (data.email or '').strip().lower() if getattr(data, 'email', None) else None

    # Ищем пользователя по коду и опционально по email (если передан)
    if email:
        user = db.query(User).filter(func.lower(User.email) == email, User.password_reset_code == code).first()
        if not user:
            logger.info(f'No user found by email+code, trying by code only (email provided was {email})')
            user = db.query(User).filter(User.password_reset_code == code).first()
    else:
        user = db.query(User).filter(User.password_reset_code == code).first()

    logger.info(f'Password reset confirm attempt - email: {email}, code: {code}, found_user: {bool(user)}')

    if not user:
        raise HTTPException(status_code=400, detail='Неверный код')

    if data.password != data.password_confirm:
        raise HTTPException(status_code=400, detail='Пароли не совпадают')

    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail='Пароль должен быть не менее 6 символов')

    user.password_hash = get_password_hash(data.password)
    user.password_reset_code = None
    db.commit()
    db.refresh(user)
    logger.info(f'Password reset successful for {user.email}')
    return UserResponse.model_validate(user)


@app.patch('/users/me/password', response_model=UserResponse)
def change_password_for_current_user(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сменить пароль: либо указать старый пароль, либо использовать подтверждение по почте (password_reset_code).
    Если передан old_password — проверяем его и меняем. Если не передан, отправляем код на почту предварительно или ожидаем, что код был подтвержден через /password/reset/confirm.
    """
    # Если указан old_password, проверяем
    if data.old_password:
        if not current_user.password_hash:
            raise HTTPException(status_code=400, detail='У вас не настроен старый пароль')
        if not verify_password(data.old_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail='Старый пароль неверен')

        # В этом случае просто обновляем пароль
        if data.password != data.password_confirm:
            raise HTTPException(status_code=400, detail='Пароли не совпадают')
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail='Пароль должен быть не менее 6 символов')

        current_user.password_hash = get_password_hash(data.password)
        db.commit()
        db.refresh(current_user)
        return UserResponse.model_validate(current_user)

    # Если old_password не передан, пользователь должен сначала запросить код через /password/reset и затем подтвердить через /password/reset/confirm.
    raise HTTPException(status_code=400, detail='Нужен старый пароль или подтвердите смену через письмо (см. /password/reset)')

@app.get("/users/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    logger.debug(f"Current user id: {getattr(current_user, 'id', None)}")
    # Явно сериализуем модель пользователя в pydantic-схему — это предотвращает случаи, когда
    # FastAPI/ResponseModel по каким-то причинам не сериализует ORM-объект правильно.
    return UserResponse.model_validate(current_user)

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
    # Явно возвращаем Pydantic-сериализованный ответ (включая новое поле allergies)
    return UserResponse.model_validate(current_user)

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
def create_dish(dish: DishCreate, db: Session = Depends(get_db), admin: User = Depends(get_cook_or_admin_user)):
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
    admin: User = Depends(get_cook_or_admin_user)
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
        admin: User = Depends(get_cook_or_admin_user)
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
def download_table_report(
    date_query: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    all_time: Optional[bool] = False,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """
    Скачивание DOCX-отчёта (таблицы для столовой).
    Поддерживает те же режимы, что и summary: date_query, start_date+end_date, all_time.
    Формат отчёта — список пользователей с их блюдами (каждая позиция по количеству раз).
    """
    try:
        # Подготовляем список OrderItem-ов в зависимости от режима
        items = []

        if all_time:
            items = db.query(OrderItem).join(Order).join(User).join(Dish).filter(Order.status == OrderStatus.PAID).all()
            filename_suffix = 'all_time'
        elif start_date and end_date:
            if start_date > end_date:
                start_date, end_date = end_date, start_date
            # Заберём все оплаченные позиции и отфильтруем в Python по дате
            candidates = db.query(OrderItem).join(Order).join(User).join(Dish).filter(Order.status == OrderStatus.PAID).all()
            for it in candidates:
                if not it.order or not it.order.week_start_date:
                    continue
                actual_date = it.order.week_start_date + timedelta(days=(it.day_of_week - 1))
                actual_date_only = actual_date if isinstance(actual_date, date) else actual_date.date()
                if start_date <= actual_date_only <= end_date:
                    items.append(it)
            filename_suffix = f"{start_date}_to_{end_date}"
        elif date_query:
            # single day — use isoweekday to match 1..7
            day_idx = date_query.isoweekday()
            items = db.query(OrderItem).join(Order).join(User).join(Dish) \
                .filter(OrderItem.day_of_week == day_idx) \
                .filter(Order.status == OrderStatus.PAID) \
                .all()
            filename_suffix = f"{date_query}"
        else:
            raise HTTPException(status_code=400, detail="Укажите date_query или start_date+end_date или all_time=true")

        user_map = {}
        for it in items:
            uid = it.order.user_id if it.order else None
            if uid is None:
                continue
            if uid not in user_map:
                user_map[uid] = {
                    "user_name": f"{it.order.user.name} {it.order.user.secondary_name}",
                    "user_class": it.order.user.status,
                    "dishes": [],
                    "total": 0.0
                }

            d_name = it.dish.short_name if it.dish.short_name else it.dish.name
            # Добавляем dish столько раз, сколько quantity и аккумулируем сумму
            try:
                qty = int(it.quantity or 0)
            except Exception:
                qty = 0
            price = float(it.dish.price_rub or 0.0)
            for _ in range(qty):
                user_map[uid]["dishes"].append(d_name)
            user_map[uid]["total"] += qty * price

        report_data = list(user_map.values())

        # Рассчитываем общий итог по всем пользователям
        grand_total = sum(u.get('total', 0.0) for u in report_data)

        # Формируем удобочитаемый заголовок периода
        if all_time:
            period_text = 'За всё время'
        elif start_date and end_date:
            period_text = f"За период: {start_date} — {end_date}"
        elif date_query:
            period_text = f"За день: {date_query}"
        else:
            period_text = ''

        # Генерируем и возвращаем DOCX (передаём period и общий итог)
        os.makedirs("reports", exist_ok=True)
        path = docx_utils.generate_table_setting_report(report_data, filename=f"Report_{filename_suffix}.docx", period=period_text, grand_total=grand_total)
        return FileResponse(path, filename=f"Table_Report_{filename_suffix}.docx")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error while generating docx report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/module-menu/export")
def export_module_menu(db: Session = Depends(get_db), admin: User = Depends(get_cook_or_admin_user)):
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
def get_summary_report(
    date_query: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    all_time: Optional[bool] = False,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """
    Возвращает сводку по выручке/количеству блюд.

    Поддерживаем три режима:
    - date_query (существующее поведение): сводка за день недели, соответствующий переданной дате (weekday).
    - start_date + end_date: сводка по календарному диапазону (мы вычисляем фактическую дату позиции как order.week_start_date + (day_of_week-1)).
    - all_time=true: суммируем по всему доступному датасету (все оплаченные позиции).

    Если несколько режимов переданы одновременно — приоритет: all_time -> (start_date+end_date) -> date_query.
    """
    try:
        # Приоритет: all_time
        if all_time:
            items = db.query(OrderItem).join(Order).join(Dish).filter(Order.status == OrderStatus.PAID).all()

            stats_map = {}
            for it in items:
                d_id = it.dish.id
                if d_id not in stats_map:
                    stats_map[d_id] = {"name": it.dish.name, "qty": 0, "revenue": 0.0}
                stats_map[d_id]["qty"] += (it.quantity or 0)
                stats_map[d_id]["revenue"] += (it.quantity or 0) * (it.dish.price_rub or 0.0)

            items_list = [
                {"dish": v["name"], "count": v["qty"], "revenue": v["revenue"]}
                for v in stats_map.values()
            ]
            total_revenue = sum(v["revenue"] for v in stats_map.values())

            return {"date": "all_time", "total_revenue": total_revenue, "items": items_list}

        # Диапазон дат
        if start_date and end_date:
            if start_date > end_date:
                # поменяем местами для удобства
                start_date, end_date = end_date, start_date

            items = db.query(OrderItem).join(Order).join(Dish).filter(Order.status == OrderStatus.PAID).all()

            stats_map = {}
            for it in items:
                # Вычисляем фактическую дату позиции
                if not it.order or not it.order.week_start_date:
                    continue
                actual_date = it.order.week_start_date + timedelta(days=(it.day_of_week - 1))
                # Сравниваем как date
                actual_date_only = actual_date if isinstance(actual_date, date) else actual_date.date()
                if actual_date_only < start_date or actual_date_only > end_date:
                    continue

                d_id = it.dish.id
                if d_id not in stats_map:
                    stats_map[d_id] = {"name": it.dish.name, "qty": 0, "revenue": 0.0}
                stats_map[d_id]["qty"] += (it.quantity or 0)
                stats_map[d_id]["revenue"] += (it.quantity or 0) * (it.dish.price_rub or 0.0)

            items_list = [
                {"dish": v["name"], "count": v["qty"], "revenue": v["revenue"]}
                for v in stats_map.values()
            ]
            total_revenue = sum(v["revenue"] for v in stats_map.values())

            return {"date": {"start": start_date, "end": end_date}, "total_revenue": total_revenue, "items": items_list}

        # Совместимость: одиночная дата (weekday)
        if date_query:
            # Используем isoweekday: 1 = Monday, ..., 7 = Sunday — это соответствует значениям day_of_week в OrderItem
            day_idx = date_query.isoweekday()

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

        # Если ничего явно не указано — просим клиента передать параметры
        raise HTTPException(status_code=400, detail="Укажите date_query или start_date+end_date или all_time=true")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error while building summary report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/admin/users/by-email", response_model=UserResponse)
def update_admin_status_by_email(data: AdminUpdateByEmailRequest, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    # Админские права нельзя снимать у существующего админа
    if user.is_admin and not data.is_admin:
        raise HTTPException(status_code=403, detail="Права администратора нельзя менять")
    user.is_admin = data.is_admin
    # Если в запросе передан is_cook, админ может установить/снять роль повара
    if hasattr(data, 'is_cook') and data.is_cook is not None:
        user.is_cook = data.is_cook
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


# Новые эндпоинты для поваров/админов — просмотр заказов и статусов
@app.get("/staff/orders", response_model=List[OrderResponse])
def staff_get_orders(db: Session = Depends(get_db), staff: User = Depends(get_cook_or_admin_user)):
    orders = db.query(Order).order_by(Order.id.desc()).all()
    return orders

@app.get("/staff/orders/{order_id}", response_model=OrderResponse)
def staff_get_order(order_id: int, db: Session = Depends(get_db), staff: User = Depends(get_cook_or_admin_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    return order


@app.post('/balance/topups', response_model=TopupResponse)
def create_topup(data: TopupCreateRequest, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail='Amount must be positive')

    topup = BalanceTopup(user_id=user.id, amount=data.amount, status=TopupStatus.PENDING)
    db.add(topup)
    db.commit()
    db.refresh(topup)
    return topup


@app.post('/balance/topups/{topup_id}/proof')
async def upload_topup_proof(topup_id: int, request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    topup = db.query(BalanceTopup).filter(BalanceTopup.id == topup_id).first()
    if not topup:
        raise HTTPException(status_code=404, detail='Topup not found')
    if topup.user_id != user.id:
        raise HTTPException(status_code=403, detail='Forbidden')

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

    forbidden_extensions = {".exe", ".zip", ".rar", ".7z", ".tar", ".gz", ".sh", ".bat", ".cmd", ".msi", ".dmg"}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext in forbidden_extensions:
        raise HTTPException(status_code=400, detail="Загрузка исполняемых файлов и архивов запрещена.")

    os.makedirs("uploads", exist_ok=True)
    file_location = f"uploads/topup_{topup_id}_{file.filename}"
    with open(file_location, "wb+") as file_object:
        file_object.write(await file.read())

    topup.payment_proof_path = file_location
    topup.status = TopupStatus.ON_REVIEW
    db.commit()

    return {"message": "Topup proof uploaded"}


@app.get('/balance/topups/{topup_id}/proof')
async def download_topup_proof(topup_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    topup = db.query(BalanceTopup).filter(BalanceTopup.id == topup_id).first()
    if not topup:
        raise HTTPException(status_code=404, detail='Topup not found')
    if topup.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail='Forbidden')
    if not topup.payment_proof_path:
        raise HTTPException(status_code=404, detail='Proof not uploaded')
    if not os.path.exists(topup.payment_proof_path):
        raise HTTPException(status_code=404, detail='File not found')

    file_path_lower = topup.payment_proof_path.lower()
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

    return FileResponse(topup.payment_proof_path, filename=os.path.basename(topup.payment_proof_path), media_type=media_type)


@app.patch('/admin/balance/topups/{topup_id}/status')
def admin_update_topup_status(topup_id: int, status: TopupStatus, amount: Optional[float] = None, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    topup = db.query(BalanceTopup).filter(BalanceTopup.id == topup_id).first()
    if not topup:
        raise HTTPException(status_code=404, detail='Topup not found')

    if topup.status == status:
        return {"message": f"Status already {status.value}"}

    # Если переводим в PAID, прибавляем баланс
    if status == TopupStatus.PAID:
        user = db.query(User).filter(User.id == topup.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        # Определяем сумму, которую админ хочет зачислить: если передан параметр amount — используем его и запишем в topup.amount;
        # иначе используем ранее заявленную сумму в topup.amount.
        used_amount = topup.amount or 0.0
        if amount is not None:
            try:
                used_amount = float(amount)
            except Exception:
                raise HTTPException(status_code=400, detail='Invalid amount')
            topup.amount = used_amount

        user.balance = (user.balance or 0.0) + used_amount

    topup.status = status
    db.commit()

    return {"message": f"Topup {topup_id} marked as {status.value}"}

@app.get('/admin/balance/topups_all', response_model=List[TopupResponse])
def admin_list_topups(db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """Возвращает список всех пополнений для админов (новые вверху)"""
    topups = db.query(BalanceTopup).order_by(BalanceTopup.id.desc()).all()
    return topups

@app.post("/orders/{order_id}/charge")
def charge_order_from_balance(order_id: int, request: Request, db: Session = Depends(get_db)):
    """Списать сумму заказа с баланса пользователя и пометить заказ как PAID, если хватает средств."""
    user = get_current_user(request, db)
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if order.status != OrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Списать можно только заказы в статусе PENDING")

    amount = float(order.total_amount or 0.0)

    # Проверка достаточности баланса
    if (user.balance or 0.0) < amount:
        raise HTTPException(status_code=400, detail='Недостаточно средств на балансе')

    # Выполняем списание — гарантия, что баланс не станет < 0
    new_balance = (user.balance or 0.0) - amount
    if new_balance < 0:
        # На всякий случай, не допускаем отрицательного баланса
        new_balance = 0.0

    user.balance = new_balance
    order.status = OrderStatus.PAID
    # Не меняем поле payment_proof_path — чеки остаются

    db.commit()
    db.refresh(user)
    db.refresh(order)

    return {"message": f"Заказ #{order_id} оплачен со счёта. Остаток: {user.balance:.2f} ₽", "balance": user.balance}

if __name__ == "__main__":
    import init_db
    init_db.init_db()
    uvicorn.run(app, host="0.0.0.0", port=8000)

