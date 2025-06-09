// backend/routes/progress.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// 資料檔案路徑
const progressFile = path.join(__dirname, '../data/progress.json');
const projectsFile = path.join(__dirname, '../data/projects.json');

// 讀取 JSON 檔案的輔助函數
function readProgressFile() {
    try {
        const data = fs.readFileSync(progressFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading progress file:', error);
        return [];
    }
}

function readProjectsFile() {
    try {
        const data = fs.readFileSync(projectsFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading projects file:', error);
        return [];
    }
}

// 寫入 JSON 檔案的輔助函數
function writeProgressFile(data) {
    try {
        fs.writeFileSync(progressFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing progress file:', error);
        return false;
    }
}

// 驗證進度回報資料的輔助函數
function validateProgressData(progress) {
    const errors = [];

    if (!progress.reporter || progress.reporter.trim() === '') {
        errors.push('回報人為必填欄位');
    }

    if (!progress.date) {
        errors.push('回報日期為必填欄位');
    } else {
        const reportDate = new Date(progress.date);
        const today = new Date();
        const futureLimit = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天後

        if (isNaN(reportDate.getTime())) {
            errors.push('無效的日期格式');
        } else if (reportDate > futureLimit) {
            errors.push('回報日期不能超過未來 7 天');
        }
    }

    if (!progress.projectCode || progress.projectCode.trim() === '') {
        errors.push('專案代碼為必填欄位');
    }

    if (progress.workHours !== undefined) {
        const hours = parseFloat(progress.workHours);
        if (isNaN(hours) || hours < 0 || hours > 24) {
            errors.push('工作時數必須在 0-24 小時之間');
        }
    }

    const validHelpOptions = ['是', '否'];
    if (progress.needHelp && !validHelpOptions.includes(progress.needHelp)) {
        errors.push('是否需要協助欄位值無效');
    }

    return errors;
}

// 檢查專案是否存在的輔助函數
function checkProjectExists(projectCode) {
    const projects = readProjectsFile();
    return projects.some(p => p.projectCode === projectCode);
}

// ==================== 路由定義 ====================

// 獲取所有進度回報
// GET /api/progress?projectCode=PRJ-001&reporter=張小明&startDate=2025-06-01&endDate=2025-06-30&limit=10
router.get('/', (req, res) => {
    try {
        let progress = readProgressFile();
        const {
            projectCode,
            reporter,
            startDate,
            endDate,
            needHelp,
            limit,
            page,
            sortBy,
            sortOrder,
            search
        } = req.query;

        // 專案代碼篩選
        if (projectCode) {
            progress = progress.filter(p => p.projectCode === projectCode);
        }

        // 回報人篩選
        if (reporter) {
            progress = progress.filter(p => p.reporter && p.reporter.includes(reporter));
        }

        // 日期範圍篩選
        if (startDate) {
            progress = progress.filter(p => p.date >= startDate);
        }
        if (endDate) {
            progress = progress.filter(p => p.date <= endDate);
        }

        // 需要協助篩選
        if (needHelp) {
            progress = progress.filter(p => p.needHelp === needHelp);
        }

        // 關鍵字搜尋
        if (search) {
            const searchLower = search.toLowerCase();
            progress = progress.filter(p =>
                (p.content && p.content.toLowerCase().includes(searchLower)) ||
                (p.blocker && p.blocker.toLowerCase().includes(searchLower)) ||
                (p.plan && p.plan.toLowerCase().includes(searchLower)) ||
                p.reporter.toLowerCase().includes(searchLower)
            );
        }

        // 排序
        const sortField = sortBy || 'date';
        const order = sortOrder === 'asc' ? 1 : -1;

        progress.sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            // 處理日期排序
            if (sortField === 'date') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            // 處理數字排序
            if (sortField === 'workHours') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }

            // 處理字串排序
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return aVal.localeCompare(bVal) * order;
            }

            // 處理數字和日期排序
            if (aVal < bVal) return -1 * order;
            if (aVal > bVal) return 1 * order;
            return 0;
        });

        // 分頁處理
        const total = progress.length;
        let paginatedProgress = progress;

        if (page && limit) {
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const startIndex = (pageNum - 1) * limitNum;
            paginatedProgress = progress.slice(startIndex, startIndex + limitNum);
        } else if (limit) {
            const limitNum = parseInt(limit);
            paginatedProgress = progress.slice(0, limitNum);
        }

        res.json({
            success: true,
            data: paginatedProgress,
            pagination: {
                total,
                page: parseInt(page) || 1,
                limit: parseInt(limit) || total,
                totalPages: limit ? Math.ceil(total / parseInt(limit)) : 1
            }
        });
    } catch (error) {
        console.error('獲取進度回報錯誤:', error);
        res.status(500).json({
            success: false,
            error: '讀取進度資料失敗'
        });
    }
});

