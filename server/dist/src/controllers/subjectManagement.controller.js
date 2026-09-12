"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectManagementController = void 0;
const db_1 = require("../db");
class SubjectManagementController {
    /**
     * GET /api/admin/subjects
     * List all subjects with search, filtering by department, year, semester, and status.
     */
    static async getSubjects(req, res) {
        try {
            const { departmentId, yearId, semester, status, search } = req.query;
            const where = {};
            if (departmentId && departmentId !== 'all') {
                where.departmentId = departmentId;
            }
            if (yearId && yearId !== 'all') {
                where.yearId = yearId;
            }
            if (semester && semester !== 'all') {
                where.semester = parseInt(semester, 10);
            }
            if (status && status !== 'all') {
                where.isActive = status === 'active';
            }
            if (search && typeof search === 'string' && search.trim().length > 0) {
                const query = search.trim();
                where.OR = [
                    { name: { contains: query, mode: 'insensitive' } },
                    { code: { contains: query, mode: 'insensitive' } }
                ];
            }
            const subjects = await db_1.prisma.subject.findMany({
                where,
                include: {
                    department: true,
                    year: true,
                    _count: {
                        select: {
                            teacherAssignments: true,
                            marks: true
                        }
                    }
                },
                orderBy: [
                    { department: { code: 'asc' } },
                    { year: { yearNumber: 'asc' } },
                    { semester: 'asc' },
                    { code: 'asc' }
                ]
            });
            const formattedSubjects = subjects.map(s => ({
                ...s,
                department_name: s.department?.name,
                department_code: s.department?.code,
                department_id: s.departmentId,
                year: s.year?.yearNumber,
                yearNumber: s.year?.yearNumber,
                year_name: s.year?.name
            }));
            return res.status(200).json({ subjects: formattedSubjects, data: formattedSubjects, total: formattedSubjects.length });
        }
        catch (error) {
            console.error('Get subjects error:', error);
            return res.status(500).json({ error: 'Failed to retrieve subjects' });
        }
    }
    /**
     * GET /api/admin/subjects/:id
     * Retrieve a single subject by ID.
     */
    static async getSubjectById(req, res) {
        try {
            const { id } = req.params;
            const subject = await db_1.prisma.subject.findUnique({
                where: { id },
                include: {
                    department: true,
                    year: true,
                    teacherAssignments: {
                        include: {
                            staff: {
                                select: { id: true, name: true, email: true }
                            },
                            section: true,
                            academicYear: true
                        }
                    },
                    _count: {
                        select: {
                            marks: true,
                            teacherAssignments: true
                        }
                    }
                }
            });
            if (!subject) {
                return res.status(404).json({ error: 'Subject not found', code: 'SUBJECT_NOT_FOUND' });
            }
            return res.status(200).json({ subject });
        }
        catch (error) {
            console.error('Get subject by ID error:', error);
            return res.status(500).json({ error: 'Failed to fetch subject details' });
        }
    }
    /**
     * POST /api/admin/subjects
     * Create a new subject with Admin clearance.
     */
    static async createSubject(req, res) {
        try {
            let { name, code, departmentId, department_id, yearId, year, yearNumber, semester, maximumMarks = 100, isActive = true } = req.body || {};
            const rawDept = departmentId || department_id || req.body?.deptId || req.body?.dept_id;
            const rawYear = yearId || year || yearNumber || req.body?.year_id;
            // 1. Validation
            if (!name || typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ error: 'Subject name is required', code: 'MISSING_NAME' });
            }
            if (!code || typeof code !== 'string' || !code.trim()) {
                return res.status(400).json({ error: 'Subject code is required', code: 'MISSING_CODE' });
            }
            // Flexible department resolution: by ID, code, or name
            let deptExists = null;
            if (rawDept) {
                const deptStr = String(rawDept).trim();
                deptExists = await db_1.prisma.department.findUnique({ where: { id: deptStr } });
                if (!deptExists) {
                    deptExists = await db_1.prisma.department.findFirst({
                        where: { code: { equals: deptStr, mode: 'insensitive' } }
                    });
                }
                if (!deptExists) {
                    deptExists = await db_1.prisma.department.findFirst({
                        where: { name: { contains: deptStr, mode: 'insensitive' } }
                    });
                }
            }
            if (!deptExists) {
                deptExists = await db_1.prisma.department.findFirst({ where: { isActive: true } });
            }
            if (!deptExists) {
                return res.status(400).json({ error: 'Department is required', code: 'MISSING_DEPARTMENT' });
            }
            const parsedSem = parseInt(semester, 10);
            if (isNaN(parsedSem) || parsedSem < 1 || parsedSem > 8) {
                return res.status(400).json({
                    error: 'Semester must be an integer between 1 and 8',
                    code: 'INVALID_SEMESTER'
                });
            }
            // Flexible year resolution: by ID, number, or derived from semester
            let yearExists = null;
            if (rawYear) {
                const yrStr = String(rawYear).trim();
                yearExists = await db_1.prisma.year.findUnique({ where: { id: yrStr } });
                if (!yearExists) {
                    const yrNum = parseInt(yrStr, 10);
                    if (!isNaN(yrNum)) {
                        yearExists = await db_1.prisma.year.findFirst({ where: { yearNumber: yrNum } });
                    }
                }
            }
            // Auto-align year with semester if not found or misaligned
            const expectedYearNum = Math.min(4, Math.max(1, Math.ceil(parsedSem / 2)));
            if (!yearExists || yearExists.yearNumber !== expectedYearNum) {
                const alignedYr = await db_1.prisma.year.findFirst({ where: { yearNumber: expectedYearNum } });
                if (alignedYr) {
                    yearExists = alignedYr;
                }
            }
            if (!yearExists) {
                yearExists = await db_1.prisma.year.findFirst({ where: { yearNumber: 1 } });
            }
            const parsedMaxMarks = parseFloat(maximumMarks);
            if (isNaN(parsedMaxMarks) || parsedMaxMarks <= 0) {
                return res.status(400).json({
                    error: 'Maximum marks must be a positive number',
                    code: 'INVALID_MAX_MARKS'
                });
            }
            const cleanCode = code.trim().toUpperCase();
            const cleanName = name.trim();
            // 4. Duplicate code check (case-insensitive)
            const existingCode = await db_1.prisma.subject.findFirst({
                where: { code: { equals: cleanCode, mode: 'insensitive' } }
            });
            if (existingCode) {
                return res.status(409).json({
                    error: `Subject code "${cleanCode}" already exists (${existingCode.name}). Subject codes must be unique.`,
                    code: 'SUBJECT_CODE_EXISTS'
                });
            }
            // 5. Create subject
            const subject = await db_1.prisma.subject.create({
                data: {
                    name: cleanName,
                    code: cleanCode,
                    departmentId: deptExists.id,
                    yearId: yearExists.id,
                    semester: parsedSem,
                    maximumMarks: parsedMaxMarks,
                    isActive: Boolean(isActive)
                },
                include: {
                    department: true,
                    year: true
                }
            });
            // 6. Audit Trail
            if (req.user) {
                await db_1.prisma.auditLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'CREATE_SUBJECT',
                        entity: 'Subject',
                        entityId: subject.id,
                        metadata: { code: subject.code, name: subject.name, department: deptExists.code }
                    }
                });
            }
            return res.status(201).json({
                message: `Subject [${subject.code}] ${subject.name} created successfully`,
                subject
            });
        }
        catch (error) {
            console.error('Create subject error:', error);
            return res.status(500).json({ error: 'Failed to create subject' });
        }
    }
    /**
     * PUT /api/admin/subjects/:id
     * Update an existing subject.
     */
    static async updateSubject(req, res) {
        try {
            const { id } = req.params;
            const { name, code, departmentId, yearId, semester, maximumMarks, isActive } = req.body || {};
            const existingSubject = await db_1.prisma.subject.findUnique({ where: { id } });
            if (!existingSubject) {
                return res.status(404).json({ error: 'Subject not found', code: 'SUBJECT_NOT_FOUND' });
            }
            const updateData = {};
            if (name !== undefined) {
                if (typeof name !== 'string' || !name.trim()) {
                    return res.status(400).json({ error: 'Subject name cannot be blank', code: 'INVALID_NAME' });
                }
                updateData.name = name.trim();
            }
            if (code !== undefined) {
                if (typeof code !== 'string' || !code.trim()) {
                    return res.status(400).json({ error: 'Subject code cannot be blank', code: 'INVALID_CODE' });
                }
                const cleanCode = code.trim().toUpperCase();
                if (cleanCode !== existingSubject.code) {
                    const duplicate = await db_1.prisma.subject.findFirst({
                        where: {
                            code: { equals: cleanCode, mode: 'insensitive' },
                            id: { not: id }
                        }
                    });
                    if (duplicate) {
                        return res.status(409).json({
                            error: `Subject code "${cleanCode}" is already in use by another subject.`,
                            code: 'SUBJECT_CODE_EXISTS'
                        });
                    }
                }
                updateData.code = cleanCode;
            }
            const rawUpdateDept = req.body?.departmentId || req.body?.department_id || req.body?.deptId;
            if (rawUpdateDept !== undefined) {
                const deptStr = String(rawUpdateDept).trim();
                let dept = await db_1.prisma.department.findUnique({ where: { id: deptStr } });
                if (!dept) {
                    dept = await db_1.prisma.department.findFirst({ where: { code: { equals: deptStr, mode: 'insensitive' } } });
                }
                if (dept) {
                    updateData.departmentId = dept.id;
                }
            }
            let yearNum = 0;
            const rawUpdateYear = req.body?.yearId || req.body?.year || req.body?.yearNumber;
            if (rawUpdateYear !== undefined) {
                const yrStr = String(rawUpdateYear).trim();
                let yr = await db_1.prisma.year.findUnique({ where: { id: yrStr } });
                if (!yr) {
                    const parsedYr = parseInt(yrStr, 10);
                    if (!isNaN(parsedYr)) {
                        yr = await db_1.prisma.year.findFirst({ where: { yearNumber: parsedYr } });
                    }
                }
                if (yr) {
                    updateData.yearId = yr.id;
                    yearNum = yr.yearNumber;
                }
            }
            else {
                const currentYr = await db_1.prisma.year.findUnique({ where: { id: existingSubject.yearId } });
                yearNum = currentYr?.yearNumber || 1;
            }
            if (semester !== undefined) {
                const parsedSem = parseInt(semester, 10);
                if (isNaN(parsedSem) || parsedSem < 1 || parsedSem > 8) {
                    return res.status(400).json({
                        error: 'Semester must be between 1 and 8',
                        code: 'INVALID_SEMESTER'
                    });
                }
                const expectedYearNum = Math.min(4, Math.max(1, Math.ceil(parsedSem / 2)));
                if (yearNum !== expectedYearNum) {
                    const alignedYr = await db_1.prisma.year.findFirst({ where: { yearNumber: expectedYearNum } });
                    if (alignedYr) {
                        updateData.yearId = alignedYr.id;
                    }
                }
                updateData.semester = parsedSem;
            }
            if (maximumMarks !== undefined) {
                const parsedMax = parseFloat(maximumMarks);
                if (isNaN(parsedMax) || parsedMax <= 0) {
                    return res.status(400).json({
                        error: 'Maximum marks must be a positive number',
                        code: 'INVALID_MAX_MARKS'
                    });
                }
                updateData.maximumMarks = parsedMax;
            }
            if (isActive !== undefined) {
                updateData.isActive = Boolean(isActive);
            }
            const updated = await db_1.prisma.subject.update({
                where: { id },
                data: updateData,
                include: {
                    department: true,
                    year: true
                }
            });
            if (req.user) {
                await db_1.prisma.auditLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'UPDATE_SUBJECT',
                        entity: 'Subject',
                        entityId: id,
                        metadata: updateData
                    }
                });
            }
            return res.status(200).json({
                message: `Subject [${updated.code}] updated successfully`,
                subject: updated
            });
        }
        catch (error) {
            console.error('Update subject error:', error);
            return res.status(500).json({ error: 'Failed to update subject' });
        }
    }
    /**
     * PATCH /api/admin/subjects/:id/status
     * Toggle or update subject active status.
     */
    static async toggleSubjectStatus(req, res) {
        try {
            const { id } = req.params;
            const { isActive } = req.body || {};
            const existingSubject = await db_1.prisma.subject.findUnique({ where: { id } });
            if (!existingSubject) {
                return res.status(404).json({ error: 'Subject not found', code: 'SUBJECT_NOT_FOUND' });
            }
            const newStatus = isActive !== undefined ? Boolean(isActive) : !existingSubject.isActive;
            const updated = await db_1.prisma.subject.update({
                where: { id },
                data: { isActive: newStatus },
                include: { department: true, year: true }
            });
            if (req.user) {
                await db_1.prisma.auditLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'TOGGLE_SUBJECT_STATUS',
                        entity: 'Subject',
                        entityId: id,
                        metadata: { previousStatus: existingSubject.isActive, newStatus }
                    }
                });
            }
            return res.status(200).json({
                message: `Subject ${updated.code} is now ${newStatus ? 'Active' : 'Inactive'}`,
                subject: updated
            });
        }
        catch (error) {
            console.error('Toggle subject status error:', error);
            return res.status(500).json({ error: 'Failed to toggle subject status' });
        }
    }
    /**
     * DELETE /api/admin/subjects/:id
     * Safe subject deletion with reference checks (TeacherAssignments & Marks).
     */
    static async deleteSubject(req, res) {
        try {
            const { id } = req.params;
            const subject = await db_1.prisma.subject.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            teacherAssignments: true,
                            marks: true
                        }
                    }
                }
            });
            if (!subject) {
                return res.status(404).json({ error: 'Subject not found', code: 'SUBJECT_NOT_FOUND' });
            }
            const assignmentCount = subject._count.teacherAssignments;
            const markCount = subject._count.marks;
            if (assignmentCount > 0 || markCount > 0) {
                return res.status(400).json({
                    error: `Cannot delete subject [${subject.code}] ${subject.name}: It is referenced by ${assignmentCount} faculty assignment(s) and ${markCount} student mark(s). Use status deactivation instead to preserve academic integrity.`,
                    code: 'CANNOT_DELETE_REFERENCED_SUBJECT',
                    references: {
                        teacherAssignments: assignmentCount,
                        marks: markCount
                    }
                });
            }
            await db_1.prisma.subject.delete({ where: { id } });
            if (req.user) {
                await db_1.prisma.auditLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'DELETE_SUBJECT',
                        entity: 'Subject',
                        entityId: id,
                        metadata: { code: subject.code, name: subject.name }
                    }
                });
            }
            return res.status(200).json({
                message: `Subject [${subject.code}] ${subject.name} was safely deleted.`
            });
        }
        catch (error) {
            console.error('Delete subject error:', error);
            return res.status(500).json({ error: 'Failed to delete subject' });
        }
    }
}
exports.SubjectManagementController = SubjectManagementController;
