import { Request, Response } from 'express';
import { prisma } from '../db';

export class SubjectManagementController {
  /**
   * GET /api/admin/subjects
   * List all subjects with search, filtering by department, year, semester, and status.
   */
  static async getSubjects(req: Request, res: Response) {
    try {
      const { departmentId, yearId, semester, status, search } = req.query;

      const where: any = {};

      if (departmentId && departmentId !== 'all') {
        where.departmentId = departmentId as string;
      }

      if (yearId && yearId !== 'all') {
        where.yearId = yearId as string;
      }

      if (semester && semester !== 'all') {
        where.semester = parseInt(semester as string, 10);
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

      const subjects = await prisma.subject.findMany({
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

      return res.status(200).json({ subjects });
    } catch (error: any) {
      console.error('Get subjects error:', error);
      return res.status(500).json({ error: 'Failed to retrieve subjects' });
    }
  }

  /**
   * GET /api/admin/subjects/:id
   * Retrieve a single subject by ID.
   */
  static async getSubjectById(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const subject = await prisma.subject.findUnique({
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
    } catch (error: any) {
      console.error('Get subject by ID error:', error);
      return res.status(500).json({ error: 'Failed to fetch subject details' });
    }
  }

  /**
   * POST /api/admin/subjects
   * Create a new subject with Admin clearance.
   */
  static async createSubject(req: Request, res: Response) {
    try {
      const {
        name,
        code,
        departmentId,
        yearId,
        semester,
        maximumMarks = 100,
        isActive = true
      } = req.body || {};

      // 1. Validation
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Subject name is required', code: 'MISSING_NAME' });
      }

      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'Subject code is required', code: 'MISSING_CODE' });
      }

      if (!departmentId) {
        return res.status(400).json({ error: 'Department is required', code: 'MISSING_DEPARTMENT' });
      }

      if (!yearId) {
        return res.status(400).json({ error: 'Academic year level is required', code: 'MISSING_YEAR' });
      }

      const parsedSem = parseInt(semester, 10);
      if (isNaN(parsedSem) || parsedSem < 1 || parsedSem > 8) {
        return res.status(400).json({
          error: 'Semester must be an integer between 1 and 8',
          code: 'INVALID_SEMESTER'
        });
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

      // 2. Department & Year existence check
      const [deptExists, yearExists] = await Promise.all([
        prisma.department.findUnique({ where: { id: departmentId } }),
        prisma.year.findUnique({ where: { id: yearId } })
      ]);

      if (!deptExists) {
        return res.status(400).json({ error: 'Referenced department does not exist', code: 'DEPARTMENT_NOT_FOUND' });
      }

      if (!yearExists) {
        return res.status(400).json({ error: 'Referenced year level does not exist', code: 'YEAR_NOT_FOUND' });
      }

      // 3. Check semester alignment with year (e.g. Year 1 has Sem 1-2, Year 2 has Sem 3-4, etc.)
      const expectedMinSem = (yearExists.yearNumber - 1) * 2 + 1;
      const expectedMaxSem = yearExists.yearNumber * 2;
      if (parsedSem < expectedMinSem || parsedSem > expectedMaxSem) {
        return res.status(400).json({
          error: `Semester ${parsedSem} does not belong to ${yearExists.name} (Expected Semester ${expectedMinSem} or ${expectedMaxSem}).`,
          code: 'SEMESTER_YEAR_MISMATCH'
        });
      }

      // 4. Duplicate code check (case-insensitive)
      const existingCode = await prisma.subject.findFirst({
        where: { code: { equals: cleanCode, mode: 'insensitive' } }
      });

      if (existingCode) {
        return res.status(409).json({
          error: `Subject code "${cleanCode}" already exists (${existingCode.name}). Subject codes must be unique.`,
          code: 'SUBJECT_CODE_EXISTS'
        });
      }

      // 5. Create subject
      const subject = await prisma.subject.create({
        data: {
          name: cleanName,
          code: cleanCode,
          departmentId,
          yearId,
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
        await prisma.auditLog.create({
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
    } catch (error: any) {
      console.error('Create subject error:', error);
      return res.status(500).json({ error: 'Failed to create subject' });
    }
  }

  /**
   * PUT /api/admin/subjects/:id
   * Update an existing subject.
   */
  static async updateSubject(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const {
        name,
        code,
        departmentId,
        yearId,
        semester,
        maximumMarks,
        isActive
      } = req.body || {};

      const existingSubject = await prisma.subject.findUnique({ where: { id } });
      if (!existingSubject) {
        return res.status(404).json({ error: 'Subject not found', code: 'SUBJECT_NOT_FOUND' });
      }

      const updateData: any = {};

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
          const duplicate = await prisma.subject.findFirst({
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

      if (departmentId !== undefined) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept) {
          return res.status(400).json({ error: 'Department not found', code: 'DEPARTMENT_NOT_FOUND' });
        }
        updateData.departmentId = departmentId;
      }

      let yearNum = 0;
      if (yearId !== undefined) {
        const yr = await prisma.year.findUnique({ where: { id: yearId } });
        if (!yr) {
          return res.status(400).json({ error: 'Year not found', code: 'YEAR_NOT_FOUND' });
        }
        updateData.yearId = yearId;
        yearNum = yr.yearNumber;
      } else {
        const currentYr = await prisma.year.findUnique({ where: { id: existingSubject.yearId } });
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
        const expectedMinSem = (yearNum - 1) * 2 + 1;
        const expectedMaxSem = yearNum * 2;
        if (parsedSem < expectedMinSem || parsedSem > expectedMaxSem) {
          return res.status(400).json({
            error: `Semester ${parsedSem} does not align with Year ${yearNum} (Semesters ${expectedMinSem}-${expectedMaxSem}).`,
            code: 'SEMESTER_YEAR_MISMATCH'
          });
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

      const updated = await prisma.subject.update({
        where: { id },
        data: updateData,
        include: {
          department: true,
          year: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
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
    } catch (error: any) {
      console.error('Update subject error:', error);
      return res.status(500).json({ error: 'Failed to update subject' });
    }
  }

  /**
   * PATCH /api/admin/subjects/:id/status
   * Toggle or update subject active status.
   */
  static async toggleSubjectStatus(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { isActive } = req.body || {};

      const existingSubject = await prisma.subject.findUnique({ where: { id } });
      if (!existingSubject) {
        return res.status(404).json({ error: 'Subject not found', code: 'SUBJECT_NOT_FOUND' });
      }

      const newStatus = isActive !== undefined ? Boolean(isActive) : !existingSubject.isActive;

      const updated = await prisma.subject.update({
        where: { id },
        data: { isActive: newStatus },
        include: { department: true, year: true }
      });

      if (req.user) {
        await prisma.auditLog.create({
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
    } catch (error: any) {
      console.error('Toggle subject status error:', error);
      return res.status(500).json({ error: 'Failed to toggle subject status' });
    }
  }

  /**
   * DELETE /api/admin/subjects/:id
   * Safe subject deletion with reference checks (TeacherAssignments & Marks).
   */
  static async deleteSubject(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const subject = await prisma.subject.findUnique({
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

      await prisma.subject.delete({ where: { id } });

      if (req.user) {
        await prisma.auditLog.create({
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
    } catch (error: any) {
      console.error('Delete subject error:', error);
      return res.status(500).json({ error: 'Failed to delete subject' });
    }
  }
}