// 獲取特定進度回報
// GET /api/progress/:id
router.get('/:id', (req, res) => {
    try {
        const progressId = parseInt(req.params.id);

        if (isNaN(progressId)) {
            return res.status(400).json({
                success: false,
                error: '無效的回報 ID'
            });
        }

        const progress = readProgressFile();
        const report = progress.find(p => p.id === progressId);

        if (!report) {
            return res.status(404).json({
                success: false,
                error: '進度回報不存在'
            });
        }

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('獲取進度回報詳情錯誤:', error);
        res.status(500).json({
            success: false,
            error: '讀取進度資料失敗'
        });
    }
});

// 新增進度回報
// POST /api/progress
router.post('/', (req, res) => {
    try {
        const progressData = req.body;

        // 資料驗證
        const validationErrors = validateProgressData(progressData);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: '資料驗證失敗',
                details: validationErrors
            });
        }

        // 檢查專案是否存在
        if (!checkProjectExists(progressData.projectCode)) {
            return res.status(400).json({
                success: false,
                error: '指定的專案不存在'
            });
        }

        // 建立新的進度回報
        const newProgress = {
            id: Date.now(),
            reporter: progressData.reporter.trim(),
            date: progressData.date,
            projectCode: progressData.projectCode.trim(),
            workHours: parseFloat(progressData.workHours) || 0,
            content: progressData.content ? progressData.content.trim() : '',
            blocker: progressData.blocker ? progressData.blocker.trim() : '',
            needHelp: progressData.needHelp || '否',
            plan: progressData.plan ? progressData.plan.trim() : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const progress = readProgressFile();
        progress.push(newProgress);

        if (writeProgressFile(progress)) {
            res.status(201).json({
                success: true,
                message: '進度回報建立成功',
                data: newProgress
            });
        } else {
            res.status(500).json({
                success: false,
                error: '進度回報儲存失敗'
            });
        }
    } catch (error) {
        console.error('新增進度回報錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤'
        });
    }
});

// 更新進度回報
// PUT /api/progress/:id
router.put('/:id', (req, res) => {
    try {
        const progressId = parseInt(req.params.id);
        const updateData = req.body;

        if (isNaN(progressId)) {
            return res.status(400).json({
                success: false,
                error: '無效的回報 ID'
            });
        }

        // 資料驗證
        const validationErrors = validateProgressData(updateData);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: '資料驗證失敗',
                details: validationErrors
            });
        }

        // 檢查專案是否存在
        if (updateData.projectCode && !checkProjectExists(updateData.projectCode)) {
            return res.status(400).json({
                success: false,
                error: '指定的專案不存在'
            });
        }

        const progress = readProgressFile();
        const reportIndex = progress.findIndex(p => p.id === progressId);

        if (reportIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '進度回報不存在'
            });
        }

        // 更新進度回報
        const updatedProgress = {
            ...progress[reportIndex],
            ...updateData,
            workHours: parseFloat(updateData.workHours) || progress[reportIndex].workHours,
            updatedAt: new Date().toISOString()
        };

        // 確保字串欄位被正確處理
        if (updateData.reporter) updatedProgress.reporter = updateData.reporter.trim();
        if (updateData.projectCode) updatedProgress.projectCode = updateData.projectCode.trim();
        if (updateData.content !== undefined) updatedProgress.content = updateData.content.trim();
        if (updateData.blocker !== undefined) updatedProgress.blocker = updateData.blocker.trim();
        if (updateData.plan !== undefined) updatedProgress.plan = updateData.plan.trim();

        progress[reportIndex] = updatedProgress;

        if (writeProgressFile(progress)) {
            res.json({
                success: true,
                message: '進度回報更新成功',
                data: updatedProgress
            });
        } else {
            res.status(500).json({
                success: false,
                error: '進度回報更新失敗'
            });
        }
    } catch (error) {
        console.error('更新進度回報錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤'
        });
    }
});

