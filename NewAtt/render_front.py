"""
Файл для рендеринга фронтенда и работы API.
Обслуживает статические файлы из front12345 и подключает API из NewAtt.
API доступно по тем же путям, что и раньше (без префикса /api).
"""
from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from starlette.responses import FileResponse

from logger import logger
from fastapi import Request, Depends, HTTPException
from sqlalchemy.orm import Session
from auth import require_admin
from main import get_db

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

# Старый маппинг путей к HTML файлам
OLD_HTML_MAPPING: dict[str, str] = {
    "admin":                        "admin/admin.html",
    "admin_menu":                   "admin/admin_menu.html",
    "admin_orders":                 "admin/admin_orders.html",
    "admin_users":                  "admin/admin_users.html",
    "admin_module":                 "admin/admin_module.html",
    "admin_topups":                 "admin/admin_topups.html",
    # "register":                     "register_login/register.html",
    "login":                        "register_login/login.html",
    "verify":                       "register_login/verify.html",
    "register_login":               "register_login/register.html",
    "register_login/register_login":"register_login/register.html",
    "profile":                      "register_login/profile.html",
    "dashboard":                    "main.html",
}

# Маппинг путей к HTML файлам для дебага
DEBUG_HTML_MAPPING: dict[str, str] = {
    "test_error":               "test_error.html",
    "raise_error":              "ERROR"
}

# Маппинг путей к HTML файлам
HTML_MAPPING: dict[str, str] = (
{
    "":                         "hello.html",
    "hello":                    "hello.html",
    "index":                    "main.html",
    "main":                     "main.html",
    "admin/admin":              "admin/admin.html",
    "admin/admin_menu":         "admin/admin_menu.html",
    "admin/admin_orders":       "admin/admin_orders.html",
    "admin/admin_users":        "admin/admin_users.html",
    "admin/admin_module":       "admin/admin_module.html",
    "admin/admin_topups":       "admin/admin_topups.html",
    "register_login/register":  "register_login/register.html",
    "register_login/login":     "register_login/login.html",
    "register_login/verify":    "register_login/verify.html",
    "404":                      "404.html",
    "error":                    "error.html",
    "register_login/profile":   "register_login/profile.html",
} | OLD_HTML_MAPPING | DEBUG_HTML_MAPPING)


@app.get("/{path:path}")
async def catch_all(path: str, request: Request, db: Session = Depends(get_db)):
    try:
        if (path.endswith(".js") or
            path.endswith(".css") or
            path.endswith(".png") or
            path.endswith(".jpg") or
            path.endswith(".jpeg") or
            path.endswith(".svg") or
            path.endswith(".ico")):
            # Если запрашивается статический файл, пробуем его отдать
            logger.debug(f"Request for static file: {path}")
            base_name_of_path = os.path.basename(path)
            file_path = frontend_path / base_name_of_path
            if file_path.is_file():
                return FileResponse(file_path)
            else:
                logger.warning(f"Static file not found: {file_path}")
                file_path = frontend_path / base_name_of_path[base_name_of_path.rfind('.')+1:] / base_name_of_path
                if file_path.is_file():
                    return FileResponse(file_path)
                raise HTTPException(status_code=404, detail="Static file not found")
        if path.endswith(".html"):
            path = path[:-5]
        elif "." in path:
            logger.warning(f"Unsupported file type requested: {path}")
            return FileResponse(frontend_path / "404.html", status_code=404)
        html_file = HTML_MAPPING.get(path)
        logger.debug(f"Request for path {path}, HTML file: {html_file}")
        if html_file:
            if (frontend_path / html_file).is_file():
                return FileResponse(frontend_path / html_file)
            else:
                raise FileNotFoundError(f"File {frontend_path / html_file} doesn't exist")
        else:
            try:
                logger.warning(f"File {path} not found, serving 404.html")
                return FileResponse(frontend_path / "404.html", status_code=404)
            except Exception as e:
                logger.error(f"Error serving 404.html: {e}")
                return {"error": "Internal server error: 404.html not found, please try again later."}, 500
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(repr(e))
        from starlette.responses import RedirectResponse, Response
        import urllib.parse
        
        # Если запрашивается error.html, не делаем редирект, чтобы избежать цикла
        if path == 'error.html' or path == 'error':
            logger.error(f"Error occurred while serving error page: {e}")
            return Response(
                content=f"Internal Server Error: {e}",
                status_code=500,
                media_type="text/plain"
            )
        
        # Create error details
        error_message = str(e)
        error_details = f"Exception occurred: {e.__class__.__name__}"
        error_code = 500
        
        # Create URL with error parameters
        error_url = f"/error.html?code={error_code}&message={urllib.parse.quote(error_message)}&details={urllib.parse.quote(error_details)}&timestamp={urllib.parse.quote(str(datetime.now().isoformat()))}"
        logger.debug(f"Redirecting to error page: {error_url}")
        
        # Use 307 Temporary Redirect to preserve method and body, but we want to show error page
        return RedirectResponse(url=error_url, status_code=307)

# Статические файлы (CSS, JS, etc.) обслуживаем через StaticFiles
# app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="static_root")

if __name__ == "__main__":
    # Инициализируем базу данных (если нужно)
    import init_db
    init_db.init_db()
    
    # Запускаем сервер
    uvicorn.run(app, host="0.0.0.0", port=8000)