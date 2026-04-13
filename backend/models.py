from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, DateTime, Boolean, func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    email = Column(String(100), unique=True, nullable=False)
    balance_available = Column(Float, default=0.0)
    balance_locked = Column(Float, default=0.0)
    is_admin = Column(Boolean, default=False)
    bank_info = Column(Text, nullable=True) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tasks_requested = relationship("Task", foreign_keys="[Task.requester_id]", back_populates="requester")
    tasks_provided = relationship("Task", foreign_keys="[Task.provider_id]", back_populates="provider")
    transactions = relationship("TransactionHistory", back_populates="user")

class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.user_id"))
    provider_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    title = Column(String(200), nullable=False)
    skill_name = Column(String(100), index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deadline = Column(DateTime)
    hours = Column(Float, nullable=False)
    status = Column(String(50), default="open")
    
    # --- LƯU ĐƯỜNG DẪN ẢNH MINH CHỨNG ---
    # lưu vết file ảnh sau khi thợ báo cáo hoàn thành
    evidence_image = Column(String(255), nullable=True)

    requester = relationship("User", foreign_keys=[requester_id], back_populates="tasks_requested")
    provider = relationship("User", foreign_keys=[provider_id], back_populates="tasks_provided")
    reviews = relationship("Review", back_populates="task")

class Review(Base):
    __tablename__ = "reviews"

    review_id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.task_id"))
    comment = Column(Text)
    rating_score = Column(Integer)
    review_date = Column(DateTime(timezone=True), server_default=func.now())
    task = relationship("Task", back_populates="reviews")

class TransactionHistory(Base):
    __tablename__ = "transaction_history"

    trans_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    task_id = Column(Integer, ForeignKey("tasks.task_id"), nullable=True)
    hours_change = Column(Float, nullable=False)
    counterparty_id = Column(Integer, nullable=True)
    action_type = Column(String(50))
    status = Column(String(20), default="success") 
    transaction_date = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="transactions")