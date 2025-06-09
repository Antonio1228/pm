// frontend/components/progress.js

/* ==================== 進度回報模組 ==================== */

class Progress {
    constructor(apiBase) {
        this.apiBase = apiBase;
        this.projects = [];
        this.currentReporter = '';
        this.defaultWorkHours = 8;
    }

    /* ==================== 初始化 ==================== */

    async init() {
        try {
            await this.loadProjects();
            this.setupEventListeners();
            this.setupForm();
            this.loadUserPreferences();
            console.log('📝 進度回報模組初始化完成');
        } catch (error) {
            console.error('進度回報模組初始化失敗:', error);
            this.showError('進度回報載入失敗，請重新整理頁面');
        }
    }

    /* ==================== 資料載入 ==================== */

    async loadProjects() {
        try {
            const response = await fetch(`${this.apiBase}/api/projects?status=active`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '載入專案失敗');
            }

            this.projects = data.success ? data.data : data;
            this.updateProjectOptions();

        } catch (error) {
            console.error('載入專案失敗:', error);
            this.showError('載入專案選項失敗');
            this.projects = [];
        }
    }

    updateProjectOptions() {
        const select = document.getElementById('progressProjectCode');
        if (!select) return;

        // 清空現有選項
        select.innerHTML = '<option value="">請選擇專案</option>';

        // 按狀態分組顯示
        const activeProjects = this.projects.filter(p => p.status === 'active');
        const otherProjects = this.projects.filter(p => p.status !== 'active');

        if (activeProjects.length > 0) {
            const activeGroup = document.createElement('optgroup');
            activeGroup.label = '進行中專案';

            activeProjects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.projectCode;
                option.textContent = `${project.projectCode} - ${project.name}`;
                activeGroup.appendChild(option);
            });

            select.appendChild(activeGroup);
        }

        if (otherProjects.length > 0) {
            const otherGroup = document.createElement('optgroup');
            otherGroup.label = '其他專案';

            otherProjects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.projectCode;
                option.textContent = `${project.projectCode} - ${project.name} (${this.getStatusText(project.status)})`;
                option.style.color = '#6c757d';
                otherGroup.appendChild(option);
            });

            select.appendChild(otherGroup);
        }

        // 如果沒有專案，顯示提示
        if (this.projects.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '尚無可用專案';
            option.disabled = true;
            select.appendChild(option);
        }
    }

    /* ==================== 表單設定 ==================== */

    setupForm() {
        // 設定今日日期
        const dateInput = document.getElementById('reportDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
            dateInput.max = new Date().toISOString().split('T')[0]; // 不允許未來日期
        }

        // 設定預設工作時數
        const workHoursInput = document.getElementById('workHours');
        if (workHoursInput && !workHoursInput.value) {
            workHoursInput.value = this.defaultWorkHours;
        }

        // 設定字數計算
        this.setupCharacterCounters();

        // 設定智能建議
        this.setupSmartSuggestions();
    }

    setupCharacterCounters() {
        const textareas = [
            { id: 'progressContent', maxLength: 500 },
            { id: 'blocker', maxLength: 300 },
            { id: 'plan', maxLength: 300 }
        ];

        textareas.forEach(({ id, maxLength }) => {
            const textarea = document.getElementById(id);
            if (!textarea) return;

            // 創建字數顯示元素
            const counter = document.createElement('div');
            counter.className = 'character-counter';
            counter.style.cssText = `
        text-align: right;
        font-size: 12px;
        color: #6c757d;
        margin-top: 5px;
      `;

            textarea.parentNode.insertBefore(counter, textarea.nextSibling);

            // 更新字數
            const updateCounter = () => {
                const current = textarea.value.length;
                counter.textContent = `${current}/${maxLength}`;

                if (current > maxLength * 0.9) {
                    counter.style.color = '#dc3545';
                } else if (current > maxLength * 0.8) {
                    counter.style.color = '#ffc107';
                } else {
                    counter.style.color = '#6c757d';
                }
            };

            textarea.addEventListener('input', updateCounter);
            updateCounter(); // 初始化
        });
    }

    setupSmartSuggestions() {
        const contentTextarea = document.getElementById('progressContent');
        const blockerTextarea = document.getElementById('blocker');
        const needHelpSelect = document.getElementById('needHelp');

        // 當填入阻礙內容時，自動設定需要協助
        if (blockerTextarea && needHelpSelect) {
            blockerTextarea.addEventListener('input', (e) => {
                if (e.target.value.trim() && needHelpSelect.value === '否') {
                    needHelpSelect.value = '是';
                    this.showSuccess('💡 已自動設定為需要協助');
                }
            });
        }

        // 智能建議功能
        this.setupAutoSuggestions();
    }

    setupAutoSuggestions() {
        // 常用詞彙建議
        const suggestions = {
            progressContent: [
                '完成 API 開發',
                '撰寫技術文件',
                '進行系統測試',
                '修復 bug',
                '優化效能',
                '與團隊討論需求',
                '程式碼審查',
                '資料庫設計'
            ],
            blocker: [
                '等待第三方 API 回應',
                '需要更多技術資料',
                '伺服器環境問題',
                '等待客戶確認需求',
                '缺少相關權限',
                '技術難題需要協助'
            ],
            plan: [
                '繼續開發功能模組',
                '進行整合測試',
                '準備部署文件',
                '與客戶確認需求',
                '優化程式碼',
                '撰寫使用者文件'
            ]
        };

        Object.entries(suggestions).forEach(([fieldId, items]) => {
            const textarea = document.getElementById(fieldId);
            if (!textarea) return;

            this.addSuggestionDropdown(textarea, items);
        });
    }

    addSuggestionDropdown(textarea, suggestions) {
        const container = document.createElement('div');
        container.className = 'suggestion-container';
        container.style.position = 'relative';

        textarea.parentNode.insertBefore(container, textarea);
        container.appendChild(textarea);

        const dropdown = document.createElement('div');
        dropdown.className = 'suggestions-dropdown';
        dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-top: none;
      max-height: 150px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
    `;

        container.appendChild(dropdown);

        // 顯示建議
        const showSuggestions = () => {
            dropdown.innerHTML = '';
            const value = textarea.value.toLowerCase();

            const filtered = suggestions.filter(item =>
                item.toLowerCase().includes(value) && item !== textarea.value
            );

            if (filtered.length > 0 && value.length > 0) {
                filtered.forEach(suggestion => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
          `;
                    item.textContent = suggestion;

                    item.addEventListener('click', () => {
                        textarea.value = suggestion;
                        dropdown.style.display = 'none';
                        textarea.focus();
                    });

                    item.addEventListener('mouseenter', () => {
                        item.style.backgroundColor = '#f8f9fa';
                    });

                    item.addEventListener('mouseleave', () => {
                        item.style.backgroundColor = 'white';
                    });

                    dropdown.appendChild(item);
                });

                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        };

        textarea.addEventListener('input', showSuggestions);
        textarea.addEventListener('focus', showSuggestions);

        // 點擊外部隱藏建議
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    /* ==================== 使用者偏好設定 ==================== */

    loadUserPreferences() {
        // 載入儲存的回報人姓名
        const savedReporter = localStorage.getItem('progressReporter');
        if (savedReporter) {
            this.currentReporter = savedReporter;
            const reporterInput = document.getElementById('reporter');
            if (reporterInput) {
                reporterInput.value = savedReporter;
            }
        }

        // 載入預設工作時數
        const savedWorkHours = localStorage.getItem('defaultWorkHours');
        if (savedWorkHours) {
            this.defaultWorkHours = parseFloat(savedWorkHours);
        }
    }

    saveUserPreferences(reporter, workHours) {
        if (reporter) {
            localStorage.setItem('progressReporter', reporter);
            this.currentReporter = reporter;
        }

        if (workHours) {
            localStorage.setItem('defaultWorkHours', workHours);
            this.defaultWorkHours = workHours;
        }
    }

    /* ==================== 進度回報 CRUD ==================== */

    async createProgressReport(progressData) {
        try {
            // 前端驗證
            const validation = this.validateProgressData(progressData);
            if (!validation.isValid) {
                this.showError(validation.errors.join(', '));
                return false;
            }

            // 儲存使用者偏好
            this.saveUserPreferences(progressData.reporter, progressData.workHours);

            const response = await fetch(`${this.apiBase}/api/progress`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(progressData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '提交進度回報失敗');
            }

            this.showSuccess('✅ 進度回報提交成功！');
            this.resetForm();

            // 通知其他模組
            this.notifyProgressUpdate();

            // 顯示提交摘要
            this.showSubmissionSummary(data.data || data);

            return true;
        } catch (error) {
            console.error('提交進度回報失敗:', error);
            this.showError(error.message);
            return false;
        }
    }

    /* ==================== 表單驗證 ==================== */

    validateProgressData(data) {
        const errors = [];

        if (!data.reporter || !data.reporter.trim()) {
            errors.push('回報人為必填欄位');
        }

        if (!data.date) {
            errors.push('回報日期為必填欄位');
        } else {
            const reportDate = new Date(data.date);
            const today = new Date();
            const futureLimit = new Date(today.getTime() + 24 * 60 * 60 * 1000);

            if (reportDate > futureLimit) {
                errors.push('回報日期不能是未來日期');
            }
        }

        if (!data.projectCode) {
            errors.push('請選擇專案');
        }

        if (data.workHours !== undefined) {
            const hours = parseFloat(data.workHours);
            if (isNaN(hours) || hours < 0 || hours > 24) {
                errors.push('工作時數必須在 0-24 小時之間');
            }
        }

        // 檢查是否至少填寫了一個內容欄位
        if (!data.content && !data.blocker && !data.plan) {
            errors.push('請至少填寫一個內容欄位（完成項目、遇到問題或明日計劃）');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /* ==================== 表單管理 ==================== */

    resetForm() {
        const form = document.getElementById('progressForm');
        if (!form) return;

        // 重置表單但保留某些欄位
        const fieldsToKeep = ['reporter', 'workHours'];
        const savedValues = {};

        fieldsToKeep.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                savedValues[fieldId] = field.value;
            }
        });

        form.reset();

        // 恢復保留的欄位
        Object.entries(savedValues).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value;
            }
        });

        // 重設今日日期
        const dateInput = document.getElementById('reportDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // 重置字數計算器
        document.querySelectorAll('.character-counter').forEach(counter => {
            const textarea = counter.previousElementSibling;
            if (textarea) {
                const current = textarea.value.length;
                counter.textContent = `${current}/500`; // 假設最大長度
                counter.style.color = '#6c757d';
            }
        });
    }

    /* ==================== 快速填入功能 ==================== */

    setupQuickFillButtons() {
        const quickFillContainer = document.createElement('div');
        quickFillContainer.className = 'quick-fill-buttons';
        quickFillContainer.innerHTML = `
      <h4>快速填入模板</h4>
      <div class="template-buttons">
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.progressModule.fillTemplate('development')">
          💻 開發工作
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.progressModule.fillTemplate('meeting')">
          🤝 會議討論
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.progressModule.fillTemplate('testing')">
          🧪 測試工作
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.progressModule.fillTemplate('documentation')">
          📝 文件撰寫
        </button>
      </div>
    `;

        const form = document.getElementById('progressForm');
        if (form) {
            form.insertBefore(quickFillContainer, form.firstChild);
        }
    }

    fillTemplate(templateType) {
        const templates = {
            development: {
                content: '完成功能模組開發，包含前端介面和後端 API 實作',
                blocker: '',
                plan: '進行功能測試並優化效能'
            },
            meeting: {
                content: '參與專案進度會議，討論當前開發狀況和後續規劃',
                blocker: '需要等待客戶確認部分需求細節',
                plan: '根據會議結論調整開發優先順序'
            },
            testing: {
                content: '執行系統功能測試，發現並修復多個 bug',
                blocker: '',
                plan: '繼續進行整合測試和效能測試'
            },
            documentation: {
                content: '撰寫 API 文件和使用者操作手冊',
                blocker: '',
                plan: '完成技術文件並進行內部審查'
            }
        };

        const template = templates[templateType];
        if (!template) return;

        // 填入模板內容
        this.setFieldValue('progressContent', template.content);
        this.setFieldValue('blocker', template.blocker);
        this.setFieldValue('plan', template.plan);

        // 更新字數計算器
        this.updateCharacterCounters();

        this.showSuccess(`📝 已填入${this.getTemplateName(templateType)}模板`);
    }

    getTemplateName(templateType) {
        const names = {
            development: '開發工作',
            meeting: '會議討論',
            testing: '測試工作',
            documentation: '文件撰寫'
        };
        return names[templateType] || templateType;
    }

    setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value;
            field.dispatchEvent(new Event('input')); // 觸發 input 事件
        }
    }

    updateCharacterCounters() {
        document.querySelectorAll('.character-counter').forEach(counter => {
            const textarea = counter.previousElementSibling;
            if (textarea) {
                const current = textarea.value.length;
                const maxLength = textarea.getAttribute('maxlength') || 500;
                counter.textContent = `${current}/${maxLength}`;
            }
        });
    }

    /* ==================== 提交摘要 ==================== */

    showSubmissionSummary(progressData) {
        const modal = document.createElement('div');
        modal.className = 'submission-summary-modal';
        modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-content">
          <div class="modal-header">
            <h3>✅ 回報提交成功</h3>
            <button class="close-btn" onclick="this.closest('.submission-summary-modal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="summary-item">
              <strong>專案：</strong> ${progressData.projectCode}
            </div>
            <div class="summary-item">
              <strong>日期：</strong> ${this.formatDate(progressData.date)}
            </div>
            <div class="summary-item">
              <strong>工作時數：</strong> ${progressData.workHours || 0} 小時
            </div>
            ${progressData.needHelp === '是' ? `
              <div class="summary-item warning">
                <strong>⚠️ 已標記需要協助</strong>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="this.closest('.submission-summary-modal').remove()">
              確定
            </button>
          </div>
        </div>
      </div>
    `;

        // 添加樣式
        modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
    `;

        document.body.appendChild(modal);

        // 3秒後自動關閉
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 3000);
    }

    /* ==================== 事件處理 ==================== */

    setupEventListeners() {
        // 表單提交
        const form = document.getElementById('progressForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // 專案選擇變更
        const projectSelect = document.getElementById('progressProjectCode');
        if (projectSelect) {
            projectSelect.addEventListener('change', (e) => this.handleProjectChange(e));
        }

        // 工作時數輸入驗證
        const workHoursInput = document.getElementById('workHours');
        if (workHoursInput) {
            workHoursInput.addEventListener('input', (e) => this.validateWorkHours(e));
        }

        // 監聽專案更新事件
        window.addEventListener('projectsUpdated', (e) => {
            this.projects = e.detail.projects;
            this.updateProjectOptions();
        });

        // 設定快速填入按鈕
        this.setupQuickFillButtons();
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const progressData = {
            reporter: formData.get('reporter')?.trim(),
            date: formData.get('reportDate'),
            projectCode: formData.get('progressProjectCode'),
            workHours: parseFloat(formData.get('workHours')) || 0,
            content: formData.get('progressContent')?.trim(),
            blocker: formData.get('blocker')?.trim(),
            needHelp: formData.get('needHelp'),
            plan: formData.get('plan')?.trim()
        };

        await this.createProgressReport(progressData);
    }

    handleProjectChange(e) {
        const projectCode = e.target.value;
        const project = this.projects.find(p => p.projectCode === projectCode);

        if (project) {
            // 顯示專案資訊
            this.showProjectInfo(project);
        }
    }

    showProjectInfo(project) {
        // 移除舊的專案資訊
        const oldInfo = document.querySelector('.project-info');
        if (oldInfo) oldInfo.remove();

        const infoDiv = document.createElement('div');
        infoDiv.className = 'project-info';
        infoDiv.innerHTML = `
      <div class="project-details">
        <h5>📂 ${project.name}</h5>
        <p><strong>負責人：</strong> ${project.owner || '未指定'}</p>
        <p><strong>狀態：</strong> <span class="status-badge ${this.getStatusClass(project.status)}">${this.getStatusText(project.status)}</span></p>
        ${project.description ? `<p><strong>說明：</strong> ${project.description}</p>` : ''}
      </div>
    `;

        const projectSelect = document.getElementById('progressProjectCode');
        if (projectSelect) {
            projectSelect.parentNode.insertBefore(infoDiv, projectSelect.nextSibling);
        }
    }

    validateWorkHours(e) {
        const value = parseFloat(e.target.value);

        if (isNaN(value) || value < 0) {
            e.target.setCustomValidity('工作時數必須大於等於 0');
        } else if (value > 24) {
            e.target.setCustomValidity('工作時數不能超過 24 小時');
        } else {
            e.target.setCustomValidity('');
        }
    }

    /* ==================== 工具函數 ==================== */

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
        if (!dateString) return '-';

        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    /* ==================== 通知其他模組 ==================== */

    notifyProgressUpdate() {
        window.dispatchEvent(new CustomEvent('progressUpdated'));
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
        this.projects = [];
        console.log('📝 進度回報模組已清理');
    }
}

// 匯出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Progress;
} else {
    window.Progress = Progress;
}