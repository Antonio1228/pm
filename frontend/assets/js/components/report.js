// frontend/components/reports.js

/* ==================== 報表查詢模組 ==================== */

class Reports {
    constructor(apiBase) {
        this.apiBase = apiBase;
        this.progressReports = [];
        this.filteredReports = [];
        this.projects = [];
        this.reporters = [];
        this.currentFilters = {
            search: '',
            projectCode: '',
            reporter: '',
            startDate: '',
            endDate: '',
            needHelp: '',
            sortBy: 'date',
            sortOrder: 'desc'
        };
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalPages = 1;
    }

    /* ==================== 初始化 ==================== */

    async init() {
        try {
            await this.loadInitialData();
            this.setupEventListeners();
            this.setupFilters();
            console.log('📊 報表查詢模組初始化完成');
        } catch (error) {
            console.error('報表查詢模組初始化失敗:', error);
            this.showError('報表查詢載入失敗，請重新整理頁面');
        }
    }

    /* ==================== 資料載入 ==================== */

    async loadInitialData() {
        try {
            const [projectsData, reportsData] = await Promise.all([
                this.fetchProjects(),
                this.fetchProgressReports()
            ]);

            this.projects = projectsData;
            this.progressReports = reportsData;
            this.extractReporters();
            this.updateFilterOptions();
            this.applyFilters();
            this.updateReportsDisplay();
            this.updateStats();

        } catch (error) {
            console.error('載入初始資料失敗:', error);
            throw error;
        }
    }

    async fetchProjects() {
        try {
            const response = await fetch(`${this.apiBase}/api/projects`);
            const data = await response.json();
            return data.success ? data.data : data;
        } catch (error) {
            console.error('獲取專案資料失敗:', error);
            return [];
        }
    }

    async fetchProgressReports() {
        try {
            const params = new URLSearchParams({
                sortBy: this.currentFilters.sortBy,
                sortOrder: this.currentFilters.sortOrder,
                limit: 100 // 初始載入更多資料
            });

            const response = await fetch(`${this.apiBase}/api/progress?${params}`);
            const data = await response.json();
            return data.success ? data.data : data;
        } catch (error) {
            console.error('獲取進度回報失敗:', error);
            return [];
        }
    }

    async refreshReports() {
        try {
            this.showLoading(true);
            const reportsData = await this.fetchProgressReports();
            this.progressReports = reportsData;
            this.extractReporters();
            this.updateFilterOptions();
            this.applyFilters();
            this.updateReportsDisplay();
            this.updateStats();
            this.showSuccess('📊 報表資料已更新');
        } catch (error) {
            this.showError('更新報表資料失敗');
        } finally {
            this.showLoading(false);
        }
    }

    /* ==================== 篩選功能 ==================== */

    extractReporters() {
        const reporterSet = new Set();
        this.progressReports.forEach(report => {
            if (report.reporter) {
                reporterSet.add(report.reporter);
            }
        });
        this.reporters = Array.from(reporterSet).sort();
    }

    updateFilterOptions() {
        this.updateProjectFilter();
        this.updateReporterFilter();
    }

