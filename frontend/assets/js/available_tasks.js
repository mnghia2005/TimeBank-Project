document.addEventListener('DOMContentLoaded', async function() {
    const userInfo = JSON.parse(localStorage.getItem('user_info'));
    const token = localStorage.getItem('access_token');
    
    if (!userInfo || !token) { 
        localStorage.clear();
        window.location.href = 'login.html'; 
        return; 
    }

    const tableBody = document.getElementById('taskTableBody');
    const statusMessage = document.getElementById('statusMessage');
    const offcanvasEl = document.getElementById('taskDetailOffcanvas');
    const bsOffcanvas = new bootstrap.Offcanvas(offcanvasEl);
    
    let allTasks = []; // KHO DỮ LIỆU ĐỂ HIỆN OFFCANVAS

    async function authFetch(url, options = {}) {
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            alert("Phiên đăng nhập hết hạn!");
            localStorage.clear();
            window.location.href = 'login.html';
            return null;
        }
        return response;
    }

    async function fetchTasks() {
        try {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border text-primary spinner-border-sm me-2"></div> Đang tải danh sách...</td></tr>';
            const response = await authFetch(`http://localhost:8000/api/tasks/available`);
            if (!response) return;
            allTasks = await response.json();
            renderTable(allTasks);
        } catch (error) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-5"><i class="bi bi-exclamation-triangle me-2"></i> Lỗi kết nối!</td></tr>';
        }
    }

    function renderTable(tasks) {
        tableBody.innerHTML = '';
        if (tasks.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-5">Chưa có công việc nào.</td></tr>';
            return;
        }
        tasks.forEach(task => {
            const deadlineDate = task.deadline ? new Date(task.deadline).toLocaleDateString('vi-VN') : 'Không hạn';
            const row = document.createElement('tr');
            row.className = 'task-row';
            row.innerHTML = `
                <td class="py-4 ps-4" onclick="showDetail(${task.task_id})">
                    <div class="task-title mb-1 text-dark fw-bold">${task.title}</div>
                    <div class="text-muted small"><i class="bi bi-person-circle me-1"></i>${task.requester_name}</div>
                </td>
                <td><span class="badge-time">${task.hours} giờ</span></td>
                <td class="text-danger fw-medium small">${deadlineDate}</td>
                <td class="text-center">
                    <button class="btn-accept shadow-sm" onclick="handleAccept(${task.task_id})">Nhận việc</button>
                </td>`;
            tableBody.appendChild(row);
        });
    }

    window.showDetail = function(taskId) {
        const task = allTasks.find(t => t.task_id === taskId);
        if (!task) return;

        const deadlineStr = task.deadline ? new Date(task.deadline).toLocaleString('vi-VN') : 'Không giới hạn';
        let cleanDescription = task.description || 'Chưa có mô tả.';
        if (cleanDescription.includes('|')) { cleanDescription = cleanDescription.split('|').pop().trim(); }

        document.getElementById('offcanvasContent').innerHTML = `
            <div class="mb-4"><p class="detail-label">Tiêu đề</p><h4 class="fw-bold text-dark">${task.title}</h4></div>
            <div class="row mb-4 g-3">
                <div class="col-6 text-center"><div class="p-3 border rounded-3 bg-light"><p class="detail-label mb-1">Thù lao</p><div class="fw-bold text-primary">${task.hours} Giờ</div></div></div>
                <div class="col-6 text-center"><div class="p-3 border rounded-3 bg-light"><p class="detail-label mb-1">Hạn</p><div class="fw-bold text-danger">${deadlineStr}</div></div></div>
            </div>
            <div class="mb-4"><p class="detail-label">Kỹ năng</p><div class="p-3 rounded-3 border bg-white"><div class="fw-bold text-dark"><i class="bi bi-tools me-2"></i>${task.skill_name || 'Không có'}</div></div></div>
            <div class="mb-4"><p class="detail-label">Mô tả (JD)</p><div class="jd-box text-dark" style="white-space: pre-wrap;">${cleanDescription}</div></div>`;
        
        document.getElementById('offcanvasFooter').innerHTML = `<button class="btn-accept w-100 py-3 shadow" onclick="handleAccept(${task.task_id})">XÁC NHẬN NHẬN VIỆC</button>`;
        bsOffcanvas.show();
    };

    window.handleAccept = async function(taskId) {
        if (!confirm("Bạn muốn nhận việc này?")) return;
        try {
            const response = await authFetch(`http://localhost:8000/api/tasks/${taskId}/accept`, { method: 'POST' });
            if (response && response.ok) {
                bsOffcanvas.hide();
                statusMessage.classList.remove('d-none');
                setTimeout(() => { statusMessage.classList.add('d-none'); fetchTasks(); }, 2000);
            } else if (response) {
                const err = await response.json(); alert("Lỗi: " + err.detail);
            }
        } catch (e) { alert("Lỗi kết nối!"); }
    };

   
    const taskSearchInput = document.getElementById('taskSearch');
    if (taskSearchInput) {
        taskSearchInput.addEventListener('input', async (e) => {
            const key = e.target.value;
            const response = await authFetch(`http://localhost:8000/api/tasks/available?keyword=${encodeURIComponent(key)}`);
            if (response && response.ok) {
                const searchResults = await response.json();
                allTasks = searchResults; 
                renderTable(searchResults);
            }
        });
    }

    fetchTasks();
});