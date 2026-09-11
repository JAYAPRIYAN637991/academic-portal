import { Request, Response } from 'express';
import { ReportFormat, ReportService, ReportType } from '../services/report.service';
import { checkStaffAssignment } from '../middleware/auth.middleware';
import { prisma } from '../db';

const VALID_REPORT_TYPES: ReportType[] = [
  'student-performance',
  'section-performance',
  'year-performance',
  'department-performance',
  'overall-college',
  'notifications',
  'notices'
];

function normalizeReportType(type: string): ReportType | null {
  const clean = (type || '').trim().toLowerCase();
  const map: Record<string, ReportType> = {
    'student-performance': 'student-performance',
    'section-performance': 'section-performance',
    'year-performance': 'year-performance',
    'department-performance': 'department-performance',
    'overall-college': 'overall-college',
    'overall-college-result': 'overall-college',
    'notifications': 'notifications',
    'notification-report': 'notifications',
    'notices': 'notices',
    'college-notice-report': 'notices'
  };
  return map[clean] || null;
}

export class ReportController {
  /**
   * GET /api/admin/reports/types
   * Returns catalog of available reports.
   */
  static getReportCatalog(_req: Request, res: Response) {
    const catalog = [
      {
        id: 'student-performance',
        name: 'Student Performance Report',
        category: 'ACADEMICS',
        description: 'Comprehensive roster with IA-1, IA-2, improvement delta, pass percentage, and academic status.',
        allowedFormats: ['pdf', 'excel', 'csv', 'pptx', 'json'],
        requiresSection: false,
        supportsStudentFilter: true
      },
      {
        id: 'section-performance',
        name: 'Section Performance Report',
        category: 'ACADEMICS',
        description: 'Class cohort averages, highest/lowest marks, improvement trajectories, and subject averages.',
        allowedFormats: ['pdf', 'excel', 'csv', 'pptx', 'json'],
        requiresSection: false
      },
      {
        id: 'year-performance',
        name: 'Year-wise Performance Report',
        category: 'INSTITUTIONAL',
        description: 'Comparative analytics across 1st, 2nd, 3rd, and 4th Year student cohorts.',
        allowedFormats: ['pdf', 'excel', 'csv', 'pptx', 'json'],
        adminOnly: true
      },
      {
        id: 'department-performance',
        name: 'Department Performance Report',
        category: 'INSTITUTIONAL',
        description: 'Departmental benchmarking, faculty workloads, and performance rankings.',
        allowedFormats: ['pdf', 'excel', 'csv', 'pptx', 'json'],
        adminOnly: true
      },
      {
        id: 'overall-college',
        name: 'Overall College Result',
        category: 'INSTITUTIONAL',
        description: 'College-wide evaluation summary, department and section rankings, top 10, and attention rosters.',
        allowedFormats: ['pdf', 'excel', 'csv', 'pptx', 'json'],
        adminOnly: true
      },
      {
        id: 'notifications',
        name: 'Parent Notification Report',
        category: 'COMMUNICATION',
        description: 'Delivery analytics across SMS and WhatsApp channels, delivery rates, and failed messages.',
        allowedFormats: ['pdf', 'excel', 'csv', 'pptx', 'json'],
        adminOnly: true
      },
      {
        id: 'notices',
        name: 'College Notice Activity Report',
        category: 'COMMUNICATION',
        description: 'Official notice broadcast registry, categories, schedules, targets, and delivery counts.',
        allowedFormats: ['pdf', 'excel', 'csv', 'pptx', 'json'],
        adminOnly: true
      }
    ];

    const reports = catalog.map(c => ({
      ...c,
      formats: c.allowedFormats
    }));

    return res.status(200).json({ reports, catalog });
  }

  /**
   * GET /api/admin/reports/:reportType
   * Unrestricted administrative report generator.
   */
  static async generateAdminReport(req: Request, res: Response) {
    try {
      const rawParam = req.params.reportType as string;
      const rawQuery = (req.query.type as string) || '';
      const rawType = (rawParam === 'generate' ? rawQuery : rawParam) || rawQuery;
      const reportType = normalizeReportType(rawType);

      let format = ((req.query.format as string) || 'pdf').toLowerCase() as ReportFormat;
      if (format === ('powerpoint' as any)) format = 'pptx';

      if (!reportType) {
        return res.status(400).json({
          error: `Invalid report type: "${rawType}". Valid options: ${VALID_REPORT_TYPES.join(', ')}`,
          code: 'INVALID_REPORT_TYPE'
        });
      }

      const result = await ReportService.generateReport({
        reportType,
        format,
        filters: req.query,
        userId: req.user!.id,
        userName: req.user!.name
      });

      if (format === 'json') {
        return res.status(200).json(result.data);
      }

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.buffer!.length);
      return res.end(result.buffer);
    } catch (error: any) {
      console.error('Admin report generation error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate report' });
    }
  }

  /**
   * GET /api/staff/reports/:reportType
   * Scoped faculty report generator.
   * Strictly restricted to assigned sections and marks.
   */
  static async generateStaffReport(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;
      const { reportType } = req.params as { reportType: ReportType };
      const format = ((req.query.format as string) || 'pdf').toLowerCase() as ReportFormat;

      // 1. Strict Guard: Staff can NEVER generate college-wide reports
      const collegeWideTypes: ReportType[] = [
        'year-performance',
        'department-performance',
        'overall-college',
        'notifications',
        'notices'
      ];

      if (collegeWideTypes.includes(reportType)) {
        return res.status(403).json({
          error: 'Forbidden: College-wide reports are restricted to Central Administration.',
          code: 'COLLEGE_WIDE_REPORTS_RESTRICTED'
        });
      }

      if (reportType !== 'student-performance' && reportType !== 'section-performance') {
        return res.status(400).json({ error: 'Unsupported report type', code: 'INVALID_REPORT_TYPE' });
      }

      // 2. Class Section Clearance Check
      const sectionId = req.query.sectionId as string | undefined;
      const studentId = req.query.studentId as string | undefined;

      if (!sectionId && !studentId) {
        return res.status(400).json({
          error: 'Faculty members must specify an assigned sectionId or studentId for report generation.',
          code: 'MISSING_ASSIGNED_SECTION'
        });
      }

      if (sectionId) {
        const hasAssignment = await prisma.teacherAssignment.findFirst({
          where: { staffId, sectionId }
        });
        if (!hasAssignment) {
          return res.status(403).json({
            error: 'Forbidden: You are not assigned to instruct this class section.',
            code: 'STAFF_SECTION_UNAUTHORIZED'
          });
        }
      } else if (studentId) {
        const student = await prisma.student.findUnique({
          where: { id: studentId },
          select: { sectionId: true, academicYearId: true }
        });
        if (!student) {
          return res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND' });
        }
        const hasAssignment = await prisma.teacherAssignment.findFirst({
          where: { staffId, sectionId: student.sectionId }
        });
        if (!hasAssignment) {
          return res.status(403).json({
            error: 'Forbidden: You are not assigned to instruct this student’s section.',
            code: 'STAFF_STUDENT_UNAUTHORIZED'
          });
        }
      }

      const result = await ReportService.generateReport({
        reportType,
        format,
        filters: req.query,
        userId: staffId,
        userName: req.user!.name
      });

      if (format === 'json') {
        return res.status(200).json(result.data);
      }

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.buffer!.length);
      return res.end(result.buffer);
    } catch (error: any) {
      console.error('Staff report generation error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate report' });
    }
  }
}
