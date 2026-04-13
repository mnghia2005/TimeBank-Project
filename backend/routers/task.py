from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func   # ← THÊM DÒNG NÀY
import models, schemas
from database import get_db
from datetime import datetime
import os
import uuid
from routers.auth import get_current_user
router = APIRouter(
    prefix="/api/tasks",
    tags=["Tasks"]
)


UPLOAD_DIR = "static/evidence"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def check_and_refund_overdue_tasks(db: Session):
    now = datetime.now()
    overdue_tasks = db.query(models.Task).filter(
        models.Task.deadline < now,
        models.Task.status.in_(["open", "in_progress", "waiting_confirmation"])
    ).all()

    for task in overdue_tasks:
        requester = db.query(models.User).filter(models.User.user_id == task.requester_id).first()
        if requester:
            requester.balance_available += task.hours
            requester.balance_locked -= task.hours
        task.status = "expired"
    
    if overdue_tasks:
        db.commit()

# 1. API: Tạo Task mới 
@router.post("/")
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Thay vì tìm user_id từ body, lấy thẳng từ current_user (Token)
    if current_user.balance_available < task.hours:
        raise HTTPException(status_code=400, detail=f"Số dư không đủ! Bạn cần {task.hours}h.")

    try:
        current_user.balance_available -= task.hours
        current_user.balance_locked += task.hours

        deadline_dt = None
        if task.deadline:
            deadline_dt = datetime.fromisoformat(task.deadline.replace('Z', '+00:00'))

        new_task = models.Task(
            title=task.title,
            skill_name=task.skill_name, 
            description=task.description,
            hours=task.hours,
            requester_id=current_user.user_id, # LẤY TỪ TOKEN
            deadline=deadline_dt,
            status="open" 
        )
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        return {"status": "success", "message": "Đăng yêu cầu thành công!"}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi tạo task!")

# 2. API: Lấy danh sách việc khả dụng 
@router.get("/available")
def get_available_tasks(keyword: str = "", db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_and_refund_overdue_tasks(db)
    
    # 1. Logic lọc cũ 
    query = db.query(models.Task).options(joinedload(models.Task.requester)).filter(
        models.Task.status == "open",
        models.Task.requester_id != current_user.user_id
    )
    
    # 2. Nếu có từ khóa thì lọc tiếp
    if keyword:
        search_pattern = f"%{keyword.lower()}%"
        query = query.filter(
            or_(
                func.lower(models.Task.title).like(search_pattern),
                func.lower(models.Task.description).like(search_pattern),
                func.lower(models.Task.skill_name).like(search_pattern)
            )
        )
    
    tasks = query.all()
    
  
    return [
        {
            "task_id": t.task_id, "title": t.title, "skill_name": t.skill_name,
            "description": t.description, "hours": t.hours,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "created_at": t.created_at.isoformat(),
            "requester_name": t.requester.full_name if t.requester else "Ẩn danh",
            "evidence_image": t.evidence_image 
        } for t in tasks
    ]

# 3. API: Chấp nhận nhận việc
@router.post("/{task_id}/accept")
def accept_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_and_refund_overdue_tasks(db)
    
    task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
    if not task or task.status != "open":
        raise HTTPException(status_code=400, detail="Công việc không khả dụng!")
    
    if task.requester_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Bạn không thể nhận việc của chính mình!")

    task.status = "in_progress"
    task.provider_id = current_user.user_id # LẤY TỪ TOKEN
    db.commit()
    return {"status": "success", "message": "Nhận việc thành công!"}

# 4. API: Lấy việc TÔI ĐĂNG 
@router.get("/my-posted")
def get_my_posted(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_and_refund_overdue_tasks(db)
    return db.query(models.Task).options(
        joinedload(models.Task.provider), 
        joinedload(models.Task.requester)
    ).filter(
        models.Task.requester_id == current_user.user_id,
        models.Task.status != "completed"
    ).all()

# 5. API: Lấy việc TÔI NHẬN 
@router.get("/my-accepted")
def get_my_accepted(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_and_refund_overdue_tasks(db)
    return db.query(models.Task).options(joinedload(models.Task.requester)).filter(
        models.Task.provider_id == current_user.user_id,
        models.Task.status != "completed"
    ).all()

# 6. API: BÁO CÁO HOÀN THÀNH 
@router.post("/{task_id}/report-complete")
async def report_complete(task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
    if not task or task.provider_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Bạn không phải là người thực hiện việc này!")
        
    if task.status == "expired":
        raise HTTPException(status_code=400, detail="Công việc đã hết hạn!")

    try:
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        task.status = "waiting_confirmation"
        task.evidence_image = f"/static/evidence/{unique_filename}"
        db.commit()
        return {"message": "Đã gửi báo cáo thành công!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi lưu ảnh!")

# 7. API: Nghiệm thu 
@router.post("/{task_id}/confirm-complete")
def confirm_complete(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
    if not task or task.requester_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền nghiệm thu việc này!")
    
    if task.status == "expired":
        raise HTTPException(status_code=400, detail="Công việc đã hết hạn!")
        
    worker = db.query(models.User).filter(models.User.user_id == task.provider_id).first()
    try:
        current_user.balance_locked -= task.hours
        worker.balance_available += task.hours
        task.status = "completed"
        
        # Lưu lịch sử
        h1 = models.TransactionHistory(user_id=current_user.user_id, task_id=task.task_id, hours_change=-task.hours, counterparty_id=worker.user_id, action_type="transfer", status="success")
        h2 = models.TransactionHistory(user_id=worker.user_id, task_id=task.task_id, hours_change=task.hours, counterparty_id=current_user.user_id, action_type="reward", status="success")
        db.add(h1); db.add(h2); db.commit()
        return {"status": "success", "message": "Nghiệm thu thành công!"}
    except Exception:
        db.rollback(); raise HTTPException(status_code=500, detail="Lỗi hệ thống!")

# 8. API: Hủy yêu cầu 
@router.delete("/{task_id}/cancel")
def cancel_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
    if not task or task.requester_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Không có quyền hủy!")
        
    if task.status == "open":
        current_user.balance_locked -= task.hours
        current_user.balance_available += task.hours
        db.delete(task); db.commit()
        return {"message": "Đã hủy yêu cầu!"}
    raise HTTPException(status_code=400, detail="Không thể hủy việc đang thực hiện!")