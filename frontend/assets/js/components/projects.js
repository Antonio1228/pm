// frontend/components/projects.js

/* ==================== 專案管理模組 ==================== */

class Projects {
    constructor(apiBase) {
        this.apiBase = apiBase;
        this.projects = [];
        this.filteredProjects = [];
        this.currentEditId = null;
        this.searchTerm = '';
        this.sortBy = 'name';
        this.sortOrder = 'asc';
    }

    /* ==================== 初始化 ==================== */

    async init() {
        try {
            await this.loadProjects();
            this.setupEventListeners();
            this.setupForm();
            console.log('📂 專案管理模組初始化完成');
        } catch (error) {
            console.error('專案管理模組初始化失敗:', error);
            this.showError('專案管理載入失敗，請重新整理頁面');
        }
    }

    /* ==================== 資料載入 ==================== */

    async loadProjects() {
        try {
            const response = await fetch(`${this.apiBase}/api/projects`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '載入專案失敗');
            }

            this.projects = data.success ? data.data : data;
            this.applyFilters();
            this.updateProjectTable();
            this.updateProjectStats();

        } catch (error) {
            console.error('載入專案失敗:', error);
            this.showError('載入專案資料失敗');
            this.projects = [];
        }
    }

    /* ==================== 專案 CRUD 操作 ==================== */

    async createProject(projectData) {
        try {
            // 前端驗證
            const validation = this.validateProjectData(projectData);
            if (!validation.isValid) {
                this.showError(validation.errors.join(', '));
                return false;
            }

            const response = await fetch(`${this.apiBase}/api/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '建立專案失敗');
            }

            this.showSuccess('✅ 專案建立成功！');
            await this.loadProjects();
            this.resetForm();

            // 通知其他模組專案已更新
            this.notifyProjectUpdate();

            return true;
        } catch (error) {
            console.error('建立專案失敗:', error);
            this.showError(error.message);
            return false;
        }
    }

    async updateProject(projectId, projectData) {
        try {
            const project = this.projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error('專案不存在');
            }

            const validation = this.validateProjectData(projectData);
            if (!validation.isValid) {
                this.showError(validation.errors.join(', '));
                return false;
            }

            const response = await fetch(`${this.apiBase}/api/projects/${project.projectCode}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '更新專案失敗');
            }

            this.showSuccess('✅ 專案更新成功！');
            await this.loadProjects();
            this.resetForm();

            this.notifyProjectUpdate();

            return true;
        } catch (error) {
            console.error('更新專案失敗:', error);
            this.showError(error.message);
            return false;
        }
    }

    async deleteProject(projectId) {
        try {
            const project = this.projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error('專案不存在');
            }

            const confirmMessage = `確定要刪除專案「${project.name}」嗎？\n\n此操作將會：\n• 刪除專案資料\n• 保留相關的進度回報\n\n此操作無法復原！`;

            if (!confirm(confirmMessage)) {
                return false;
            }

            const response = await fetch(`${this.apiBase}/api/projects/${projectId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '刪除專案失敗');
            }

            this.showSuccess('✅ 專案刪除成功！');
            await this.loadProjects();

            this.notifyProjectUpdate();

            return true;
        } catch (error) {
            console.error('刪除專案失敗:', error);
            this.showError(error.message);
            return false;
        }
    }

    /* ==================== 表單管理 ==================== */

    setupForm() {
        const form = document.getElementById('projectForm');
        if (!form) return;

        // 設定今日為預設開始日期
        const startDateInput = document.getElementById('startDate');
        if (startDateInput && !startDateInput.value) {
            startDateInput.value = new Date().toISOString().split('T')[0];
        }

        // 設定結束日期最小值
        const endDateInput = document.getElementById('endDate');
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', () => {
                endDateInput.min = startDateInput.value;
                if (endDateInput.value && endDateInput.value < startDateInput.value) {
                    endDateInput.value = startDateInput.value;
                }
            });
        }
    }

    fillForm(project) {
        const form = document.getElementById('projectForm');
        if (!form || !project) return;

        // 填入表單資料
        this.setFormValue('projectCode', project.projectCode);
        this.setFormValue('projectName', project.name);
        this.setFormValue('projectOwner', project.owner);
        this.setFormValue('startDate', project.startDate);
        this.setFormValue('endDate', project.endDate);
        this.setFormValue('projectStatus', project.status);
        this.setFormValue('description', project.description);

        // 設定編輯模式
        this.currentEditId = project.id;
        this.updateFormMode(true);

        // 滾動到表單
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setFormValue(fieldName, value) {
        const field = document.getElementById(fieldName);
        if (field) {
            field.value = value || '';
        }
    }

    updateFormMode(isEdit) {
        const form = document.getElementById('projectForm');
        const submitBtn = form?.querySelector('button[type="submit"]');
        const projectCodeField = document.getElementById('projectCode');

        if (isEdit) {
            if (submitBtn) submitBtn.textContent = '🔄 更新專案';
            if (projectCodeField) projectCodeField.readOnly = true;
            this.addCancelButton();
        } else {
            if (submitBtn) submitBtn.textContent = '💾 儲存專案';
            if (projectCodeField) projectCodeField.readOnly = false;
            this.removeCancelButton();
        }
    }

    addCancelButton() {
        const form = document.getElementById('projectForm');
        const submitBtn = form?.querySelector('button[type="submit"]');

        if (!submitBtn || document.getElementById('cancelEditBtn')) return;

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'cancelEditBtn';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.marginLeft = '10px';
        cancelBtn.textContent = '❌ 取消編輯';
        cancelBtn.onclick = () => this.resetForm();

        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }

    removeCancelButton() {
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) {
            cancelBtn.remove();
        }
    }

    resetForm() {
        const form = document.getElementById('projectForm');
        if (form) {
            form.reset();
            this.currentEditId = null;
            this.updateFormMode(false);

            // 重設預設日期
            const startDateInput = document.getElementById('startDate');
            if (startDateInput) {
                startDateInput.value = new Date().toISOString().split('T')[0];
            }
        }
    }

    /* ==================== 表格管理 ==================== */

    updateProjectTable() {
        const tbody = document.querySelector('#projectTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.filteredProjects.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
        <td colspan="7" class="text-center text-muted" style="padding: 40px;">
          ${this.projects.length === 0 ? '尚無專案資料' : '無符合條件的專案'}
        </td>
      `;
            tbody.appendChild(row);
            return;
        }

        this.filteredProjects.forEach(project => {
            const row = this.createProjectRow(project);
            tbody.appendChild(row);
        });
    }

    createProjectRow(project) {
        const row = document.createElement('tr');
        row.className = 'project-row';
        row.dataset.projectId = project.id;

        const statusClass = this.getStatusClass(project.status);
        const statusText = this.getStatusText(project.status);
        const progressDays = this.calculateProgressDays(project);

        row.innerHTML = `
      <td>
        <strong>${project.projectCode}</strong>
        ${project.status === 'active' ? '<span class="badge badge-active">●</span>' : ''}
      </td>
      <td>
        <div class="project-name">
          ${project.name}
          ${progressDays.isOverdue ? '<span class="overdue-indicator">⚠️</span>' : ''}
        </div>
      </td>
      <td>${project.owner || '<span class="text-muted">未指定</span>'}</td>
      <td>${this.formatDate(project.startDate)}</td>
      <td>
        ${this.formatDate(project.endDate)}
        ${progressDays.daysText ? `<small class="text-muted d-block">${progressDays.daysText}</small>` : ''}
      </td>
      <td>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-warning" onclick="window.projectsModule.editProject(${project.id})" title="編輯專案">
            ✏️
          </button>
          <button class="btn btn-sm btn-danger" onclick="window.projectsModule.deleteProject(${project.id})" title="刪除專案">
            🗑️
          </button>
        </div>
      </td>
    `;

        return row;
    }

    /* ==================== 篩選與排序 ==================== */

    applyFilters() {
        let filtered = [...this.projects];

        // 搜尋篩選
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(project =>
                project.name.toLowerCase().includes(searchLower) ||
                project.projectCode.toLowerCase().includes(searchLower) ||
                (project.owner && project.owner.toLowerCase().includes(searchLower)) ||
                (project.description && project.description.toLowerCase().includes(searchLower))
            );
        }

        // 排序
        filtered.sort((a, b) => {
            let aVal = a[this.sortBy];
            let bVal = b[this.sortBy];

            // 處理空值
            if (!aVal && !bVal) return 0;
            if (!aVal) return 1;
            if (!bVal) return -1;

            // 處理日期
            if (this.sortBy.includes('Date')) {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            // 處理字串
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            let result = 0;
            if (aVal < bVal) result = -1;
            else if (aVal > bVal) result = 1;

            return this.sortOrder === 'desc' ? -result : result;
        });

        this.filteredProjects = filtered;
    }

    handleSearch(searchTerm) {
        this.searchTerm = searchTerm;
        this.applyFilters();
        this.updateProjectTable();
    }

    handleSort(column) {
        if (this.sortBy === column) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortBy = column;
            this.sortOrder = 'asc';
        }

        this.applyFilters();
        this.updateProjectTable();
        this.updateSortIndicators();
    }

    updateSortIndicators() {
        // 清除所有排序指示器
        document.querySelectorAll('.sort-indicator').forEach(el => el.remove());

        // 添加當前排序指示器
        const header = document.querySelector(`[data-sort="${this.sortBy}"]`);
        if (header) {
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            indicator.textContent = this.sortOrder === 'asc' ? ' ↑' : ' ↓';
            header.appendChild(indicator);
        }
    }

    /* ==================== 統計資料 ==================== */

    updateProjectStats() {
        const stats = this.calculateStats();

        // 更新統計顯示
        this.updateStatElement('totalProjectsCount', stats.total);
        this.updateStatElement('activeProjectsCount', stats.active);
        this.updateStatElement('completedProjectsCount', stats.completed);
        this.updateStatElement('overdueProjectsCount', stats.overdue);
    }

    calculateStats() {
        const now = new Date();

        return {
            total: this.projects.length,
            active: this.projects.filter(p => p.status === 'active').length,
            completed: this.projects.filter(p => p.status === 'completed').length,
            planning: this.projects.filter(p => p.status === 'planning').length,
            onHold: this.projects.filter(p => p.status === 'on-hold').length,
            overdue: this.projects.filter(p => {
                if (!p.endDate || p.status === 'completed') return false;
                return new Date(p.endDate) < now;
            }).length
        };
    }

    updateStatElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    /* ==================== 工具函數 ==================== */

    validateProjectData(data) {
        const errors = [];

        if (!data.projectCode || !data.projectCode.trim()) {
            errors.push('專案代碼為必填欄位');
        }

        if (!data.name || !data.name.trim()) {
            errors.push('專案名稱為必填欄位');
        }

        if (data.startDate && data.endDate) {
            const startDate = new Date(data.startDate);
            const endDate = new Date(data.endDate);
            if (endDate < startDate) {
                errors.push('結束日期不能早於開始日期');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    getStatusClass(status) {
        const statusMap = {
            'planning': 'status-pending',
            'active': 'status-active',
            'on-hold': 'status-pending',
            'completed': 'status-completed'
        };
        return statusMap[status] || 'status-pending';
    }

    getStatusText(status) {
        const statusMap = {
            'planning': '規劃中',
            'active': '進行中',
            'on-hold': '暫停',
            'completed': '已完成'
        };
        return statusMap[status] || status;
    }

    formatDate(dateString) {
        if (!dateString) return '<span class="text-muted">未設定</span>';

        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    calculateProgressDays(project) {
        if (!project.endDate) {
            return { daysText: null, isOverdue: false };
        }

        const now = new Date();
        const endDate = new Date(project.endDate);
        const diffTime = endDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (project.status === 'completed') {
            return { daysText: '已完成', isOverdue: false };
        }

        if (diffDays < 0) {
            return { daysText: `逾期 ${Math.abs(diffDays)} 天`, isOverdue: true };
        } else if (diffDays === 0) {
            return { daysText: '今天截止', isOverdue: false };
        } else if (diffDays <= 7) {
            return { daysText: `${diffDays} 天內截止`, isOverdue: false };
        }

        return { daysText: null, isOverdue: false };
    }

    /* ==================== 事件處理 ==================== */

    setupEventListeners() {
        // 表單提交
        const form = document.getElementById('projectForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // 搜尋輸入
        const searchInput = document.getElementById('projectSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // 表格標題排序
        const sortableHeaders = document.querySelectorAll('[data-sort]');
        sortableHeaders.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                this.handleSort(header.dataset.sort);
            });
        });
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const projectData = {
            projectCode: formData.get('projectCode')?.trim(),
            name: formData.get('projectName')?.trim(),
            owner: formData.get('projectOwner')?.trim(),
            startDate: formData.get('startDate'),
            endDate: formData.get('endDate'),
            status: formData.get('projectStatus'),
            description: formData.get('description')?.trim()
        };

        let success = false;
        if (this.currentEditId) {
            success = await this.updateProject(this.currentEditId, projectData);
        } else {
            success = await this.createProject(projectData);
        }

        if (success) {
            // 表單已在成功處理中重置
        }
    }

    /* ==================== 公開方法 ==================== */

    editProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (project) {
            this.fillForm(project);
        }
    }

    /* ==================== 通知其他模組 ==================== */

    notifyProjectUpdate() {
        // 觸發自定義事件，讓其他模組知道專案已更新
        window.dispatchEvent(new CustomEvent('projectsUpdated', {
            detail: { projects: this.projects }
        }));
    }

    /* ==================== 通知方法 ==================== */

    showSuccess(message) {
        if (typeof showAlert === 'function') {
            showAlert(message, 'success');
        } else {
            console.log('✅', message);
        }
    }

    showError(message) {
        if (typeof showAlert === 'function') {
            showAlert(message, 'error');
        } else {
            console.error('❌', message);
        }
    }

    /* ==================== 清理 ==================== */

    destroy() {
        // 清理事件監聽器和資源
        this.projects = [];
        this.filteredProjects = [];
        this.currentEditId = null;
        console.log('📂 專案管理模組已清理');
    }
}

// 匯出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Projects;
} else {
    window.Projects = Projects;
}