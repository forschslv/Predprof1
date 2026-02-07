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

# Добавляем путь к модулям бэкенда
sys.path.insert(0, str(Path(__file__).parent / "NewAtt"))

# Импортируем основное приложение из NewAtt.main
from main import app as api_app

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

# Включаем все маршруты из api_app в корневое приложение
# Это позволяет API работать по тем же путям, что и раньше
# app.include_router(api_app.router)

# Монтируем API приложение под префиксом /api
app.mount("/api", api_app)

# Монтируем статические файлы фронтенда под корень
# Статика будет обслуживаться для путей, не занятых API
frontend_path = Path(__file__).parent.parent / "front12345"
app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")

if __name__ == "__main__":
    # Инициализируем базу данных (если нужно)
    import init_db
    init_db.init_db()
    
    # Запускаем сервер
    uvicorn.run(app, host="0.0.0.0", port=8000)