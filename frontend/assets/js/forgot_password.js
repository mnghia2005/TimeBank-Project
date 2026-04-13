const form = document.getElementById('forgotPasswordForm');
        const successMessage = document.getElementById('successMessage');
        const emailInput = document.getElementById('email');
        const emailDisplay = document.getElementById('userEmailDisplay');
        const nmn1=    document.getElementById('nmn1');    
        form.addEventListener('submit', function(event) {
            event.preventDefault(); // Ngăn trang bị load lại khi bấm Submit

            // 1. Lấy giá trị email người dùng vừa nhập
            const userEmail = emailInput.value;

            // 2. Điền email đó vào câu thông báo
            emailDisplay.textContent = userEmail;

            // 3. Ẩn Form đi
            form.classList.add('d-none');
            nmn1.classList.add('d-none');
            // 4. Hiện khối thông báo thành công lên
            successMessage.classList.remove('d-none');
        });