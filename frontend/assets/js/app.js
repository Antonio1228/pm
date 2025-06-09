// frontend/assets/js/app.js - 簡化版

/* ==================== 全域變數與設定 ==================== */
const API_BASE_URL = window.location.origin;
let currentSection = 'dashboard';
let projects = [];
let progressReports = [];
let isInitialized = false; // 新增：防止重複初始化

console.log('🌐 API Base URL:', API_BASE_URL);

/* ==================== 工具函數 ==================== */

// 顯示提示訊息
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer') || createAlertContainer();

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
    <span>${message}</span>
    <button class="close-btn" onclick="this.parentElement.remove()">&times;</button>
  `;

    alertContainer.appendChild(alert);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10001;
    max-width: 400px;
  `;
    document.body.appendChild(container);
    return container;
}

// API 請求封裝
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API request failed:', error);
        showAlert(error.message || '請求失敗，請稍後再試', 'error');
        throw error;
    }
}

/* ==================== 頁面導航 ==================== */

function showSection(sectionId) {
    // 避免重複處理同一個區段
    if (currentSection === sectionId) {
        return;
    }

    currentSection = sectionId;

    // 隱藏所有區段
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // 更新導航按鈕狀態
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 顯示目標區段
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // 更新按鈕狀態
    if (event && event.target) {
        event.target.classList.add('active');
    }

    // 載入對應資料
    loadSectionData(sectionId);
}

async function loadSectionData(sectionId) {
    // 避免重複載入同一個區段
    if (currentSection === sectionId && isInitialized) {
        return;
    }

    try {
        switch (sectionId) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'projects':
                await loadProjects();
                break;
            case 'progress':
                await loadProjectOptions();
                break;
            case 'reports':
                await loadProgressReports();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${sectionId} data:`, error);
    }
}

/* ==================== 儀表板功能 ==================== */

async function loadDashboard() {
    try {
        // 確保先載入專案資料
        if (projects.length === 0) {
            projects = await apiRequest(`${API_BASE_URL}/api/projects`);
        }

        const statsData = await apiRequest(`${API_BASE_URL}/api/dashboard/stats`);
        const progressData = await apiRequest(`${API_BASE_URL}/api/progress?limit=5`);

        updateDashboardStats(statsData);
        updateRecentProgress(progressData);
    } catch (error) {
        console.error('載入儀表板失敗:', error);
    }
}

function updateDashboardStats(stats) {
    const elements = {
        totalProjects: document.getElementById('totalProjects'),
        activeProjects: document.getElementById('activeProjects'),
        totalReports: document.getElementById('totalReports'),
        needHelpCount: document.getElementById('needHelpCount'),
        totalWorkHours: document.getElementById('totalWorkHours'),
        thisWeekReports: document.getElementById('thisWeekReports')
    };

    Object.entries(elements).forEach(([key, element]) => {
        if (element && stats[key] !== undefined) {
            element.textContent = stats[key];
        }
    });
}

function updateRecentProgress(recentReports) {
    const container = document.getElementById('recentProgress');
    if (!container) return;

    container.innerHTML = '';

    if (!recentReports || recentReports.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">尚無進度回報資料</p>';
        return;
    }

    recentReports.forEach(report => {
        const project = projects.find(p => p.projectCode === report.projectCode);
        const projectName = project ? project.name : `專案 ${report.projectCode}`;

        const card = document.createElement('div');
        card.className = 'progress-card';
        card.innerHTML = `
      <div class="progress-header">
        <h4>${report.projectCode} - ${projectName}</h4>
        <span class="status-badge ${report.needHelp === '是' ? 'status-blocked' : 'status-active'}">
          ${report.needHelp === '是' ? '需要協助' : '正常'}
        </span>
      </div>
      <div class="progress-meta">
        <span>👤 ${report.reporter}</span>
        <span>📅 ${formatDate(report.date)}</span>
        ${report.workHours ? `<span>⏰ ${report.workHours}小時</span>` : ''}
      </div>
      <div class="progress-content">
        ${report.content ? `<p>${report.content}</p>` : ''}
        ${report.blocker ? `<p class="problem-text"><strong>🚫 問題：</strong> ${report.blocker}</p>` : ''}
      </div>
    `;
        container.appendChild(card);
    });
}

/* ==================== 專案管理功能 ==================== */

async function loadProjects() {
    try {
        projects = await apiRequest(`${API_BASE_URL}/api/projects`);
        updateProjectTable();
    } catch (error) {
        console.error('載入專案列表失敗:', error);
    }
}

function updateProjectTable() {
    const tbody = document.querySelector('#projectTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    projects.forEach(project => {
        const row = document.createElement('tr');
        row.innerHTML = `
      <td>${project.projectCode}</td>
      <td>${project.name}</td>
      <td>${project.owner || '-'}</td>
      <td>${formatDate(project.startDate)}</td>
      <td>${formatDate(project.endDate)}</td>
      <td><span class="status-badge status-${project.status}">${getStatusText(project.status)}</span></td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteProject(${project.id})">刪除</button>
      </td>
    `;
        tbody.appendChild(row);
    });
}

async function deleteProject(projectId) {
    if (!confirm('確定要刪除此專案嗎？')) return;

    try {
        await apiRequest(`${API_BASE_URL}/api/projects/${projectId}`, {
            method: 'DELETE'
        });

        showAlert('✅ 專案刪除成功！');
        await loadProjects();
    } catch (error) {
        console.error('刪除專案失敗:', error);
    }
}

/* ==================== 進度回報功能 ==================== */

async function loadProjectOptions() {
    try {
        if (projects.length === 0) {
            projects = await apiRequest(`${API_BASE_URL}/api/projects`);
        }

        const select = document.getElementById('progressProjectCode');
        if (!select) return;

        select.innerHTML = '<option value="">請選擇專案</option>';

        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.projectCode;
            option.textContent = `${project.projectCode} - ${project.name}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('載入專案選項失敗:', error);
    }
}

