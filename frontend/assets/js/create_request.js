document.getElementById('createTaskForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // 1. Lấy Token và thông tin User
    const token = localStorage.getItem('access_token');
    const userInfoStr = localStorage.getItem('user_info');
    
    if (!token || !userInfoStr) {
        alert("Phiên làm việc hết hạn, vui lòng đăng nhập lại!");
        window.location.href = 'login.html';
        return;
    }

    const title = document.getElementById('taskTitle').value;
    const skills = document.getElementById('taskSkills').value;
    const hours = document.getElementById('taskCredit').value;
    const deadline = document.getElementById('taskDeadline').value;
    const description = document.getElementById('taskDescription').value;

    // 2. Gói dữ liệu 
    const payload = {
        title: title,
        skill_name: skills,
        description: description,
        hours: parseFloat(hours),
        deadline: deadline ? deadline : null 
    };

    try {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang đăng bài...';

        // 3. Gọi API kèm theo Token bảo mật
        const response = await fetch('http://localhost:8000/api/tasks/', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
    
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            alert("Đăng yêu cầu thành công! Hệ thống đã tạm khóa " + hours + " giờ.");
            window.location.href = 'available_tasks.html'; // Hoặc trang danh sách việc
        } else {
            
            const errorMsg = result.detail && typeof result.detail === 'object' 
                             ? result.detail[0].msg 
                             : (result.detail || "Không thể tạo yêu cầu");
            
            alert("Lỗi: " + errorMsg);
            btn.disabled = false;
            btn.innerHTML = 'ĐĂNG YÊU CẦU NGAY';
        }
    } catch (error) {
        alert("Kết nối máy chủ thất bại! Nghĩa kiểm tra Backend đã chạy chưa nhé?");
        console.error(error);
    }
});