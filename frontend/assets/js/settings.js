document.addEventListener('DOMContentLoaded', async function() {
    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    const token = localStorage.getItem('access_token');

    // 0. Kiểm tra đăng nhập
    if (!userInfo || !token) { 
        window.location.href = 'login.html'; 
        return; 
    }

    // Hàm helper gọi API có kèm JWT Token
    async function authFetch(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            alert("Phiên đăng nhập hết hạn!");
            localStorage.clear();
            window.location.href = 'login.html';
            return null;
        }
        return response;
    }
    async function loadBasicInfo() {
        try {
            const res = await authFetch(`http://localhost:8000/api/users/me`);
            if (res && res.ok) {
                const data = await res.json();
                document.getElementById('username').value = data.username;
                document.getElementById('fullname').value = data.full_name;
                document.getElementById('email').value = data.email;
            }
        } catch (e) { console.error("Lỗi load dữ liệu:", e); }
    }

    // 2.Đổi mật khẩu
    document.getElementById('changePasswordForm').onsubmit = async function(e) {
        e.preventDefault();
        
        const currentPass = document.getElementById('currentPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confirmPass = document.getElementById('confirmNewPassword').value;

        if (newPass.length < 8) { 
            alert("Mật khẩu mới phải từ 8 ký tự trở lên Nghĩa nhé!"); 
            return; 
        }
        if (newPass !== confirmPass) { 
            alert("Mật khẩu xác nhận không khớp, kiểm tra lại đi ông!"); 
            return; 
        }

        const btn = this.querySelector('button[type="submit"]');
        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xử lý...';

            const res = await authFetch(`http://localhost:8000/api/users/change-password`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    current_password: currentPass, // Khớp với PasswordUpdate Schema
                    new_password: newPass 
                })
            });

            if (res && res.ok) {
                alert("Đổi mật khẩu thành công rực rỡ! Nhớ dùng pass mới khi login nhé.");
                this.reset(); // Xóa trắng các ô nhập
            } else {
                const err = await res.json();
                
                alert("Thất bại: " + (err.detail || "Có lỗi xảy ra"));
            }
        } catch (e) { 
            alert("Lỗi kết nối server!"); 
        } finally {
            btn.disabled = false;
            btn.innerText = 'Cập nhật mật khẩu';
        }
    };

    document.getElementById('btnLogout').onclick = () => { 
        localStorage.clear(); 
        window.location.href='login.html'; 
    };

    loadBasicInfo();
});