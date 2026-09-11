import { Request, Response } from 'express';
import { prisma } from '../db';

export class AssessmentManagementController {
  /**
   * GET /api/admin/assessments
   * Returns all dynamic assessments (non-hardcoded) with search, status, and scope filtering.
   */
  static async getAssessments(req: Request, res: Response) {
    try {
      const { search, status, academicYearId, departmentId, subjectId } = req.query;

      const where: any = {};

      if (status && status !== 'all') {
        where.isActive = status === 'active';
      }

      if (academicYearId && academicYearId !== 'all') {
        where.academicYearId = academicYearId as string;
      }

      if (departmentId && departmentId !== 'all') {
        where.departmentId = departmentId as string;
      }

      if (subjectId && subjectId !== 'all') {
        where.subjectId = subjectId as string;
      }

      if (search && typeof search === 'string' && search.trim().length > 0) {
        const query = search.trim();
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ];
      }

      const assessments = await prisma.assessment.findMany({
        where,
        include: {
          academicYear: true,
          department: true,
          year: true,
          subject: true,
          _count: {
            select: {
              marks: true,
              performanceSnapshots: true
            }
          }
        },
        orderBy: [
          { createdAt: 'asc' }
        ]
      });

      return res.status(200).json({ assessments });
    } catch (error: any) {
      console.error('Get assessments error:', error);
      return res.status(500).json({ error: 'Failed to retrieve assessments' });
    }
  }

  /**
   * GET /api/admin/assessments/:id
   * Retrieve a single assessment by ID.
   */
  static async getAssessmentById(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const assessment = await prisma.assessment.findUnique({
        where: { id },
        include: {
          academicYear: true,
          department: true,
          year: true,
          subject: true,
          _count: {
            select: {
              marks: true,
              performanceSnapshots: true
            }
          }
        }
      });

      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
      }

      return res.status(200).json({ assessment });
    } catch (error: any) {
      console.error('Get assessment by ID error:', error);
      return res.status(500).json({ error: 'Failed to fetch assessment' });
    }
  }

  /**
   * POST /api/admin/assessments
   * Dynamically create a new assessment (e.g. IA-1, IA-2, IA-3, MODEL, SEMESTER, or custom).
   * Not hard-coded.
   */
  static async createAssessment(req: Request, res: Response) {
    try {
      const {
        name,
        code,
        description,
        maximumMarks = 100,
        weightage,
        academicYearId,
        departmentId,
        yearId,
        semester,
        subjectId,
        isActive = true
      } = req.body || {};

      // 1. Validation
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Assessment name is required', code: 'MISSING_NAME' });
      }

      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'Assessment code is required', code: 'MISSING_CODE' });
      }

      const cleanCode = code.trim().toUpperCase();
      const cleanName = name.trim();

      const parsedMaxMarks = parseFloat(maximumMarks);
      if (isNaN(parsedMaxMarks) || parsedMaxMarks <= 0) {
        return res.status(400).json({
          error: 'Maximum marks must be a positive number',
          code: 'INVALID_MAX_MARKS'
        });
      }

      // 2. Uniqueness check for code (case-insensitive)
      const existing = await prisma.assessment.findFirst({
        where: { code: { equals: cleanCode, mode: 'insensitive' } }
      });

      if (existing) {
        return res.status(409).json({
          error: `Assessment code "${cleanCode}" already exists (${existing.name}). Each assessment code must be distinct.`,
          code: 'ASSESSMENT_CODE_EXISTS'
        });
      }

      // 3. Optional scope existence checks
      if (academicYearId) {
        const ay = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
        if (!ay) return res.status(400).json({ error: 'Referenced academic year does not exist' });
      }

      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept) return res.status(400).json({ error: 'Referenced department does not exist' });
      }

      if (subjectId) {
        const sub = await prisma.subject.findUnique({ where: { id: subjectId } });
        if (!sub) return res.status(400).json({ error: 'Referenced subject does not exist' });
      }

      // 4. Create assessment
      const assessment = await prisma.assessment.create({
        data: {
          name: cleanName,
          code: cleanCode,
          description: description?.trim() || null,
          maximumMarks: parsedMaxMarks,
          weightage: weightage !== undefined && weightage !== null ? parseFloat(weightage) : null,
          academicYearId: academicYearId || null,
          departmentId: departmentId || null,
          yearId: yearId || null,
          semester: semester ? parseInt(semester, 10) : null,
          subjectId: subjectId || null,
          isActive: Boolean(isActive)
        },
        include: {
          academicYear: true,
          department: true,
          subject: true
        }
      });

      // 5. Audit Log
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'CREATE_ASSESSMENT',
            entity: 'Assessment',
            entityId: assessment.id,
            metadata: { code: assessment.code, name: assessment.name, maxMarks: assessment.maximumMarks }
          }
        });
      }

      return res.status(201).json({
        message: `Assessment [${assessment.code}] ${assessment.name} created successfully`,
        assessment
      });
    } catch (error: any) {
      console.error('Create assessment error:', error);
      return res.status(500).json({ error: 'Failed to create assessment' });
    }
  }

  /**
   * PUT /api/admin/assessments/:id
   * Updates an existing assessment.
   */
  static async updateAssessment(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const {
        name,
        code,
        description,
        maximumMarks,
        weightage,
        academicYearId,
        departmentId,
        yearId,
        semester,
        subjectId,
        isActive
      } = req.body || {};

      const existing = await prisma.assessment.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
      }

      const updateData: any = {};

      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ error: 'Assessment name cannot be empty', code: 'INVALID_NAME' });
        }
        updateData.name = name.trim();
      }

      if (code !== undefined) {
        if (typeof code !== 'string' || !code.trim()) {
          return res.status(400).json({ error: 'Assessment code cannot be empty', code: 'INVALID_CODE' });
        }
        const cleanCode = code.trim().toUpperCase();
        if (cleanCode !== existing.code) {
          const duplicate = await prisma.assessment.findFirst({
            where: {
              code: { equals: cleanCode, mode: 'insensitive' },
              id: { not: id }
            }
          });
          if (duplicate) {
            return res.status(409).json({
              error: `Assessment code "${cleanCode}" is already in use by another assessment.`,
              code: 'ASSESSMENT_CODE_EXISTS'
            });
          }
        }
        updateData.code = cleanCode;
      }

      if (description !== undefined) {
        updateData.description = description?.trim() || null;
      }

      if (maximumMarks !== undefined) {
        const parsedMax = parseFloat(maximumMarks);
        if (isNaN(parsedMax) || parsedMax <= 0) {
          return res.status(400).json({ error: 'Maximum marks must be a positive number', code: 'INVALID_MAX_MARKS' });
        }
        updateData.maximumMarks = parsedMax;
      }

      if (weightage !== undefined) {
        updateData.weightage = weightage !== null && weightage !== '' ? parseFloat(weightage) : null;
      }

      if (academicYearId !== undefined) {
        updateData.academicYearId = academicYearId || null;
      }

      if (departmentId !== undefined) {
        updateData.departmentId = departmentId || null;
      }

      if (yearId !== undefined) {
        updateData.yearId = yearId || null;
      }

      if (semester !== undefined) {
        updateData.semester = semester ? parseInt(semester, 10) : null;
      }

      if (subjectId !== undefined) {
        updateData.subjectId = subjectId || null;
      }

      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }

      const updated = await prisma.assessment.update({
        where: { id },
        data: updateData,
        include: {
          academicYear: true,
          department: true,
          subject: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'UPDATE_ASSESSMENT',
            entity: 'Assessment',
            entityId: id,
            metadata: updateData
          }
        });
      }

      return res.status(200).json({
        message: `Assessment [${updated.code}] updated successfully`,
        assessment: updated
      });
    } catch (error: any) {
      console.error('Update assessment error:', error);
      return res.status(500).json({ error: 'Failed to update assessment' });
    }
  }

  /**
   * PATCH /api/admin/assessments/:id/status
   * Toggle or set assessment active status.
   */
  static async toggleAssessmentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { isActive } = req.body || {};

      const existing = await prisma.assessment.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
      }

      const newStatus = isActive !== undefined ? Boolean(isActive) : !existing.isActive;

      const updated = await prisma.assessment.update({
        where: { id },
        data: { isActive: newStatus }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'TOGGLE_ASSESSMENT_STATUS',
            entity: 'Assessment',
            entityId: id,
            metadata: { previousStatus: existing.isActive, newStatus }
          }
        });
      }

      return res.status(200).json({
        message: `Assessment ${updated.code} status changed to ${newStatus ? 'Active' : 'Inactive'}`,
        assessment: updated
      });
    } catch (error: any) {
      console.error('Toggle assessment status error:', error);
      return res.status(500).json({ error: 'Failed to toggle assessment status' });
    }
  }

  /**
   * DELETE /api/admin/assessments/:id
   * Safe assessment deletion. Prevented if student marks or performance evaluations exist.
   */
  static async deleteAssessment(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const assessment = await prisma.assessment.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              marks: true,
              performanceSnapshots: true
            }
          }
        }
      });

      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
      }

      const markCount = assessment._count.marks;
      const snapshotCount = assessment._count.performanceSnapshots;

      if (markCount > 0 || snapshotCount > 0) {
        return res.status(400).json({
          error: `Cannot delete assessment [${assessment.code}] ${assessment.name}: It is referenced by ${markCount} student mark(s) and ${snapshotCount} performance record(s). Deactivate the assessment instead to preserve academic grading records.`,
          code: 'CANNOT_DELETE_REFERENCED_ASSESSMENT',
          references: {
            marks: markCount,
            performanceSnapshots: snapshotCount
          }
        });
      }

      await prisma.assessment.delete({ where: { id } });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'DELETE_ASSESSMENT',
            entity: 'Assessment',
            entityId: id,
            metadata: { code: assessment.code, name: assessment.name }
          }
        });
      }

      return res.status(200).json({
        message: `Assessment [${assessment.code}] ${assessment.name} was safely deleted.`
      });
    } catch (error: any) {
      console.error('Delete assessment error:', error);
      return res.status(500).json({ error: 'Failed to delete assessment' });
    }
  }
}
