document.addEventListener('DOMContentLoaded', async function() {
    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    const token = localStorage.getItem('access_token');

    // 0. Kiểm tra bảo mật
    if (!userInfo || !token) { 
        localStorage.clear();
        window.location.href = 'login.html'; 
        return; 
    }

    const rate = 100000; 
    const fee = 0.05;    
    
    const BANK_ID = "MB"; 
    const ACCOUNT_NO = "272972005"; 
    const ACCOUNT_NAME = "TIME BANK SYSTEM"; 

    const qrModal = new bootstrap.Modal(document.getElementById('qrModal'));
    let pendingHours = 0;
    let currentMemo = "";
    // --- HÀM HỖ TRỢ FETCH CÓ TOKEN ---
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

    // 1. Tính toán thời gian thực 
    document.getElementById('depositHours').addEventListener('input', function() {
        const hours = parseFloat(this.value) || 0;
        document.getElementById('depositAmount').innerText = (hours * rate).toLocaleString('vi-VN') + " ₫";
    });

    document.getElementById('withdrawHours').addEventListener('input', function() {
        const hours = parseFloat(this.value) || 0;
        const total = hours * rate * (1 - fee);
        document.getElementById('withdrawAmount').innerText = (total).toLocaleString('vi-VN') + " ₫";
    });

    // 2. Load số dư 
    async function loadBalance() {
        try {
            const res = await authFetch(`http://localhost:8000/api/users/me`);
            if (!res) return;
            const data = await res.json();
            
            // Backend trả về balance_available
            document.getElementById('currentBalance').innerHTML = `${data.balance_available} <small class="fs-5 opacity-75">Giờ</small>`;
            document.getElementById('currentVnd').innerText = `Tương đương ≈ ${(data.balance_available * rate).toLocaleString('vi-VN')} VNĐ`;
        } catch (e) { console.error("Lỗi load số dư:", e); }
    }

    // 3. Xử lý Nạp tiền 
    document.getElementById('depositForm').onsubmit = function(e) {
        e.preventDefault();
        pendingHours = parseFloat(document.getElementById('depositHours').value);
        if (pendingHours <= 0) {
            alert("Vui lòng nhập số giờ lớn hơn 0");
            return;
        }
        const amount = pendingHours * rate;
        
        const memo = `TB NAP ${userInfo.user_id}`;
        currentMemo = memo;
        const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact.jpg?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;
        
        document.getElementById('qrImage').src = qrUrl;
        document.getElementById('modalAmount').innerText = amount.toLocaleString('vi-VN') + " ₫";
        document.getElementById('modalMemo').innerText = memo;
        qrModal.show();
    };

    // 4. Xác nhận đã chuyển khoản 
    window.confirmDeposit = async function() {
        try {
            const res = await authFetch('http://localhost:8000/api/exchange/process', {
                method: 'POST',
                body: JSON.stringify({ 
                    amount: pendingHours, 
                    action: 'deposit' ,
                    })
            });
            if (res && res.ok) { 
                alert("Yêu cầu nạp đã gửi thành công! Vui lòng chờ Admin kiểm tra tài khoản ngân hàng và duyệt."); 
                qrModal.hide(); 
                loadBalance(); 
            }
        } catch (e) { alert("Lỗi kết nối máy chủ!"); }
    };

    // 5. Xử lý Rút tiền 
    document.getElementById('withdrawForm').onsubmit = async function(e) {
        e.preventDefault();
        const hours = document.getElementById('withdrawHours').value;
        const info = document.getElementById('bankInfo').value;

        if (parseFloat(hours) <= 0) {
            alert("Số giờ rút không hợp lệ");
            return;
        }

        const res = await authFetch('http://localhost:8000/api/exchange/process', {
            method: 'POST',
            body: JSON.stringify({ 
                amount: parseFloat(hours), 
                action: 'withdraw',
                bank_info: info 
                
            })
        });

        if (res && res.ok) { 
            alert("Lệnh rút đã gửi thành công! Giờ của bạn đã được tạm khóa để chờ Admin chuyển khoản."); 
            document.getElementById('withdrawForm').reset();
            loadBalance(); 
        } else if (res) {
            const err = await res.json();
            alert("Lỗi: " + (err.detail || "Không thể thực hiện yêu cầu"));
        }
    };

    loadBalance();
});