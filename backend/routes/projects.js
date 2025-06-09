// backend/routes/projects.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// 資料檔案路徑
const projectsFile = path.join(__dirname, '../data/projects.json');

// 讀取 JSON 檔案的輔助函數
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
function writeProjectsFile(data) {
    try {
        fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing projects file:', error);
        return false;
    }
}

// 驗證專案資料的輔助函數
function validateProjectData(project) {
    const errors = [];

    if (!project.projectCode || project.projectCode.trim() === '') {
        errors.push('專案代碼為必填欄位');
    }

    if (!project.name || project.name.trim() === '') {
        errors.push('專案名稱為必填欄位');
    }

    if (project.startDate && project.endDate) {
        const startDate = new Date(project.startDate);
        const endDate = new Date(project.endDate);
        if (endDate < startDate) {
            errors.push('結束日期不能早於開始日期');
        }
    }

    const validStatuses = ['planning', 'active', 'on-hold', 'completed'];
    if (project.status && !validStatuses.includes(project.status)) {
        errors.push('專案狀態無效');
    }

    return errors;
}

// ==================== 路由定義 ====================

// 獲取所有專案
// GET /api/projects?status=active&owner=張小明&search=網站
router.get('/', (req, res) => {
    try {
        let projects = readProjectsFile();
        const { status, owner, search, sortBy, sortOrder } = req.query;

        // 狀態篩選
        if (status) {
            projects = projects.filter(p => p.status === status);
        }

        // 負責人篩選
        if (owner) {
            projects = projects.filter(p => p.owner && p.owner.includes(owner));
        }

        // 關鍵字搜尋
        if (search) {
            const searchLower = search.toLowerCase();
            projects = projects.filter(p =>
                p.name.toLowerCase().includes(searchLower) ||
                p.projectCode.toLowerCase().includes(searchLower) ||
                (p.description && p.description.toLowerCase().includes(searchLower)) ||
                (p.owner && p.owner.toLowerCase().includes(searchLower))
            );
        }

        // 排序
        if (sortBy) {
            const order = sortOrder === 'desc' ? -1 : 1;
            projects.sort((a, b) => {
                let aVal = a[sortBy];
                let bVal = b[sortBy];

                // 處理日期排序
                if (sortBy.includes('Date')) {
                    aVal = aVal ? new Date(aVal) : new Date(0);
                    bVal = bVal ? new Date(bVal) : new Date(0);
                }

                // 處理字串排序
                if (typeof aVal === 'string') {
                    return aVal.localeCompare(bVal) * order;
                }

                // 處理數字和日期排序
                if (aVal < bVal) return -1 * order;
                if (aVal > bVal) return 1 * order;
                return 0;
            });
        }

        res.json({
            success: true,
            data: projects,
            total: projects.length
        });
    } catch (error) {
        console.error('獲取專案列表錯誤:', error);
        res.status(500).json({
            success: false,
            error: '讀取專案資料失敗'
        });
    }
});

// 獲取特定專案
// GET /api/projects/:projectCode
router.get('/:projectCode', (req, res) => {
    try {
        const projects = readProjectsFile();
        const project = projects.find(p => p.projectCode === req.params.projectCode);

        if (!project) {
            return res.status(404).json({
                success: false,
                error: '專案不存在'
            });
        }

        res.json({
            success: true,
            data: project
        });
    } catch (error) {
        console.error('獲取專案詳情錯誤:', error);
        res.status(500).json({
            success: false,
            error: '讀取專案資料失敗'
        });
    }
});

// 新增專案
// POST /api/projects
router.post('/', (req, res) => {
    try {
        const projectData = req.body;

        // 資料驗證
        const validationErrors = validateProjectData(projectData);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: '資料驗證失敗',
                details: validationErrors
            });
        }

        const projects = readProjectsFile();

        // 檢查專案代碼是否重複
        if (projects.some(p => p.projectCode === projectData.projectCode)) {
            return res.status(409).json({
                success: false,
                error: '專案代碼已存在'
            });
        }

        // 建立新專案
        const newProject = {
            id: Date.now(),
            projectCode: projectData.projectCode.trim(),
            name: projectData.name.trim(),
            owner: projectData.owner ? projectData.owner.trim() : '',
            startDate: projectData.startDate || '',
            endDate: projectData.endDate || '',
            status: projectData.status || 'planning',
            description: projectData.description ? projectData.description.trim() : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        projects.push(newProject);

        if (writeProjectsFile(projects)) {
            res.status(201).json({
                success: true,
                message: '專案建立成功',
                data: newProject
            });
        } else {
            res.status(500).json({
                success: false,
                error: '專案儲存失敗'
            });
        }
    } catch (error) {
        console.error('新增專案錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤'
        });
    }
});

