/**
 * Audit Service
 * 
 * Centralized, immutable auditing engine tracking administrative actions,
 * faculty operations, and mark revisions across the institution.
 */

import { prisma } from '../db';

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  STUDENT_CREATED = 'STUDENT_CREATED',
  STUDENT_UPDATED = 'STUDENT_UPDATED',
  STUDENT_IMPORTED = 'STUDENT_IMPORTED',
  STAFF_CREATED = 'STAFF_CREATED',
  STAFF_ASSIGNMENT_CHANGED = 'STAFF_ASSIGNMENT_CHANGED',
  MARKS_UPLOADED = 'MARKS_UPLOADED',
  MARKS_UPDATED = 'MARKS_UPDATED',
  PERFORMANCE_PUBLISHED = 'PERFORMANCE_PUBLISHED',
  COLLEGE_NOTICE_CREATED = 'COLLEGE_NOTICE_CREATED',
  COLLEGE_NOTICE_PUBLISHED = 'COLLEGE_NOTICE_PUBLISHED',
  NOTIFICATION_SENT = 'NOTIFICATION_SENT',
  REPORT_GENERATED = 'REPORT_GENERATED'
}

export interface LogAuditParams {
  userId: string;
  action: AuditAction | string;
  entity: string;
  entityId: string;
  metadata?: Record<string, any> | null;
}

export interface GetAuditLogsParams {
  action?: string;
  entity?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export interface GetMarkChangeLogsParams {
  studentId?: string;
  subjectId?: string;
  assessmentId?: string;
  changedBy?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export class AuditService {
  /**
   * Records a permanent, immutable audit log entry.
   */
  static async log(params: LogAuditParams) {
    try {
      const entry = await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          metadata: params.metadata || {}
        }
      });
      return entry;
    } catch (err: any) {
      console.error(`[AuditService] Failed to record audit log (${params.action}):`, err.message);
      return null;
    }
  }

  /**
   * Retrieves paginated, multi-filtered audit logs with user details.
   */
  static async getAuditLogs(params: GetAuditLogsParams) {
    const where: any = {};

    if (params.action) {
      where.action = params.action;
    }

    if (params.entity) {
      where.entity = params.entity;
    }

    if (params.userId) {
      where.userId = params.userId;
    }

    // Date filtering
    if (params.date) {
      const d = new Date(params.date);
      if (!isNaN(d.getTime())) {
        const start = new Date(d);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setUTCHours(23, 59, 59, 999);
        where.createdAt = { gte: start, lte: end };
      }
    } else if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        const start = new Date(params.startDate);
        if (!isNaN(start.getTime())) where.createdAt.gte = start;
      }
      if (params.endDate) {
        const end = new Date(params.endDate);
        if (!isNaN(end.getTime())) where.createdAt.lte = end;
      }
    }

    // Free text search
    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entity: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const [logs, totalItems, actionCounts] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true }
      })
    ]);

    // Aggregate summary action counts
    const summary = {
      total: totalItems,
      logins: 0,
      studentEvents: 0,
      staffEvents: 0,
      marksEvents: 0,
      noticeEvents: 0,
      notificationEvents: 0,
      reports: 0
    };

    for (const group of actionCounts) {
      const c = group._count.action;
      if (group.action === AuditAction.LOGIN || group.action === AuditAction.LOGOUT) {
        summary.logins += c;
      } else if (group.action.startsWith('STUDENT_')) {
        summary.studentEvents += c;
      } else if (group.action.startsWith('STAFF_')) {
        summary.staffEvents += c;
      } else if (group.action.startsWith('MARKS_')) {
        summary.marksEvents += c;
      } else if (group.action.startsWith('COLLEGE_NOTICE_')) {
        summary.noticeEvents += c;
      } else if (group.action === AuditAction.NOTIFICATION_SENT) {
        summary.notificationEvents += c;
      } else if (group.action === AuditAction.REPORT_GENERATED || group.action === AuditAction.PERFORMANCE_PUBLISHED) {
        summary.reports += c;
      }
    }

    const countsMap: Record<string, number> = {};
    for (const group of actionCounts) {
      countsMap[group.action] = group._count.action;
    }

    return {
      total: totalItems,
      summary,
      actionCounts: countsMap,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit)
      },
      logs
    };
  }

  /**
   * Retrieves paginated, multi-filtered Mark Change History ledger.
   * Every record includes: Student, Register Number, Subject, Assessment, Previous Mark, New Mark, Changed By, Reason, Date/Time.
   */
  static async getMarkChangeLogs(params: GetMarkChangeLogsParams) {
    const where: any = {};

    if (params.studentId) where.studentId = params.studentId;
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.assessmentId) where.assessmentId = params.assessmentId;
    if (params.changedBy) where.changedBy = params.changedBy;

    // Date filtering
    if (params.date) {
      const d = new Date(params.date);
      if (!isNaN(d.getTime())) {
        const start = new Date(d);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setUTCHours(23, 59, 59, 999);
        where.createdAt = { gte: start, lte: end };
      }
    } else if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        const start = new Date(params.startDate);
        if (!isNaN(start.getTime())) where.createdAt.gte = start;
      }
      if (params.endDate) {
        const end = new Date(params.endDate);
        if (!isNaN(end.getTime())) where.createdAt.lte = end;
      }
    }

    // Search query
    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { student: { name: { contains: q, mode: 'insensitive' } } },
        { student: { registerNumber: { contains: q, mode: 'insensitive' } } },
        { subject: { name: { contains: q, mode: 'insensitive' } } },
        { subject: { code: { contains: q, mode: 'insensitive' } } },
        { assessment: { name: { contains: q, mode: 'insensitive' } } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { reason: { contains: q, mode: 'insensitive' } }
      ];
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const [logs, totalItems] = await Promise.all([
      prisma.markChangeLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              registerNumber: true,
              department: { select: { id: true, code: true, name: true } },
              section: { select: { id: true, name: true } }
            }
          },
          subject: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          assessment: {
            select: {
              id: true,
              code: true,
              name: true,
              maximumMarks: true
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }),
      prisma.markChangeLog.count({ where })
    ]);

    // Format records with score difference
    const sanitizedLogs = logs.map(l => {
      const difference = Number((l.newMarks - l.previousMarks).toFixed(2));
      return {
        id: l.id,
        markId: l.markId,
        studentId: l.studentId,
        student: l.student,
        subject: l.subject,
        assessment: l.assessment,
        changer: l.user,
        user: l.user,
        studentName: l.student?.name || '—',
        registerNumber: l.student?.registerNumber || '—',
        departmentCode: l.student?.department?.code || '—',
        sectionName: l.student?.section?.name || '—',
        subjectId: l.subjectId,
        subjectCode: l.subject?.code || '—',
        subjectName: l.subject?.name || '—',
        assessmentId: l.assessmentId,
        assessmentCode: l.assessment?.code || '—',
        assessmentName: l.assessment?.name || '—',
        maximumMarks: l.assessment?.maximumMarks || 100,
        previousMarks: l.previousMarks,
        newMarks: l.newMarks,
        difference,
        changedById: l.changedBy,
        changedByName: l.user?.name || '—',
        changedByEmail: l.user?.email || '—',
        changedByRole: l.user?.role || '—',
        reason: l.reason || 'No reason specified',
        createdAt: l.createdAt
      };
    });

    return {
      total: totalItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit)
      },
      logs: sanitizedLogs,
      changeLogs: sanitizedLogs
    };
  }
}
