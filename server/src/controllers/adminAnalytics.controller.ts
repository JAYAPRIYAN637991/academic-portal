import { Request, Response } from 'express';
import { AdminAnalyticsService } from '../services/adminAnalytics.service';

export class AdminAnalyticsController {
  /**
   * GET /api/admin/analytics/overall
   * Comprehensive College-wide analytics.
   * Includes total students/depts/years/sections, IA-1/IA-2 averages, improvement,
   * pass percentage, department/year/section rankings, subject performance,
   * Top 10, Bottom 10, Most Improved, and Attention lists.
   */
  static async getOverallAnalytics(req: Request, res: Response) {
    try {
      const academicYearId = req.query.academicYearId as string | undefined;
      const data = await AdminAnalyticsService.getOverallCollegeAnalytics(academicYearId);
      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Error fetching overall college analytics:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch overall college analytics',
        code: 'OVERALL_ANALYTICS_ERROR'
      });
    }
  }

  /**
   * GET /api/admin/analytics/departments
   * Department Comparative Analytics across all active departments.
   */
  static async getDepartmentAnalytics(req: Request, res: Response) {
    try {
      const academicYearId = req.query.academicYearId as string | undefined;
      const data = await AdminAnalyticsService.getDepartmentAnalytics(academicYearId);
      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Error fetching department analytics:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch department analytics',
        code: 'DEPARTMENT_ANALYTICS_ERROR'
      });
    }
  }

  /**
   * GET /api/admin/analytics/years
   * Year-wise Comparative Analytics (1st, 2nd, 3rd, 4th Year).
   */
  static async getYearWiseAnalytics(req: Request, res: Response) {
    try {
      const academicYearId = req.query.academicYearId as string | undefined;
      const data = await AdminAnalyticsService.getYearWiseAnalytics(academicYearId);
      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Error fetching year-wise analytics:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch year-wise analytics',
        code: 'YEAR_ANALYTICS_ERROR'
      });
    }
  }

  /**
   * GET /api/admin/analytics/sections
   * Section Analytics: Detailed analytics for a specific section or list of all sections.
   */
  static async getSectionAnalytics(req: Request, res: Response) {
    try {
      const sectionId = req.query.sectionId as string | undefined;
      const academicYearId = req.query.academicYearId as string | undefined;
      const data = await AdminAnalyticsService.getSectionAnalytics(sectionId, academicYearId);
      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Error fetching section analytics:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch section analytics',
        code: 'SECTION_ANALYTICS_ERROR'
      });
    }
  }

  /**
   * GET /api/admin/analytics/drilldown
   * Hierarchical Drilldown: College -> Department -> Year -> Section -> Subject -> Student
   */
  static async getDrilldown(req: Request, res: Response) {
    try {
      const {
        level,
        academicYearId,
        departmentId,
        yearId,
        sectionId,
        subjectId,
        studentId
      } = req.query;

      const data = await AdminAnalyticsService.getDrilldownNode({
        level: level as string | undefined,
        academicYearId: academicYearId as string | undefined,
        departmentId: departmentId as string | undefined,
        yearId: yearId as string | undefined,
        sectionId: sectionId as string | undefined,
        subjectId: subjectId as string | undefined,
        studentId: studentId as string | undefined
      });

      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Error fetching hierarchical drilldown:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch drilldown node',
        code: 'DRILLDOWN_ERROR'
      });
    }
  }
}