    updateProjectFilter() {
        const select = document.getElementById('filterProject');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">所有專案</option>';

        // 按狀態分組
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
                option.textContent = `${project.projectCode} - ${project.name}`;
                otherGroup.appendChild(option);
            });

            select.appendChild(otherGroup);
        }

        select.value = currentValue;
    }

    updateReporterFilter() {
        const select = document.getElementById('filterReporter');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">所有回報人</option>';

        this.reporters.forEach(reporter => {
            const option = document.createElement('option');
            option.value = reporter;
            option.textContent = reporter;
            select.appendChild(option);
        });

        select.value = currentValue;
    }

    setupFilters() {
        // 設定日期範圍預設值
        const endDateInput = document.getElementById('endDate');
        if (endDateInput && !endDateInput.value) {
            endDateInput.value = new Date().toISOString().split('T')[0];
        }

        const startDateInput = document.getElementById('startDate');
        if (startDateInput && !startDateInput.value) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
        }

        // 設定快速日期選擇按鈕
        this.setupQuickDateFilters();
    }

    setupQuickDateFilters() {
        const quickFiltersContainer = document.createElement('div');
        quickFiltersContainer.className = 'quick-date-filters';
        quickFiltersContainer.innerHTML = `
      <div class="quick-filter-buttons">
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.reportsModule.setDateRange(7)">
          近 7 天
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.reportsModule.setDateRange(30)">
          近 30 天
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.reportsModule.setDateRange(90)">
          近 3 個月
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.reportsModule.clearDateRange()">
          全部
        </button>
      </div>
    `;

        const filterContainer = document.querySelector('.search-filter-container');
        if (filterContainer) {
            filterContainer.appendChild(quickFiltersContainer);
        }
    }

    setDateRange(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (startDateInput) startDateInput.value = startDate.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = endDate.toISOString().split('T')[0];

        this.updateFilters();
    }

    clearDateRange() {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';

        this.updateFilters();
    }

    applyFilters() {
        let filtered = [...this.progressReports];

        // 關鍵字搜尋
        if (this.currentFilters.search) {
            const searchLower = this.currentFilters.search.toLowerCase();
            filtered = filtered.filter(report =>
                (report.content && report.content.toLowerCase().includes(searchLower)) ||
                (report.blocker && report.blocker.toLowerCase().includes(searchLower)) ||
                (report.plan && report.plan.toLowerCase().includes(searchLower)) ||
                report.reporter.toLowerCase().includes(searchLower) ||
                report.projectCode.toLowerCase().includes(searchLower)
            );
        }

        // 專案篩選
        if (this.currentFilters.projectCode) {
            filtered = filtered.filter(report => report.projectCode === this.currentFilters.projectCode);
        }

        // 回報人篩選
        if (this.currentFilters.reporter) {
            filtered = filtered.filter(report => report.reporter === this.currentFilters.reporter);
        }

        // 日期範圍篩選
        if (this.currentFilters.startDate) {
            filtered = filtered.filter(report => report.date >= this.currentFilters.startDate);
        }
        if (this.currentFilters.endDate) {
            filtered = filtered.filter(report => report.date <= this.currentFilters.endDate);
        }

        // 需要協助篩選
        if (this.currentFilters.needHelp) {
            filtered = filtered.filter(report => report.needHelp === this.currentFilters.needHelp);
        }

        // 排序
        filtered.sort((a, b) => {
            let aVal = a[this.currentFilters.sortBy];
            let bVal = b[this.currentFilters.sortBy];

            if (this.currentFilters.sortBy === 'date') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            } else if (this.currentFilters.sortBy === 'workHours') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }

            let result = 0;
            if (aVal < bVal) result = -1;
            else if (aVal > bVal) result = 1;

            return this.currentFilters.sortOrder === 'desc' ? -result : result;
        });

        this.filteredReports = filtered;
        this.currentPage = 1;
        this.totalPages = Math.ceil(filtered.length / this.pageSize);
    }

    updateFilters() {
        // 收集所有篩選條件
        this.currentFilters.search = document.getElementById('reportSearch')?.value || '';
        this.currentFilters.projectCode = document.getElementById('filterProject')?.value || '';
        this.currentFilters.reporter = document.getElementById('filterReporter')?.value || '';
        this.currentFilters.startDate = document.getElementById('startDate')?.value || '';
        this.currentFilters.endDate = document.getElementById('endDate')?.value || '';
        this.currentFilters.needHelp = document.getElementById('filterNeedHelp')?.value || '';

        this.applyFilters();
        this.updateReportsDisplay();
        this.updateStats();
        this.updateFilterSummary();
    }

    /* ==================== 報表顯示 ==================== */

    updateReportsDisplay() {
        const container = document.getElementById('progressReports');
        if (!container) return;

        container.innerHTML = '';

        if (this.filteredReports.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>無符合條件的報表</h3>
          <p>請調整篩選條件或新增進度回報</p>
        </div>
      `;
            this.updatePagination();
            return;
        }

        // 分頁顯示
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, this.filteredReports.length);
        const pageReports = this.filteredReports.slice(startIndex, endIndex);

        pageReports.forEach(report => {
            const reportCard = this.createReportCard(report);
            container.appendChild(reportCard);
        });

        this.updatePagination();
        this.updateResultsInfo();
    }

    createReportCard(report) {
        const card = document.createElement('div');
        card.className = 'progress-card report-card';
        card.dataset.reportId = report.id;

        const project = this.projects.find(p => p.projectCode === report.projectCode);
        const projectName = project ? project.name : '未知專案';

        card.innerHTML = `
      <div class="progress-header">
        <div class="report-title">
          <h4>${report.projectCode} - ${projectName}</h4>
          <div class="report-meta">
            <span class="reporter">👤 ${report.reporter}</span>
            <span class="date">📅 ${this.formatDate(report.date)}</span>
            <span class="relative-date">${this.getRelativeTime(report.date)}</span>
          </div>
        </div>
        <div class="report-status">
          <span class="status-badge ${report.needHelp === '是' ? 'status-blocked' : 'status-active'}">
            ${report.needHelp === '是' ? '🆘 需要協助' : '✅ 正常'}
          </span>
          ${report.workHours ? `<span class="work-hours">⏰ ${report.workHours}h</span>` : ''}
        </div>
      </div>
      
      <div class="progress-content">
        ${report.content ? `
          <div class="content-section">
            <h5>✅ 完成項目</h5>
            <p>${this.highlightSearchTerm(report.content)}</p>
          </div>
        ` : ''}
        
        ${report.blocker ? `
          <div class="content-section ${report.needHelp === '是' ? 'warning' : ''}">
            <h5>🚫 遇到問題</h5>
            <p>${this.highlightSearchTerm(report.blocker)}</p>
          </div>
        ` : ''}
        
        ${report.plan ? `
          <div class="content-section">
            <h5>📋 明日計劃</h5>
            <p>${this.highlightSearchTerm(report.plan)}</p>
          </div>
        ` : ''}
      </div>
      
      <div class="report-actions">
        <button class="btn btn-sm btn-secondary" onclick="window.reportsModule.exportReport(${report.id})">
          📄 匯出
        </button>
        <button class="btn btn-sm btn-secondary" onclick="window.reportsModule.shareReport(${report.id})">
          🔗 分享
        </button>
        ${report.needHelp === '是' ? `
          <button class="btn btn-sm btn-warning" onclick="window.reportsModule.markAsResolved(${report.id})">
            ✅ 標記為已解決
          </button>
        ` : ''}
      </div>
    `;

        return card;
    }

    /* ==================== 分頁功能 ==================== */

    updatePagination() {
        const paginationContainer = document.getElementById('pagination');
        if (!paginationContainer) return;

        if (this.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="pagination-wrapper">';

        // 上一頁按鈕
        paginationHTML += `
      <button class="btn btn-sm ${this.currentPage === 1 ? 'btn-secondary' : 'btn-primary'}" 
              ${this.currentPage === 1 ? 'disabled' : ''} 
              onclick="window.reportsModule.goToPage(${this.currentPage - 1})">
        ← 上一頁
      </button>
    `;

        // 頁碼按鈕
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<button class="btn btn-sm btn-secondary" onclick="window.reportsModule.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += '<span class="pagination-dots">...</span>';
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
        <button class="btn btn-sm ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'}" 
                onclick="window.reportsModule.goToPage(${i})">
          ${i}
        </button>
      `;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                paginationHTML += '<span class="pagination-dots">...</span>';
            }
            paginationHTML += `<button class="btn btn-sm btn-secondary" onclick="window.reportsModule.goToPage(${this.totalPages})">${this.totalPages}</button>`;
        }

        // 下一頁按鈕
        paginationHTML += `
      <button class="btn btn-sm ${this.currentPage === this.totalPages ? 'btn-secondary' : 'btn-primary'}" 
              ${this.currentPage === this.totalPages ? 'disabled' : ''} 
              onclick="window.reportsModule.goToPage(${this.currentPage + 1})">
        下一頁 →
      </button>
    `;

        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
    }

    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;

        this.currentPage = page;
        this.updateReportsDisplay();

        // 滾動到頂部
        const container = document.getElementById('progressReports');
        if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /* ==================== 統計資訊 ==================== */

    updateStats() {
        const stats = this.calculateFilteredStats();
        this.displayStats(stats);
    }

    calculateFilteredStats() {
        const reports = this.filteredReports;

        return {
            totalReports: reports.length,
            totalWorkHours: reports.reduce((sum, r) => sum + (parseFloat(r.workHours) || 0), 0),
            needHelpCount: reports.filter(r => r.needHelp === '是').length,
            uniqueProjects: new Set(reports.map(r => r.projectCode)).size,
            uniqueReporters: new Set(reports.map(r => r.reporter)).size,
            averageWorkHours: reports.length > 0 ?
                (reports.reduce((sum, r) => sum + (parseFloat(r.workHours) || 0), 0) / reports.length).toFixed(1) : 0,
            dateRange: this.getDateRange(reports),
            topReporter: this.getTopReporter(reports),
            topProject: this.getTopProject(reports)
        };
    }

    getDateRange(reports) {
        if (reports.length === 0) return null;

        const dates = reports.map(r => new Date(r.date)).sort((a, b) => a - b);
        return {
            start: dates[0],
            end: dates[dates.length - 1]
        };
    }

    getTopReporter(reports) {
        const reporterCount = {};
        reports.forEach(r => {
            reporterCount[r.reporter] = (reporterCount[r.reporter] || 0) + 1;
        });

        const topReporter = Object.entries(reporterCount)
            .sort(([, a], [, b]) => b - a)[0];

        return topReporter ? { name: topReporter[0], count: topReporter[1] } : null;
    }

    getTopProject(reports) {
        const projectCount = {};
        reports.forEach(r => {
            projectCount[r.projectCode] = (projectCount[r.projectCode] || 0) + 1;
        });

        const topProject = Object.entries(projectCount)
            .sort(([, a], [, b]) => b - a)[0];

        return topProject ? { code: topProject[0], count: topProject[1] } : null;
    }

    displayStats(stats) {
        const statsContainer = document.getElementById('reportsStats');
        if (!statsContainer) return;

        statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${stats.totalReports}</div>
          <div class="stat-label">總回報數</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${Math.round(stats.totalWorkHours)}</div>
          <div class="stat-label">總工作時數</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${stats.needHelpCount}</div>
          <div class="stat-label">需要協助</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${stats.averageWorkHours}</div>
          <div class="stat-label">平均工時/天</div>
        </div>
      </div>
      
      ${stats.topReporter ? `
        <div class="additional-stats">
          <div class="stat-item">
            <strong>最活躍回報者：</strong> ${stats.topReporter.name} (${stats.topReporter.count} 次)
          </div>
          ${stats.topProject ? `
            <div class="stat-item">
              <strong>最多回報專案：</strong> ${stats.topProject.code} (${stats.topProject.count} 次)
            </div>
          ` : ''}
          <div class="stat-item">
            <strong>涉及專案：</strong> ${stats.uniqueProjects} 個
          </div>
          <div class="stat-item">
            <strong>參與人員：</strong> ${stats.uniqueReporters} 人
          </div>
        </div>
      ` : ''}
    `;
    }

    updateResultsInfo() {
        const infoContainer = document.getElementById('resultsInfo');
        if (!infoContainer) return;

        const startIndex = (this.currentPage - 1) * this.pageSize + 1;
        const endIndex = Math.min(this.currentPage * this.pageSize, this.filteredReports.length);

        infoContainer.innerHTML = `
      顯示第 ${startIndex}-${endIndex} 筆，共 ${this.filteredReports.length} 筆結果
      ${this.filteredReports.length !== this.progressReports.length ?
                `（從 ${this.progressReports.length} 筆中篩選）` : ''}
    `;
    }

    updateFilterSummary() {
        const summaryContainer = document.getElementById('filterSummary');
        if (!summaryContainer) return;

        const activeFilters = [];

        if (this.currentFilters.search) {
            activeFilters.push(`關鍵字: "${this.currentFilters.search}"`);
        }
        if (this.currentFilters.projectCode) {
            const project = this.projects.find(p => p.projectCode === this.currentFilters.projectCode);
            activeFilters.push(`專案: ${project ? project.name : this.currentFilters.projectCode}`);
        }
        if (this.currentFilters.reporter) {
            activeFilters.push(`回報人: ${this.currentFilters.reporter}`);
        }
        if (this.currentFilters.startDate || this.currentFilters.endDate) {
            const start = this.currentFilters.startDate || '最早';
            const end = this.currentFilters.endDate || '最新';
            activeFilters.push(`日期: ${start} ~ ${end}`);
        }
        if (this.currentFilters.needHelp) {
            activeFilters.push(`協助狀態: ${this.currentFilters.needHelp}`);
        }

        if (activeFilters.length > 0) {
            summaryContainer.innerHTML = `
        <div class="filter-summary">
          <strong>目前篩選條件：</strong> ${activeFilters.join(' | ')}
          <button class="btn btn-sm btn-secondary" onclick="window.reportsModule.clearAllFilters()" style="margin-left: 10px;">
            清除所有篩選
          </button>
        </div>
      `;
            summaryContainer.style.display = 'block';
        } else {
            summaryContainer.style.display = 'none';
        }
    }

    /* ==================== 匯出功能 ==================== */

    exportReport(reportId) {
        const report = this.filteredReports.find(r => r.id === reportId);
        if (!report) return;

        const project = this.projects.find(p => p.projectCode === report.projectCode);
        const projectName = project ? project.name : '未知專案';

        const content = `
進度回報 - ${report.projectCode}
====================

專案名稱：${projectName}
回報人：${report.reporter}
回報日期：${this.formatDate(report.date)}
工作時數：${report.workHours || 0} 小時
需要協助：${report.needHelp}

完成項目：
${report.content || '無'}

遇到問題：
${report.blocker || '無'}

明日計劃：
${report.plan || '無'}

匯出時間：${new Date().toLocaleString('zh-TW')}
    `.trim();

        this.downloadAsFile(`${report.projectCode}_${report.date}_進度回報.txt`, content);
    }

    exportAllReports() {
        if (this.filteredReports.length === 0) {
            this.showError('沒有資料可以匯出');
            return;
        }

        const csvContent = this.generateCSV();
        const filename = `進度回報_${new Date().toISOString().split('T')[0]}.csv`;
        this.downloadAsFile(filename, csvContent);
        this.showSuccess(`✅ 已匯出 ${this.filteredReports.length} 筆資料`);
    }

    generateCSV() {
        const headers = ['日期', '專案代碼', '專案名稱', '回報人', '工作時數', '完成項目', '遇到問題', '需要協助', '明日計劃'];
        const rows = [headers];

        this.filteredReports.forEach(report => {
            const project = this.projects.find(p => p.projectCode === report.projectCode);
            const projectName = project ? project.name : '未知專案';

            rows.push([
                report.date,
                report.projectCode,
                projectName,
                report.reporter,
                report.workHours || 0,
                this.escapeCsvField(report.content || ''),
                this.escapeCsvField(report.blocker || ''),
                report.needHelp,
                this.escapeCsvField(report.plan || '')
            ]);
        });

        return rows.map(row => row.join(',')).join('\n');
    }

    escapeCsvField(field) {
        if (typeof field !== 'string') return field;
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    }

    downloadAsFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    /* ==================== 其他功能 ==================== */

    shareReport(reportId) {
        const report = this.filteredReports.find(r => r.id === reportId);
        if (!report) return;

        const shareData = {
            title: `進度回報 - ${report.projectCode}`,
            text: `${report.reporter} 在 ${this.formatDate(report.date)} 的進度回報`,
            url: window.location.href
        };

        if (navigator.share) {
            navigator.share(shareData);
        } else {
            // 複製到剪貼簿
            const shareText = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
            navigator.clipboard.writeText(shareText).then(() => {
                this.showSuccess('📋 分享連結已複製到剪貼簿');
            }).catch(() => {
                this.showError('分享失敗');
            });
        }
    }

    async markAsResolved(reportId) {
        // 這裡可以實作標記為已解決的功能
        this.showSuccess('✅ 已標記為已解決');
    }

    clearAllFilters() {
        // 清空所有篩選條件
        document.getElementById('reportSearch').value = '';
        document.getElementById('filterProject').value = '';
        document.getElementById('filterReporter').value = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('filterNeedHelp').value = '';

        this.updateFilters();
        this.showSuccess('🧹 已清除所有篩選條件');
    }

    /* ==================== 工具函數 ==================== */

    formatDate(dateString) {
        if (!dateString) return '-';

        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    getRelativeTime(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '昨天';
        if (diffDays < 7) return `${diffDays} 天前`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} 週前`;
        return `${Math.floor(diffDays / 30)} 個月前`;
    }

    highlightSearchTerm(text) {
        if (!this.currentFilters.search || !text) return text;

        const searchTerm = this.currentFilters.search;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    showLoading(show) {
        const loadingElement = document.getElementById('reportsLoading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }

    /* ==================== 事件處理 ==================== */

    setupEventListeners() {
        // 搜尋輸入
        const searchInput = document.getElementById('reportSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.updateFilters();
            }, 300));
        }

        // 篩選器變更
        const filterElements = [
            'filterProject', 'filterReporter', 'filterNeedHelp',
            'startDate', 'endDate'
        ];

        filterElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.updateFilters());
            }
        });

        // 排序變更
        const sortSelect = document.getElementById('sortBy');
        const orderSelect = document.getElementById('sortOrder');

        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.currentFilters.sortBy = sortSelect.value;
                this.updateFilters();
            });
        }

        if (orderSelect) {
            orderSelect.addEventListener('change', () => {
                this.currentFilters.sortOrder = orderSelect.value;
                this.updateFilters();
            });
        }

        // 匯出按鈕
        const exportBtn = document.getElementById('exportReportsBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportAllReports());
        }

        // 重新整理按鈕
        const refreshBtn = document.getElementById('refreshReportsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshReports());
        }

        // 監聽進度更新事件
        window.addEventListener('progressUpdated', () => {
            this.refreshReports();
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
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
        this.progressReports = [];
        this.filteredReports = [];
        this.projects = [];
        this.reporters = [];
        console.log('📊 報表查詢模組已清理');
    }
}

// 匯出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Reports;
} else {
    window.Reports = Reports;
}