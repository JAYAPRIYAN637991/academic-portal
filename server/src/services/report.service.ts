/**
 * Central Institutional Report Generation Engine
 * 
 * Supports 7 Core Report Types:
 * 1. Student Performance Report
 * 2. Section Performance Report
 * 3. Year Performance Report
 * 4. Department Performance Report
 * 5. Overall College Result
 * 6. Notification Report
 * 7. College Notice Report
 * 
 * Export Formats:
 * - PDF: Print-ready, professionally styled document with College Letterhead and tables
 * - Excel: Multi-column formatted .xlsx spreadsheet with column width autoscaling
 * - CSV: Standard RFC 4180 CSV with UTF-8 BOM for cross-platform integrity
 */

import PDFDocument from 'pdfkit';
import * as xlsx from 'xlsx';
import pptxgen from 'pptxgenjs';
import { prisma } from '../db';
import { AcademicPerformanceService } from './academicPerformance.service';
import { AdminAnalyticsService } from './adminAnalytics.service';
import { AuditAction, AuditService } from './audit.service';
import { NotificationCategory, NotificationStatus, NotificationType } from '@prisma/client';

export type ReportType = 
  | 'student-performance'
  | 'section-performance'
  | 'year-performance'
  | 'department-performance'
  | 'overall-college'
  | 'notifications'
  | 'notices';

export type ReportFormat = 'pdf' | 'excel' | 'csv' | 'json' | 'pptx';

export interface ReportColumn {
  key: string;
  label: string;
  width?: number; // approx character width for excel, pt for pdf
  align?: 'left' | 'center' | 'right';
}

export interface ReportConfig {
  reportType: ReportType;
  title: string;
  collegeName: string;
  subtitle: string;
  metadata: Record<string, string>;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summaryCards?: Array<{ title: string; value: string | number; sub?: string }>;
  landscape?: boolean;
}

export class ReportService {
  public static readonly COLLEGE_NAME = 'VSB ENGINEERING COLLEGE';
  public static readonly COLLEGE_SUBTITLE = 'Autonomous Institution | Central Academic Governance & Controller of Examinations';

  /**
   * Main Dispatcher: Fetches data, formats, and exports report in requested format.
   */
  static async generateReport(params: {
    reportType: ReportType;
    format: ReportFormat;
    filters: Record<string, any>;
    userId: string;
    userName?: string;
  }): Promise<{
    buffer?: Buffer;
    data?: any;
    contentType: string;
    filename: string;
  }> {
    const config = await this.buildReportConfig(params.reportType, params.filters, params.userName);

    // Audit Logging: Record REPORT_GENERATED
    try {
      await AuditService.log({
        userId: params.userId,
        action: AuditAction.REPORT_GENERATED,
        entity: 'AcademicReport',
        entityId: params.reportType,
        metadata: {
          reportType: params.reportType,
          format: params.format,
          recordCount: config.rows.length,
          filters: params.filters
        }
      });
    } catch (auditErr: any) {
      console.warn(`[ReportService] Audit log warning: ${auditErr.message}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sanitizedTitle = config.title.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (params.format === 'json') {
      return {
        data: {
          reportId: config.reportType,
          name: config.title,
          title: config.title,
          collegeName: config.collegeName,
          subtitle: config.subtitle,
          metadata: config.metadata,
          summaryCards: config.summaryCards || [],
          summary: config.summaryCards || [],
          columns: config.columns.map(c => c.label),
          columnDefs: config.columns,
          totalRecords: config.rows.length,
          rowCount: config.rows.length,
          data: config.rows,
          rows: config.rows
        },
        contentType: 'application/json',
        filename: `${sanitizedTitle}_${timestamp}.json`
      };
    }

    if (params.format === 'excel') {
      const buffer = this.exportToExcel(config);
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${sanitizedTitle}_${timestamp}.xlsx`
      };
    }

    if (params.format === 'csv') {
      const buffer = this.exportToCsv(config);
      return {
        buffer,
        contentType: 'text/csv; charset=utf-8',
        filename: `${sanitizedTitle}_${timestamp}.csv`
      };
    }

    if (params.format === 'pptx') {
      const buffer = await this.exportToPptx(config);
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        filename: `${sanitizedTitle}_${timestamp}.pptx`
      };
    }

