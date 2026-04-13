from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import models, schemas
from database import get_db
from routers.auth import verify_password, get_password_hash, get_current_user
from sqlalchemy import or_

router = APIRouter(prefix="/api", tags=["Users"])

# 2. API Dashboard 
@router.get("/dashboard/me")
def get_dashboard_data(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    u_id = current_user.user_id
    
    # Tính tổng thu nhập
    total_income = db.query(func.sum(models.TransactionHistory.hours_change)).filter(
        models.TransactionHistory.user_id == u_id, 
        models.TransactionHistory.hours_change > 0, 
        models.TransactionHistory.status == "success"
    ).scalar() or 0.0
    
    # Đếm yêu cầu chờ xử lý (Việm mà thuê người khác làm)
    pending_tasks = db.query(models.Task).filter(
        models.Task.requester_id == u_id, 
        models.Task.status.in_(["open", "waiting_confirmation"])
    ).count()

    # Nếu là Admin, đếm đơn nạp/rút toàn hệ thống
    admin_pending_total = 0
    if current_user.is_admin:
        admin_pending_total = db.query(models.TransactionHistory).filter(models.TransactionHistory.status == "pending").count()

    # Lấy 20 giao dịch gần nhất
    transactions = db.query(models.TransactionHistory).filter(models.TransactionHistory.user_id == u_id).order_by(models.TransactionHistory.transaction_date.desc()).limit(20).all()
    history_list = []
    for tx in transactions:
        title, cp_name = ("Nạp giờ", "Hệ thống") if tx.action_type == "deposit" else ("Rút tiền", "Hệ thống")
        if tx.task_id:
            task = db.query(models.Task).filter(models.Task.task_id == tx.task_id).first()
            title = task.title if task else "Công việc"
            cp_user = db.query(models.User).filter(models.User.user_id == tx.counterparty_id).first()
            cp_name = cp_user.full_name if cp_user else "Thành viên"
        
        history_list.append({
            "tx_id": tx.trans_id, "title": title, "counterparty": cp_name, 
            "date": tx.transaction_date.strftime("%d/%m/%Y"), 
            "full_time": tx.transaction_date.strftime("%H:%M:%S - %d/%m/%Y"),
            "amount": float(tx.hours_change), "type": tx.action_type, "status": tx.status
        })

    # Dữ liệu biểu đồ 7 ngày
    labels, income, expense = [], [], []
    for i in range(6, -1, -1):
        date = (datetime.now() - timedelta(days=i)).date()
        labels.append(date.strftime("%d/%m"))
        inc = db.query(func.sum(models.TransactionHistory.hours_change)).filter(models.TransactionHistory.user_id == u_id, models.TransactionHistory.hours_change > 0, func.date(models.TransactionHistory.transaction_date) == date, models.TransactionHistory.status == "success").scalar() or 0
        exp = db.query(func.sum(models.TransactionHistory.hours_change)).filter(models.TransactionHistory.user_id == u_id, models.TransactionHistory.hours_change < 0, func.date(models.TransactionHistory.transaction_date) == date, models.TransactionHistory.status == "success").scalar() or 0
        income.append(float(inc)); expense.append(abs(float(exp)))

    return {
        "balance": current_user.balance_available, 
        "balance_locked": current_user.balance_locked,
        "is_admin": current_user.is_admin,
        "total_income": round(total_income, 1), 
        "pending_requests": pending_tasks, 
        "admin_pending_total": admin_pending_total,
        "recent_transactions": history_list, 
        "chart": {"labels": labels, "income": income, "expense": expense}
    }

# 3. Các API phụ trợ (Me, Update, Password, All Transactions)
@router.get("/users/me")
def get_user_profile(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.put("/users/update-profile")
def update_profile(req: schemas.ProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    current_user.full_name = req.full_name
    current_user.email = req.email
    db.commit(); db.refresh(current_user); return current_user

@router.put("/users/change-password")
def change_password(req: schemas.PasswordUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not verify_password(req.current_password, current_user.password): raise HTTPException(status_code=400, detail="Mật khẩu cũ sai!")
    current_user.password = get_password_hash(req.new_password)
    db.commit(); return {"message": "Thành công!"}

@router.get("/transactions/all/me")
def get_all_transactions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    txs = db.query(models.TransactionHistory).filter(models.TransactionHistory.user_id == current_user.user_id).order_by(models.TransactionHistory.transaction_date.desc()).all()
    return [{"tx_id": t.trans_id, "title": "Giao dịch", "date": t.transaction_date.strftime("%d/%m/%Y"), "amount": float(t.hours_change), "type": t.action_type, "status": t.status} for t in txs]


@router.get("/transactions/search")
def search_transactions(keyword: str = "", db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.TransactionHistory).filter(models.TransactionHistory.user_id == current_user.user_id)
    
    if keyword:
        # Tìm kiếm không phân biệt hoa thường trong action_type hoặc Title của Task
        search_pattern = f"%{keyword.lower()}%"
        query = query.join(models.Task, isouter=True).filter(
            or_(
                func.lower(models.TransactionHistory.action_type).like(search_pattern),
                func.lower(models.Task.title).like(search_pattern)
            )
        )
    
    txs = query.order_by(models.TransactionHistory.transaction_date.desc()).all()
    
    res = []
    for tx in txs:
        
        title = "Hệ thống"
        if tx.task_id:
            task = db.query(models.Task).filter(models.Task.task_id == tx.task_id).first()
            title = task.title if task else "Công việc cũ"
        elif tx.action_type == "deposit": title = "Nạp giờ"
        elif tx.action_type == "withdraw": title = "Rút giờ"

        res.append({
            "tx_id": tx.trans_id, "title": title, "date": tx.transaction_date.strftime("%d/%m/%Y"),
            "amount": float(tx.hours_change), "type": tx.action_type, "status": tx.status
        })
    return res