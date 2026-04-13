from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from jose import JWTError, jwt
from database import get_db
import models, schemas
from sqlalchemy import func 
#CẤU HÌNH BẢO MẬT
SECRET_KEY = "NGHIA_PTIT_DE_2026_SECRET"
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Phiên đăng nhập hết hạn!",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None: raise credentials_exception
    except JWTError: raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None or not user.is_admin:
        raise HTTPException(status_code=403, detail="Bạn không có quyền Admin!")
    return user

router = APIRouter(
    prefix="/api/admin", 
    tags=["Admin"],
    dependencies=[Depends(get_current_admin)]
)

# --- 1. DUYỆT NẠP TIỀN---
@router.get("/pending-deposits")
def get_pending_deposits(db: Session = Depends(get_db)):
    results = db.query(models.TransactionHistory).options(joinedload(models.TransactionHistory.user)).filter(
        models.TransactionHistory.action_type == "deposit",
        models.TransactionHistory.status == "pending"
    ).all()
    return [{"trans_id": d.trans_id, "hours_change": d.hours_change, "transaction_date": d.transaction_date, "user": {"full_name": d.user.full_name,"bank_info": d.user.bank_info}} for d in results]

@router.post("/approve-deposit/{trans_id}")
def approve_deposit(trans_id: int, db: Session = Depends(get_db)):
    tx = db.query(models.TransactionHistory).filter(models.TransactionHistory.trans_id == trans_id).first()
    if not tx: raise HTTPException(status_code=404)
    user = db.query(models.User).filter(models.User.user_id == tx.user_id).first()
    if user:
        user.balance_available += tx.hours_change
        tx.status = "success"
        db.commit()
    return {"message": "Duyệt nạp thành công!"}

# --- 2. DUYỆT RÚT TIỀN  ---
@router.get("/pending-withdrawals")
def get_pending_withdrawals(db: Session = Depends(get_db)):
    results = db.query(models.TransactionHistory).options(joinedload(models.TransactionHistory.user)).filter(
        models.TransactionHistory.action_type == "withdraw",
        models.TransactionHistory.status == "pending"
    ).all()
    
    # Ép kiểu dữ liệu để đảm bảo Frontend nhận được bank_info
    return [
        {
            "trans_id": w.trans_id,
            "hours_change": w.hours_change,
            "transaction_date": w.transaction_date,
            "user": {
                "full_name": w.user.full_name,
                "bank_info": w.user.bank_info or "Chưa cung cấp" 
            }
        } for w in results
    ]

@router.post("/approve-withdrawal/{trans_id}")
def approve_withdrawal(trans_id: int, db: Session = Depends(get_db)):
    tx = db.query(models.TransactionHistory).filter(models.TransactionHistory.trans_id == trans_id).first()
    if not tx: raise HTTPException(status_code=404)
    user = db.query(models.User).filter(models.User.user_id == tx.user_id).first()
    if user:
        user.balance_locked -= abs(tx.hours_change)
        tx.status = "success"
        db.commit()
    return {"message": "Đã thanh toán!"}

@router.post("/reject-withdrawal/{trans_id}")
def reject_withdrawal(trans_id: int, db: Session = Depends(get_db)):
    tx = db.query(models.TransactionHistory).filter(models.TransactionHistory.trans_id == trans_id).first()
    if not tx: raise HTTPException(status_code=404)
    user = db.query(models.User).filter(models.User.user_id == tx.user_id).first()
    if user:
        user.balance_available += abs(tx.hours_change)
        user.balance_locked -= abs(tx.hours_change)
        tx.status = "rejected"
        db.commit()
    return {"message": "Đã từ chối!"}

# --- 3. QUẢN LÝ TASK  ---
@router.get("/tasks")
def get_all_tasks(db: Session = Depends(get_db)):
    return db.query(models.Task).options(joinedload(models.Task.requester), joinedload(models.Task.provider)).all()

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db.query(models.Task).filter(models.Task.task_id == task_id).delete()
    db.commit()
    return {"message": "Xóa Task thành công"}

# --- 4. QUẢN LÝ USER  ---
@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@router.post("/users/{user_id}/toggle-admin")
def toggle_admin(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user: raise HTTPException(status_code=404)
    user.is_admin = not user.is_admin
    db.commit(); db.refresh(user)
    return {"is_admin": user.is_admin}


@router.get("/user-withdraw-stats")
def get_user_withdraw_stats(db: Session = Depends(get_db)):
    results = db.query(
        models.User.user_id,
        models.User.full_name,
        models.User.username,
        func.sum(models.TransactionHistory.hours_change).label("total_withdraw"),
        func.count(models.TransactionHistory.trans_id).label("withdraw_count")
    ).join(
        models.TransactionHistory,
        models.User.user_id == models.TransactionHistory.user_id
    ).filter(
        models.TransactionHistory.action_type == "withdraw",
        models.TransactionHistory.status == "success"
    ).group_by(
        models.User.user_id,
        models.User.full_name,
        models.User.username
    ).all()

    return [
        {
            "user_id": r.user_id,
            "full_name": r.full_name,
            "username": r.username,
            "total_withdraw_hours": round(abs(float(r.total_withdraw)), 1),
            "total_withdraw_vnd": round(abs(float(r.total_withdraw)) * 100000, 0),
            "withdraw_count": r.withdraw_count
        }
        for r in results
    ]