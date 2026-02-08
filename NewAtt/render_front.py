"""
Файл для рендеринга фронтенда и работы API.
Обслуживает статические файлы из front12345 и подключает API из NewAtt.
API доступно по тем же путям, что и раньше (без префикса /api).
"""
from __future__ import annotations

import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from starlette.responses import FileResponse

from NewAtt.logger import logger

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
    "": "main.html",
    "index": "main.html",
    "main": "main.html",
    "dashboard": "main.html",
    "admin": "admin.html",
    "admin_menu": "admin_menu.html",
    "admin_orders": "admin_orders.html",
    "admin_users": "admin_users.html",
    "register_login": "register_login.html",
    "order_details": "order_details.html",
    "verify": "verify.html",
    "404": "404.html",
    "test_error": "test_error.html",
    "error": "error.html",
}


@app.get("/{path:path}")
async def catch_all(path: str):#-> FileResponse | tuple[dict[str, str], int]
    if (path.endswith(".js") or
        path.endswith(".css") or
        path.endswith(".png") or
        path.endswith(".jpg") or
        path.endswith(".jpeg") or
        path.endswith(".svg") or
        path.endswith(".ico")):
        # Если запрашивается статический файл, пробуем его отдать
        logger.debug(f"Request for static file: {path}")
        file_path = frontend_path / path
        if file_path.is_file():
            return FileResponse(file_path)
        else:
            logger.warning(f"Static file not found: {file_path}")
            raise HTTPException(status_code=404, detail="Static file not found")
    if path.endswith(".html"):
        path = path[:-5]
    elif "." in path:
        logger.warning(f"Unsupported file type requested: {path}")
        raise HTTPException(status_code=404, detail="This file type is not supported")
    html_file = HTML_MAPPING.get(path)
    logger.debug(f"Request for path {path}, HTML file: {html_file}")
    if html_file:
        return FileResponse(frontend_path / html_file)
    else:
        try:
            logger.warning(f"File {path} not found, serving 404.html")
            return FileResponse(frontend_path / "404.html", status_code=404)
        except Exception as e:
            logger.error(f"Error serving 404.html: {e}")
            return {"error": "Internal server error: 404.html not found, please try again later."}, 500


# Статические файлы (CSS, JS, etc.) обслуживаем через StaticFiles
app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="static_root")

if __name__ == "__main__":
    # Инициализируем базу данных (если нужно)
    import init_db
    init_db.init_db()
    
    # Запускаем сервер
    uvicorn.run(app, host="0.0.0.0", port=8000)