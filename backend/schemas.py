from pydantic import BaseModel, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: str

class UserLogin(BaseModel):
    username: str
    password: str

# --- SỬA: XÓA requester_id VÌ BACKEND TỰ LẤY TỪ TOKEN ---
class TaskCreate(BaseModel):
    title: str
    skill_name: Optional[str] = None
    description: str
    hours: float
    deadline: Optional[str] = None 
    

# SCHEMA ĐỂ XUẤT DỮ LIỆU TASK ---
class TaskOut(BaseModel):
    task_id: int
    title: str
    skill_name: Optional[str]
    description: str
    hours: float
    status: str
    evidence_image: Optional[str] = None 
    
    class Config:
        from_attributes = True


class ExchangeRequest(BaseModel):
    amount: float
    action: str
    bank_info: Optional[str] = None
    # ĐÃ XÓA user_id: int Ở ĐÂY

class ProfileUpdate(BaseModel):
    full_name: str
    email: str

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class UserOut(BaseModel):
    user_id: int
    username: str
    full_name: Optional[str]
    email: str
    balance_available: float
    is_admin: bool
    bank_info: Optional[str] = None
    class Config:
        from_attributes = True

# SCHEMA DÀNH CHO JWT TOKEN 
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None