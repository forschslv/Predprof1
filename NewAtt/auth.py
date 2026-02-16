import os
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session

from models import User
from dotenv import load_dotenv
from logger import logger


load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SUPER_SECRET_KEY_CHANGE_ME")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

security = HTTPBearer(auto_error=False)

PUBLIC_PATHS = [
    "/docs",
    "/redoc",
    "/openapi.json",
    "/register",
    "/verify-code",
    "/resend-code",
    "/auth/token",
]


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()

    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Пропускаем публичные пути
        for path in PUBLIC_PATHS:
            if request.url.path.startswith(path):
                return await call_next(request)

        token = None
        try:
            auth_header = request.headers.get("authorization")
            if auth_header:
                scheme, _, param = auth_header.partition(" ")
                if scheme.lower() == "bearer":
                    token = param

            if not token:
                return await call_next(request)

            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if not user_id:
                return await call_next(request)

            request.state.user_id = int(user_id)
        except Exception as e:
            logger.debug(f"JWT decode error: {e}")
            # Не шлём 401 здесь, чтобы публичные страницы работали корректно

        return await call_next(request)


def get_current_user_id(
        request: Request,
        token: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


def require_admin(request: Request, db: Session) -> User:
    user_id = get_current_user_id(request)

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges (Admin required)"
        )

    return user


def require_cook_or_admin(request: Request, db: Session) -> User:
    user_id = get_current_user_id(request)

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not (user.is_admin or user.is_cook):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges (Cook or Admin required)"
        )

    return user
