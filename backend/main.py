from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import models
from database import engine
from routers import auth, user, task, exchange, admin 

# Khởi tạo Database và các bảng
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Time Bank API - Secure Edition")

# Cấu hình file tĩnh cho ảnh minh chứng
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS cấu hình cho phép Frontend truy cập
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các Router
app.include_router(task.router)
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(exchange.router)
app.include_router(admin.router)

@app.get("/")
def read_root():
    return {"status": "success", "message": "Server Time Bank JWT đã sẵn sàng!"}