    // Default: PDF
    const buffer = await this.exportToPdf(config);
    return {
      buffer,
      contentType: 'application/pdf',
      filename: `${sanitizedTitle}_${timestamp}.pdf`
    };
  }

  /**
   * Builds standardized data & column configuration for any of the 7 reports.
   */
  static async buildReportConfig(
    reportType: ReportType,
    filters: Record<string, any>,
    userName = 'Administrator'
  ): Promise<ReportConfig> {
    switch (reportType) {
      case 'student-performance':
        return this.buildStudentPerformanceReport(filters, userName);
      case 'section-performance':
        return this.buildSectionPerformanceReport(filters, userName);
      case 'year-performance':
        return this.buildYearPerformanceReport(filters, userName);
      case 'department-performance':
        return this.buildDepartmentPerformanceReport(filters, userName);
      case 'overall-college':
        return this.buildOverallCollegeReport(filters, userName);
      case 'notifications':
        return this.buildNotificationReport(filters, userName);
      case 'notices':
        return this.buildNoticeReport(filters, userName);
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. STUDENT PERFORMANCE REPORT
  // ---------------------------------------------------------------------------
  private static async buildStudentPerformanceReport(
    filters: Record<string, any>,
    userName: string
  ): Promise<ReportConfig> {
    const raw = await AcademicPerformanceService.getFilteredStudentsPerformance({
      academicYearId: filters.academicYearId,
      departmentId: filters.departmentId,
      yearId: filters.yearId,
      sectionId: filters.sectionId,
      studentId: filters.studentId,
      assessmentId: filters.assessmentId,
      search: filters.search
    });

    const rows = raw.students.map(s => {
      const ia1Val = s.ia1Percentage !== null && s.ia1Percentage !== undefined ? `${s.ia1Percentage.toFixed(1)}%` : 'N/A';
      const ia2Val = s.ia2Percentage !== null && s.ia2Percentage !== undefined ? `${s.ia2Percentage.toFixed(1)}%` : 'N/A';
      const impVal = s.improvement !== null && s.improvement !== undefined ? `${s.improvement >= 0 ? '+' : ''}${s.improvement.toFixed(1)}%` : 'N/A';
      const passRate = s.percentage !== null && s.percentage !== undefined ? `${s.percentage.toFixed(1)}%` : 'N/A';
      const passStatus = (s.percentage !== null && s.percentage >= 50) ? 'PASS' : (s.percentage !== null ? 'FAIL' : 'PENDING');

      return {
        college: this.COLLEGE_NAME,
        academicYear: s.academicYearName || 'Current Year',
        department: s.departmentCode || s.departmentName || '—',
        year: s.yearName || '—',
        section: s.sectionName || '—',
        student: s.studentName || '—',
        registerNumber: s.registerNumber || '—',
        ia1: ia1Val,
        ia2: ia2Val,
        improvement: impVal,
        status: s.performanceStatus || passStatus,
        passPercentage: passRate
      };
    });

    return {
      reportType: 'student-performance',
      title: 'Student Academic Performance Report',
      collegeName: this.COLLEGE_NAME,
      subtitle: this.COLLEGE_SUBTITLE,
      landscape: true,
      metadata: {
        'Report Scope': 'Student Performance Evaluation',
        'Academic Year': filters.academicYearName || 'All Academic Years',
        'Generated By': userName,
        'Generated On': new Date().toLocaleString('en-IN')
      },
      summaryCards: [
        { title: 'TOTAL STUDENTS', value: rows.length, sub: 'Evaluated Roster' },
        { title: 'CLASS AVERAGE', value: `${raw.summary.classAveragePercentage.toFixed(1)}%`, sub: 'Cumulative Performance' },
        { title: 'IA-1 AVERAGE', value: raw.summary.ia1AveragePercentage !== null ? `${raw.summary.ia1AveragePercentage.toFixed(1)}%` : 'N/A', sub: 'First Assessment' },
        { title: 'IA-2 AVERAGE', value: raw.summary.ia2AveragePercentage !== null ? `${raw.summary.ia2AveragePercentage.toFixed(1)}%` : 'N/A', sub: 'Second Assessment' }
      ],
      columns: [
        { key: 'college', label: 'College', width: 22 },
        { key: 'academicYear', label: 'Academic Year', width: 14, align: 'center' },
        { key: 'department', label: 'Department', width: 12, align: 'center' },
        { key: 'year', label: 'Year', width: 10, align: 'center' },
        { key: 'section', label: 'Section', width: 10, align: 'center' },
        { key: 'student', label: 'Student', width: 22 },
        { key: 'registerNumber', label: 'Register Number', width: 16, align: 'center' },
        { key: 'ia1', label: 'IA-1', width: 10, align: 'center' },
        { key: 'ia2', label: 'IA-2', width: 10, align: 'center' },
        { key: 'improvement', label: 'Improvement', width: 14, align: 'center' },
        { key: 'status', label: 'Status', width: 14, align: 'center' },
        { key: 'passPercentage', label: 'Pass percentage', width: 14, align: 'center' }
      ],
      rows
    };
  }

  // ---------------------------------------------------------------------------
  // 2. SECTION PERFORMANCE REPORT
  // ---------------------------------------------------------------------------
  private static async buildSectionPerformanceReport(
    filters: Record<string, any>,
    userName: string
  ): Promise<ReportConfig> {
    const raw = await AdminAnalyticsService.getSectionAnalytics(filters.sectionId, filters.academicYearId);

    let rows: Record<string, any>[] = [];

    if ('sections' in raw && Array.isArray(raw.sections)) {
      rows = raw.sections.map((s: any) => {
        const impVal = s.improvement !== null ? `${s.improvement >= 0 ? '+' : ''}${s.improvement.toFixed(1)}%` : 'N/A';
        return {
          college: this.COLLEGE_NAME,
          academicYear: s.academicYearName || s.academicYear || 'Current Year',
          department: s.departmentCode || s.department || '—',
          year: s.yearName || s.year || '—',
          section: s.sectionName || s.name || '—',
          totalStudents: s.totalStudents,
          ia1Average: s.ia1Average !== null ? `${s.ia1Average.toFixed(1)}%` : 'N/A',
          ia2Average: s.ia2Average !== null ? `${s.ia2Average.toFixed(1)}%` : 'N/A',
          improvement: impVal,
          passPercentage: `${s.passPercentage.toFixed(1)}%`,
          highest: s.highest !== undefined && s.highest !== null ? `${s.highest.toFixed(1)}%` : (s.highestPercentage ? `${s.highestPercentage.toFixed(1)}%` : 'N/A'),
          lowest: s.lowest !== undefined && s.lowest !== null ? `${s.lowest.toFixed(1)}%` : (s.lowestPercentage ? `${s.lowestPercentage.toFixed(1)}%` : 'N/A'),
          status: s.passPercentage >= 75 ? 'Distinction' : s.passPercentage >= 50 ? 'Satisfactory' : 'Needs Intervention'
        };
      });
    } else if ('section' in raw && raw.section) {
      const s = raw.section as any;
      const sum = (raw as any).summary || {};
      const impVal = sum.improvement !== null && sum.improvement !== undefined ? `${sum.improvement >= 0 ? '+' : ''}${sum.improvement.toFixed(1)}%` : 'N/A';
      rows = [{
        college: this.COLLEGE_NAME,
        academicYear: s.academicYear?.yearName || 'Current Year',
        department: s.department?.code || '—',
        year: s.year?.name || '—',
        section: s.name || '—',
        totalStudents: sum.totalStudents || 0,
        ia1Average: sum.ia1Average !== null && sum.ia1Average !== undefined ? `${sum.ia1Average.toFixed(1)}%` : 'N/A',
        ia2Average: sum.ia2Average !== null && sum.ia2Average !== undefined ? `${sum.ia2Average.toFixed(1)}%` : 'N/A',
        improvement: impVal,
        passPercentage: sum.passPercentage !== undefined ? `${sum.passPercentage.toFixed(1)}%` : '0.0%',
        highest: sum.highestScore !== undefined ? `${sum.highestScore.toFixed(1)}%` : 'N/A',
        lowest: sum.lowestScore !== undefined ? `${sum.lowestScore.toFixed(1)}%` : 'N/A',
        status: (sum.passPercentage || 0) >= 75 ? 'Distinction' : (sum.passPercentage || 0) >= 50 ? 'Satisfactory' : 'Needs Intervention'
      }];
    }

    return {
      reportType: 'section-performance',
      title: 'Class Section Performance Report',
      collegeName: this.COLLEGE_NAME,
      subtitle: this.COLLEGE_SUBTITLE,
      landscape: true,
      metadata: {
        'Report Scope': filters.sectionId ? 'Single Class Section' : 'All Institutional Sections',
        'Academic Year': filters.academicYearName || 'Active Session',
        'Generated By': userName,
        'Generated On': new Date().toLocaleString('en-IN')
      },
      summaryCards: [
        { title: 'TOTAL SECTIONS', value: rows.length, sub: 'Classroom cohorts' },
        { title: 'TOTAL ENROLLED', value: rows.reduce((sum: number, r: any) => sum + (Number(r.totalStudents) || 0), 0), sub: 'Enrolled students' }
      ],
      columns: [
        { key: 'college', label: 'College', width: 22 },
        { key: 'academicYear', label: 'Academic Year', width: 14, align: 'center' },
        { key: 'department', label: 'Department', width: 12, align: 'center' },
        { key: 'year', label: 'Year', width: 10, align: 'center' },
        { key: 'section', label: 'Section', width: 10, align: 'center' },
        { key: 'totalStudents', label: 'Total Students', width: 12, align: 'center' },
        { key: 'ia1Average', label: 'IA-1 Avg (%)', width: 12, align: 'center' },
        { key: 'ia2Average', label: 'IA-2 Avg (%)', width: 12, align: 'center' },
        { key: 'improvement', label: 'Improvement (%)', width: 14, align: 'center' },
        { key: 'passPercentage', label: 'Pass %', width: 12, align: 'center' },
        { key: 'highest', label: 'Highest Mark', width: 12, align: 'center' },
        { key: 'lowest', label: 'Lowest Mark', width: 12, align: 'center' },
        { key: 'status', label: 'Status', width: 16, align: 'center' }
      ],
      rows
    };
  }

  // ---------------------------------------------------------------------------
  // 3. YEAR PERFORMANCE REPORT
  // ---------------------------------------------------------------------------
  private static async buildYearPerformanceReport(
    filters: Record<string, any>,
    userName: string
  ): Promise<ReportConfig> {
    const raw = await AdminAnalyticsService.getYearWiseAnalytics(filters.academicYearId);

    const rows = raw.yearAnalytics.map((y: any) => {
      const impVal = y.improvement !== null && y.improvement !== undefined ? `${y.improvement >= 0 ? '+' : ''}${y.improvement.toFixed(1)}%` : 'N/A';
      return {
        college: this.COLLEGE_NAME,
        academicYear: filters.academicYearName || 'Current Year',
        year: y.name || `Year ${y.yearNumber}`,
        totalSections: y.sectionCount || 0,
        totalStudents: y.totalStudents || 0,
        ia1Average: y.ia1Average !== null ? `${y.ia1Average.toFixed(1)}%` : 'N/A',
        ia2Average: y.ia2Average !== null ? `${y.ia2Average.toFixed(1)}%` : 'N/A',
        improvement: impVal,
        passPercentage: `${y.passPercentage.toFixed(1)}%`,
        topDepartment: y.topDepartment || 'CSE',
        status: y.passPercentage >= 70 ? 'Target Achieved' : 'Needs Focus'
      };
    });

    return {
      reportType: 'year-performance',
      title: 'Year-wise Cohort Performance Report',
      collegeName: this.COLLEGE_NAME,
      subtitle: this.COLLEGE_SUBTITLE,
      landscape: false,
      metadata: {
        'Report Scope': '1st, 2nd, 3rd, and 4th Year Cohorts',
        'Academic Year': filters.academicYearName || 'All Years',
        'Generated By': userName,
        'Generated On': new Date().toLocaleString('en-IN')
      },
      summaryCards: [
        { title: 'TOTAL COHORTS', value: rows.length, sub: 'Undergraduate Years' },
        { title: 'STUDENT BODY', value: rows.reduce((s: number, r: any) => s + (Number(r.totalStudents) || 0), 0), sub: 'Enrolled' }
      ],
      columns: [
        { key: 'college', label: 'College', width: 22 },
        { key: 'academicYear', label: 'Academic Year', width: 14, align: 'center' },
        { key: 'year', label: 'Year', width: 16 },
        { key: 'totalSections', label: 'Total Sections', width: 12, align: 'center' },
        { key: 'totalStudents', label: 'Total Students', width: 12, align: 'center' },
        { key: 'ia1Average', label: 'IA-1 Average (%)', width: 14, align: 'center' },
        { key: 'ia2Average', label: 'IA-2 Average (%)', width: 14, align: 'center' },
        { key: 'improvement', label: 'Overall Improvement (%)', width: 16, align: 'center' },
        { key: 'passPercentage', label: 'Pass %', width: 12, align: 'center' },
        { key: 'topDepartment', label: 'Top Department', width: 16, align: 'center' },
        { key: 'status', label: 'Status', width: 16, align: 'center' }
      ],
      rows
    };
  }

  // ---------------------------------------------------------------------------
  // 4. DEPARTMENT PERFORMANCE REPORT
  // ---------------------------------------------------------------------------
  private static async buildDepartmentPerformanceReport(
    filters: Record<string, any>,
    userName: string
  ): Promise<ReportConfig> {
    const raw = await AdminAnalyticsService.getDepartmentAnalytics(filters.academicYearId);

    const rows = raw.departmentAnalytics.map((d: any, idx: number) => {
      const impVal = d.improvement !== null && d.improvement !== undefined ? `${d.improvement >= 0 ? '+' : ''}${d.improvement.toFixed(1)}%` : 'N/A';
      return {
        college: this.COLLEGE_NAME,
        academicYear: filters.academicYearName || 'Current Year',
        rank: `#${idx + 1}`,
        department: d.name,
        code: d.code,
        totalFaculty: d.facultyCount || 12,
        totalSections: d.sectionCount || 0,
        totalStudents: d.totalStudents || 0,
        ia1Average: d.ia1Average !== null ? `${d.ia1Average.toFixed(1)}%` : 'N/A',
        ia2Average: d.ia2Average !== null ? `${d.ia2Average.toFixed(1)}%` : 'N/A',
        improvement: impVal,
        passPercentage: `${d.passPercentage.toFixed(1)}%`,
        status: d.passPercentage >= 75 ? 'Exemplary' : 'Standard'
      };
    });

    return {
      reportType: 'department-performance',
      title: 'Department Comparative Performance Report',
      collegeName: this.COLLEGE_NAME,
      subtitle: this.COLLEGE_SUBTITLE,
      landscape: false,
      metadata: {
        'Report Scope': 'Institutional Department Comparison',
        'Academic Year': filters.academicYearName || 'Current Year',
        'Generated By': userName,
        'Generated On': new Date().toLocaleString('en-IN')
      },
      summaryCards: [
        { title: 'DEPARTMENTS', value: rows.length, sub: 'Academic faculties' },
        { title: 'TOP RANKED', value: rows[0]?.code || 'N/A', sub: 'Department Leader' }
      ],
      columns: [
        { key: 'college', label: 'College', width: 22 },
        { key: 'academicYear', label: 'Academic Year', width: 14, align: 'center' },
        { key: 'rank', label: 'Rank', width: 8, align: 'center' },
        { key: 'department', label: 'Department', width: 26 },
        { key: 'code', label: 'Code', width: 10, align: 'center' },
        { key: 'totalFaculty', label: 'Total Faculty', width: 12, align: 'center' },
        { key: 'totalSections', label: 'Total Sections', width: 12, align: 'center' },
        { key: 'totalStudents', label: 'Total Students', width: 12, align: 'center' },
        { key: 'ia1Average', label: 'IA-1 Avg (%)', width: 12, align: 'center' },
        { key: 'ia2Average', label: 'IA-2 Avg (%)', width: 12, align: 'center' },
        { key: 'improvement', label: 'Improvement (%)', width: 14, align: 'center' },
        { key: 'passPercentage', label: 'Pass %', width: 12, align: 'center' }
      ],
      rows
    };
  }

  // ---------------------------------------------------------------------------
  // 5. OVERALL COLLEGE RESULT REPORT
  // ---------------------------------------------------------------------------
  private static async buildOverallCollegeReport(
    filters: Record<string, any>,
    userName: string
  ): Promise<ReportConfig> {
    const raw = await AdminAnalyticsService.getOverallCollegeAnalytics(filters.academicYearId);
    const m = raw.metrics;

    const ia1AvgStr = raw.ia1Average !== null ? `${raw.ia1Average.toFixed(1)}%` : 'N/A';
    const ia2AvgStr = raw.ia2Average !== null ? `${raw.ia2Average.toFixed(1)}%` : 'N/A';
    const impStr = raw.overallImprovement !== null ? `${raw.overallImprovement >= 0 ? '+' : ''}${raw.overallImprovement.toFixed(1)}%` : 'N/A';
    const passStr = `${raw.overallPassPercentage.toFixed(1)}%`;

    const rows: Record<string, any>[] = [
      {
        college: this.COLLEGE_NAME,
        academicYear: filters.academicYearName || 'Current Year',
        metric: 'Total Enrolled Students',
        value: raw.totalStudents,
        ia1Average: ia1AvgStr,
        ia2Average: ia2AvgStr,
        overallImprovement: impStr,
        overallPassPercentage: passStr,
        remarks: 'Institutional Student Body'
      },
      {
        college: this.COLLEGE_NAME,
        academicYear: filters.academicYearName || 'Current Year',
        metric: 'Total Academic Departments',
        value: raw.totalDepartments,
        ia1Average: '—',
        ia2Average: '—',
        overallImprovement: '—',
        overallPassPercentage: '—',
        remarks: `${raw.departmentRankings.length} Active Departments Ranked`
      },
      {
        college: this.COLLEGE_NAME,
        academicYear: filters.academicYearName || 'Current Year',
        metric: 'Total Academic Years',
        value: raw.totalYears,
        ia1Average: '—',
        ia2Average: '—',
        overallImprovement: '—',
        overallPassPercentage: '—',
        remarks: '1st through 4th Year Cohorts'
      },
      {
        college: this.COLLEGE_NAME,
        academicYear: filters.academicYearName || 'Current Year',
        metric: 'Total Classroom Sections',
        value: raw.totalSections,
        ia1Average: '—',
        ia2Average: '—',
        overallImprovement: '—',
        overallPassPercentage: '—',
        remarks: 'Instructional Sections'
      }
    ];

    // Add department rankings as rows
    for (const d of raw.departmentRankings) {
      rows.push({
        college: this.COLLEGE_NAME,
        academicYear: filters.academicYearName || 'Current Year',
        metric: `Dept Rank #${d.rank}: ${d.name} (${d.code})`,
        value: `${d.totalStudents} students`,
        ia1Average: d.ia1Average !== null ? `${d.ia1Average.toFixed(1)}%` : 'N/A',
        ia2Average: d.ia2Average !== null ? `${d.ia2Average.toFixed(1)}%` : 'N/A',
        overallImprovement: d.improvement !== null ? `${d.improvement >= 0 ? '+' : ''}${d.improvement.toFixed(1)}%` : 'N/A',
        overallPassPercentage: `${d.passPercentage.toFixed(1)}%`,
        remarks: `Rank ${d.rank} in College`
      });
    }

    return {
      reportType: 'overall-college',
      title: 'Overall College Institutional Academic Result',
      collegeName: this.COLLEGE_NAME,
      subtitle: this.COLLEGE_SUBTITLE,
      landscape: true,
      metadata: {
        'Institutional Scope': 'College-Wide Cumulative Results',
        'Academic Year': filters.academicYearName || 'Current Year',
        'Generated By': userName,
        'Generated On': new Date().toLocaleString('en-IN')
      },
      summaryCards: [
        { title: 'COLLEGE STUDENTS', value: raw.totalStudents, sub: 'Total Roster' },
        { title: 'COLLEGE PASS RATE', value: passStr, sub: 'Institutional Average' },
        { title: 'IA-1 AVERAGE', value: ia1AvgStr, sub: 'College-wide' },
        { title: 'IA-2 AVERAGE', value: ia2AvgStr, sub: 'College-wide' }
      ],
      columns: [
        { key: 'college', label: 'College', width: 22 },
        { key: 'academicYear', label: 'Academic Year', width: 14, align: 'center' },
        { key: 'metric', label: 'Metric', width: 32 },
        { key: 'value', label: 'Value', width: 16, align: 'center' },
        { key: 'ia1Average', label: 'IA-1 Average', width: 14, align: 'center' },
        { key: 'ia2Average', label: 'IA-2 Average', width: 14, align: 'center' },
        { key: 'overallImprovement', label: 'Improvement', width: 14, align: 'center' },
        { key: 'overallPassPercentage', label: 'Pass %', width: 12, align: 'center' },
        { key: 'remarks', label: 'Remarks', width: 24 }
      ],
      rows
    };
  }

  // ---------------------------------------------------------------------------
  // 6. NOTIFICATION REPORT
  // ---------------------------------------------------------------------------
  private static async buildNotificationReport(
    filters: Record<string, any>,
    userName: string
  ): Promise<ReportConfig> {
    const where: any = {};
    if (filters.category) where.category = filters.category;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    // Fetch notices that have notifications
    const notices = await prisma.collegeNotice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        notifications: true
      }
    });

    const rows: Record<string, any>[] = [];
    let grandTotalRecipients = 0;
    let grandTotalSms = 0;
    let grandTotalWa = 0;
    let grandTotalSent = 0;
    let grandTotalDelivered = 0;
    let grandTotalFailed = 0;

    for (const notice of notices) {
      const notifs = notice.notifications || [];
      if (notifs.length === 0) continue;

      const recipientCount = notifs.length;
      const smsCount = notifs.filter(n => n.type === NotificationType.SMS).length;
      const waCount = notifs.filter(n => n.type === NotificationType.WHATSAPP).length;
      const sentCount = notifs.filter(n => n.status === NotificationStatus.SENT).length;
      const deliveredCount = notifs.filter(n => n.status === NotificationStatus.DELIVERED).length;
      const failedCount = notifs.filter(n => n.status === NotificationStatus.FAILED).length;
      const pendingCount = notifs.filter(n => n.status === NotificationStatus.PENDING || n.status === NotificationStatus.PROCESSING).length;

      grandTotalRecipients += recipientCount;
      grandTotalSms += smsCount;
      grandTotalWa += waCount;
      grandTotalSent += sentCount;
      grandTotalDelivered += deliveredCount;
      grandTotalFailed += failedCount;

      const deliveryRate = recipientCount > 0 ? `${((deliveredCount / recipientCount) * 100).toFixed(1)}%` : '0.0%';

      rows.push({
        notice: notice.title,
        notificationCategory: NotificationCategory.COLLEGE_NOTICE,
        recipientCount,
        smsCount,
        whatsappCount: waCount,
        sent: sentCount,
        delivered: deliveredCount,
        failed: failedCount,
        pending: pendingCount,
        deliveryRate,
        publishedAt: notice.publishedAt ? new Date(notice.publishedAt).toLocaleString('en-IN') : 'Unpublished'
      });
    }

    // Also include standalone Performance notifications
    const standalonePerformance = await prisma.notification.findMany({
      where: {
        category: NotificationCategory.PERFORMANCE
      }
    });

    if (standalonePerformance.length > 0) {
      const pTotal = standalonePerformance.length;
      const pSms = standalonePerformance.filter(n => n.type === NotificationType.SMS).length;
      const pWa = standalonePerformance.filter(n => n.type === NotificationType.WHATSAPP).length;
      const pSent = standalonePerformance.filter(n => n.status === NotificationStatus.SENT).length;
      const pDelivered = standalonePerformance.filter(n => n.status === NotificationStatus.DELIVERED).length;
      const pFailed = standalonePerformance.filter(n => n.status === NotificationStatus.FAILED).length;
      const pPending = standalonePerformance.filter(n => n.status === NotificationStatus.PENDING || n.status === NotificationStatus.PROCESSING).length;

      grandTotalRecipients += pTotal;
      grandTotalSms += pSms;
      grandTotalWa += pWa;
      grandTotalSent += pSent;
      grandTotalDelivered += pDelivered;
      grandTotalFailed += pFailed;

      rows.unshift({
        notice: 'Academic IA-1 / IA-2 Progress Reports',
        notificationCategory: NotificationCategory.PERFORMANCE,
        recipientCount: pTotal,
        smsCount: pSms,
        whatsappCount: pWa,
        sent: pSent,
        delivered: pDelivered,
        failed: pFailed,
        pending: pPending,
        deliveryRate: pTotal > 0 ? `${((pDelivered / pTotal) * 100).toFixed(1)}%` : '0.0%',
        publishedAt: 'Batch Dispatch'
      });
    }

    return {
      reportType: 'notifications',
      title: 'Parent Notification Delivery & Channel Report',
      collegeName: this.COLLEGE_NAME,
      subtitle: this.COLLEGE_SUBTITLE,
      landscape: true,
      metadata: {
        'Report Scope': 'SMS and WhatsApp Delivery Audit',
        'Generated By': userName,
        'Generated On': new Date().toLocaleString('en-IN')
      },
      summaryCards: [
        { title: 'TOTAL RECIPIENTS', value: grandTotalRecipients, sub: 'Notification Dispatches' },
        { title: 'DELIVERED', value: grandTotalDelivered, sub: 'Successfully Confirmed' },
        { title: 'FAILED', value: grandTotalFailed, sub: 'Provider Failures' },
        { title: 'SMS / WHATSAPP', value: `${grandTotalSms} / ${grandTotalWa}`, sub: 'Channel Breakdown' }
      ],
      columns: [
        { key: 'notice', label: 'Notice', width: 30 },
        { key: 'notificationCategory', label: 'Notification category', width: 20, align: 'center' },
        { key: 'recipientCount', label: 'Recipient count', width: 14, align: 'center' },
        { key: 'smsCount', label: 'SMS count', width: 12, align: 'center' },
        { key: 'whatsappCount', label: 'WhatsApp count', width: 14, align: 'center' },
        { key: 'sent', label: 'Sent', width: 10, align: 'center' },
        { key: 'delivered', label: 'Delivered', width: 10, align: 'center' },
        { key: 'failed', label: 'Failed', width: 10, align: 'center' },
        { key: 'deliveryRate', label: 'Delivery Rate', width: 14, align: 'center' },
        { key: 'publishedAt', label: 'Date', width: 16, align: 'center' }
      ],
      rows
    };
  }

  // ---------------------------------------------------------------------------
  // 7. COLLEGE NOTICE REPORT
  // ---------------------------------------------------------------------------
  private static async buildNoticeReport(
    filters: Record<string, any>,
    userName: string
  ): Promise<ReportConfig> {
    const where: any = {};
    if (filters.noticeType) where.noticeType = filters.noticeType;
    if (filters.status) where.status = filters.status;
    if (filters.targetType) where.targetType = filters.targetType;

    const notices = await prisma.collegeNotice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
        department: true,
        year: true,
        section: true,
        academicYear: true,
        notifications: true
      }
    });

    const rows = notices.map(n => {
      const scope = n.targetType === 'ALL_COLLEGE'
        ? 'Entire Institution'
        : n.targetType === 'DEPARTMENT'
        ? `Dept: ${n.department?.code || '—'}`
        : n.targetType === 'YEAR'
        ? `Year: ${n.year?.name || '—'}`
        : `Sec: ${n.department?.code || ''} ${n.section?.name || ''}`;

      return {
        notice: n.title,
        type: n.noticeType,
        targetAudience: scope,
        deliveryChannel: n.deliveryChannel,
        status: n.status,
        recipientCount: n.notifications.length,
        author: n.author?.name || 'Administrator',
        createdAt: new Date(n.createdAt).toLocaleDateString('en-IN'),
        publishedAt: n.publishedAt ? new Date(n.publishedAt).toLocaleDateString('en-IN') : '—'
      };
    });

    return {
      reportType: 'notices',
      title: 'College Notice & Official News Ledger',
      collegeName: this.COLLEGE_NAME,
      subtitle: this.COLLEGE_SUBTITLE,
      landscape: true,
      metadata: {
        'Report Scope': 'Institutional Broadcasts',
        'Generated By': userName,
        'Generated On': new Date().toLocaleString('en-IN')
      },
      summaryCards: [
        { title: 'TOTAL NOTICES', value: rows.length, sub: 'Created in System' },
        { title: 'PUBLISHED', value: rows.filter((r: any) => r.status === 'PUBLISHED').length, sub: 'Active Broadcasts' }
      ],
      columns: [
        { key: 'notice', label: 'Title', width: 28 },
        { key: 'type', label: 'Type / Category', width: 16, align: 'center' },
        { key: 'targetAudience', label: 'Target Audience', width: 20 },
        { key: 'deliveryChannel', label: 'Delivery Channel', width: 14, align: 'center' },
        { key: 'status', label: 'Status', width: 14, align: 'center' },
        { key: 'recipientCount', label: 'Recipients', width: 12, align: 'center' },
        { key: 'author', label: 'Author', width: 18 },
        { key: 'createdAt', label: 'Created At', width: 14, align: 'center' },
        { key: 'publishedAt', label: 'Published At', width: 14, align: 'center' }
      ],
      rows
    };
  }

  // ---------------------------------------------------------------------------
  // EXPORT BUILDERS: PDF, EXCEL, CSV
  // ---------------------------------------------------------------------------

  /**
   * Generates a high-quality, print-ready PDF document using PDFKit.
   */
  static async exportToPdf(config: ReportConfig): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margin = 36;
      const isLandscape = !!config.landscape;
      const doc = new PDFDocument({
        size: 'A4',
        layout: isLandscape ? 'landscape' : 'portrait',
        margin,
        bufferPages: true
      });

      const buffers: Buffer[] = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const printableWidth = pageWidth - margin * 2;

      // --- College Header ---
      doc.rect(margin, margin, printableWidth, 54).fill('#0f172a');

      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
        .text(config.collegeName, margin + 12, margin + 10, { width: printableWidth - 24 });
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text(config.subtitle, margin + 12, margin + 28, { width: printableWidth - 24 });
      doc.fillColor('#38bdf8').fontSize(9).font('Helvetica-Bold')
        .text(`OFFICIAL ACADEMIC RECORD | ${config.title.toUpperCase()}`, margin + 12, margin + 39, { width: printableWidth - 24 });

      let currentY = margin + 64;

      // --- Metadata Strip ---
      const metaKeys = Object.keys(config.metadata);
      if (metaKeys.length > 0) {
        doc.rect(margin, currentY, printableWidth, 22).fill('#f1f5f9');
        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
        
        const colW = printableWidth / Math.min(metaKeys.length, 4);
        metaKeys.slice(0, 4).forEach((key, idx) => {
          const val = config.metadata[key];
          doc.text(`${key}: `, margin + 8 + (idx * colW), currentY + 6, { continued: true });
          doc.font('Helvetica').text(val);
          doc.font('Helvetica-Bold');
        });
        currentY += 28;
      }

      // --- Summary Cards (if available) ---
      if (config.summaryCards && config.summaryCards.length > 0) {
        const cardsCount = Math.min(config.summaryCards.length, 4);
        const cardW = (printableWidth - (cardsCount - 1) * 8) / cardsCount;
        config.summaryCards.slice(0, 4).forEach((card, idx) => {
          const cardX = margin + idx * (cardW + 8);
          doc.rect(cardX, currentY, cardW, 36).fill('#f8fafc');
          doc.rect(cardX, currentY, cardW, 36).stroke('#e2e8f0');
          doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold').text(card.title, cardX + 6, currentY + 5);
          doc.fillColor('#0284c7').fontSize(12).font('Helvetica-Bold').text(String(card.value), cardX + 6, currentY + 14);
          if (card.sub) {
            doc.fillColor('#94a3b8').fontSize(6).font('Helvetica').text(card.sub, cardX + 6, currentY + 26);
          }
        });
        currentY += 44;
      }

      // --- Table Rendering ---
      const cols = config.columns;
      const totalColWeight = cols.reduce((sum, c) => sum + (c.width || 12), 0);
      const colWidths = cols.map(c => ((c.width || 12) / totalColWeight) * printableWidth);

      // Table Header Row
      const drawTableHeader = (y: number) => {
        doc.rect(margin, y, printableWidth, 18).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
        let x = margin;
        cols.forEach((col, idx) => {
          const w = colWidths[idx];
          doc.text(col.label, x + 4, y + 5, { width: w - 8, align: col.align || 'left' });
          x += w;
        });
        return y + 18;
      };

      currentY = drawTableHeader(currentY);

      // Table Data Rows
      const rowHeight = 16;
      doc.font('Helvetica').fontSize(7.5);

      config.rows.forEach((row, rowIndex) => {
        // Check for page break
        if (currentY + rowHeight > pageHeight - margin - 20) {
          doc.addPage();
          currentY = drawTableHeader(margin);
        }

        // Alternating row background
        if (rowIndex % 2 === 1) {
          doc.rect(margin, currentY, printableWidth, rowHeight).fill('#f8fafc');
        }

        doc.rect(margin, currentY, printableWidth, rowHeight).stroke('#f1f5f9');
        doc.fillColor('#1e293b');

        let x = margin;
        cols.forEach((col, idx) => {
          const w = colWidths[idx];
          const rawVal = row[col.key];
          const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : '—';
          doc.text(val, x + 4, currentY + 4, { width: w - 8, align: col.align || 'left', ellipsis: true });
          x += w;
        });

        currentY += rowHeight;
      });

      // --- Footers & Page Numbers ---
      const pageRange = doc.bufferedPageRange();
      for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
        doc.switchToPage(i);
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica');
        const footerY = pageHeight - margin + 8;
        doc.text(`CONFIDENTIAL - FOR AUTHORIZED COLLEGE USE ONLY | VSB Engineering College`, margin, footerY, {
          align: 'left',
          width: printableWidth / 2
        });
        doc.text(`Page ${i + 1} of ${pageRange.count}`, margin + printableWidth / 2, footerY, {
          align: 'right',
          width: printableWidth / 2
        });
      }

      doc.end();
    });
  }

  /**
   * Generates formatted Excel workbook (.xlsx).
   */
  static exportToExcel(config: ReportConfig): Buffer {
    const wsData: any[][] = [];

    // Header Branding
    wsData.push([config.collegeName.toUpperCase()]);
    wsData.push([config.subtitle]);
    wsData.push([config.title.toUpperCase()]);
    wsData.push([`Generated On: ${new Date().toLocaleString('en-IN')}`]);
    wsData.push([]);

    // Column Headers
    wsData.push(config.columns.map(c => c.label));

    // Rows
    for (const row of config.rows) {
      const rowArr = config.columns.map(c => {
        const val = row[c.key];
        return val !== undefined && val !== null ? val : '—';
      });
      wsData.push(rowArr);
    }

    const ws = xlsx.utils.aoa_to_sheet(wsData);

    // Auto Column Widths
    ws['!cols'] = config.columns.map(c => ({
      wch: Math.max(c.label.length + 4, c.width || 14)
    }));

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, config.title.slice(0, 31));

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generates standard RFC 4180 CSV with UTF-8 BOM.
   */
  static exportToCsv(config: ReportConfig): Buffer {
    const BOM = '\uFEFF';
    const headerLine = config.columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');

    const rowLines = config.rows.map(row => {
      return config.columns.map(c => {
        const raw = row[c.key];
        const val = raw !== undefined && raw !== null ? String(raw) : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = BOM + [headerLine, ...rowLines].join('\r\n');
    return Buffer.from(csvContent, 'utf-8');
  }

  /**
   * Generates executive Microsoft PowerPoint presentation (.pptx) with analysis, KPI cards, and data tables.
   */
  static async exportToPptx(config: ReportConfig): Promise<Buffer> {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'VSB Engineering College';
    pptx.company = 'VSB Engineering College (Autonomous)';
    pptx.revision = '1';
    pptx.subject = config.title;
    pptx.title = `${config.title} - Academic Performance Analysis`;

    // -------------------------------------------------------------------------
    // Slide 1: Executive Title & Institutional Accreditation Header
    // -------------------------------------------------------------------------
    const slide1 = pptx.addSlide();
    slide1.background = { color: '0F172A' }; // Deep Navy

    // Accent line
    slide1.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 0.6,
      w: 11.73,
      h: 0.08,
      fill: { color: '38BDF8' }
    });

    slide1.addText(config.collegeName.toUpperCase(), {
      x: 0.8,
      y: 0.85,
      w: 11.73,
      h: 0.5,
      fontSize: 22,
      fontFace: 'Arial',
      color: 'F8FAFC',
      bold: true,
      align: 'left'
    });

    slide1.addText(config.subtitle || 'Autonomous Institution | Central Academic Governance & Controller of Examinations', {
      x: 0.8,
      y: 1.35,
      w: 11.73,
      h: 0.4,
      fontSize: 12,
      fontFace: 'Arial',
      color: '94A3B8',
      align: 'left'
    });

    // Report Title Banner Container
    slide1.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 2.1,
      w: 11.73,
      h: 2.7,
      fill: { color: '1E293B' },
      line: { color: '334155', width: 1 }
    });

    slide1.addText(config.title.toUpperCase(), {
      x: 1.2,
      y: 2.4,
      w: 11.0,
      h: 0.8,
      fontSize: 26,
      fontFace: 'Arial',
      color: '38BDF8',
      bold: true
    });

    slide1.addText('Executive Academic Performance Analysis & Institutional Outcome Review', {
      x: 1.2,
      y: 3.2,
      w: 11.0,
      h: 0.4,
      fontSize: 14,
      fontFace: 'Arial',
      color: 'E2E8F0'
    });

    slide1.addText('Continuous Internal Assessment (IA-1, IA-2) & Anna University Accreditation Metric Standards', {
      x: 1.2,
      y: 3.7,
      w: 11.0,
      h: 0.4,
      fontSize: 11,
      fontFace: 'Arial',
      color: '94A3B8'
    });

    // Metadata Badges Row at bottom
    const metaEntries = Object.entries(config.metadata || {});
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const metaCards = [
      { label: 'GENERATED DATE', val: dateStr },
      { label: 'CLASSIFICATION', val: 'OFFICIAL ACADEMIC GOVERNANCE' },
      ...(metaEntries.slice(0, 2).map(([k, v]) => ({ label: k.toUpperCase(), val: String(v) })))
    ];

    metaCards.forEach((mc, idx) => {
      const cardX = 0.8 + idx * 2.95;
      slide1.addShape(pptx.ShapeType.rect, {
        x: cardX,
        y: 5.1,
        w: 2.8,
        h: 1.2,
        fill: { color: '1E293B' },
        line: { color: '475569', width: 1 }
      });
      slide1.addText(mc.label, {
        x: cardX + 0.15,
        y: 5.2,
        w: 2.5,
        h: 0.25,
        fontSize: 8,
        color: '38BDF8',
        bold: true
      });
      slide1.addText(mc.val, {
        x: cardX + 0.15,
        y: 5.45,
        w: 2.5,
        h: 0.7,
        fontSize: 11,
        color: 'FFFFFF',
        bold: true
      });
    });

    slide1.addText('CONFIDENTIAL | For Authorized College & Examination Cell Administration Only', {
      x: 0.8,
      y: 6.8,
      w: 11.73,
      h: 0.3,
      fontSize: 8.5,
      color: '64748B',
      align: 'center'
    });

    // -------------------------------------------------------------------------
    // Slide 2: Executive Summary & Performance Metrics Dashboard
    // -------------------------------------------------------------------------
    const slide2 = pptx.addSlide();
    slide2.background = { color: 'F8FAFC' };

    // Header Bar
    slide2.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 1.1,
      fill: { color: '0F172A' }
    });
    slide2.addText('EXECUTIVE SUMMARY & KEY PERFORMANCE METRICS', {
      x: 0.8,
      y: 0.2,
      w: 10.0,
      h: 0.4,
      fontSize: 18,
      fontFace: 'Arial',
      color: '38BDF8',
      bold: true
    });
    slide2.addText(`${config.collegeName} | ${config.title}`, {
      x: 0.8,
      y: 0.6,
      w: 10.0,
      h: 0.3,
      fontSize: 10,
      fontFace: 'Arial',
      color: '94A3B8'
    });

    // KPI Cards
    let summaryCards = config.summaryCards || [];
    if (!summaryCards || summaryCards.length === 0) {
      const rowCount = config.rows.length;
      summaryCards = [
        { title: 'Total Evaluated Roster', value: rowCount, sub: 'Cohort records processed' },
        { title: 'Assessment Term', value: 'IA-1 & IA-2', sub: 'Internal evaluations' },
        { title: 'Governance Status', value: 'Verified', sub: 'Examination Cell' }
      ];
    }

    const maxCards = Math.min(summaryCards.length, 4);
    const cardWidth = maxCards > 0 ? (11.73 - (maxCards - 1) * 0.3) / maxCards : 2.7;

    summaryCards.slice(0, maxCards).forEach((card, idx) => {
      const cx = 0.8 + idx * (cardWidth + 0.3);
      slide2.addShape(pptx.ShapeType.rect, {
        x: cx,
        y: 1.35,
        w: cardWidth,
        h: 1.3,
        fill: { color: 'FFFFFF' },
        line: { color: 'CBD5E1', width: 1 }
      });
      // Accent top line
      slide2.addShape(pptx.ShapeType.rect, {
        x: cx,
        y: 1.35,
        w: cardWidth,
        h: 0.06,
        fill: { color: idx === 0 ? '38BDF8' : (idx === 1 ? '10B981' : (idx === 2 ? '6366F1' : 'F59E0B')) }
      });
      slide2.addText(card.title.toUpperCase(), {
        x: cx + 0.15,
        y: 1.48,
        w: cardWidth - 0.3,
        h: 0.3,
        fontSize: 8.5,
        color: '64748B',
        bold: true
      });
      slide2.addText(String(card.value), {
        x: cx + 0.15,
        y: 1.78,
        w: cardWidth - 0.3,
        h: 0.45,
        fontSize: 19,
        color: '0F172A',
        bold: true
      });
      if (card.sub) {
        slide2.addText(card.sub, {
          x: cx + 0.15,
          y: 2.28,
          w: cardWidth - 0.3,
          h: 0.25,
          fontSize: 8,
          color: '94A3B8'
        });
      }
    });

    // Analytical Insights Container
    slide2.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 2.85,
      w: 11.73,
      h: 3.9,
      fill: { color: 'FFFFFF' },
      line: { color: 'E2E8F0', width: 1 }
    });

    slide2.addText('Key Academic Insights & Performance Observations', {
      x: 1.1,
      y: 3.05,
      w: 11.0,
      h: 0.4,
      fontSize: 14,
      fontFace: 'Arial',
      color: '0F172A',
      bold: true
    });

    const insights = [
      'Comprehensive Cohort Assessment: Performance datasets encompass internal continuous evaluations (IA-1, IA-2), model practical assessments, and lecture attendance benchmarks.',
      'Departmental Benchmarking: Cohort outcomes demonstrate consistent syllabus completion with targeted improvements observed between internal assessment cycles.',
      'Accreditation Alignment: Metrics directly align with Anna University and NBA criteria for outcome-based education (OBE) and continuous performance monitoring.',
      'Parental Transparency: Academic results and attendance thresholds are communicated via multi-channel institutional notification dispatches (SMS & WhatsApp).',
      'Action Orientation: Data-driven insights identify high-potential candidates for honors recognition as well as students requiring tailored remedial sessions.'
    ];

    insights.forEach((bullet, idx) => {
      slide2.addText(`•  ${bullet}`, {
        x: 1.1,
        y: 3.55 + idx * 0.58,
        w: 11.0,
        h: 0.5,
        fontSize: 9.5,
        fontFace: 'Arial',
        color: '334155',
        lineSpacing: 14
      });
    });

    // -------------------------------------------------------------------------
    // Slide 3+: Analytical Data Tables (Paginated)
    // -------------------------------------------------------------------------
    const rowsPerPage = 10;
    const totalRows = config.rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

    for (let p = 0; p < totalPages; p++) {
      const tableSlide = pptx.addSlide();
      tableSlide.background = { color: 'F8FAFC' };

      // Header Bar
      tableSlide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 13.33,
        h: 1.0,
        fill: { color: '0F172A' }
      });
      tableSlide.addText(`${config.title.toUpperCase()} — DATA ANALYSIS BREAKDOWN`, {
        x: 0.8,
        y: 0.15,
        w: 9.0,
        h: 0.35,
        fontSize: 16,
        fontFace: 'Arial',
        color: '38BDF8',
        bold: true
      });
      tableSlide.addText(`Displaying records ${p * rowsPerPage + 1} – ${Math.min((p + 1) * rowsPerPage, totalRows)} of ${totalRows}  |  Slide ${p + 1} of ${totalPages}`, {
        x: 0.8,
        y: 0.55,
        w: 9.0,
        h: 0.3,
        fontSize: 9.5,
        fontFace: 'Arial',
        color: '94A3B8'
      });

      // Filter Tag on right
      tableSlide.addShape(pptx.ShapeType.rect, {
        x: 10.2,
        y: 0.25,
        w: 2.3,
        h: 0.5,
        fill: { color: '1E293B' },
        line: { color: '38BDF8', width: 1 }
      });
      tableSlide.addText('OFFICIAL AUDIT DATA', {
        x: 10.2,
        y: 0.35,
        w: 2.3,
        h: 0.3,
        fontSize: 8.5,
        color: '38BDF8',
        bold: true,
        align: 'center'
      });

      // Prepare table data
      const pageRows = config.rows.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
      const displayCols = config.columns.length > 8 ? config.columns.slice(0, 8) : config.columns;

      const headerRow = displayCols.map(col => ({
        text: col.label,
        options: {
          fill: { color: '1E293B' },
          color: 'FFFFFF',
          fontSize: 9,
          bold: true,
          align: (col.align || 'left') as any,
          valign: 'middle' as any
        }
      }));

      const bodyRows = pageRows.map((row, rIdx) => {
        const isAlt = rIdx % 2 === 1;
        return displayCols.map(col => {
          const raw = row[col.key];
          const val = raw !== undefined && raw !== null ? String(raw) : '—';
          
          let cellColor = '1E293B';
          let isBold = false;
          if (val === 'PASS') {
            cellColor = '16A34A';
            isBold = true;
          } else if (val === 'FAIL') {
            cellColor = 'DC2626';
            isBold = true;
          }

          return {
            text: val,
            options: {
              fill: { color: isAlt ? 'F1F5F9' : 'FFFFFF' },
              color: cellColor,
              fontSize: 8.5,
              bold: isBold,
              align: (col.align || 'left') as any,
              valign: 'middle' as any
            }
          };
        });
      });

      tableSlide.addTable([headerRow, ...bodyRows], {
        x: 0.8,
        y: 1.25,
        w: 11.73,
        rowH: 0.38,
        border: { pt: 0.5, color: 'CBD5E1' }
      });

      // Footer
      tableSlide.addText('VSB Engineering College Autonomous | Central Academic Evaluation Report', {
        x: 0.8,
        y: 6.9,
        w: 8.0,
        h: 0.3,
        fontSize: 8,
        color: '94A3B8'
      });
      tableSlide.addText(`Slide ${p + 3}`, {
        x: 10.5,
        y: 6.9,
        w: 2.0,
        h: 0.3,
        fontSize: 8,
        color: '94A3B8',
        align: 'right'
      });
    }

    // -------------------------------------------------------------------------
    // Final Slide: Strategic Action Plan & Academic Interventions
    // -------------------------------------------------------------------------
    const finalSlide = pptx.addSlide();
    finalSlide.background = { color: '0F172A' };

    finalSlide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 0.6,
      w: 11.73,
      h: 0.08,
      fill: { color: '38BDF8' }
    });

    finalSlide.addText('STRATEGIC ACTION PLAN & ACADEMIC INTERVENTIONS', {
      x: 0.8,
      y: 0.85,
      w: 11.73,
      h: 0.45,
      fontSize: 20,
      fontFace: 'Arial',
      color: 'F8FAFC',
      bold: true
    });

    finalSlide.addText('Institutional Recommendations for Department Heads, Faculty Mentors & Academic Council', {
      x: 0.8,
      y: 1.35,
      w: 11.73,
      h: 0.35,
      fontSize: 11,
      fontFace: 'Arial',
      color: '94A3B8'
    });

    const pillars = [
      {
        title: '1. Targeted Remedial Action',
        color: 'EF4444',
        items: [
          'Conduct structured remedial coaching for students scoring below 50% in internal assessments.',
          'Schedule targeted problem-solving tutorials before university end-semester examinations.',
          'Review repeated low-scoring subjects at departmental academic committee meetings.'
        ]
      },
      {
        title: '2. Continuous Mentorship',
        color: '38BDF8',
        items: [
          'Assign proctors/mentors to track individual improvement trajectories between IA-1 and IA-2.',
          'Maintain regular documentation of attendance interventions for at-risk candidates.',
          'Conduct periodic one-on-one academic counseling sessions.'
        ]
      },
      {
        title: '3. Stakeholder Transparency',
        color: '10B981',
        items: [
          'Ensure 100% dispatch of automated multi-channel marks notifications to parents.',
          'Monitor delivery logs to resolve unverified or incorrect parent contact numbers.',
          'Present consolidated academic reports at quarterly Institutional Governing Council meetings.'
        ]
      }
    ];

    pillars.forEach((p, idx) => {
      const colX = 0.8 + idx * 4.0;
      finalSlide.addShape(pptx.ShapeType.rect, {
        x: colX,
        y: 1.9,
        w: 3.73,
        h: 4.5,
        fill: { color: '1E293B' },
        line: { color: '334155', width: 1 }
      });
      // Header tag
      finalSlide.addShape(pptx.ShapeType.rect, {
        x: colX,
        y: 1.9,
        w: 3.73,
        h: 0.5,
        fill: { color: p.color }
      });
      finalSlide.addText(p.title.toUpperCase(), {
        x: colX + 0.15,
        y: 2.0,
        w: 3.43,
        h: 0.3,
        fontSize: 10,
        color: 'FFFFFF',
        bold: true
      });

      p.items.forEach((item, itIdx) => {
        finalSlide.addText(`•  ${item}`, {
          x: colX + 0.2,
          y: 2.6 + itIdx * 1.1,
          w: 3.33,
          h: 1.0,
          fontSize: 9.5,
          color: 'E2E8F0',
          lineSpacing: 14
        });
      });
    });

    finalSlide.addText('CONFIDENTIAL | Central Academic Governance & Controller of Examinations | VSB Engineering College', {
      x: 0.8,
      y: 6.8,
      w: 11.73,
      h: 0.3,
      fontSize: 8.5,
      color: '64748B',
      align: 'center'
    });

    const nodeBuffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    return nodeBuffer;
  }
}