// 刪除進度回報
// DELETE /api/progress/:id
router.delete('/:id', (req, res) => {
    try {
        const progressId = parseInt(req.params.id);

        if (isNaN(progressId)) {
            return res.status(400).json({
                success: false,
                error: '無效的回報 ID'
            });
        }

        const progress = readProgressFile();
        const reportIndex = progress.findIndex(p => p.id === progressId);

        if (reportIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '進度回報不存在'
            });
        }

        const deletedProgress = progress[reportIndex];
        progress.splice(reportIndex, 1);

        if (writeProgressFile(progress)) {
            res.json({
                success: true,
                message: '進度回報刪除成功',
                data: deletedProgress
            });
        } else {
            res.status(500).json({
                success: false,
                error: '進度回報刪除失敗'
            });
        }
    } catch (error) {
        console.error('刪除進度回報錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤'
        });
    }
});

// 獲取進度統計資料
// GET /api/progress/stats/summary
router.get('/stats/summary', (req, res) => {
    try {
        const progress = readProgressFile();
        const projects = readProjectsFile();

        // 計算各種統計數據
        const stats = {
            total: progress.length,
            needHelpCount: progress.filter(p => p.needHelp === '是').length,
            totalWorkHours: progress.reduce((sum, p) => sum + (p.workHours || 0), 0),
            averageWorkHours: progress.length > 0 ?
                (progress.reduce((sum, p) => sum + (p.workHours || 0), 0) / progress.length).toFixed(1) : 0,

            // 本週統計
            thisWeek: {
                reports: progress.filter(p => {
                    const reportDate = new Date(p.date);
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    return reportDate >= oneWeekAgo;
                }).length,
                workHours: progress.filter(p => {
                    const reportDate = new Date(p.date);
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    return reportDate >= oneWeekAgo;
                }).reduce((sum, p) => sum + (p.workHours || 0), 0),
                needHelp: progress.filter(p => {
                    const reportDate = new Date(p.date);
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    return reportDate >= oneWeekAgo && p.needHelp === '是';
                }).length
            },

            // 按專案分組統計
            byProject: projects.map(project => {
                const projectReports = progress.filter(p => p.projectCode === project.projectCode);
                return {
                    projectCode: project.projectCode,
                    projectName: project.name,
                    reportCount: projectReports.length,
                    totalHours: projectReports.reduce((sum, p) => sum + (p.workHours || 0), 0),
                    needHelpCount: projectReports.filter(p => p.needHelp === '是').length,
                    lastReportDate: projectReports.length > 0 ?
                        projectReports.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date : null
                };
            }).filter(p => p.reportCount > 0),

            // 按回報人分組統計
            byReporter: Object.values(
                progress.reduce((acc, report) => {
                    if (!acc[report.reporter]) {
                        acc[report.reporter] = {
                            reporter: report.reporter,
                            reportCount: 0,
                            totalHours: 0,
                            needHelpCount: 0,
                            lastReportDate: null
                        };
                    }
                    acc[report.reporter].reportCount++;
                    acc[report.reporter].totalHours += report.workHours || 0;
                    if (report.needHelp === '是') acc[report.reporter].needHelpCount++;

                    if (!acc[report.reporter].lastReportDate ||
                        new Date(report.date) > new Date(acc[report.reporter].lastReportDate)) {
                        acc[report.reporter].lastReportDate = report.date;
                    }

                    return acc;
                }, {})
            ),

            // 近期趨勢（最近 30 天）
            recentTrend: (() => {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const recentReports = progress.filter(p => new Date(p.date) >= thirtyDaysAgo);
                const dailyStats = {};

                recentReports.forEach(report => {
                    if (!dailyStats[report.date]) {
                        dailyStats[report.date] = {
                            date: report.date,
                            reportCount: 0,
                            workHours: 0,
                            needHelpCount: 0
                        };
                    }
                    dailyStats[report.date].reportCount++;
                    dailyStats[report.date].workHours += report.workHours || 0;
                    if (report.needHelp === '是') dailyStats[report.date].needHelpCount++;
                });

                return Object.values(dailyStats).sort((a, b) => new Date(a.date) - new Date(b.date));
            })()
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('獲取進度統計錯誤:', error);
        res.status(500).json({
            success: false,
            error: '獲取統計資料失敗'
        });
    }
});

// 獲取特定專案的進度回報
// GET /api/progress/project/:projectCode
router.get('/project/:projectCode', (req, res) => {
    try {
        const { projectCode } = req.params;
        const { limit, sortOrder } = req.query;

        // 檢查專案是否存在
        if (!checkProjectExists(projectCode)) {
            return res.status(404).json({
                success: false,
                error: '專案不存在'
            });
        }

        let progress = readProgressFile().filter(p => p.projectCode === projectCode);

        // 排序（預設按日期新到舊）
        const order = sortOrder === 'asc' ? 1 : -1;
        progress.sort((a, b) => (new Date(a.date) - new Date(b.date)) * order);

        // 限制數量
        if (limit) {
            progress = progress.slice(0, parseInt(limit));
        }

        res.json({
            success: true,
            data: progress,
            total: progress.length
        });
    } catch (error) {
        console.error('獲取專案進度回報錯誤:', error);
        res.status(500).json({
            success: false,
            error: '讀取專案進度資料失敗'
        });
    }
});

// 獲取特定回報人的進度回報
// GET /api/progress/reporter/:reporter
router.get('/reporter/:reporter', (req, res) => {
    try {
        const { reporter } = req.params;
        const { limit, sortOrder, startDate, endDate } = req.query;

        let progress = readProgressFile().filter(p => p.reporter === reporter);

        // 日期範圍篩選
        if (startDate) {
            progress = progress.filter(p => p.date >= startDate);
        }
        if (endDate) {
            progress = progress.filter(p => p.date <= endDate);
        }

        // 排序（預設按日期新到舊）
        const order = sortOrder === 'asc' ? 1 : -1;
        progress.sort((a, b) => (new Date(a.date) - new Date(b.date)) * order);

        // 限制數量
        if (limit) {
            progress = progress.slice(0, parseInt(limit));
        }

        res.json({
            success: true,
            data: progress,
            total: progress.length
        });
    } catch (error) {
        console.error('獲取回報人進度錯誤:', error);
        res.status(500).json({
            success: false,
            error: '讀取回報人進度資料失敗'
        });
    }
});

// 批量更新進度回報的協助狀態
// PATCH /api/progress/batch/help-status
router.patch('/batch/help-status', (req, res) => {
    try {
        const { progressIds, needHelp } = req.body;

        if (!Array.isArray(progressIds) || progressIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: '請提供有效的回報 ID 陣列'
            });
        }

        const validHelpOptions = ['是', '否'];
        if (!validHelpOptions.includes(needHelp)) {
            return res.status(400).json({
                success: false,
                error: '無效的協助狀態'
            });
        }

        const progress = readProgressFile();
        const updatedProgress = [];

        progressIds.forEach(id => {
            const reportIndex = progress.findIndex(p => p.id === parseInt(id));
            if (reportIndex !== -1) {
                progress[reportIndex].needHelp = needHelp;
                progress[reportIndex].updatedAt = new Date().toISOString();
                updatedProgress.push(progress[reportIndex]);
            }
        });

        if (writeProgressFile(progress)) {
            res.json({
                success: true,
                message: `成功更新 ${updatedProgress.length} 個進度回報的協助狀態`,
                data: updatedProgress
            });
        } else {
            res.status(500).json({
                success: false,
                error: '批量更新失敗'
            });
        }
    } catch (error) {
        console.error('批量更新協助狀態錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤'
        });
    }
});

// 獲取需要協助的進度回報
// GET /api/progress/need-help
router.get('/need-help', (req, res) => {
    try {
        const { limit, projectCode } = req.query;

        let progress = readProgressFile().filter(p => p.needHelp === '是');

        // 專案篩選
        if (projectCode) {
            progress = progress.filter(p => p.projectCode === projectCode);
        }

        // 按日期排序（最新的在前）
        progress.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 限制數量
        if (limit) {
            progress = progress.slice(0, parseInt(limit));
        }

        // 添加專案資訊
        const projects = readProjectsFile();
        const progressWithProject = progress.map(report => {
            const project = projects.find(p => p.projectCode === report.projectCode);
            return {
                ...report,
                projectName: project ? project.name : '未知專案',
                projectOwner: project ? project.owner : null
            };
        });

        res.json({
            success: true,
            data: progressWithProject,
            total: progressWithProject.length
        });
    } catch (error) {
        console.error('獲取需要協助的回報錯誤:', error);
        res.status(500).json({
            success: false,
            error: '讀取需要協助的資料失敗'
        });
    }
});

module.exports = router;