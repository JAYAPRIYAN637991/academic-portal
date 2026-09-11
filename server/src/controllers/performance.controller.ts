import { Request, Response } from 'express';
import { AcademicPerformanceService } from '../services/academicPerformance.service';
import { checkStaffAssignment } from '../middleware/auth.middleware';
import { prisma } from '../db';
import { AuditAction } from '../services/audit.service';

export class PerformanceController {
  /**
   * GET /api/admin/analytics/performance/overview
   * Admin-Only: Multi-filtered student performance overview.
   * Query filters: academicYearId, departmentId, yearId, sectionId, studentId, assessmentId, search
   */
  static async getPerformanceOverview(req: Request, res: Response) {
    try {
      const {
        academicYearId,
        departmentId,
        yearId,
        sectionId,
        studentId,
        assessmentId,
        search
      } = req.query;

      const result = await AcademicPerformanceService.getFilteredStudentsPerformance({
        academicYearId: academicYearId as string | undefined,
        departmentId: departmentId as string | undefined,
        yearId: yearId as string | undefined,
        sectionId: sectionId as string | undefined,
        studentId: studentId as string | undefined,
        assessmentId: assessmentId as string | undefined,
        search: search as string | undefined
      });

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Get performance overview error:', error);
      return res.status(500).json({ error: error.message || 'Failed to retrieve performance overview' });
    }
  }

  /**
   * GET /api/admin/analytics/performance/student/:studentId
   * GET /api/staff/analytics/performance/student/:studentId
   * 
   * Returns comprehensive calculation report for a student:
   * - Total marks, max marks, percentage, status
   * - IA-1 percentage & IA-2 percentage
   * - Improvement / Decline
   * - Subject-wise difference and comparison
   */
  static async getStudentPerformance(req: Request, res: Response) {
    try {
      const studentId = req.params.studentId as string;

      if (!studentId) {
        return res.status(400).json({ error: 'studentId is required', code: 'MISSING_STUDENT_ID' });
      }

      // Verify student existence
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, sectionId: true, academicYearId: true }
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND' });
      }

      // Security check for Staff
      if (req.user!.role !== 'ADMIN') {
        const staffId = req.user!.id;
        const assignment = await prisma.teacherAssignment.findFirst({
          where: {
            staffId,
            sectionId: student.sectionId,
            academicYearId: student.academicYearId
          }
        });

        if (!assignment) {
          return res.status(403).json({
            error: 'Forbidden: You are not assigned to instruct this student’s class.',
            code: 'STAFF_STUDENT_UNAUTHORIZED'
          });
        }
      }

      const report = await AcademicPerformanceService.getStudentPerformanceFromDb(studentId);

      if (!report) {
        return res.status(404).json({ error: 'Could not generate performance report', code: 'REPORT_FAILED' });
      }

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: AuditAction.REPORT_GENERATED,
            entity: 'StudentPerformance',
            entityId: studentId,
            metadata: {
              reportType: 'STUDENT_PERFORMANCE_REPORT',
              studentName: report.studentName,
              registerNumber: report.registerNumber
            }
          }
        });
      }

      return res.status(200).json({ report });
    } catch (error: any) {
      console.error('Get student performance error:', error);
      return res.status(500).json({ error: error.message || 'Failed to retrieve student performance' });
    }
  }

  /**
   * GET /api/admin/analytics/performance/section/:sectionId
   * GET /api/staff/analytics/section
   * 
   * Returns class performance summary:
   * - Class averages (overall, IA-1, IA-2)
   * - Level distributions
   * - Improvement / decline trajectories
   * - Subject summaries & student rankings
   */
  static async getSectionPerformance(req: Request, res: Response) {
    try {
      const sectionId = (req.params.sectionId || req.query.sectionId) as string;
      const subjectId = req.query.subjectId as string | undefined;

      if (!sectionId) {
        return res.status(400).json({ error: 'sectionId is required', code: 'MISSING_SECTION_ID' });
      }

      // Check staff authorization if not admin
      if (req.user!.role !== 'ADMIN') {
        const staffId = req.user!.id;
        if (subjectId) {
          const isAssigned = await checkStaffAssignment(staffId, sectionId, subjectId);
          if (!isAssigned) {
            return res.status(403).json({
              error: 'Forbidden: You are not assigned to this subject/section.',
              code: 'STAFF_CLASS_UNAUTHORIZED'
            });
          }
        } else {
          // Verify staff has at least one assignment in this section
          const assignment = await prisma.teacherAssignment.findFirst({
            where: { staffId, sectionId }
          });
          if (!assignment) {
            return res.status(403).json({
              error: 'Forbidden: You are not assigned to this class section.',
              code: 'STAFF_CLASS_UNAUTHORIZED'
            });
          }
        }
      }

      const summary = await AcademicPerformanceService.getSectionPerformanceFromDb(sectionId, subjectId);

      if (!summary) {
        return res.status(404).json({ error: 'Section not found', code: 'SECTION_NOT_FOUND' });
      }

      return res.status(200).json({ summary });
    } catch (error: any) {
      console.error('Get section performance error:', error);
      return res.status(500).json({ error: error.message || 'Failed to calculate class performance' });
    }
  }

  /**
   * POST /api/admin/analytics/performance/snapshots/generate
   * 
   * Admin-only: Computes and persists performance snapshots for all students in an assessment.
   */
  static async generateSnapshots(req: Request, res: Response) {
    try {
      const { assessmentId, sectionId } = req.body || {};

      if (!assessmentId) {
        return res.status(400).json({ error: 'assessmentId is required', code: 'MISSING_ASSESSMENT_ID' });
      }

      const result = await AcademicPerformanceService.generateAndSaveAssessmentSnapshots(assessmentId, sectionId);

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: AuditAction.PERFORMANCE_PUBLISHED,
            entity: 'PerformanceSnapshot',
            entityId: assessmentId,
            metadata: {
              assessmentId,
              sectionId,
              createdCount: result.createdCount,
              updatedCount: result.updatedCount,
              totalProcessed: result.createdCount + result.updatedCount
            }
          }
        });
      }

      return res.status(200).json({
        message: `Successfully processed snapshots: ${result.createdCount} created, ${result.updatedCount} updated.`,
        ...result
      });
    } catch (error: any) {
      console.error('Generate snapshots error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate snapshots' });
    }
  }
}