/* ==================== 進度查詢功能 ==================== */

async function loadProgressReports() {
    try {
        // 確保先載入專案資料
        if (projects.length === 0) {
            projects = await apiRequest(`${API_BASE_URL}/api/projects`);
        }

        progressReports = await apiRequest(`${API_BASE_URL}/api/progress`);
        updateProgressReportsDisplay();
    } catch (error) {
        console.error('載入進度回報失敗:', error);
    }
}

function updateProgressReportsDisplay() {
    const container = document.getElementById('progressReports');
    if (!container) return;

    container.innerHTML = '';

    if (progressReports.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">尚無進度回報資料</p>';
        return;
    }

    progressReports.forEach(report => {
        const project = projects.find(p => p.projectCode === report.projectCode);
        const projectName = project ? project.name : `專案 ${report.projectCode}`;

        const card = document.createElement('div');
        card.className = 'progress-card';
        card.innerHTML = `
      <div class="progress-header">
        <h4>${report.projectCode} - ${projectName}</h4>
        <span class="status-badge ${report.needHelp === '是' ? 'status-blocked' : 'status-active'}">
          ${report.needHelp === '是' ? '需要協助' : '正常'}
        </span>
      </div>
      <div class="progress-meta">
        <span>👤 ${report.reporter}</span>
        <span>📅 ${formatDate(report.date)}</span>
      </div>
      <div class="progress-content">
        ${report.content ? `<h5>✅ 完成項目：</h5><p>${report.content}</p>` : ''}
        ${report.blocker ? `<h5>🚫 遇到問題：</h5><p class="problem-text">${report.blocker}</p>` : ''}
        ${report.plan ? `<h5>📋 明日計劃：</h5><p>${report.plan}</p>` : ''}
      </div>
    `;
        container.appendChild(card);
    });
}

/* ==================== 表單處理 ==================== */

// 專案表單提交
async function handleProjectSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const projectData = {
        projectCode: formData.get('projectCode'),
        name: formData.get('projectName'),
        owner: formData.get('projectOwner'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        status: formData.get('projectStatus'),
        description: formData.get('description')
    };

    try {
        await apiRequest(`${API_BASE_URL}/api/projects`, {
            method: 'POST',
            body: JSON.stringify(projectData)
        });

        showAlert('✅ 專案建立成功！');
        event.target.reset();
        await loadProjects();
    } catch (error) {
        console.error('建立專案失敗:', error);
    }
}

// 進度回報表單提交
async function handleProgressSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const progressData = {
        reporter: formData.get('reporter'),
        date: formData.get('reportDate'),
        projectCode: formData.get('progressProjectCode'),
        workHours: parseFloat(formData.get('workHours')) || 0,
        content: formData.get('progressContent'),
        blocker: formData.get('blocker'),
        needHelp: formData.get('needHelp'),
        plan: formData.get('plan')
    };

    try {
        await apiRequest(`${API_BASE_URL}/api/progress`, {
            method: 'POST',
            body: JSON.stringify(progressData)
        });

        showAlert('✅ 進度回報提交成功！');
        event.target.reset();
        // 重設今日日期
        document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
    } catch (error) {
        console.error('提交進度回報失敗:', error);
    }
}

/* ==================== 工具函數 ==================== */

function formatDate(dateString) {
    if (!dateString) return '-';

    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function getStatusText(status) {
    const statusMap = {
        'planning': '規劃中',
        'active': '進行中',
        'on-hold': '暫停',
        'completed': '已完成'
    };
    return statusMap[status] || status;
}

/* ==================== 事件監聽器設定 ==================== */

function setupEventListeners() {
    // 專案表單
    const projectForm = document.getElementById('projectForm');
    if (projectForm) {
        projectForm.addEventListener('submit', handleProjectSubmit);
    }

    // 進度回報表單
    const progressForm = document.getElementById('progressForm');
    if (progressForm) {
        progressForm.addEventListener('submit', handleProgressSubmit);
    }
}

/* ==================== 初始化 ==================== */

function initializeApp() {
    // 防止重複初始化
    if (isInitialized) {
        return;
    }

    console.log('🚀 開始初始化應用程式...');

    // 設定今日日期為預設值
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = new Date().toISOString().split('T')[0];
        }
    });

    // 設定事件監聽器
    setupEventListeners();

    // 先載入專案資料，再載入儀表板
    loadProjects().then(() => {
        // 只在初始化時載入儀表板
        if (currentSection === 'dashboard') {
            loadDashboard();
        }
        isInitialized = true;
        console.log('✅ 應用程式初始化完成');
    });
}

// 全域函數
window.showSection = showSection;
window.deleteProject = deleteProject;

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', initializeApp);

console.log('📱 專案管理系統 JavaScript 載入完成');