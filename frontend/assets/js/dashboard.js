document.addEventListener('DOMContentLoaded', async function() {
    let userInfo = JSON.parse(localStorage.getItem('user_info'));
    const token = localStorage.getItem('access_token');
    
    // 1. Kiểm tra đăng nhập
    if (!userInfo || !token) { 
        localStorage.clear();
        window.location.href = 'login.html'; 
        return; 
    }

    let allTxData = []; // Kho dữ liệu để tìm kiếm và xem chi tiết

    // --- HÀM FETCH CÓ TOKEN ---
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

    // --- HÀM TỰ ĐỘNG HIỆN NÚT ADMIN ---
    function renderAdminLink(isAdmin, pendingAdminCount) {
        const nav = document.getElementById('sidebarNav');
        
        // Chỉ vẽ nếu là Admin và trên màn hình chưa có nút này
        if (isAdmin && nav && !document.getElementById('adminNavItem')) {
            const adminLi = document.createElement('li');
            adminLi.id = 'adminNavItem';
            adminLi.className = 'nav-item mt-3';
            
            // Badge số lượng đơn đang chờ duyệt (nếu có)
            const badge = pendingAdminCount > 0 ? 
                `<span class="badge bg-danger ms-2">${pendingAdminCount}</span>` : "";
            
            adminLi.innerHTML = `
                <a class="nav-link admin-link fw-bold text-danger" href="admin_dashboard.html">
                    <i class="bi bi-shield-lock-fill me-2"></i>DUYỆT HỆ THỐNG ${badge}
                </a>`;
            nav.appendChild(adminLi);
        }
    }

    // --- TẢI THÔNG SỐ DASHBOARD ---
    async function loadStats() {
        try {
            const res = await authFetch(`http://localhost:8000/api/dashboard/me`);
            if (!res) return;
            const data = await res.json();

            // Đổ dữ liệu ra giao diện
            document.getElementById('displayBalance').innerText = data.balance + "h";
            document.getElementById('displayIncome').innerText = data.total_income + "h";
            document.getElementById('displayPending').innerText = data.pending_requests;
            
            // GỌI HÀM HIỆN NÚT ADMIN TẠI ĐÂY
            renderAdminLink(data.is_admin, data.admin_pending_total);
            
            allTxData = data.recent_transactions; 
            renderTable(data.recent_transactions);
            renderChart(data.chart);
        } catch (e) { console.error("Lỗi load Dashboard:", e); }
    }

    // --- BIỂU ĐỒ ---
    let chartInstance = null;
    function renderChart(chartData) {
        const ctx = document.getElementById('myChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [
                    { label: 'Thu nhập (+)', data: chartData.income, backgroundColor: '#10b981', borderRadius: 6 },
                    { label: 'Chi trả (-)', data: chartData.expense, backgroundColor: '#ef4444', borderRadius: 6 }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { position: 'bottom' } }, 
                scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } 
            }
        });
    }

    // --- BẢNG GIAO DỊCH GẦN ĐÂY ---
    function renderTable(txs) {
        const body = document.getElementById('tableBody');
        const displayTxs = txs.slice(0, 7);
        body.innerHTML = displayTxs.map(tx => `
            <tr class="cursor-pointer" onclick="showTxDetail('${tx.tx_id}')">
                <td class="py-3">
                    <div class="fw-bold text-dark">${tx.title}</div>
                    <div class="small text-muted">${tx.date}</div>
                </td>
                <td class="text-end fw-bold ${tx.amount > 0 ? 'text-success' : 'text-danger'}">
                    ${tx.amount > 0 ? '+' : ''}${tx.amount}h
                </td>
            </tr>`).join('');
    }

    // --- XEM CHI TIẾT GIAO DỊCH ---
    window.showTxDetail = async (txId) => {
        try {
            const tx = allTxData.find(t => t.tx_id == txId);
            if (!tx) { alert("Dữ liệu không tồn tại trong cache!"); return; }

            const modalBody = document.getElementById('txDetailContent');
            modalBody.innerHTML = `
                <div class="bg-primary bg-opacity-10 p-4 rounded-circle d-inline-block mb-3"><i class="bi bi-clock-history fs-1 text-primary"></i></div>
                <h4 class="fw-bold text-dark mb-1">${tx.title}</h4>
                <p class="text-muted small">Mã GD: #TX-${tx.tx_id}</p>
                <div class="bg-light p-4 rounded-4 text-start mt-3">
                    <div class="mb-3"><label class="small text-muted fw-bold">Đối tác</label><p class="mb-0 fw-bold">${tx.counterparty || 'Hệ thống'}</p></div>
                    <div class="mb-3"><label class="small text-muted fw-bold">Số giờ</label><p class="mb-0 fw-bold ${tx.amount>0?'text-success':'text-danger'}">${tx.amount>0?'+':''}${tx.amount} Giờ</p></div>
                    <div><label class="small text-muted fw-bold">Thời gian</label><p class="mb-0 fw-bold">${tx.full_time || tx.date}</p></div>
                </div>`;
            new bootstrap.Modal('#txDetailModal').show();
        } catch (e) { console.error(e); }
    };

    // --- XEM TẤT CẢ GIAO DỊCH ---
    window.openAllTransactions = async () => {
        try {
            const res = await authFetch(`http://localhost:8000/api/transactions/all/me`);
            if (!res) return;
            allTxData = await res.json();
            renderAllTxTable(allTxData);
            new bootstrap.Modal('#allTransactionsModal').show();
        } catch (e) { console.error(e); }
    };

    function renderAllTxTable(data) {
        const body = document.getElementById('allTxTableBody');
        body.innerHTML = data.map(tx => `
            <tr class="cursor-pointer" onclick="showTxDetail('${tx.tx_id}')">
                <td><strong>${tx.title}</strong><br><small class="text-muted">${tx.type ? tx.type.toUpperCase() : 'GIAO DỊCH'}</small></td>
                <td class="fw-bold ${tx.amount>0?'text-success':'text-danger'}">${tx.amount>0?'+':''}${tx.amount}h</td>
                <td class="small text-muted">${tx.date}</td>
            </tr>`).join('');
    }

    // --- TÌM KIẾM GIAO DỊCH  ---
    const searchInput = document.getElementById('searchTxInput');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const key = e.target.value;
            const res = await authFetch(`http://localhost:8000/api/transactions/search?keyword=${encodeURIComponent(key)}`);
            if (res && res.ok) {
                const searchResults = await res.json();
                allTxData = searchResults; // Cập nhật cache để modal không bị sai dữ liệu
                renderAllTxTable(searchResults); 
            }
        });
    }

    // --- ĐĂNG XUẤT ---
    document.getElementById('btnLogout').onclick = () => { 
        localStorage.clear(); 
        window.location.href='login.html'; 
    };

    document.getElementById('displayName').innerText = userInfo.full_name;
    loadStats();
});