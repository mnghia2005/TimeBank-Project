from fastapi import APIRouter, Depends, HTTPException,status
from sqlalchemy.orm import Session
import models, schemas
from database import get_db

from .auth import get_current_user

router = APIRouter(
    prefix="/api/exchange",
    tags=["Exchange"]
)

@router.post("/process")
def process_exchange(
    req: schemas.ExchangeRequest, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) 
):
    action_type = req.action.lower()

    if action_type == "deposit":
        if req.bank_info:
            current_user.bank_info = req.bank_info
        new_tx = models.TransactionHistory(
            user_id=current_user.user_id,
            hours_change=req.amount,
            action_type="deposit",
            status="pending"  

        )
        db.add(new_tx)
        db.commit()
        return {"message": "Yêu cầu nạp đã gửi thành công!"}

    elif action_type == "withdraw":
        if current_user.balance_available < req.amount:
            raise HTTPException(status_code=400, detail="Số dư khả dụng không đủ!")
        
        # Lưu bank_info nếu có 
        if req.bank_info and req.bank_info.strip():
            current_user.bank_info = req.bank_info

        current_user.balance_available -= req.amount
        current_user.balance_locked += req.amount

        new_tx = models.TransactionHistory(
            user_id=current_user.user_id,
            hours_change=-req.amount,
            action_type="withdraw",
            status="pending"  # ← Chờ Admin duyệt
        )
        db.add(new_tx)
        db.commit()
        return {"message": "Yêu cầu rút đã được gửi!"}

    raise HTTPException(status_code=400, detail="Hành động không hợp lệ")