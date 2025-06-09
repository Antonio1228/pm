// frontend/components/dashboard.js

/* ==================== 儀表板模組 ==================== */

class Dashboard {
    constructor(apiBase) {
        this.apiBase = apiBase;
        this.refreshInterval = null;
        this.autoRefreshEnabled = true;
        this.refreshIntervalTime = 30000; // 30秒自動刷新
        this.charts = {};
        this.stats = {};
    }

    /* ==================== 初始化 ==================== */

    async init() {
        try {
            await this.loadAllData();
            this.setupEventListeners();
            this.startAutoRefresh();
            console.log('📊 儀表板模組初始化完成');
        } catch (error) {
            console.error('儀表板初始化失敗:', error);
            this.showError('儀表板載入失敗，請重新整理頁面');
        }
    }

    /* ==================== 資料載入 ==================== */

    async loadAllData() {
        try {
            const [statsData, projectsData, progressData, needHelpData] = await Promise.all([
                this.fetchDashboardStats(),
                this.fetchProjectSummary(),
                this.fetchRecentProgress(),
                this.fetchNeedHelpReports()
            ]);

            this.updateStats(statsData);
            this.updateProjectSummary(projectsData);
            this.updateRecentProgress(progressData);
            this.updateNeedHelpAlerts(needHelpData);
            this.updateCharts();

        } catch (error) {
            console.error('載入儀表板資料失敗:', error);
            throw error;
        }
    }

    async fetchDashboardStats() {
        try {
            const response = await fetch(`${this.apiBase}/api/dashboard/stats`);
            const data = await response.json();
            return data.success ? data.data : data;
        } catch (error) {
            console.error('獲取統計資料失敗:', error);
            return this.getDefaultStats();
        }
    }

    async fetchProjectSummary() {
        try {
            const response = await fetch(`${this.apiBase}/api/dashboard/project-progress`);
            const data = await response.json();
            return data.success ? data.data : data;
        } catch (error) {
            console.error('獲取專案摘要失敗:', error);
            return [];
        }
    }

    async fetchRecentProgress() {
        try {
            const response = await fetch(`${this.apiBase}/api/progress?limit=10&sortBy=date&sortOrder=desc`);
            const data = await response.json();
            return data.success ? data.data : data;
        } catch (error) {
            console.error('獲取最新進度失敗:', error);
            return [];
        }
    }

    async fetchNeedHelpReports() {
        try {
            const response = await fetch(`${this.apiBase}/api/progress/need-help?limit=5`);
            const data = await response.json();
            return data.success ? data.data : data;
        } catch (error) {
            console.error('獲取需要協助的回報失敗:', error);
            return [];
        }
    }

    /* ==================== 統計資料更新 ==================== */

    updateStats(stats) {
        this.stats = stats;

        // 更新統計卡片
        this.updateStatCard('totalProjects', stats.totalProjects || 0, '總專案數');
        this.updateStatCard('activeProjects', stats.activeProjects || 0, '進行中專案');
        this.updateStatCard('totalReports', stats.totalReports || 0, '總回報數');
        this.updateStatCard('needHelpCount', stats.needHelpCount || 0, '需要協助', stats.needHelpCount > 0 ? 'warning' : 'normal');

        // 更新額外統計
        if (stats.totalWorkHours !== undefined) {
            this.updateStatCard('totalWorkHours', Math.round(stats.totalWorkHours), '總工作時數');
        }

        if (stats.thisWeekReports !== undefined) {
            this.updateStatCard('thisWeekReports', stats.thisWeekReports, '本週回報');
        }
    }

    updateStatCard(elementId, value, label, type = 'normal') {
        const element = document.getElementById(elementId);
        if (!element) return;

        // 數字動畫效果
        this.animateNumber(element, value);

        // 更新標籤
        const labelElement = element.parentNode.querySelector('.stat-label');
        if (labelElement) {
            labelElement.textContent = label;
        }

        // 根據類型添加樣式
        const card = element.closest('.stat-card');
        if (card) {
            card.className = `stat-card ${type === 'warning' ? 'stat-warning' : ''}`;
        }
    }

    animateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const increment = (targetValue - currentValue) / 20;
        let current = currentValue;

        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= targetValue) || (increment < 0 && current <= targetValue)) {
                current = targetValue;
                clearInterval(timer);
            }
            element.textContent = Math.round(current);
        }, 50);
    }

    /* ==================== 專案摘要更新 ==================== */

    updateProjectSummary(projects) {
        const container = document.getElementById('projectSummary');
        if (!container) return;

        // 清空容器
        container.innerHTML = '';

        if (!projects || projects.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <p>📂 尚無專案資料</p>
        </div>
      `;
            return;
        }

        // 排序專案（按最後回報日期）
        const sortedProjects = projects
            .sort((a, b) => {
                if (!a.lastReportDate && !b.lastReportDate) return 0;
                if (!a.lastReportDate) return 1;
                if (!b.lastReportDate) return -1;
                return new Date(b.lastReportDate) - new Date(a.lastReportDate);
            })
            .slice(0, 5); // 只顯示前5個

        sortedProjects.forEach(project => {
            const projectCard = this.createProjectSummaryCard(project);
            container.appendChild(projectCard);
        });
    }

    createProjectSummaryCard(project) {
        const card = document.createElement('div');
        card.className = 'project-summary-card';

        const statusClass = this.getProjectStatusClass(project.status);
        const progressPercentage = this.calculateProjectProgress(project);

        card.innerHTML = `
      <div class="project-header">
        <h4>${project.projectCode} - ${project.name}</h4>
        <span class="status-badge ${statusClass}">${this.getStatusText(project.status)}</span>
      </div>
      
      <div class="project-stats">
        <div class="stat-item">
          <span class="stat-icon">📝</span>
          <span class="stat-text">${project.totalReports || 0} 回報</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">⏰</span>
          <span class="stat-text">${Math.round(project.totalWorkHours || 0)} 小時</span>
        </div>
        ${project.needHelpCount > 0 ? `
          <div class="stat-item warning">
            <span class="stat-icon">🆘</span>
            <span class="stat-text">${project.needHelpCount} 需協助</span>
          </div>
        ` : ''}
      </div>
      
      <div class="project-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercentage}%"></div>
        </div>
        <span class="progress-text">${progressPercentage}% 完成</span>
      </div>
      
      <div class="project-meta">
        <span>👤 ${project.owner || '未指定'}</span>
        <span>📅 ${this.formatRelativeDate(project.lastReportDate)}</span>
      </div>
    `;

        return card;
    }

    /* ==================== 最新進度更新 ==================== */

    updateRecentProgress(progressReports) {
        const container = document.getElementById('recentProgress');
        if (!container) return;

        container.innerHTML = '';

        if (!progressReports || progressReports.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <p>📝 尚無進度回報</p>
        </div>
      `;
            return;
        }

        // 顯示最新的5個回報
        progressReports.slice(0, 5).forEach(report => {
            const progressCard = this.createProgressCard(report);
            container.appendChild(progressCard);
        });
    }

    createProgressCard(report) {
        const card = document.createElement('div');
        card.className = 'progress-card';

        card.innerHTML = `
      <div class="progress-header">
        <h4>${report.projectCode}</h4>
        <span class="status-badge ${report.needHelp === '是' ? 'status-blocked' : 'status-active'}">
          ${report.needHelp === '是' ? '需要協助' : '正常'}
        </span>
      </div>
      
      <div class="progress-meta">
        <span>👤 ${report.reporter}</span>
        <span>📅 ${this.formatRelativeDate(report.date)}</span>
        ${report.workHours ? `<span>⏰ ${report.workHours}h</span>` : ''}
      </div>
      
      <div class="progress-content">
        ${report.content ? `
          <div class="content-section">
            <h5>✅ 完成項目</h5>
            <p>${this.truncateText(report.content, 100)}</p>
          </div>
        ` : ''}
        
        ${report.blocker ? `
          <div class="content-section warning">
            <h5>🚫 遇到問題</h5>
            <p>${this.truncateText(report.blocker, 100)}</p>
          </div>
        ` : ''}
      </div>
    `;

        return card;
    }

    /* ==================== 需要協助提醒 ==================== */

    updateNeedHelpAlerts(needHelpReports) {
        const container = document.getElementById('needHelpAlerts');
        if (!container) return;

        if (!needHelpReports || needHelpReports.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
      <div class="alert-header">
        <h3>🆘 需要協助的項目 (${needHelpReports.length})</h3>
      </div>
      <div class="alert-list">
        ${needHelpReports.map(report => `
          <div class="alert-item">
            <div class="alert-info">
              <strong>${report.projectCode}</strong> - ${report.reporter}
              <span class="alert-date">${this.formatRelativeDate(report.date)}</span>
            </div>
            <div class="alert-content">
              ${this.truncateText(report.blocker || '需要協助', 80)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    }

    /* ==================== 圖表更新 ==================== */

    updateCharts() {
        this.updateWorkHoursChart();
        this.updateProjectStatusChart();
        this.updateProgressTrendChart();
    }

    updateWorkHoursChart() {
        const canvas = document.getElementById('workHoursChart');
        if (!canvas) return;

        // 這裡可以使用 Chart.js 或其他圖表庫
        // 簡化版本：使用 CSS 創建簡單的長條圖
        const ctx = canvas.getContext('2d');
        const data = this.stats.byProject || [];

        // 清空畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (data.length === 0) return;

        // 繪製簡單的長條圖
        const maxHours = Math.max(...data.map(p => p.totalHours || 0));
        const barWidth = canvas.width / data.length - 10;

        data.forEach((project, index) => {
            const barHeight = (project.totalHours / maxHours) * (canvas.height - 40);
            const x = index * (barWidth + 10) + 5;
            const y = canvas.height - barHeight - 20;

            // 繪製長條
            ctx.fillStyle = '#667eea';
            ctx.fillRect(x, y, barWidth, barHeight);

            // 繪製標籤
            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(project.projectCode, x + barWidth / 2, canvas.height - 5);
            ctx.fillText(project.totalHours + 'h', x + barWidth / 2, y - 5);
        });
    }

    updateProjectStatusChart() {
        const container = document.getElementById('projectStatusChart');
        if (!container || !this.stats.byStatus) return;

        const statuses = this.stats.byStatus;
        const total = Object.values(statuses).reduce((sum, count) => sum + count, 0);

        if (total === 0) {
            container.innerHTML = '<p class="text-muted">無專案資料</p>';
            return;
        }

        const statusInfo = {
            planning: { label: '規劃中', color: '#6c757d' },
            active: { label: '進行中', color: '#28a745' },
            'on-hold': { label: '暫停', color: '#ffc107' },
            completed: { label: '已完成', color: '#17a2b8' }
        };

        container.innerHTML = Object.entries(statuses)
            .filter(([_, count]) => count > 0)
            .map(([status, count]) => {
                const percentage = Math.round((count / total) * 100);
                const info = statusInfo[status] || { label: status, color: '#6c757d' };

                return `
          <div class="status-chart-item">
            <div class="status-indicator" style="background-color: ${info.color}"></div>
            <span class="status-label">${info.label}</span>
            <span class="status-count">${count} (${percentage}%)</span>
            <div class="status-bar">
              <div class="status-fill" style="width: ${percentage}%; background-color: ${info.color}"></div>
            </div>
          </div>
        `;
            }).join('');
    }

    updateProgressTrendChart() {
        // 實作進度趨勢圖
        // 這裡可以加入更複雜的趨勢分析
    }

    /* ==================== 工具函數 ==================== */

    getProjectStatusClass(status) {
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

    calculateProjectProgress(project) {
        // 簡單的進度計算邏輯
        if (project.status === 'completed') return 100;
        if (project.status === 'planning') return 0;

        // 根據回報數量和時間計算大概進度
        const reportsCount = project.totalReports || 0;
        const workHours = project.totalWorkHours || 0;

        // 這裡可以實作更複雜的進度計算邏輯
        const baseProgress = Math.min((reportsCount * 10), 80);
        const hoursBonus = Math.min((workHours / 40) * 20, 20);

        return Math.min(Math.round(baseProgress + hoursBonus), 95);
    }

    formatRelativeDate(dateString) {
        if (!dateString) return '無資料';

        const date = new Date(dateString);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '昨天';
        if (diffDays < 7) return `${diffDays} 天前`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} 週前`;

        return date.toLocaleDateString('zh-TW', {
            month: 'short',
            day: 'numeric'
        });
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    getDefaultStats() {
        return {
            totalProjects: 0,
            activeProjects: 0,
            totalReports: 0,
            needHelpCount: 0,
            totalWorkHours: 0,
            thisWeekReports: 0
        };
    }

    /* ==================== 自動刷新 ==================== */

    startAutoRefresh() {
        if (!this.autoRefreshEnabled) return;

        this.refreshInterval = setInterval(async () => {
            try {
                await this.loadAllData();
                console.log('📊 儀表板資料自動刷新');
            } catch (error) {
                console.error('自動刷新失敗:', error);
            }
        }, this.refreshIntervalTime);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    toggleAutoRefresh() {
        this.autoRefreshEnabled = !this.autoRefreshEnabled;

        if (this.autoRefreshEnabled) {
            this.startAutoRefresh();
        } else {
            this.stopAutoRefresh();
        }

        return this.autoRefreshEnabled;
    }

    /* ==================== 事件處理 ==================== */

    setupEventListeners() {
        // 手動刷新按鈕
        const refreshBtn = document.getElementById('dashboardRefresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.handleRefresh());
        }

        // 自動刷新切換
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.toggleAutoRefresh();
            });
        }

        // 時間範圍選擇
        const timeRangeSelect = document.getElementById('timeRange');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                this.handleTimeRangeChange(e.target.value);
            });
        }
    }

    async handleRefresh() {
        try {
            await this.loadAllData();
            this.showSuccess('📊 儀表板已更新');
        } catch (error) {
            this.showError('刷新失敗，請稍後再試');
        }
    }

    async handleTimeRangeChange(timeRange) {
        // 實作時間範圍變更邏輯
        console.log('時間範圍變更為:', timeRange);
        // 重新載入對應時間範圍的資料
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
        this.stopAutoRefresh();
        console.log('📊 儀表板模組已清理');
    }
}

// 匯出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dashboard;
} else {
    window.Dashboard = Dashboard;
}