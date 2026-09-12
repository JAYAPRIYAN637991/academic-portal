"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const db_1 = require("../db");
const audit_service_1 = require("../services/audit.service");
const adminAnalytics_service_1 = require("../services/adminAnalytics.service");
const credential_util_1 = require("../utils/credential.util");
const auth_middleware_1 = require("../middleware/auth.middleware");
class AdminController {
    /**
     * GET /api/admin/dashboard-summary
     * Complete Institutional Admin Dashboard summary.
     * Consolidates:
     * - 8 KPI Cards (Total Students, Staff, Depts, Sections, IA-1, IA-2, Improvement, Pass %)
     * - Performance Overview
     * - Department Performance
     * - Year Performance
     * - Section Performance
     * - Top Students & Students Needing Attention
     * - College Notices (Draft, Scheduled, Published)
     * - Notifications Queue (Pending, Sent, Delivered, Failed)
     */
    static async getDashboardSummary(req, res) {
        try {
            const academicYearId = req.query.academicYearId;
            const [overallAnalytics, staffCount, allDepartments, noticeStats, recentNotices, notificationStats] = await Promise.all([
                adminAnalytics_service_1.AdminAnalyticsService.getOverallCollegeAnalytics(academicYearId),
                db_1.prisma.user.count({ where: { role: client_1.Role.STAFF, isActive: true } }),
                db_1.prisma.department.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
                db_1.prisma.collegeNotice.groupBy({
                    by: ['status'],
                    _count: { id: true }
                }),
                db_1.prisma.collegeNotice.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        title: true,
                        noticeType: true,
                        targetType: true,
                        deliveryChannel: true,
                        status: true,
                        createdAt: true,
                        publishedAt: true,
                        scheduledAt: true,
                        author: { select: { name: true } }
                    }
                }),
                db_1.prisma.notification.groupBy({
                    by: ['status'],
                    _count: { id: true }
                })
            ]);
            // Parse notice status counts
            let draftNotices = 0;
            let scheduledNotices = 0;
            let publishedNotices = 0;
            for (const n of noticeStats) {
                if (n.status === 'DRAFT')
                    draftNotices = n._count.id;
                else if (n.status === 'SCHEDULED')
                    scheduledNotices = n._count.id;
                else if (n.status === 'PUBLISHED')
                    publishedNotices = n._count.id;
            }
            // Parse notification status counts
            let notifPending = 0;
            let notifSent = 0;
            let notifDelivered = 0;
            let notifFailed = 0;
            let notifTotal = 0;
            for (const notif of notificationStats) {
                const c = notif._count.id;
                notifTotal += c;
                if (notif.status === 'PENDING' || notif.status === 'PROCESSING') {
                    notifPending += c;
                }
                else if (notif.status === 'SENT') {
                    notifSent += c;
                }
                else if (notif.status === 'DELIVERED') {
                    notifDelivered += c;
                }
                else if (notif.status === 'FAILED') {
                    notifFailed += c;
                }
            }
            const totalDepts = allDepartments.length;
            // 8 Cards Data (both camelCase and snake_case)
            const cards = {
                totalStudents: overallAnalytics.totalStudents,
                totalStaff: staffCount,
                departments: totalDepts,
                sections: overallAnalytics.totalSections,
                ia1Average: overallAnalytics.ia1Average ?? 0,
                ia2Average: overallAnalytics.ia2Average ?? 0,
                overallImprovement: overallAnalytics.overallImprovement ?? 0,
                passPercentage: overallAnalytics.overallPassPercentage ?? 0
            };
            const metrics = {
                total_students: overallAnalytics.totalStudents,
                total_staff: staffCount,
                departments: totalDepts,
                sections: overallAnalytics.totalSections,
                ia1_average: overallAnalytics.ia1Average ?? 0,
                ia2_average: overallAnalytics.ia2Average ?? 0,
                overall_improvement: overallAnalytics.overallImprovement ?? 0,
                pass_percentage: overallAnalytics.overallPassPercentage ?? 0,
            };
            // Map department performance including any newly created departments
            const mappedDeptPerformance = allDepartments.map((dept) => {
                const ranking = overallAnalytics.departmentRankings.find((r) => r.departmentId === dept.id || r.code === dept.code);
                return {
                    id: dept.id,
                    name: dept.name,
                    code: dept.code,
                    ia1_avg: ranking?.ia1Average ?? 0,
                    ia2_avg: ranking?.ia2Average ?? 0,
                    pass_rate: ranking?.passPercentage ?? 0,
                    total_students: ranking?.totalStudents ?? 0
                };
            });
            const mappedYearPerformance = overallAnalytics.yearRankings.map((y) => ({
                year: y.yearNumber,
                ia1_avg: y.ia1Average ?? 0,
                ia2_avg: y.ia2Average ?? 0,
                improvement: y.improvement ?? 0,
                pass_rate: y.passPercentage ?? 0,
                total_students: y.totalStudents ?? 0
            }));
            const mappedSectionPerformance = overallAnalytics.sectionRankings.map((s) => ({
                section: `${s.departmentCode} Y${s.yearName || ''}-${s.sectionName}`,
                ia1_avg: s.ia1Average ?? 0,
                ia2_avg: s.ia2Average ?? 0,
                pass_rate: s.passPercentage ?? 0,
                total_students: s.totalStudents ?? 0
            }));
            return res.status(200).json({
                success: true,
                cards,
                metrics,
                // Top-level aliases for direct metric card access
                totalStudents: overallAnalytics.totalStudents,
                totalStaff: staffCount,
                departments: totalDepts,
                sections: overallAnalytics.totalSections,
                ia1Average: overallAnalytics.ia1Average ?? 0,
                ia2Average: overallAnalytics.ia2Average ?? 0,
                overallImprovement: overallAnalytics.overallImprovement ?? 0,
                passPercentage: overallAnalytics.overallPassPercentage ?? 0,
                performanceOverview: {
                    totalStudents: overallAnalytics.totalStudents,
                    evaluatedStudents: overallAnalytics.metrics.totalStudents,
                    totalMarksEntered: overallAnalytics.metrics.totalMarksEntered,
                    ia1Average: overallAnalytics.ia1Average ?? 0,
                    ia2Average: overallAnalytics.ia2Average ?? 0,
                    overallImprovement: overallAnalytics.overallImprovement ?? 0,
                    overallPassPercentage: overallAnalytics.overallPassPercentage ?? 0,
                    highestPercentage: overallAnalytics.highestPercentage,
                    lowestPercentage: overallAnalytics.lowestPercentage,
                    benchmarkStatus: overallAnalytics.overallPassPercentage >= 75 ? 'Optimal' : (overallAnalytics.overallPassPercentage >= 50 ? 'Standard' : 'Action Required')
                },
                departmentPerformance: mappedDeptPerformance,
                department_performance: mappedDeptPerformance,
                yearPerformance: mappedYearPerformance,
                year_performance: mappedYearPerformance,
                sectionPerformance: mappedSectionPerformance,
                section_performance: mappedSectionPerformance,
                topStudents: overallAnalytics.top10Students.slice(0, 5),
                allTopStudents: overallAnalytics.top10Students,
                studentsNeedingAttention: overallAnalytics.studentsNeedingAttention,
                notices: {
                    draft: draftNotices,
                    scheduled: scheduledNotices,
                    published: publishedNotices,
                    total: draftNotices + scheduledNotices + publishedNotices
                },
                collegeNotices: {
                    draft: draftNotices,
                    scheduled: scheduledNotices,
                    published: publishedNotices,
                    total: draftNotices + scheduledNotices + publishedNotices,
                    recent: recentNotices
                },
                notifications: {
                    pending: notifPending,
                    sent: notifSent,
                    delivered: notifDelivered,
                    failed: notifFailed,
                    total: notifTotal,
                    deliveryRate: notifTotal > 0 ? Number(((notifDelivered / notifTotal) * 100).toFixed(1)) : 0
                }
            });
        }
        catch (error) {
            console.error('Admin dashboard summary error:', error);
            return res.status(500).json({
                error: error.message || 'Failed to fetch admin dashboard summary',
                code: 'ADMIN_DASHBOARD_ERROR'
            });
        }
    }
    /**
     * GET /api/admin/analytics/overall
     * College-wide overall analytics. Strictly restricted to Admin.
     * Staff accessing this returns 403 Forbidden.
     */
    static async getOverallAnalytics(req, res) {
        try {
            const [departments, staffCount, studentCount, marksCount, noticesCount] = await Promise.all([
                db_1.prisma.department.count(),
                db_1.prisma.user.count({ where: { role: client_1.Role.STAFF } }),
                db_1.prisma.student.count(),
                db_1.prisma.mark.count(),
                db_1.prisma.collegeNotice.count()
            ]);
            const avgMarks = await db_1.prisma.mark.aggregate({
                _avg: { marksObtained: true }
            });
            return res.status(200).json({
                scope: 'OVERALL_COLLEGE_ANALYTICS',
                metrics: {
                    totalDepartments: departments,
                    totalStaff: staffCount,
                    totalStudents: studentCount,
                    totalMarksEntered: marksCount,
                    averageScore: avgMarks._avg.marksObtained ? Number(avgMarks._avg.marksObtained.toFixed(2)) : 0,
                    totalNotices: noticesCount
                }
            });
        }
        catch (error) {
            console.error('Admin overall analytics error:', error);
            return res.status(500).json({ error: 'Failed to fetch overall analytics' });
        }
    }
    /**
     * GET /api/admin/staff
     * Lists all faculty accounts with their assignments.
     */
    static async getStaffList(req, res) {
        try {
            const staffMembers = await db_1.prisma.user.findMany({
                where: { role: client_1.Role.STAFF },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    teacherAssignments: {
                        include: {
                            subject: true,
                            section: {
                                include: {
                                    department: true,
                                    year: true
                                }
                            }
                        }
                    }
                },
                orderBy: { name: 'asc' }
            });
            return res.status(200).json({ staff: staffMembers });
        }
        catch (error) {
            console.error('Get staff error:', error);
            return res.status(500).json({ error: 'Failed to fetch staff list' });
        }
    }
    /**
     * POST /api/admin/staff
     * Admin-only creation of Staff accounts (no public registration).
     */
    static async createStaff(req, res) {
        try {
            const { name, email, password } = req.body || {};
            if (!name || !email || !password) {
                return res.status(400).json({
                    error: 'Name, email, and temporary password are required to create a staff account.',
                    code: 'FIELDS_REQUIRED'
                });
            }
            const existing = await db_1.prisma.user.findUnique({
                where: { email: email.trim().toLowerCase() }
            });
            if (existing) {
                return res.status(409).json({
                    error: 'A user with this email already exists.',
                    code: 'USER_ALREADY_EXISTS'
                });
            }
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash(password, salt);
            const newStaff = await db_1.prisma.user.create({
                data: {
                    name: name.trim(),
                    email: email.trim().toLowerCase(),
                    passwordHash,
                    role: client_1.Role.STAFF,
                    isActive: true
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    createdAt: true
                }
            });
            // Record in audit log
            if (req.user) {
                await db_1.prisma.auditLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'CREATE_STAFF',
                        entity: 'User',
                        entityId: newStaff.id,
                        metadata: { createdStaffEmail: newStaff.email }
                    }
                });
            }
            return res.status(201).json({
                message: 'Staff account created successfully',
                staff: newStaff
            });
        }
        catch (error) {
            console.error('Create staff error:', error);
            return res.status(500).json({ error: 'Failed to create staff account' });
        }
    }
    /**
     * GET /api/admin/audit-logs
     * Retrieves paginated, multi-filtered audit logs
     */
    static async getAuditLogs(req, res) {
        try {
            const { action, entity, userId, startDate, endDate, date, search, page, limit } = req.query;
            const result = await audit_service_1.AuditService.getAuditLogs({
                action: action,
                entity: entity,
                userId: userId,
                startDate: startDate,
                endDate: endDate,
                date: date,
                search: search,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined
            });
            return res.status(200).json(result);
        }
        catch (error) {
            console.error('Audit logs error:', error);
            return res.status(500).json({ error: 'Failed to fetch audit logs' });
        }
    }
    /**
     * GET /api/admin/audit-logs/mark-changes
     * Retrieves paginated, multi-filtered Mark Change History ledger.
     * Every record includes: Student, Register Number, Subject, Assessment, Previous Mark, New Mark, Changed By, Reason, Date/Time.
     */
    static async getMarkChangeLogs(req, res) {
        try {
            const { studentId, subjectId, assessmentId, changedBy, startDate, endDate, date, search, page, limit } = req.query;
            const result = await audit_service_1.AuditService.getMarkChangeLogs({
                studentId: studentId,
                subjectId: subjectId,
                assessmentId: assessmentId,
                changedBy: changedBy,
                startDate: startDate,
                endDate: endDate,
                date: date,
                search: search,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined
            });
            return res.status(200).json(result);
        }
        catch (error) {
            console.error('Mark change logs error:', error);
            return res.status(500).json({ error: 'Failed to fetch mark change history' });
        }
    }
    /**
     * DELETE handler for audit logs or mark changes:
     * STRICTLY FORBIDDEN. Audit trail records are permanent and immutable.
     */
    static async preventAuditDeletion(_req, res) {
        return res.status(403).json({
            error: 'Forbidden: Audit trail records and mark change logs are permanent, immutable institutional records. Deletion is strictly prohibited.',
            code: 'AUDIT_LOGS_IMMUTABLE'
        });
    }
    /**
     * GET /api/admin/profile
     * Returns current authenticated Admin's profile and credential metadata.
     */
    static async getAdminProfile(req, res) {
        try {
            if (!req.user || req.user.role !== client_1.Role.ADMIN) {
                return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
            }
            const admin = await db_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    username: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            if (!admin) {
                return res.status(404).json({ error: 'Admin account not found', code: 'ADMIN_NOT_FOUND' });
            }
            return res.status(200).json({ admin });
        }
        catch (error) {
            console.error('Get admin profile error:', error);
            return res.status(500).json({ error: 'Failed to retrieve admin profile' });
        }
    }
    /**
     * PUT /api/admin/profile/credentials
     * Admin changes their username and/or password.
     * Enforces:
     * 1. Confirmation of current password for identity authorization.
     * 2. New password must satisfy complexity (alphanumeric + at least 1 special symbol, min 8 chars).
     * 3. New username uniqueness check.
     */
    static async updateAdminCredentials(req, res) {
        try {
            if (!req.user || req.user.role !== client_1.Role.ADMIN) {
                return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
            }
            const { currentPassword, newUsername, newPassword, newName } = req.body || {};
            if (!currentPassword) {
                return res.status(400).json({
                    error: 'Current administrator password is required to authorize changes.',
                    code: 'CURRENT_PASSWORD_REQUIRED'
                });
            }
            const admin = await db_1.prisma.user.findUnique({ where: { id: req.user.id } });
            if (!admin) {
                return res.status(404).json({ error: 'Admin account not found', code: 'ADMIN_NOT_FOUND' });
            }
            // Verify current password
            const isCurrentPasswordValid = await bcryptjs_1.default.compare(currentPassword, admin.passwordHash);
            if (!isCurrentPasswordValid) {
                return res.status(401).json({
                    error: 'Incorrect current password. Authorization failed.',
                    code: 'INCORRECT_CURRENT_PASSWORD'
                });
            }
            const updateData = {};
            // Check and update new username
            if (newUsername && typeof newUsername === 'string' && newUsername.trim()) {
                const cleanUsername = newUsername.trim().toLowerCase();
                if (cleanUsername !== admin.username) {
                    const existingUsername = await db_1.prisma.user.findUnique({
                        where: { username: cleanUsername }
                    });
                    if (existingUsername && existingUsername.id !== admin.id) {
                        return res.status(409).json({
                            error: `Username "${cleanUsername}" is already taken. Please choose another.`,
                            code: 'USERNAME_TAKEN'
                        });
                    }
                    updateData.username = cleanUsername;
                }
            }
            // Check and update new name if provided
            if (newName && typeof newName === 'string' && newName.trim()) {
                updateData.name = newName.trim();
            }
            // Check and validate new password
            if (newPassword) {
                const validation = (0, credential_util_1.validatePasswordComplexity)(newPassword);
                if (!validation.isValid) {
                    return res.status(400).json({
                        error: `Password security policy violation: ${validation.errors.join(', ')}. Password must be alphanumeric and contain at least one special symbol.`,
                        code: 'PASSWORD_COMPLEXITY_FAILED',
                        details: validation.errors
                    });
                }
                const salt = await bcryptjs_1.default.genSalt(10);
                updateData.passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
            }
            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({
                    error: 'No credential changes specified. Provide new username or new password.',
                    code: 'NO_CHANGES_SPECIFIED'
                });
            }
            const updatedAdmin = await db_1.prisma.user.update({
                where: { id: admin.id },
                data: updateData,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    username: true,
                    role: true,
                    isActive: true,
                    updatedAt: true
                }
            });
            // Generate refreshed JWT token with updated info
            const token = (0, auth_middleware_1.generateToken)({
                id: updatedAdmin.id,
                email: updatedAdmin.email,
                role: updatedAdmin.role,
                name: updatedAdmin.name,
                isActive: updatedAdmin.isActive
            });
            await db_1.prisma.auditLog.create({
                data: {
                    userId: admin.id,
                    action: 'ADMIN_CREDENTIALS_UPDATED',
                    entity: 'User',
                    entityId: admin.id,
                    metadata: {
                        usernameChanged: !!updateData.username,
                        passwordChanged: !!updateData.passwordHash,
                        nameChanged: !!updateData.name,
                        newUsername: updatedAdmin.username
                    }
                }
            });
            return res.status(200).json({
                message: 'Administrator credentials updated successfully.',
                admin: updatedAdmin,
                token
            });
        }
        catch (error) {
            console.error('Update admin credentials error:', error);
            return res.status(500).json({ error: 'Failed to update admin credentials' });
        }
    }
}
exports.AdminController = AdminController;