// 更新專案
// PUT /api/projects/:projectCode
router.put('/:projectCode', (req, res) => {
    try {
        const projectCode = req.params.projectCode;
        const updateData = req.body;

        // 資料驗證
        const validationErrors = validateProjectData({ ...updateData, projectCode });
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: '資料驗證失敗',
                details: validationErrors
            });
        }

        const projects = readProjectsFile();
        const projectIndex = projects.findIndex(p => p.projectCode === projectCode);

        if (projectIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '專案不存在'
            });
        }

        // 如果要更改專案代碼，檢查新代碼是否重複
        if (updateData.projectCode && updateData.projectCode !== projectCode) {
            if (projects.some(p => p.projectCode === updateData.projectCode)) {
                return res.status(409).json({
                    success: false,
                    error: '新的專案代碼已存在'
                });
            }
        }

        // 更新專案資料
        const updatedProject = {
            ...projects[projectIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        // 確保必要欄位被正確處理
        if (updateData.name) updatedProject.name = updateData.name.trim();
        if (updateData.owner !== undefined) updatedProject.owner = updateData.owner.trim();
        if (updateData.description !== undefined) updatedProject.description = updateData.description.trim();

        projects[projectIndex] = updatedProject;

        if (writeProjectsFile(projects)) {
            res.json({
                success: true,
                message: '專案更新成功',
                data: updatedProject
            });
        } else {
            res.status(500).json({
                success: false,
                error: '專案更新失敗'
            });
        }
    } catch (error) {
        console.error('更新專案錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤'
        });
    }
});

// 刪除專案
// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
    try {
        const projectId = parseInt(req.params.id);

        if (isNaN(projectId)) {
            return res.status(400).json({
                success: false,
                error: '無效的專案 ID'
            });
        }

        const projects = readProjectsFile();
        const projectIndex = projects.findIndex(p => p.id === projectId);

        if (projectIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '專案不存在'
            });
        }

        const deletedProject = projects[projectIndex];
        projects.splice(projectIndex, 1);

        if (writeProjectsFile(projects)) {
            res.json({
                success: true,
                message: '專案刪除成功',
                data: deletedProject
            });
        } else {
            res.status(500).json({
                success: false,
                error: '專案刪除失敗'
            });
        }
    } catch (error) {
        console.error('刪除專案錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤'
        });
    }
});

// 獲取專案統計資料
// GET /api/projects/stats/summary
router.get('/stats/summary', (req, res) => {
    try {
        const projects = readProjectsFile();

        const stats = {
            total: projects.length,
            byStatus: {
                planning: projects.filter(p => p.status === 'planning').length,
                active: projects.filter(p => p.status === 'active').length,
                'on-hold': projects.filter(p => p.status === 'on-hold').length,
                completed: projects.filter(p => p.status === 'completed').length
            },
            recentProjects: projects
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5),
            upcomingDeadlines: projects
                .filter(p => p.endDate && p.status !== 'completed')
                .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
                .slice(0, 5)
                .map(p => ({
                    ...p,
                    daysUntilDeadline: Math.ceil((new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24))
                }))
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('獲取專案統計錯誤:', error);
        res.status(500).json({
            success: false,
            error: '獲取統計資料失敗'
        });
    }
});

// 批量更新專案狀態
// PATCH /api/projects/batch/status
router.patch('/batch/status', (req, res) => {
    try {
        const { projectIds, status } = req.body;

        if (!Array.isArray(projectIds) || projectIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: '請提供有效的專案 ID 陣列'
            });
        }

        const validStatuses = ['planning', 'active', 'on-hold', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: '無效的專案狀態'
            });
        }

        const projects = readProjectsFile();
        const updatedProjects = [];

        projectIds.forEach(id => {
            const projectIndex = projects.findIndex(p => p.id === parseInt(id));
            if (projectIndex !== -1) {
                projects[projectIndex].status = status;
                projects[projectIndex].updatedAt = new Date().toISOString();
                updatedProjects.push(projects[projectIndex]);
            }
        });

        if (writeProjectsFile(projects)) {
            res.json({
                success: true,
                message: `成功更新 ${updatedProjects.length} 個專案狀態`,
                data: updatedProjects
            });
        } else {
            res.status(500).json({
                success: false,
                error: '批量更新失敗'
            });
        }
    } catch (error) {
        console.error('批量更新專案狀態錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤'
        });
    }
});

module.exports = router;