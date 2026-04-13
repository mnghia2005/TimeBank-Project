document.addEventListener('DOMContentLoaded', function() {
    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    const token = localStorage.getItem('access_token');
    
    if (!userInfo || !token) { window.location.href = 'login.html'; return; }

    const postedTable = document.querySelector('#posted tbody');
    const acceptedTable = document.querySelector('#accepted tbody');
    const tabButtons = document.querySelectorAll('button[data-bs-toggle="tab"]');

    let postedTasksCache = [];
    let acceptedTasksCache = [];

    // --- HÀM HỖ TRỢ FETCH ---
    async function authFetch(url, options = {}) {
        const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
        return fetch(url, { ...options, headers });
    }

    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', function (event) {
            tabButtons.forEach(btn => btn.classList.remove('active', 'text-primary', 'border-bottom', 'border-primary', 'border-3'));
            event.target.classList.add('active', 'text-primary', 'border-bottom', 'border-primary', 'border-3');
            if (event.target.id === 'posted-tab') loadPostedTasks();
            if (event.target.id === 'accepted-tab') loadAcceptedTasks();
        });
    });

    const getStatusBadge = (status) => {
        const badges = {
            'open': '<span class="badge bg-secondary bg-opacity-10 text-secondary rounded-pill px-3">Đang tìm người</span>',
            'in_progress': '<span class="badge bg-info bg-opacity-10 text-info rounded-pill px-3">Đang làm</span>',
            'waiting_confirmation': '<span class="badge bg-warning text-dark rounded-pill px-3">Chờ xác nhận</span>',
            'expired': '<span class="badge bg-danger bg-opacity-10 text-danger rounded-pill px-3">Hết hạn</span>'
        };
        return badges[status] || status;
    };

    window.showDetail = (index, type) => {
        const task = type === 'posted' ? postedTasksCache[index] : acceptedTasksCache[index];
        const modalBody = document.getElementById('taskDetailContent');
        let evidenceImageHtml = task.evidence_image ? `
            <div class="col-12 mt-3">
                <label class="small text-muted fw-bold d-block mb-2 text-center text-danger">--- ẢNH MINH CHỨNG ---</label>
                <div class="bg-white p-2 rounded-4 border text-center">
                    <img src="http://localhost:8000${task.evidence_image}" class="img-fluid rounded-3" style="max-height: 350px; width: 100%; object-fit: contain;">
                </div>
            </div>` : "";
        
        modalBody.innerHTML = `
            <div class="text-center mb-4"><h4 class="fw-bold text-dark">${task.title}</h4><p class="small">#TB-${task.task_id}</p></div>
            <div class="bg-light p-4 rounded-4 border">
                <div class="row g-4">
                    <div class="col-md-6"><label class="small text-muted fw-bold">NGƯỜI THUÊ</label><p>${task.requester?.full_name || 'N/A'}</p></div>
                    <div class="col-md-6"><label class="small text-muted fw-bold">SỐ GIỜ</label><p class="text-primary fw-bold">${task.hours} Giờ</p></div>
                    <div class="col-12"><label class="small text-muted fw-bold">MÔ TẢ</label><div class="p-3 bg-white border rounded">${task.description}</div></div>
                    ${evidenceImageHtml}
                </div>
            </div>`;
        new bootstrap.Modal('#taskDetailModal').show();
    };

    async function loadPostedTasks() {
        try {
            // Dùng API /my-posted 
            const res = await authFetch(`http://localhost:8000/api/tasks/my-posted`);
            postedTasksCache = await res.json();
            postedTable.innerHTML = postedTasksCache.length === 0 ? '<tr><td colspan="4" class="text-center py-5 text-muted">Chưa có yêu cầu nào</td></tr>' : 
            postedTasksCache.map((t, index) => `
                <tr class="align-middle border-bottom cursor-pointer">
                    <td class="py-3" onclick="showDetail(${index}, 'posted')"><strong>${t.title}</strong><br><small>${t.hours}h</small></td>
                    <td>${t.provider?.full_name || '---'}</td>
                    <td>${getStatusBadge(t.status)}</td>
                    <td class="text-center">
                        ${t.status === 'waiting_confirmation' ? `<button class="btn btn-success btn-sm rounded-pill" onclick="confirmTask(${t.task_id})">Nghiệm thu</button>` : 
                          t.status === 'open' ? `<button class="btn btn-outline-danger btn-sm rounded-pill" onclick="cancelTask(${t.task_id})">Hủy</button>` : '---'}
                    </td>
                </tr>`).join('');
        } catch (e) { console.error(e); }
    }

    async function loadAcceptedTasks() {
        try {
            // Dùng API /my-accepted mới
            const res = await authFetch(`http://localhost:8000/api/tasks/my-accepted`);
            acceptedTasksCache = await res.json();
            acceptedTable.innerHTML = acceptedTasksCache.length === 0 ? '<tr><td colspan="4" class="text-center py-5 text-muted">Bạn chưa nhận việc nào</td></tr>' :
            acceptedTasksCache.map((t, index) => `
                <tr class="align-middle border-bottom cursor-pointer">
                    <td class="py-3" onclick="showDetail(${index}, 'accepted')"><strong>${t.title}</strong><br><small>${t.hours}h</small></td>
                    <td>${t.requester?.full_name || 'N/A'}</td>
                    <td>${t.deadline ? new Date(t.deadline).toLocaleDateString('vi-VN') : '---'}</td>
                    <td class="text-center">
                        ${t.status === 'in_progress' ? `<button class="btn btn-primary btn-sm rounded-pill" onclick="reportComplete(${t.task_id})">Báo hoàn thành</button>` : getStatusBadge(t.status)}
                    </td>
                </tr>`).join('');
        } catch (e) { console.error(e); }
    }

    window.confirmTask = async (id) => { 
        if(confirm("Xác nhận nghiệm thu?")) { 
            const res = await authFetch(`http://localhost:8000/api/tasks/${id}/confirm-complete`, {method:'POST'}); 
            if(res.ok) loadPostedTasks(); 
        } 
    };

    window.reportComplete = async (id) => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                // Fetch đặc biệt cho Upload file 
                const res = await fetch(`http://localhost:8000/api/tasks/${id}/report-complete`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (res.ok) { alert("Thành công!"); loadAcceptedTasks(); }
            } catch (err) { alert("Lỗi tải ảnh!"); }
        };
        if(confirm("Gửi ảnh minh chứng?")) fileInput.click();
    };

    window.cancelTask = async (id) => { 
        if(confirm("Xác nhận hủy?")) { 
            const res = await authFetch(`http://localhost:8000/api/tasks/${id}/cancel`, {method:'DELETE'}); 
            if(res.ok) loadPostedTasks(); 
        } 
    };

    loadPostedTasks();
});