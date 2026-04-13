const registerForm = document.getElementById('registerForm');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm_password');
const passwordError = document.getElementById('passwordError');

// 1. Tự động xóa lỗi khi người dùng bắt đầu gõ lại 
confirmPasswordInput.addEventListener('input', function() {
    passwordError.classList.add('d-none');
    confirmPasswordInput.classList.remove('is-invalid');
});

// 2. Gộp chung logic xử lý khi bấm nút Đăng Ký
registerForm.addEventListener('submit', async function(e) {
    // CHẶN FORM LOAD LẠI TRANG
    e.preventDefault();

    // Lấy dữ liệu
    const fullname = document.getElementById('fullname').value;
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = passwordInput.value;
    const confirm_password = confirmPasswordInput.value;

    // KIỂM TRA MẬT KHẨU KHỚP NHAU KHÔNG 
    if (password !== confirm_password) {
        passwordError.classList.remove('d-none'); 
        confirmPasswordInput.classList.add('is-invalid'); // Hiện viền đỏ
        confirmPasswordInput.focus(); // Đưa con trỏ chuột vào lại ô nhập
        return; // Dừng lập tức, không gọi API nữa
    }

    // ĐÓNG GÓI DỮ LIỆU
    const requestData = {
        username: username,
        password: password,
        full_name: fullname,
        email: email
    };

    try {
        // GỌI API FASTAPI
        const response = await fetch('http://localhost:8000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(requestData) 
        });

        // ĐỌC KẾT QUẢ
        const result = await response.json();

        if (response.ok) {
            alert(result.message); // Báo thành công
            window.location.href = 'login.html'; // Chuyển trang
        } else {
            alert("Lỗi: " + result.detail); // Báo lỗi trùng lặp từ Server
        }

    } catch (error) {
        console.error("Lỗi mạng:", error);
        alert("Không thể kết nối đến Máy chủ. Vui lòng kiểm tra lại Backend!");
    }
});