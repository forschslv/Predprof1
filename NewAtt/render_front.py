"""
Файл для рендеринга фронтенда и работы API.
Обслуживает статические файлы из front12345 и подключает API из NewAtt.
API доступно по тем же путям, что и раньше (без префикса /api).
"""
import sys
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from fastapi.responses import FileResponse

# Добавляем путь к модулям бэкенда
sys.path.insert(0, str(Path(__file__).parent / "NewAtt"))

# Импортируем основное приложение из NewAtt.main
from main import app as api_app

# Определяем путь к фронтенду
frontend_path = Path(__file__).parent.parent / "front12345"

# Создаём основное приложение
app = FastAPI(title="Canteen API with Frontend", version="1.0")

# Настраиваем CORS (повторяем настройки из NewAtt/main.py)
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

# Монтируем API приложение под префиксом /api
app.mount("/api", api_app)

# Маппинг путей к HTML файлам
HTML_MAPPING = {
    "/": "index.html",
    "/main": "index.html",
    "/admin": "admin.html",
    "/admin_menu": "admin_menu.html",
    "/admin_orders": "admin_orders.html",
    "/admin_users": "admin_users.html",
    "/dashboard": "dashboard.html",
    "/login": "login.html",
    "/order": "order.html",
    "/order_details": "order_details.html",
    "/verify": "verify.html",
}

@app.get("/")
async def root():
    return FileResponse(frontend_path / "index.html")

@app.get("/main")
async def main_page():
    return FileResponse(frontend_path / "index.html")

@app.get("/admin")
async def admin_page():
    return FileResponse(frontend_path / "admin.html")

@app.get("/admin_menu")
async def admin_menu_page():
    return FileResponse(frontend_path / "admin_menu.html")

@app.get("/admin_orders")
async def admin_orders_page():
    return FileResponse(frontend_path / "admin_orders.html")

@app.get("/admin_users")
async def admin_users_page():
    return FileResponse(frontend_path / "admin_users.html")

@app.get("/dashboard")
async def dashboard_page():
    return FileResponse(frontend_path / "dashboard.html")

@app.get("/login")
async def login_page():
    return FileResponse(frontend_path / "login.html")

@app.get("/order")
async def order_page():
    return FileResponse(frontend_path / "order.html")

@app.get("/order_details")
async def order_details_page():
    return FileResponse(frontend_path / "order_details.html")

@app.get("/verify")
async def verify_page():
    return FileResponse(frontend_path / "verify.html")

# Статические файлы (CSS, JS, etc.) обслуживаем через StaticFiles
app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="static_root")

if __name__ == "__main__":
    # Инициализируем базу данных (если нужно)
    import init_db
    init_db.init_db()
    
    # Запускаем сервер
    uvicorn.run(app, host="0.0.0.0", port=8000)