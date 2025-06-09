// backend/server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件設定
app.use(cors());
app.use(express.json());

// 靜態檔案服務 - 提供前端檔案
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname, '../public')));

// 資料檔案路徑
const dataDir = path.join(__dirname, 'data');
const projectsFile = path.join(dataDir, 'projects.json');
const progressFile = path.join(dataDir, 'progress.json');

// 確保資料目錄和檔案存在
function initializeDataFiles() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(projectsFile)) {
        fs.writeFileSync(projectsFile, JSON.stringify([], null, 2));
    }

    if (!fs.existsSync(progressFile)) {
        fs.writeFileSync(progressFile, JSON.stringify([], null, 2));
    }
}

// 讀取 JSON 檔案的輔助函數
function readJSONFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
}

// 寫入 JSON 檔案的輔助函數
function writeJSONFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        return false;
    }
}

// ==================== 專案相關 API ====================

// 獲取所有專案
app.get('/api/projects', (req, res) => {
    try {
        const projects = readJSONFile(projectsFile);
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: '讀取專案資料失敗' });
    }
});

// 新增專案
app.post('/api/projects', (req, res) => {
    try {
        const newProject = {
            id: Date.now(),
            projectCode: req.body.projectCode,
            name: req.body.name,
            owner: req.body.owner || '',
            startDate: req.body.startDate || '',
            endDate: req.body.endDate || '',
            status: req.body.status || 'planning',
            description: req.body.description || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 驗證必填欄位
        if (!newProject.projectCode || !newProject.name) {
            return res.status(400).json({ error: '專案代碼和名稱為必填欄位' });
        }

        const projects = readJSONFile(projectsFile);

        // 檢查專案代碼是否重複
        if (projects.some(p => p.projectCode === newProject.projectCode)) {
            return res.status(409).json({ error: '專案代碼已存在' });
        }

        projects.push(newProject);

        if (writeJSONFile(projectsFile, projects)) {
            res.status(201).json({ success: true, project: newProject });
        } else {
            res.status(500).json({ error: '專案儲存失敗' });
        }
    } catch (error) {
        console.error('新增專案錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});

// 刪除專案
app.delete('/api/projects/:id', (req, res) => {
    try {
        const projects = readJSONFile(projectsFile);
        const projectId = parseInt(req.params.id);
        const filteredProjects = projects.filter(p => p.id !== projectId);

        if (projects.length === filteredProjects.length) {
            return res.status(404).json({ error: '專案不存在' });
        }

        if (writeJSONFile(projectsFile, filteredProjects)) {
            res.json({ success: true, message: '專案刪除成功' });
        } else {
            res.status(500).json({ error: '專案刪除失敗' });
        }
    } catch (error) {
        console.error('刪除專案錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});

// ==================== 進度回報相關 API ====================

// 獲取所有進度回報
app.get('/api/progress', (req, res) => {
    try {
        const { projectCode, reporter, startDate, endDate, limit } = req.query;
        let progress = readJSONFile(progressFile);

        // 篩選條件
        if (projectCode) {
            progress = progress.filter(p => p.projectCode === projectCode);
        }

        if (reporter) {
            progress = progress.filter(p => p.reporter === reporter);
        }

        if (startDate) {
            progress = progress.filter(p => p.date >= startDate);
        }

        if (endDate) {
            progress = progress.filter(p => p.date <= endDate);
        }

        // 按日期排序（最新的在前）
        progress.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 限制返回數量
        if (limit) {
            progress = progress.slice(0, parseInt(limit));
        }

        res.json(progress);
    } catch (error) {
        res.status(500).json({ error: '讀取進度資料失敗' });
    }
});

// 新增進度回報
app.post('/api/progress', (req, res) => {
    try {
        const newProgress = {
            id: Date.now(),
            reporter: req.body.reporter,
            date: req.body.date,
            projectCode: req.body.projectCode,
            workHours: parseFloat(req.body.workHours) || 0,
            content: req.body.content || '',
            blocker: req.body.blocker || '',
            needHelp: req.body.needHelp || '否',
            plan: req.body.plan || '',
            createdAt: new Date().toISOString()
        };

        // 驗證必填欄位
        if (!newProgress.reporter || !newProgress.date || !newProgress.projectCode) {
            return res.status(400).json({ error: '回報人、日期和專案代碼為必填欄位' });
        }

        const progress = readJSONFile(progressFile);
        progress.push(newProgress);

        if (writeJSONFile(progressFile, progress)) {
            res.status(201).json({ success: true, progress: newProgress });
        } else {
            res.status(500).json({ error: '進度回報儲存失敗' });
        }
    } catch (error) {
        console.error('新增進度回報錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});

// ==================== 統計資料 API ====================

// 獲取儀表板統計資料
app.get('/api/dashboard/stats', (req, res) => {
    try {
        const projects = readJSONFile(projectsFile);
        const progress = readJSONFile(progressFile);

        const stats = {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'active').length,
            completedProjects: projects.filter(p => p.status === 'completed').length,
            totalReports: progress.length,
            needHelpCount: progress.filter(p => p.needHelp === '是').length,
            thisWeekReports: progress.filter(p => {
                const reportDate = new Date(p.date);
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                return reportDate >= oneWeekAgo;
            }).length,
            totalWorkHours: progress.reduce((sum, p) => sum + (p.workHours || 0), 0)
        };

        res.json(stats);
    } catch (error) {
        console.error('獲取統計資料錯誤:', error);
        res.status(500).json({ error: '獲取統計資料失敗' });
    }
});

// ==================== SPA 路由處理 ====================

// 所有非 API 請求都返回 index.html
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API 端點不存在' });
    }

    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ==================== 錯誤處理 ====================

app.use((err, req, res, next) => {
    console.error('伺服器錯誤:', err);
    res.status(500).json({ error: '伺服器內部錯誤' });
});

// ==================== 伺服器啟動 ====================

initializeDataFiles();

app.listen(PORT, () => {
    console.log(`🚀 伺服器運行在 http://localhost:${PORT}`);
    console.log(`📁 前端檔案: ${path.join(__dirname, '../frontend')}`);
    console.log(`📁 資料目錄: ${dataDir}`);
    console.log(`🌐 可以使用 ngrok http ${PORT} 來暴露服務`);
});

process.on('SIGTERM', () => {
    console.log('📴 伺服器正在關閉...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📴 伺服器正在關閉...');
    process.exit(0);
});