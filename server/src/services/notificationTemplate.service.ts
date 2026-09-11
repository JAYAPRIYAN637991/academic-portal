/**
 * Centralized Notification Template Service
 * 
 * Generates standardized, concise parent notification messages suitable for SMS and WhatsApp.
 * Supports:
 * 1. PERFORMANCE: Ward academic marks, IA-1/IA-2, improvement/decline, subject breakdown.
 * 2. COLLEGE_NOTICE: Holiday, Internal Exam, Semester Exam, Reopening, Academic, Urgent, General.
 */

import { NoticeType, NotificationCategory } from '@prisma/client';
import { StudentPerformanceReport } from './academicPerformance.service';

export interface PerformanceMessageData {
  studentName: string;
  registerNumber: string;
  parentName?: string;
  ia1Percentage?: number | null;
  ia2Percentage?: number | null;
  improvement?: number | null;
  progressionStatus?: 'IMPROVED' | 'DECLINED' | 'NO_CHANGE' | 'MISSING_DATA';
  improvedSubjects?: string[];
  attentionSubjects?: string[];
  overallPercentage?: number;
  overallLevel?: string;
  customNote?: string;
}

export interface CollegeNoticeMessageData {
  noticeType: NoticeType;
  title: string;
  content: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  departmentName?: string;
  yearName?: string;
  sectionName?: string;
}

