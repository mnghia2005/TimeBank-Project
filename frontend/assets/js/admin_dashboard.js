document.addEventListener('DOMContentLoaded', function() {
    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    const accessToken = localStorage.getItem('access_token');
    
    if (!userInfo || !userInfo.is_admin || !accessToken) { 
        window.location.href = 'login.html'; return; 
    }

    let allUsersCache = [];
    let allTasksCache = []; 
    const authHeaders = { 'Authorization': `Bearer ${accessToken}` };
    let withdrawStatsCache = []; 
    async function loadAllAdminData() {
        try {
            // 1. Load Nạp tiền
            const depRes = await fetch('http://localhost:8000/api/admin/pending-deposits', { headers: authHeaders });
            const deposits = await depRes.json();
            document.getElementById('listDeposits').innerHTML = deposits.length === 0 ? 
                '<tr><td colspan="4" class="text-center py-5">Không có yêu cầu nạp.</td></tr>' :
                deposits.map(d => `
                <tr class="border-bottom">
                    <td class="ps-4 py-3"><strong>${d.user.full_name}</strong></td>
                    <td><span class="badge bg-primary bg-opacity-10 text-primary">+${d.hours_change}h</span></td>
                    <td><code class="text-dark bg-light p-1 rounded">${d.user.bank_info || 'Không có memo'}</code></td>
                    <td class="small text-muted">${new Date(d.transaction_date).toLocaleString('vi-VN')}</td>
                    <td class="text-center"><button class="btn btn-success btn-sm rounded-pill" onclick="approveDeposit(${d.trans_id})">Duyệt</button></td>
                </tr>`).join('');

            // 2. Load Rút tiền 
            const withRes = await fetch('http://localhost:8000/api/admin/pending-withdrawals', { headers: authHeaders });
            const withdrawals = await withRes.json();
            document.getElementById('listWithdrawals').innerHTML = withdrawals.length === 0 ? 
                '<tr><td colspan="4" class="text-center py-5">Không có yêu cầu rút.</td></tr>' :
                withdrawals.map(w => `
                <tr class="border-bottom align-middle">
                    <td class="ps-4 py-3"><strong>${w.user.full_name}</strong></td>
                    <td><span class="badge bg-danger bg-opacity-10 text-danger">${w.hours_change}h</span></td>
                    <td class="small"><code class="text-dark bg-light p-1 rounded">${w.user.bank_info}</code></td>
                    <td class="text-center">
                        <button class="btn btn-success btn-sm rounded-pill mb-1" onclick="approveWithdrawal(${w.trans_id})">Đã chuyển tiền</button>
                        <button class="btn btn-outline-danger btn-sm rounded-pill mb-1" onclick="rejectWithdrawal(${w.trans_id})">Từ chối</button>
                    </td>
                </tr>`).join('');

            // 3. Load Tasks
            const taskRes = await fetch('http://localhost:8000/api/admin/tasks', { headers: authHeaders });
            allTasksCache = await taskRes.json();
            document.getElementById('listTasks').innerHTML = allTasksCache.map((t, index) => `
                <tr class="border-bottom align-middle hover-bg-light cursor-pointer">
                    <td class="ps-4" onclick="showTaskDetail(${index})"><strong>${t.title}</strong><br><small>${t.hours} Giờ</small></td>
                    <td>${t.requester ? t.requester.full_name : 'N/A'}</td>
                    <td><span class="badge ${t.status === 'waiting_confirmation' ? 'bg-warning text-dark' : 'bg-secondary bg-opacity-10'} rounded-pill px-3">${t.status.toUpperCase()}</span></td>
                    <td class="text-center">
                        <button class="btn btn-outline-primary btn-sm rounded-pill me-1" onclick="showTaskDetail(${index})">Xem</button>
                        <button class="btn btn-outline-danger btn-sm rounded-pill" onclick="deleteAdminTask(${t.task_id})">Xóa</button>
                    </td>
                </tr>`).join('');

            // 4. Load Users 
            const userRes = await fetch('http://localhost:8000/api/admin/users', { headers: authHeaders });
            allUsersCache = await userRes.json();
            renderUserTable(allUsersCache);

        } catch (e) { console.error("Lỗi:", e); }
    }

    // --- HÀM XEM CHI TIẾT TASK 
    window.showTaskDetail = (index) => {
        const task = allTasksCache[index];
        const modalBody = document.getElementById('taskDetailContent');
        let imgHtml = task.evidence_image ? `<div class="mt-3 border rounded p-2"><img src="http://localhost:8000${task.evidence_image}" class="img-fluid rounded shadow-sm"></div>` : "<p class='text-muted small italic mt-3'>Chưa có ảnh minh chứng.</p>";
        
        modalBody.innerHTML = `
            <div class="text-center mb-4"><h4 class="fw-bold text-dark">${task.title}</h4><p class="small text-muted">ID: #TB-${task.task_id}</p></div>
            <div class="bg-light p-4 rounded-4 border">
                <p><strong>Người thuê:</strong> ${task.requester?.full_name}</p>
                <p><strong>Người làm:</strong> ${task.provider?.full_name || 'Chưa có'}</p>
                <p><strong>Mô tả:</strong> ${task.description}</p>
                ${imgHtml}
            </div>`;
        new bootstrap.Modal('#taskDetailModal').show();
    };

    function renderUserTable(users) {
        document.getElementById('listUsers').innerHTML = users.map(u => `
            <tr class="border-bottom align-middle">
                <td class="ps-4 py-3"><strong>${u.full_name}</strong></td>
                <td>${u.username}</td>
                <td class="fw-bold text-primary">${u.balance_available}h</td>
                <td class="text-center">
                    <button class="btn ${u.is_admin ? 'btn-danger' : 'btn-outline-primary'} btn-sm rounded-pill px-3" onclick="toggleAdminStatus(${u.user_id})" ${u.user_id == userInfo.user_id ? 'disabled' : ''}>
                        ${u.is_admin ? 'Gỡ Admin' : 'Cấp Admin'}
                    </button>
                </td>
            </tr>`).join('');
    }

    // TÌM KIẾM USER 
    document.getElementById('userSearchInput').addEventListener('input', (e) => {
        const key = e.target.value.toLowerCase();
        renderUserTable(allUsersCache.filter(u => u.full_name.toLowerCase().includes(key) || u.username.toLowerCase().includes(key)));
    });

    // --- HÀNH ĐỘNG DUYỆT 
    window.approveWithdrawal = async (id) => {
        if(confirm("Xác nhận bạn đã chuyển tiền thật?")) {
            const res = await fetch(`http://localhost:8000/api/admin/approve-withdrawal/${id}`, { method: 'POST', headers: authHeaders });
            if(res.ok) loadAllAdminData();
        }
    };

    window.rejectWithdrawal = async (id) => {
        if(confirm("Từ chối và hoàn lại giờ?")) {
            const res = await fetch(`http://localhost:8000/api/admin/reject-withdrawal/${id}`, { method: 'POST', headers: authHeaders });
            if(res.ok) loadAllAdminData();
        }
    };

    window.approveDeposit = async (id) => {
        const res = await fetch(`http://localhost:8000/api/admin/approve-deposit/${id}`, { method: 'POST', headers: authHeaders });
        if(res.ok) loadAllAdminData();
    };

    window.deleteAdminTask = async (id) => {
        if(confirm("Xác nhận xóa Task?")) {
            const res = await fetch(`http://localhost:8000/api/admin/tasks/${id}`, { method: 'DELETE', headers: authHeaders });
            if(res.ok) loadAllAdminData();
        }
    };

    window.toggleAdminStatus = async (id) => {
        const res = await fetch(`http://localhost:8000/api/admin/users/${id}/toggle-admin`, { method: 'POST', headers: authHeaders });
        if(res.ok) loadAllAdminData();
    };

    document.querySelector('[data-bs-target="#withdrawStats"]')
        .addEventListener('shown.bs.tab', () => {
            if (withdrawStatsCache.length === 0) loadWithdrawStats();
        });

    async function loadWithdrawStats() {
        try {
            const res = await fetch('http://localhost:8000/api/admin/user-withdraw-stats', {
                headers: authHeaders  
            });
            withdrawStatsCache = await res.json();
            sortWithdrawTable('desc');
        } catch(e) { console.error("Lỗi load withdraw stats:", e); }
    }

    window.sortWithdrawTable = function(order) {
        document.getElementById('btnSortDesc').className = 
            `btn btn-sm rounded-pill px-3 fw-bold ${order === 'desc' ? 'btn-primary' : 'btn-outline-secondary'}`;
        document.getElementById('btnSortAsc').className = 
            `btn btn-sm rounded-pill px-3 fw-bold ${order === 'asc' ? 'btn-primary' : 'btn-outline-secondary'}`;

        const sorted = [...withdrawStatsCache].sort((a, b) => 
            order === 'desc' 
                ? b.total_withdraw_hours - a.total_withdraw_hours
                : a.total_withdraw_hours - b.total_withdraw_hours
        );

        const body = document.getElementById('withdrawStatsBody');
        if (sorted.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">Chưa có giao dịch rút nào được duyệt.</td></tr>';
            return;
        }

        body.innerHTML = sorted.map((u, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            const badgeColor = index === 0 ? 'danger' : index === 1 ? 'warning' : index === 2 ? 'primary' : 'secondary';
            return `
            <tr class="border-bottom align-middle hover-bg-light">
                <td class="ps-5">
                    <span class="badge bg-${badgeColor} bg-opacity-10 text-${badgeColor} rounded-pill px-3 py-2 fw-bold fs-6">${medal}</span>
                </td>
                <td>
                    <div class="fw-bold">${u.full_name}</div>
                    <div class="text-muted small">@${u.username}</div>
                </td>
                <td><span class="badge bg-light text-dark border rounded-pill px-3">${u.withdraw_count} lần</span></td>
                <td><span class="fw-bold text-danger fs-5">${u.total_withdraw_hours}h</span></td>
                <td><span class="fw-bold text-dark">${u.total_withdraw_vnd.toLocaleString('vi-VN')} ₫</span></td>
            </tr>`;
        }).join('');
    };
    loadAllAdminData();
});


