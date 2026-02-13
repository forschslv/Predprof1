from pydantic import BaseModel, EmailStr
from typing import List, Optional
from models import DishType, OrderStatus
from datetime import date

class UserCreate(BaseModel):
    name: str
    secondary_name: str
    email: EmailStr
    status: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    secondary_name: Optional[str] = None
    status: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    name: str
    secondary_name: str
    email: str
    status: str
    is_admin: bool
    email_verified: bool

    class Config:
        from_attributes = True

class DishBase(BaseModel):
    name: str
    short_name: Optional[str] = None
    type: DishType
    composition: str
    quantity_grams: int
    price_rub: float
    is_provider: bool = True



class DishCreate(DishBase):
    pass

class DishUpdate(BaseModel):
    name: Optional[str] = None
    price_rub: Optional[float] = None

class DishResponse(DishBase):
    id: int
    is_provider: bool
    class Config:
        from_attributes = True

class ModuleMenuEntry(BaseModel):
    day_of_week: int
    dish_ids: List[int]

class ModuleMenuRequest(BaseModel):
    schedule: List[ModuleMenuEntry]
    week_start_date: date

class ModuleMenuResponse(BaseModel):
    id: int
    day_of_week: int
    dish_id: int
    week_start_date: date

    class Config:
        from_attributes = True

class OrderItemRequest(BaseModel):
    dish_id: int
    quantity: int

class DayOrderRequest(BaseModel):
    day_of_week: int
    items: List[OrderItemRequest]

class OrderCreate(BaseModel):
    week_start_date: date
    days: List[DayOrderRequest]

class OrderResponse(BaseModel):
    id: int
    status: OrderStatus
    total_amount: float
    week_start_date: date
    class Config:
        from_attributes = True

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str

class VerifyCodeResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class RegisterResponse(BaseModel):
    message: str
    user: UserResponse

class ResendCodeRequest(BaseModel):
    email: EmailStr

class ResendCodeResponse(BaseModel):
    message: str

class AdminUpdateRequest(BaseModel):
    is_admin: bool


class AdminUpdateByEmailRequest(BaseModel):
    email: EmailStr
    is_admin: bool