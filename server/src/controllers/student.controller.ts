import { Request, Response } from 'express';
import { StudentStatus } from '@prisma/client';
import { prisma } from '../db';
import { AuditService, AuditAction } from '../services/audit.service';

// Mobile phone validator: accepts 10-digit Indian numbers or E.164 international numbers
const PHONE_REGEX = /^(\+?[1-9]\d{9,14}|[6-9]\d{9})$/;

export class StudentController {
  /**
   * GET /api/admin/students
   * Admin-only student directory with search and dependent hierarchy filtering.
   */
  static async getStudents(req: Request, res: Response) {
    try {
      const {
        academicYearId,
        departmentId,
        yearId,
        sectionId,
        status,
        search
      } = req.query;

      const where: any = {};

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
        where.status = status.toUpperCase() as StudentStatus;
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

      const students = await prisma.student.findMany({
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

      return res.status(200).json({ students, total: students.length });
    } catch (error) {
      console.error('Get students error:', error);
      return res.status(500).json({ error: 'Failed to fetch students list' });
    }
  }

  /**
   * GET /api/admin/students/:id
   * Admin-only full student details with protected parent contact and academic marks.
   */
  static async getStudentById(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const student = await prisma.student.findUnique({
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
    } catch (error) {
      console.error('Get student by id error:', error);
      return res.status(500).json({ error: 'Failed to fetch student details' });
    }
  }

  /**
   * POST /api/admin/students
   * Admin-only student registration with parent contact and validation.
   */
  static async createStudent(req: Request, res: Response) {
    try {
      const {
        registerNumber,
        name,
        academicYearId,
        departmentId,
        yearId,
        sectionId,
        parentName,
        parentMobile,
        status = 'ACTIVE'
      } = req.body || {};

      // 1. Required field validation
      if (!registerNumber || !name || !parentName || !parentMobile || !academicYearId || !departmentId || !yearId || !sectionId) {
        return res.status(400).json({
          error: 'All student details, academic structure fields, parent name, and parent mobile number are required.',
          code: 'FIELDS_REQUIRED'
        });
      }

      const trimmedRegNo = registerNumber.trim().toUpperCase();
      const trimmedName = name.trim();
      const trimmedParentName = parentName.trim();
      const cleanMobile = parentMobile.toString().trim().replace(/[\s-]/g, '');

      // 2. Mobile Phone Validation
      if (!PHONE_REGEX.test(cleanMobile)) {
        return res.status(400).json({
          error: 'Invalid parent mobile number. Please provide a valid 10-digit mobile or international format (e.g. 9876543210 or +919876543210).',
          code: 'INVALID_MOBILE_NUMBER'
        });
      }

      // 3. Academic Structure Integrity Validation
      const [acadYear, dept, yr, sec] = await Promise.all([
        prisma.academicYear.findUnique({ where: { id: academicYearId } }),
        prisma.department.findUnique({ where: { id: departmentId } }),
        prisma.year.findUnique({ where: { id: yearId } }),
        prisma.section.findUnique({ where: { id: sectionId } })
      ]);

      if (!acadYear || !dept || !yr || !sec) {
        return res.status(400).json({
          error: 'Invalid academic structure provided: One or more selected academic entities do not exist.',
          code: 'ACADEMIC_STRUCTURE_NOT_FOUND',
          details: {
            academicYearFound: !!acadYear,
            departmentFound: !!dept,
            yearFound: !!yr,
            sectionFound: !!sec
          }
        });
      }

      // Verify section belongs to the selected department, year, and academic year
      if (sec.departmentId !== departmentId || sec.yearId !== yearId || sec.academicYearId !== academicYearId) {
        return res.status(400).json({
          error: 'Section allocation mismatch: The selected section does not belong to the selected Academic Year, Department, or Year.',
          code: 'SECTION_STRUCTURE_MISMATCH'
        });
      }

      // 4. Duplicate Register Number Check within the Academic Year
      const existing = await prisma.student.findUnique({
        where: {
          registerNumber_academicYearId: {
            registerNumber: trimmedRegNo,
            academicYearId
          }
        }
      });

      if (existing) {
        return res.status(409).json({
          error: `Student with Register Number "${trimmedRegNo}" already exists in Academic Year "${acadYear.yearName}".`,
          code: 'DUPLICATE_REGISTER_NUMBER'
        });
      }

      // 5. Create Student
      const newStudent = await prisma.student.create({
        data: {
          registerNumber: trimmedRegNo,
          name: trimmedName,
          academicYearId,
          departmentId,
          yearId,
          sectionId,
          parentName: trimmedParentName,
          parentMobile: cleanMobile,
          status: (status.toUpperCase() in StudentStatus) ? (status.toUpperCase() as StudentStatus) : StudentStatus.ACTIVE
        },
        include: {
          academicYear: true,
          department: true,
          year: true,
          section: true
        }
      });

      // 6. Audit Log
      if (req.user) {
        await AuditService.log({
          userId: req.user.id,
          action: AuditAction.STUDENT_CREATED,
          entity: 'Student',
          entityId: newStudent.id,
          metadata: {
            registerNumber: newStudent.registerNumber,
            name: newStudent.name,
            parentName: newStudent.parentName,
            department: newStudent.department.code
          }
        });
      }

      return res.status(201).json({
        message: 'Student registered successfully',
        student: newStudent
      });
    } catch (error) {
      console.error('Create student error:', error);
      return res.status(500).json({ error: 'Failed to create student' });
    }
  }

  /**
   * PUT /api/admin/students/:id
   * Admin-only student update (name, register number, parent contact, class allocation).
   */
  static async updateStudent(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const {
        registerNumber,
        name,
        academicYearId,
        departmentId,
        yearId,
        sectionId,
        parentName,
        parentMobile,
        status
      } = req.body || {};

      const existing = await prisma.student.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND' });
      }

      const updateData: any = {};

      if (name) updateData.name = name.trim();
      if (parentName) updateData.parentName = parentName.trim();

      if (parentMobile) {
        const cleanMobile = parentMobile.toString().trim().replace(/[\s-]/g, '');
        if (!PHONE_REGEX.test(cleanMobile)) {
          return res.status(400).json({
            error: 'Invalid parent mobile number format.',
            code: 'INVALID_MOBILE_NUMBER'
          });
        }
        updateData.parentMobile = cleanMobile;
      }

      if (status && status.toUpperCase() in StudentStatus) {
        updateData.status = status.toUpperCase() as StudentStatus;
      }

      const targetAcadYearId = academicYearId || existing.academicYearId;
      const targetRegNo = registerNumber ? registerNumber.trim().toUpperCase() : existing.registerNumber;

      if (targetRegNo !== existing.registerNumber || targetAcadYearId !== existing.academicYearId) {
        const duplicate = await prisma.student.findUnique({
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

      if (academicYearId) updateData.academicYearId = academicYearId;
      if (departmentId) updateData.departmentId = departmentId;
      if (yearId) updateData.yearId = yearId;
      if (sectionId) updateData.sectionId = sectionId;

      const updated = await prisma.student.update({
        where: { id },
        data: updateData,
        include: {
          academicYear: true,
          department: true,
          year: true,
          section: true
        }
      });

      if (req.user) {
        await AuditService.log({
          userId: req.user.id,
          action: AuditAction.STUDENT_UPDATED,
          entity: 'Student',
          entityId: updated.id,
          metadata: { changes: req.body }
        });
      }

      return res.status(200).json({
        message: 'Student updated successfully',
        student: updated
      });
    } catch (error) {
      console.error('Update student error:', error);
      return res.status(500).json({ error: 'Failed to update student' });
    }
  }

  /**
   * PATCH /api/admin/students/:id/status
   * Safe student status toggle (ACTIVE / INACTIVE / DETAINED / ALUMNI).
   */
  static async toggleStudentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body || {};

      const existing = await prisma.student.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND' });
      }

      let newStatus: StudentStatus;
      if (status && status.toUpperCase() in StudentStatus) {
        newStatus = status.toUpperCase() as StudentStatus;
      } else {
        newStatus = existing.status === StudentStatus.ACTIVE ? StudentStatus.INACTIVE : StudentStatus.ACTIVE;
      }

      const updated = await prisma.student.update({
        where: { id },
        data: { status: newStatus },
        include: {
          academicYear: true,
          department: true,
          section: true
        }
      });

      if (req.user) {
        await AuditService.log({
          userId: req.user.id,
          action: AuditAction.STUDENT_UPDATED,
          entity: 'Student',
          entityId: updated.id,
          metadata: { previousStatus: existing.status, newStatus: updated.status }
        });
      }

      return res.status(200).json({
        message: `Student status updated to ${updated.status}`,
        student: updated
      });
    } catch (error) {
      console.error('Toggle student status error:', error);
      return res.status(500).json({ error: 'Failed to toggle student status' });
    }
  }

  /**
   * DELETE /api/admin/students/:id
   * Reference-checked deletion: rejects if student has recorded marks or parent notifications.
   */
  static async deleteStudent(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const existing = await prisma.student.findUnique({
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

      await prisma.student.delete({ where: { id } });

      if (req.user) {
        await prisma.auditLog.create({
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
    } catch (error) {
      console.error('Delete student error:', error);
      return res.status(500).json({ error: 'Failed to delete student' });
    }
  }
}
