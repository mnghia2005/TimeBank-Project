from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Khai báo địa chỉ kết nối Database (MySQL trên XAMPP)
# Cú pháp: mysql+pymysql://user:password@host/database_name
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:@localhost/timebank_db"


engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. Tạo SessionLocal để quản lý các phiên làm việc (nháp) với DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Lớp Base cơ sở để các Models khác kế thừa (định hình khuôn)
Base = declarative_base()

# 5. Dependency (Phụ thuộc): Cấp Session DB cho các API dùng xong tự đóng
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()