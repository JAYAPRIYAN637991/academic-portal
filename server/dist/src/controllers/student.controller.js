"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentController = void 0;
const client_1 = require("@prisma/client");
const db_1 = require("../db");
const audit_service_1 = require("../services/audit.service");
// Mobile phone validator: accepts 10-digit Indian numbers or E.164 international numbers
const PHONE_REGEX = /^(\+?[1-9]\d{9,14}|[6-9]\d{9})$/;
class StudentController {
    /**
     * GET /api/admin/students
     * Admin-only student directory with search and dependent hierarchy filtering.
     */
    static async getStudents(req, res) {
        try {
            const { academicYearId, departmentId, yearId, sectionId, status, search } = req.query;
            const where = {};
            if (academicYearId && typeof academicYearId === 'string' && academicYearId !== 'all') {
                where.academicYearId = academicYearId;
            }
            if (departmentId && typeof departmentId === 'string' && departmentId !== 'all') {
                where.departmentId = departmentId;
            }
            if (yearId && typeof yearId === 'string' && yearId !== 'all') {
                where.yearId = yearId;
            }
            if (sectionId && typeof sectionId === 'string' && sectionId !== 'all') {
                where.sectionId = sectionId;
            }
            if (status && typeof status === 'string' && status !== 'all') {
                where.status = status.toUpperCase();
            }
            if (search && typeof search === 'string' && search.trim()) {
                const query = search.trim();
                where.OR = [
                    { registerNumber: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } },
                    { parentName: { contains: query, mode: 'insensitive' } },
                    { parentMobile: { contains: query, mode: 'insensitive' } }
                ];
            }
            const students = await db_1.prisma.student.findMany({
                where,
                include: {
                    academicYear: { select: { id: true, yearName: true, isCurrent: true } },
                    department: { select: { id: true, code: true, name: true } },
                    year: { select: { id: true, yearNumber: true, name: true } },
                    section: { select: { id: true, name: true } },
                    _count: {
                        select: { marks: true, notifications: true }
                    }
                },
                orderBy: [
                    { academicYear: { yearName: 'desc' } },
                    { department: { code: 'asc' } },
                    { year: { yearNumber: 'asc' } },
                    { section: { name: 'asc' } },
                    { registerNumber: 'asc' }
                ]
            });
            const formattedStudents = students.map((s) => ({
                ...s,
                register_number: s.registerNumber,
                roll_number: s.rollNumber || s.registerNumber,
                department_name: s.department?.name,
                department_code: s.department?.code,
                year: s.year?.yearNumber,
                year_name: s.year?.name,
                section: s.section?.name?.replace(/^Section\s*/i, '') || s.section?.name,
                section_name: s.section?.name,
                class_section_id: s.sectionId,
                parent_name: s.parentName,
                parent_phone: s.parentMobile,
                parent_mobile: s.parentMobile,
                academic_year_name: s.academicYear?.yearName
            }));
            return res.status(200).json({ students: formattedStudents, data: formattedStudents, total: formattedStudents.length });
        }
        catch (error) {
            console.error('Get students error:', error);
            return res.status(500).json({ error: 'Failed to fetch students list' });
        }
    }
    /**
     * GET /api/admin/students/:id
     * Admin-only full student details with protected parent contact and academic marks.
     */
    static async getStudentById(req, res) {
        try {
            const { id } = req.params;
            const student = await db_1.prisma.student.findUnique({
                where: { id },
                include: {
                    academicYear: true,
                    department: true,
                    year: true,
                    section: true,
                    marks: {
                        include: {
                            subject: true,
                            assessment: true
                        }
                    },
                    notifications: {
                        take: 10,
                        orderBy: { sentAt: 'desc' }
                    }
                }
            });
            if (!student) {
                return res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND' });
            }
            return res.status(200).json({ student });
        }
        catch (error) {
            console.error('Get student by id error:', error);
            return res.status(500).json({ error: 'Failed to fetch student details' });
        }
    }
    /**
     * POST /api/admin/students
     * Admin-only student registration with parent contact and validation.
     */
    static async createStudent(req, res) {
        try {
            let { registerNumber, register_number, rollNumber, roll_number, name, academicYearId, academic_year_id, departmentId, department_id, yearId, year_id, sectionId, class_section_id, parentName, parent_name, parentMobile, parentPhone, parent_phone, status = 'ACTIVE' } = req.body || {};
            const rawRegNo = registerNumber || register_number;
            const rawName = name;
            let rawParentName = parentName || parent_name || 'Parent';
            let rawParentMobile = parentMobile || parentPhone || parent_phone || '9999999999';
            let targetSectionId = sectionId || class_section_id;
            if (!rawRegNo || !rawName || !targetSectionId) {
                return res.status(400).json({
                    error: 'Student name, Register number, and assigned Class Section are required.',
                    code: 'FIELDS_REQUIRED'
                });
            }
            // Look up section to resolve departmentId, yearId, and academicYearId
            const secRecord = await db_1.prisma.section.findUnique({
                where: { id: String(targetSectionId) },
                include: { department: true, year: true, academicYear: true }
            });
            if (!secRecord) {
                return res.status(404).json({
                    error: 'Assigned section does not exist.',
                    code: 'SECTION_NOT_FOUND'
                });
            }
            const finalDepartmentId = departmentId || department_id || secRecord.departmentId;
            const finalYearId = yearId || year_id || secRecord.yearId;
            const finalAcademicYearId = academicYearId || academic_year_id || secRecord.academicYearId;
            const trimmedRegNo = rawRegNo.trim().toUpperCase();
            const trimmedName = rawName.trim();
            const trimmedParentName = rawParentName.trim();
            let cleanMobile = rawParentMobile.toString().trim().replace(/[\s-]/g, '');
            if (!PHONE_REGEX.test(cleanMobile)) {
                cleanMobile = '9999999999';
            }
            // Duplicate check within academic year
            const existing = await db_1.prisma.student.findUnique({
                where: {
                    registerNumber_academicYearId: {
                        registerNumber: trimmedRegNo,
                        academicYearId: finalAcademicYearId
                    }
                }
            });
            if (existing) {
                return res.status(409).json({
                    error: `Student with Register Number "${trimmedRegNo}" already exists in this Academic Year.`,
                    code: 'DUPLICATE_REGISTER_NUMBER'
                });
            }
            const newStudent = await db_1.prisma.student.create({
                data: {
                    registerNumber: trimmedRegNo,
                    name: trimmedName,
                    academicYearId: finalAcademicYearId,
                    departmentId: finalDepartmentId,
                    yearId: finalYearId,
                    sectionId: secRecord.id,
                    parentName: trimmedParentName,
                    parentMobile: cleanMobile,
                    status: (status.toUpperCase() in client_1.StudentStatus) ? status.toUpperCase() : client_1.StudentStatus.ACTIVE
                },
                include: {
                    academicYear: true,
                    department: true,
                    year: true,
                    section: true
                }
            });
            try {
                if (req.user) {
                    await audit_service_1.AuditService.log({
                        userId: req.user.id,
                        action: audit_service_1.AuditAction.STUDENT_CREATED,
                        entity: 'Student',
                        entityId: newStudent.id,
                        metadata: {
                            registerNumber: newStudent.registerNumber,
                            name: newStudent.name,
                            parentName: newStudent.parentName,
                            department: newStudent.department?.code
                        }
                    });
                }
            }
            catch (auditErr) {
                console.warn('Audit log write error:', auditErr);
            }
            return res.status(201).json({
                message: 'Student registered successfully',
                student: {
                    ...newStudent,
                    register_number: newStudent.registerNumber,
                    roll_number: newStudent.registerNumber,
                    department_name: newStudent.department?.name,
                    department_code: newStudent.department?.code,
                    year: newStudent.year?.yearNumber,
                    section: newStudent.section?.name,
                    parent_name: newStudent.parentName,
                    parent_phone: newStudent.parentMobile
                }
            });
        }
        catch (error) {
            console.error('Create student error:', error);
            return res.status(500).json({ error: 'Failed to create student' });
        }
    }
    /**
     * PUT /api/admin/students/:id
     * Admin-only student update (name, register number, parent contact, class allocation).
     */
    static async updateStudent(req, res) {
        try {
            const { id } = req.params;
            let { registerNumber, register_number, rollNumber, roll_number, name, academicYearId, academic_year_id, departmentId, department_id, yearId, year_id, sectionId, class_section_id, parentName, parent_name, parentMobile, parentPhone, parent_phone, status } = req.body || {};
            const existing = await db_1.prisma.student.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND' });
            }
            const updateData = {};
            if (name)
                updateData.name = name.trim();
            const rawParentName = parentName || parent_name;
            if (rawParentName)
                updateData.parentName = rawParentName.trim();
            const rawPhone = parentMobile || parentPhone || parent_phone;
            if (rawPhone) {
                const cleanMobile = rawPhone.toString().trim().replace(/[\s-]/g, '');
                if (PHONE_REGEX.test(cleanMobile)) {
                    updateData.parentMobile = cleanMobile;
                }
            }
            if (status && status.toUpperCase() in client_1.StudentStatus) {
                updateData.status = status.toUpperCase();
            }
            const rawRegNo = registerNumber || register_number;
            const targetAcadYearId = academicYearId || academic_year_id || existing.academicYearId;
            const targetRegNo = rawRegNo ? rawRegNo.trim().toUpperCase() : existing.registerNumber;
            if (targetRegNo !== existing.registerNumber || targetAcadYearId !== existing.academicYearId) {
                const duplicate = await db_1.prisma.student.findUnique({
                    where: {
                        registerNumber_academicYearId: {
                            registerNumber: targetRegNo,
                            academicYearId: targetAcadYearId
                        }
                    }
                });
                if (duplicate && duplicate.id !== id) {
                    return res.status(409).json({
                        error: `Register Number "${targetRegNo}" already exists in this Academic Year.`,
                        code: 'DUPLICATE_REGISTER_NUMBER'
                    });
                }
                updateData.registerNumber = targetRegNo;
            }
            const targetSectionId = sectionId || class_section_id;
            if (targetSectionId) {
                const secRecord = await db_1.prisma.section.findUnique({ where: { id: String(targetSectionId) } });
                if (secRecord) {
                    updateData.sectionId = secRecord.id;
                    updateData.departmentId = secRecord.departmentId;
                    updateData.yearId = secRecord.yearId;
                    updateData.academicYearId = secRecord.academicYearId;
                }
            }
            const updated = await db_1.prisma.student.update({
                where: { id },
                data: updateData,
                include: {
                    academicYear: true,
                    department: true,
                    year: true,
                    section: true
                }
            });
            try {
                if (req.user) {
                    await audit_service_1.AuditService.log({
                        userId: req.user.id,
                        action: audit_service_1.AuditAction.STUDENT_UPDATED,
                        entity: 'Student',
                        entityId: updated.id,
                        metadata: { changes: req.body }
                    });
                }
            }
            catch (auditErr) {
                console.warn('Audit log write error:', auditErr);
            }
            return res.status(200).json({
                message: 'Student updated successfully',
                student: {
                    ...updated,
                    register_number: updated.registerNumber,
                    roll_number: updated.registerNumber,
                    department_name: updated.department?.name,
                    department_code: updated.department?.code,
                    year: updated.year?.yearNumber,
                    section: updated.section?.name,
                    parent_name: updated.parentName,
                    parent_phone: updated.parentMobile
                }
            });
        }
        catch (error) {
            console.error('Update student error:', error);
            return res.status(500).json({ error: 'Failed to update student' });
        }
    }
    /**
     * PATCH /api/admin/students/:id/status
     * Safe student status toggle (ACTIVE / INACTIVE / DETAINED / ALUMNI).
     */
    static async toggleStudentStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body || {};
            const existing = await db_1.prisma.student.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND' });
            }
            let newStatus;
            if (status && status.toUpperCase() in client_1.StudentStatus) {
                newStatus = status.toUpperCase();
            }
            else {
                newStatus = existing.status === client_1.StudentStatus.ACTIVE ? client_1.StudentStatus.INACTIVE : client_1.StudentStatus.ACTIVE;
            }
            const updated = await db_1.prisma.student.update({
                where: { id },
                data: { status: newStatus },
                include: {
                    academicYear: true,
                    department: true,
                    section: true
                }
            });
            if (req.user) {
                await audit_service_1.AuditService.log({
                    userId: req.user.id,
                    action: audit_service_1.AuditAction.STUDENT_UPDATED,
                    entity: 'Student',
                    entityId: updated.id,
                    metadata: { previousStatus: existing.status, newStatus: updated.status }
                });
            }
            return res.status(200).json({
                message: `Student status updated to ${updated.status}`,
                student: updated
            });
        }
        catch (error) {
            console.error('Toggle student status error:', error);
            return res.status(500).json({ error: 'Failed to toggle student status' });
        }
    }
    /**
     * DELETE /api/admin/students/:id
     * Reference-checked deletion: rejects if student has recorded marks or parent notifications.
     */
    static async deleteStudent(req, res) {
        try {
            const { id } = req.params;
            const existing = await db_1.prisma.student.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: { marks: true, notifications: true }
                    }
                }
            });
            if (!existing) {
                return res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND' });
            }
            const refs = existing._count;
            const totalRefs = refs.marks + refs.notifications;
            if (totalRefs > 0) {
                return res.status(409).json({
                    error: `Cannot delete student "${existing.name}" (${existing.registerNumber}) because historical academic records exist (${refs.marks} marks recorded, ${refs.notifications} notifications dispatched).`,
                    code: 'CANNOT_DELETE_REFERENCED_RECORD',
                    references: refs,
                    recommendation: 'Use safe deactivation (status = INACTIVE) instead to preserve assessment records and parental communication history.'
                });
            }
            await db_1.prisma.student.delete({ where: { id } });
            if (req.user) {
                await db_1.prisma.auditLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'DELETE_STUDENT',
                        entity: 'Student',
                        entityId: id,
                        metadata: { registerNumber: existing.registerNumber, name: existing.name }
                    }
                });
            }
            return res.status(200).json({
                message: `Student record "${existing.name}" deleted successfully.`
            });
        }
        catch (error) {
            console.error('Delete student error:', error);
            return res.status(500).json({ error: 'Failed to delete student' });
        }
    }
}
exports.StudentController = StudentController;
