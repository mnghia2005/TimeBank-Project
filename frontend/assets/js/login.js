const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async function(e) {
    // 1. Chặn form tự động load lại trang
    e.preventDefault();

    // 2. Lấy dữ liệu người dùng nhập
    const usernameInput = document.getElementById('username').value;
    const passwordInput = document.getElementById('password').value;

    try {
        
        const response = await fetch('http://localhost:8000/api/login', {
            method: 'POST',
            headers: {
                
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
            
            body: new URLSearchParams({
                'username': usernameInput,
                'password': passwordInput
            })
        });

        // 4. Đọc kết quả Backend trả về
        const result = await response.json();

        if (response.ok) {
            // LƯU CẢ TOKEN VÀ THÔNG TIN USER VÀO TRÌNH DUYỆT
            localStorage.setItem('access_token', result.access_token);
            localStorage.setItem('user_info', JSON.stringify(result.user_data)); 
            
            alert("Đăng nhập thành công! Chào " + result.user_data.full_name);
            
          
            window.location.href = 'dashboard.html'; 
        } else {
            
            let errorMessage = "Đăng nhập thất bại";

            if (result.detail) {
               
                if (Array.isArray(result.detail)) {
                    errorMessage = result.detail[0].msg;
                } else {
                    
                    errorMessage = result.detail;
                }
            }
            alert("Lỗi: " + errorMessage); 
        }

    } catch (error) {
        console.error("Lỗi mạng:", error);
        alert("Không thể kết nối đến Máy chủ. Nghĩa kiểm tra lại Backend đã chạy chưa nhé!");
    }
});