export class NotificationTemplateService {
  /**
   * Helper to format Date cleanly as "10 September 2026" or "10 Sep 2026"
   */
  static formatDate(d?: string | Date | null): string | null {
    if (!d) return null;
    try {
      const dateObj = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(dateObj.getTime())) return null;
      return dateObj.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return null;
    }
  }

  /**
   * Generates a standardized parent performance update message.
   * Suitable for both SMS and WhatsApp.
   */
  static generatePerformanceMessage(data: PerformanceMessageData): string {
    const studentName = data.studentName || 'Student';
    const registerNo = data.registerNumber || '—';

    const ia1Str = (data.ia1Percentage !== null && data.ia1Percentage !== undefined)
      ? `${Math.round(data.ia1Percentage)}%`
      : 'Not Evaluated';

    const ia2Str = (data.ia2Percentage !== null && data.ia2Percentage !== undefined)
      ? `${Math.round(data.ia2Percentage)}%`
      : 'Not Evaluated';

    let improvementStr = '—';
    if (data.improvement !== null && data.improvement !== undefined) {
      const imp = Math.round(data.improvement);
      if (imp > 0) {
        improvementStr = `+${imp} percentage points`;
      } else if (imp < 0) {
        improvementStr = `${imp} percentage points`;
      } else {
        improvementStr = `0 percentage points (No change)`;
      }
    } else if (data.progressionStatus === 'MISSING_DATA') {
      improvementStr = 'Incomplete Assessment Data';
    }

    const improvedList = (data.improvedSubjects && data.improvedSubjects.length > 0)
      ? data.improvedSubjects.join(', ')
      : 'None';

    const attentionList = (data.attentionSubjects && data.attentionSubjects.length > 0)
      ? data.attentionSubjects.join(', ')
      : 'None (All subjects meeting standard)';

    let closingAdvice = 'Please encourage your ward to continue improving.';
    if (data.progressionStatus === 'DECLINED') {
      closingAdvice = 'Please support and encourage your ward to focus on academic studies.';
    } else if (data.overallLevel === 'Excellent' || data.overallLevel === 'Very Good') {
      closingAdvice = 'Congratulations on your ward\'s commendable academic performance!';
    }

    return [
      'Dear Parent,',
      '',
      'Performance update for your ward:',
      '',
      `Student: ${studentName}`,
      `Register No: ${registerNo}`,
      '',
      `IA-1: ${ia1Str}`,
      `IA-2: ${ia2Str}`,
      '',
      `Improvement: ${improvementStr}`,
      '',
      'Improved Subjects:',
      improvedList,
      '',
      'Subjects Needing Attention:',
      attentionList,
      '',
      closingAdvice
    ].join('\n');
  }

  /**
   * Generates a parent performance message directly from a StudentPerformanceReport.
   */
  static generatePerformanceMessageFromReport(report: StudentPerformanceReport): string {
    const improvedSubjects: string[] = [];
    const attentionSubjects: string[] = [];

    if (report.subjectBreakdown && report.subjectBreakdown.length > 0) {
      for (const sb of report.subjectBreakdown) {
        const name = sb.subjectName || sb.subjectCode;
        if (sb.status === 'IMPROVED' || (sb.difference !== null && sb.difference > 0)) {
          improvedSubjects.push(name);
        }
        if (sb.overallLevel === 'Needs Attention' || sb.status === 'DECLINED' || sb.overallPercentage < 60) {
          attentionSubjects.push(name);
        }
      }
    }

    return this.generatePerformanceMessage({
      studentName: report.studentName || 'Student',
      registerNumber: report.registerNumber || '—',
      ia1Percentage: report.ia1Percentage,
      ia2Percentage: report.ia2Percentage,
      improvement: report.improvement,
      progressionStatus: report.progressionStatus,
      improvedSubjects,
      attentionSubjects,
      overallPercentage: report.percentage,
      overallLevel: report.performanceStatus
    });
  }

  /**
   * Generates a standardized College Notice message based on NoticeType.
   */
  static generateCollegeNoticeMessage(data: CollegeNoticeMessageData): string {
    const title = data.title ? data.title.trim() : '';
    const content = data.content ? data.content.trim() : '';
    const startStr = this.formatDate(data.startDate);
    const endStr = this.formatDate(data.endDate);

    switch (data.noticeType) {
      case NoticeType.HOLIDAY: {
        let dateText = startStr || 'the declared date';
        if (startStr && endStr && startStr !== endStr) {
          dateText = `${startStr} to ${endStr}`;
        }
        return [
          'Dear Parent,',
          '',
          'College Notice:',
          '',
          content || `The college will remain closed on ${dateText} due to a declared holiday.`,
          '',
          'Regards,',
          'College Administration'
        ].join('\n');
      }

      case NoticeType.INTERNAL_EXAM: {
        const examStart = startStr ? `from ${startStr}` : 'as per schedule';
        return [
          'Dear Parent,',
          '',
          'Important College Notice:',
          '',
          content || `Internal Assessment-2 examinations will begin ${examStart}.`,
          '',
          'Please ensure that your ward is prepared and follows the examination schedule.',
          '',
          'Regards,',
          'College Administration'
        ].join('\n');
      }

      case NoticeType.SEMESTER_EXAM: {
        const semStart = startStr ? `from ${startStr}` : 'as per schedule';
        return [
          'Dear Parent,',
          '',
          'Semester Examination Notice:',
          '',
          content || `Semester examinations will begin ${semStart}.`,
          '',
          'Please refer to the official examination schedule for details.',
          '',
          'Regards,',
          'College Administration'
        ].join('\n');
      }

      case NoticeType.COLLEGE_REOPENING: {
        const reopenDate = startStr ? `on ${startStr}` : 'as scheduled';
        return [
          'Dear Parent,',
          '',
          'College Notice:',
          '',
          content || `The college will reopen ${reopenDate}.`,
          '',
          'Regards,',
          'College Administration'
        ].join('\n');
      }

      case NoticeType.EXAM_TIMETABLE: {
        return [
          'Dear Parent,',
          '',
          'Examination Timetable Notice:',
          '',
          title ? `${title}` : 'Examination Timetable Released',
          '',
          content || 'The official examination timetable has been finalized and released.',
          '',
          'Please verify the schedule on the academic portal.',
          '',
          'Regards,',
          'Office of the Controller of Examinations'
        ].join('\n');
      }

      case NoticeType.ACADEMIC: {
        return [
          'Dear Parent,',
          '',
          'Academic Instruction:',
          '',
          title ? `${title}:` : 'Notice:',
          content,
          '',
          'Regards,',
          'College Administration'
        ].join('\n');
      }

      case NoticeType.URGENT: {
        return [
          'Dear Parent,',
          '',
          'URGENT COLLEGE NOTICE:',
          '',
          title ? `${title}:` : 'Notice:',
          content,
          '',
          'Please take immediate note of this instruction.',
          '',
          'Regards,',
          'College Administration'
        ].join('\n');
      }

      case NoticeType.GENERAL:
      default: {
        return [
          'Dear Parent,',
          '',
          'Important College Notice:',
          '',
          content || title || 'Important academic instructions have been announced by the college.',
          '',
          'Regards,',
          'College Administration'
        ].join('\n');
      }
    }
  }

  /**
   * Unified dispatcher for any notification category.
   */
  static generateMessage(category: NotificationCategory, data: any): string {
    if (category === NotificationCategory.PERFORMANCE) {
      return this.generatePerformanceMessage(data);
    }
    return this.generateCollegeNoticeMessage(data);
  }

  /**
   * Returns ready-to-use sample templates for all notice types and performance scenarios.
   */
  static getSampleTemplates(): Record<string, string> {
    return {
      PERFORMANCE_IMPROVED: this.generatePerformanceMessage({
        studentName: 'Arun Kumar',
        registerNumber: '23CSE101',
        ia1Percentage: 72,
        ia2Percentage: 84,
        improvement: 12,
        progressionStatus: 'IMPROVED',
        improvedSubjects: ['Java', 'DBMS'],
        attentionSubjects: ['Computer Networks']
      }),
      PERFORMANCE_DECLINED: this.generatePerformanceMessage({
        studentName: 'Priya Sharma',
        registerNumber: '23ECE042',
        ia1Percentage: 78,
        ia2Percentage: 65,
        improvement: -13,
        progressionStatus: 'DECLINED',
        improvedSubjects: [],
        attentionSubjects: ['Digital Electronics', 'Signals & Systems']
      }),
      HOLIDAY: this.generateCollegeNoticeMessage({
        noticeType: NoticeType.HOLIDAY,
        title: 'Declared Holiday',
        content: 'The college will remain closed on 10 September 2026 due to a declared holiday.',
        startDate: '2026-09-10'
      }),
      INTERNAL_EXAM: this.generateCollegeNoticeMessage({
        noticeType: NoticeType.INTERNAL_EXAM,
        title: 'Internal Assessment-2',
        content: 'Internal Assessment-2 examinations will begin from 15 September 2026.',
        startDate: '2026-09-15'
      }),
      SEMESTER_EXAM: this.generateCollegeNoticeMessage({
        noticeType: NoticeType.SEMESTER_EXAM,
        title: 'Semester Examinations',
        content: 'Semester examinations will begin from 20 November 2026.',
        startDate: '2026-11-20'
      }),
      COLLEGE_REOPENING: this.generateCollegeNoticeMessage({
        noticeType: NoticeType.COLLEGE_REOPENING,
        title: 'College Reopening',
        content: 'The college will reopen on 5 October 2026.',
        startDate: '2026-10-05'
      }),
      GENERAL: this.generateCollegeNoticeMessage({
        noticeType: NoticeType.GENERAL,
        title: 'General Academic Announcement',
        content: 'Important academic instructions have been announced by the college.'
      }),
      URGENT: this.generateCollegeNoticeMessage({
        noticeType: NoticeType.URGENT,
        title: 'Severe Weather Alert',
        content: 'Due to severe weather warnings, college will suspend afternoon classes today.'
      })
    };
  }
}
