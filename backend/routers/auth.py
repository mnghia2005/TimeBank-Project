from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import models, schemas
from database import get_db
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer

# --- CẤU HÌNH JWT ---
SECRET_KEY = "NGHIA_PTIT_DE_2026_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 

# Cấu hình để lấy Token từ Header Authorization: Bearer <token>
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

router = APIRouter(prefix="/api", tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password): 
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password): 
    return pwd_context.verify(plain_password, hashed_password)

# --- HÀM TẠO TOKEN ---
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# HÀM SOÁT VÉ 

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn!",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Giải mã Token để lấy username (sub)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    # Truy vấn thông tin User từ Database
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# ĐĂNG KÝ 
@router.post("/register")
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(or_(
        models.User.username == user.username, 
        models.User.email == user.email
    )).first()
    
    if db_user: 
        raise HTTPException(status_code=400, detail="Tài khoản hoặc Email đã tồn tại!")
    
    new_user = models.User(
        username=user.username,
        password=get_password_hash(user.password),
        full_name=user.full_name,
        email=user.email,
        balance_available=0.0,
        is_admin=False
    )
    db.add(new_user)
    db.commit()
    return {"status": "success", "message": "Đăng ký thành công!"}

# --- ROUTER: ĐĂNG NHẬP  ---
@router.post("/login")
def login_user(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=400, detail="Thông tin đăng nhập không chính xác!")

    access_token = create_access_token(data={"sub": user.username})

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_data": {
            "user_id": user.user_id,
            "username": user.username,
            "full_name": user.full_name,
            "is_admin": user.is_admin
        }
    }