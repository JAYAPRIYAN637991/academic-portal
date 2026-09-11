/**
 * Notification Service
 * 
 * Manages parent message formatting, recipient audience resolution,
 * phone number masking, and unified asynchronous SMS / WhatsApp notification dispatch
 * across PERFORMANCE and COLLEGE_NOTICE categories using BullMQ, Redis, and resilient background queues.
 */

import { prisma } from '../db';
import { NoticeTargetType, NoticeType, NotificationCategory, NotificationStatus, NotificationType } from '@prisma/client';
import { NotificationTemplateService } from './notificationTemplate.service';
import { AcademicPerformanceService } from './academicPerformance.service';
import { NotificationQueue, NotificationJobData, NotificationStatusCounts } from '../queue';

export interface RecipientInfo {
  studentId: string;
  studentName: string;
  registerNumber: string;
  parentName: string;
  parentMobile: string;
  maskedMobile: string;
  departmentCode: string;
  yearName: string;
  sectionName: string;
}

export interface RecipientPreviewResult {
  targetDescription: string;
  totalStudents: number;
  totalParents: number;
  channels: string[];
  formattedMessage: string;
  sampleRecipients: RecipientInfo[];
}

export interface DispatchPerformanceParams {
  studentId: string;
  channel?: 'SMS' | 'WHATSAPP' | 'BOTH' | string;
  simulateFailure?: boolean;
}

export interface DispatchSectionPerformanceParams {
  sectionId: string;
  channel?: 'SMS' | 'WHATSAPP' | 'BOTH' | string;
  simulateFailure?: boolean;
}

export class NotificationService {
  /**
   * Masks a phone number for privacy in the UI (e.g., "+91 98****3210" or "98****3210").
   */
  static maskPhoneNumber(phone: string): string {
    if (!phone) return '—';
    const clean = phone.trim();
    if (clean.length <= 4) return clean;
    if (clean.length <= 7) {
      return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
    }
    const start = clean.slice(0, 4);
    const end = clean.slice(-4);
    return `${start}****${end}`;
  }

  /**
   * Formats exact message text for parent communication based on notice category and dates.
   * Delegates to centralized NotificationTemplateService.
   */
  static formatNoticeMessage(notice: {
    title: string;
    content: string;
    noticeType: NoticeType;
    startDate?: Date | null;
    endDate?: Date | null;
  }): string {
    return NotificationTemplateService.generateCollegeNoticeMessage(notice);
  }

  /**
   * Formats performance update message for a student's parent.
   */
  static formatPerformanceMessage(report: any): string {
    return NotificationTemplateService.generatePerformanceMessageFromReport(report);
  }

  /**
   * Resolves human-readable target scope description (e.g. "CSE - 3rd Year - Section A" or "All College").
   */
  static async getTargetDescription(params: {
    targetType: NoticeTargetType;
    departmentId?: string | null;
    yearId?: string | null;
    sectionId?: string | null;
  }): Promise<string> {
    if (params.targetType === NoticeTargetType.ALL_COLLEGE) {
      return 'All College (Entire Student Body)';
    }

    if (params.targetType === NoticeTargetType.DEPARTMENT && params.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: params.departmentId } });
      return dept ? `Department: ${dept.code} - ${dept.name}` : 'Selected Department';
    }

    if (params.targetType === NoticeTargetType.YEAR && params.yearId) {
      const yr = await prisma.year.findUnique({ where: { id: params.yearId } });
      let desc = yr ? `Year: ${yr.name}` : 'Selected Year';
      if (params.departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: params.departmentId } });
        if (dept) desc = `${dept.code} - ${desc}`;
      }
      return desc;
    }

    if (params.targetType === NoticeTargetType.SECTION && params.sectionId) {
      const sec = await prisma.section.findUnique({
        where: { id: params.sectionId },
        include: { department: true, year: true }
      });
      return sec
        ? `${sec.department.code} - ${sec.year.name} - Section ${sec.name}`
        : 'Selected Class Section';
    }

    return 'Target Audience (Custom)';
  }

  /**
   * Queries active students matching target criteria to resolve recipients and parent mobile numbers.
   */
  static async findMatchingRecipients(params: {
    targetType: NoticeTargetType;
    academicYearId?: string | null;
    departmentId?: string | null;
    yearId?: string | null;
    sectionId?: string | null;
  }): Promise<RecipientInfo[]> {
    const whereClause: any = {
      status: 'ACTIVE'
    };

    if (params.academicYearId) {
      whereClause.academicYearId = params.academicYearId;
    }

    if (params.targetType === NoticeTargetType.ALL_COLLEGE) {
      // All active students
    } else if (params.targetType === NoticeTargetType.DEPARTMENT && params.departmentId) {
      whereClause.departmentId = params.departmentId;
    } else if (params.targetType === NoticeTargetType.YEAR && params.yearId) {
      whereClause.yearId = params.yearId;
      if (params.departmentId) {
        whereClause.departmentId = params.departmentId;
      }
    } else if (params.targetType === NoticeTargetType.SECTION && params.sectionId) {
      whereClause.sectionId = params.sectionId;
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        department: true,
        year: true,
        section: true
      },
      orderBy: { registerNumber: 'asc' }
    });

    return students.map(s => ({
      studentId: s.id,
      studentName: s.name,
      registerNumber: s.registerNumber,
      parentName: s.parentName,
      parentMobile: s.parentMobile,
      maskedMobile: this.maskPhoneNumber(s.parentMobile),
      departmentCode: s.department.code,
      yearName: s.year.name,
      sectionName: s.section.name
    }));
  }

  /**
   * Generates a preview with recipient count and formatted text before notice is published.
   */
  static async getRecipientsPreview(notice: {
    title: string;
    content: string;
    noticeType: NoticeType;
    targetType: NoticeTargetType;
    deliveryChannel?: string;
    academicYearId?: string | null;
    departmentId?: string | null;
    yearId?: string | null;
    sectionId?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  }): Promise<RecipientPreviewResult> {
    const [targetDescription, recipients] = await Promise.all([
      this.getTargetDescription({
        targetType: notice.targetType,
        departmentId: notice.departmentId,
        yearId: notice.yearId,
        sectionId: notice.sectionId
      }),
      this.findMatchingRecipients({
        targetType: notice.targetType,
        academicYearId: notice.academicYearId,
        departmentId: notice.departmentId,
        yearId: notice.yearId,
        sectionId: notice.sectionId
      })
    ]);

    // Unique parent mobile numbers
    const uniqueParents = new Set(recipients.map(r => r.parentMobile.trim()));

    const channels: string[] = [];
    const channelSetting = (notice.deliveryChannel || 'BOTH').toUpperCase();
    if (channelSetting === 'SMS' || channelSetting === 'BOTH') channels.push('SMS');
    if (channelSetting === 'WHATSAPP' || channelSetting === 'BOTH') channels.push('WhatsApp');

    const formattedMessage = this.formatNoticeMessage({
      title: notice.title,
      content: notice.content,
      noticeType: notice.noticeType,
      startDate: notice.startDate,
      endDate: notice.endDate
    });

    return {
      targetDescription,
      totalStudents: recipients.length,
      totalParents: uniqueParents.size,
      channels,
      formattedMessage,
      sampleRecipients: recipients.slice(0, 10)
    };
  }

  /**
   * Dispatches parent notifications for a published notice asynchronously via BullMQ / Redis.
   * Creates PENDING notification records, queues jobs, and immediately returns success without blocking.
   */
  static async dispatchNoticeNotifications(
    noticeId: string,
    options?: { simulateFailure?: boolean }
  ): Promise<{
    totalRecipients: number;
    smsCount: number;
    whatsappCount: number;
    totalNotificationsCreated: number;
    deliveredCount: number;
    failedCount: number;
    status: string;
  }> {
    const notice = await prisma.collegeNotice.findUnique({
      where: { id: noticeId }
    });

    if (!notice) {
      throw new Error(`Notice not found with ID: ${noticeId}`);
    }

    const recipients = await this.findMatchingRecipients({
      targetType: notice.targetType,
      academicYearId: notice.academicYearId,
      departmentId: notice.departmentId,
      yearId: notice.yearId,
      sectionId: notice.sectionId
    });

    if (recipients.length === 0) {
      return {
        totalRecipients: 0,
        smsCount: 0,
        whatsappCount: 0,
        totalNotificationsCreated: 0,
        deliveredCount: 0,
        failedCount: 0,
        status: 'QUEUED'
      };
    }

    const formattedMessage = this.formatNoticeMessage({
      title: notice.title,
      content: notice.content,
      noticeType: notice.noticeType,
      startDate: notice.startDate,
      endDate: notice.endDate
    });

    const channelSetting = (notice.deliveryChannel || 'BOTH').toUpperCase();
    const shouldSendSms = channelSetting === 'SMS' || channelSetting === 'BOTH';
    const shouldSendWa = channelSetting === 'WHATSAPP' || channelSetting === 'BOTH';

    const recordsToCreate: any[] = [];
    let smsCount = 0;
    let whatsappCount = 0;

    for (const r of recipients) {
      if (shouldSendSms) {
        recordsToCreate.push({
          noticeId: notice.id,
          studentId: r.studentId,
          parentMobile: r.parentMobile,
          type: NotificationType.SMS,
          category: NotificationCategory.COLLEGE_NOTICE,
          title: notice.title,
          message: formattedMessage,
          status: NotificationStatus.PENDING
        });
        smsCount++;
      }

      if (shouldSendWa) {
        recordsToCreate.push({
          noticeId: notice.id,
          studentId: r.studentId,
          parentMobile: r.parentMobile,
          type: NotificationType.WHATSAPP,
          category: NotificationCategory.COLLEGE_NOTICE,
          title: notice.title,
          message: formattedMessage,
          status: NotificationStatus.PENDING
        });
        whatsappCount++;
      }
    }

    // 1. Bulk create initial records with status PENDING in database
    const createdRecords = await prisma.notification.createManyAndReturn({
      data: recordsToCreate
    });

    // 2. Enqueue jobs into BullMQ / Resilient Fallback Queue (Non-blocking)
    const jobs: NotificationJobData[] = createdRecords.map(rec => ({
      notificationId: rec.id,
      type: rec.type,
      category: rec.category,
      recipientMobile: rec.parentMobile,
      message: rec.message,
      title: rec.title,
      studentId: rec.studentId || undefined,
      noticeId: rec.noticeId || undefined,
      simulateFailure: options?.simulateFailure
    }));

    await NotificationQueue.addJobs(jobs);

    console.log(
      `[NotificationService] 🚀 Non-blocking dispatch: Queued ${jobs.length} notification jobs for notice ${notice.id}`
    );

    // 3. Immediately return success response to Admin
    return {
      totalRecipients: recipients.length,
      smsCount,
      whatsappCount,
      totalNotificationsCreated: recordsToCreate.length,
      deliveredCount: 0,
      failedCount: 0,
      status: 'QUEUED'
    };
  }

  /**
   * Dispatches an Academic Performance notification asynchronously in background.
   * Creates PENDING record, enqueues to BullMQ, and immediately returns success.
   */
  static async dispatchPerformanceNotification(params: DispatchPerformanceParams): Promise<{
    success: boolean;
    studentId: string;
    studentName: string;
    registerNumber: string;
    parentName: string;
    parentMobile: string;
    message: string;
    notifications: any[];
    status: string;
  }> {
    const student = await prisma.student.findUnique({
      where: { id: params.studentId },
      include: { department: true, year: true, section: true }
    });

    if (!student) {
      throw new Error(`Student not found with ID: ${params.studentId}`);
    }

    const report = await AcademicPerformanceService.getStudentPerformanceFromDb(student.id);
    if (!report) {
      throw new Error(`Could not generate performance report for student ID: ${params.studentId}`);
    }

    const formattedMessage = NotificationTemplateService.generatePerformanceMessageFromReport(report);

    const channelSetting = (params.channel || 'BOTH').toUpperCase();
    const shouldSendSms = channelSetting === 'SMS' || channelSetting === 'BOTH';
    const shouldSendWa = channelSetting === 'WHATSAPP' || channelSetting === 'BOTH';

    const recordsToCreate: any[] = [];

    if (shouldSendSms) {
      recordsToCreate.push({
        studentId: student.id,
        parentMobile: student.parentMobile,
        type: NotificationType.SMS,
        category: NotificationCategory.PERFORMANCE,
        title: `Performance Report: ${student.name} (${student.registerNumber})`,
        message: formattedMessage,
        status: NotificationStatus.PENDING
      });
    }

    if (shouldSendWa) {
      recordsToCreate.push({
        studentId: student.id,
        parentMobile: student.parentMobile,
        type: NotificationType.WHATSAPP,
        category: NotificationCategory.PERFORMANCE,
        title: `Performance Report: ${student.name} (${student.registerNumber})`,
        message: formattedMessage,
        status: NotificationStatus.PENDING
      });
    }

    const createdRecords = await prisma.notification.createManyAndReturn({
      data: recordsToCreate
    });

    // Enqueue jobs asynchronously
    const jobs: NotificationJobData[] = createdRecords.map(rec => ({
      notificationId: rec.id,
      type: rec.type,
      category: rec.category,
      recipientMobile: rec.parentMobile,
      message: rec.message,
      title: rec.title,
      studentId: rec.studentId || undefined,
      simulateFailure: params.simulateFailure
    }));

    await NotificationQueue.addJobs(jobs);

    return {
      success: true,
      studentId: student.id,
      studentName: student.name,
      registerNumber: student.registerNumber,
      parentName: student.parentName,
      parentMobile: student.parentMobile,
      message: formattedMessage,
      notifications: createdRecords,
      status: 'QUEUED'
    };
  }

  /**
   * Dispatches Academic Performance notifications for an entire class section asynchronously.
   */
  static async dispatchSectionPerformanceNotifications(params: DispatchSectionPerformanceParams): Promise<{
    sectionId: string;
    totalStudents: number;
    totalSent: number;
    status: string;
  }> {
    const students = await prisma.student.findMany({
      where: {
        sectionId: params.sectionId,
        status: 'ACTIVE'
      },
      orderBy: { registerNumber: 'asc' }
    });

    const channelSetting = (params.channel || 'BOTH').toUpperCase();
    const shouldSendSms = channelSetting === 'SMS' || channelSetting === 'BOTH';
    const shouldSendWa = channelSetting === 'WHATSAPP' || channelSetting === 'BOTH';

    const recordsToCreate: any[] = [];

    for (const student of students) {
      try {
        const report = await AcademicPerformanceService.getStudentPerformanceFromDb(student.id);
        if (!report) continue;
        const formattedMessage = NotificationTemplateService.generatePerformanceMessageFromReport(report);

        if (shouldSendSms) {
          recordsToCreate.push({
            studentId: student.id,
            parentMobile: student.parentMobile,
            type: NotificationType.SMS,
            category: NotificationCategory.PERFORMANCE,
            title: `Performance Report: ${student.name} (${student.registerNumber})`,
            message: formattedMessage,
            status: NotificationStatus.PENDING
          });
        }

        if (shouldSendWa) {
          recordsToCreate.push({
            studentId: student.id,
            parentMobile: student.parentMobile,
            type: NotificationType.WHATSAPP,
            category: NotificationCategory.PERFORMANCE,
            title: `Performance Report: ${student.name} (${student.registerNumber})`,
            message: formattedMessage,
            status: NotificationStatus.PENDING
          });
        }
      } catch (err) {
        console.warn(`Could not prepare performance message for student ${student.registerNumber}`);
      }
    }

    if (recordsToCreate.length === 0) {
      return {
        sectionId: params.sectionId,
        totalStudents: students.length,
        totalSent: 0,
        status: 'QUEUED'
      };
    }

    const createdRecords = await prisma.notification.createManyAndReturn({
      data: recordsToCreate
    });

    const jobs: NotificationJobData[] = createdRecords.map(rec => ({
      notificationId: rec.id,
      type: rec.type,
      category: rec.category,
      recipientMobile: rec.parentMobile,
      message: rec.message,
      title: rec.title,
      studentId: rec.studentId || undefined,
      simulateFailure: params.simulateFailure
    }));

    await NotificationQueue.addJobs(jobs);

    return {
      sectionId: params.sectionId,
      totalStudents: students.length,
      totalSent: createdRecords.length,
      status: 'QUEUED'
    };
  }

  /**
   * Retrieves real-time delivery status metrics for a specific college notice
   */
  static async getNoticeNotificationStats(noticeId: string): Promise<NotificationStatusCounts & { noticeId: string }> {
    const notifications = await prisma.notification.findMany({
      where: { noticeId },
      select: { status: true }
    });

    let pending = 0;
    let processing = 0;
    let sent = 0;
    let delivered = 0;
    let failed = 0;

    for (const n of notifications) {
      if (n.status === NotificationStatus.PENDING) pending++;
      else if (n.status === NotificationStatus.PROCESSING) processing++;
      else if (n.status === NotificationStatus.SENT) sent++;
      else if (n.status === NotificationStatus.DELIVERED) delivered++;
      else if (n.status === NotificationStatus.FAILED) failed++;
    }

    return {
      noticeId,
      total: notifications.length,
      pending,
      processing,
      sent,
      delivered,
      failed
    };
  }

  /**
   * Retrieves overall system notification counts and queue health
   */
  static async getOverallNotificationStats(): Promise<{
    databaseCounts: NotificationStatusCounts;
    queueStats: any;
  }> {
    const [counts, queueStats] = await Promise.all([
      prisma.notification.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      NotificationQueue.getQueueStats()
    ]);

    const databaseCounts: NotificationStatusCounts = {
      total: 0,
      pending: 0,
      processing: 0,
      sent: 0,
      delivered: 0,
      failed: 0
    };

    for (const row of counts) {
      databaseCounts.total += row._count.status;
      if (row.status === NotificationStatus.PENDING) databaseCounts.pending = row._count.status;
      else if (row.status === NotificationStatus.PROCESSING) databaseCounts.processing = row._count.status;
      else if (row.status === NotificationStatus.SENT) databaseCounts.sent = row._count.status;
      else if (row.status === NotificationStatus.DELIVERED) databaseCounts.delivered = row._count.status;
      else if (row.status === NotificationStatus.FAILED) databaseCounts.failed = row._count.status;
    }

    return {
      databaseCounts,
      queueStats
    };
  }

  /**
   * Retrieves paginated, multi-filtered Notification History with summary card metrics and masked parent mobile numbers
   */
  static async getNotificationHistory(params: {
    academicYearId?: string;
    departmentId?: string;
    yearId?: string;
    sectionId?: string;
    type?: NotificationType | string;
    category?: NotificationCategory | string;
    status?: NotificationStatus | string;
    date?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number | string;
    limit?: number | string;
  }) {
    const where: any = {};

    if (params.category) {
      where.category = params.category as NotificationCategory;
    }

    if (params.type) {
      where.type = params.type as NotificationType;
    }

    if (params.status) {
      where.status = params.status as NotificationStatus;
    }

    // Date filtering: specific date or range
    if (params.date) {
      const d = new Date(params.date as string);
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
        const start = new Date(params.startDate as string);
        if (!isNaN(start.getTime())) where.createdAt.gte = start;
      }
      if (params.endDate) {
        const end = new Date(params.endDate as string);
        if (!isNaN(end.getTime())) where.createdAt.lte = end;
      }
    }

    // Academic filters (applied to Student or Notice)
    if (params.academicYearId || params.departmentId || params.yearId || params.sectionId) {
      const studentFilter: any = {};
      const noticeFilter: any = {};

      if (params.academicYearId) {
        studentFilter.academicYearId = params.academicYearId;
        noticeFilter.academicYearId = params.academicYearId;
      }
      if (params.departmentId) {
        studentFilter.departmentId = params.departmentId;
        noticeFilter.departmentId = params.departmentId;
      }
      if (params.yearId) {
        studentFilter.yearId = params.yearId;
        noticeFilter.yearId = params.yearId;
      }
      if (params.sectionId) {
        studentFilter.sectionId = params.sectionId;
        noticeFilter.sectionId = params.sectionId;
      }

      where.OR = [
        { student: studentFilter },
        { notice: noticeFilter }
      ];
    }

    // Search query filter
    if (params.search && typeof params.search === 'string' && params.search.trim().length > 0) {
      const q = params.search.trim();
      const searchConditions: any[] = [
        { title: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        { student: { name: { contains: q, mode: 'insensitive' } } },
        { student: { registerNumber: { contains: q, mode: 'insensitive' } } },
        { notice: { title: { contains: q, mode: 'insensitive' } } }
      ];

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions }
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Base filter for summary cards (reflecting active filters except status)
    const baseWhere = { ...where };
    delete baseWhere.status;

    const [statusGroups, baseTotalCount] = await Promise.all([
      prisma.notification.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { status: true }
      }),
      prisma.notification.count({ where: baseWhere })
    ]);

    const summaryCards = {
      total: baseTotalCount,
      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      processing: 0
    };

    for (const group of statusGroups) {
      if (group.status === NotificationStatus.SENT) summaryCards.sent = group._count.status;
      else if (group.status === NotificationStatus.DELIVERED) summaryCards.delivered = group._count.status;
      else if (group.status === NotificationStatus.FAILED) summaryCards.failed = group._count.status;
      else if (group.status === NotificationStatus.PENDING) summaryCards.pending = group._count.status;
      else if (group.status === NotificationStatus.PROCESSING) summaryCards.processing = group._count.status;
    }

    // Pagination
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, totalFiltered] = await Promise.all([
      prisma.notification.findMany({
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
              parentName: true,
              department: { select: { id: true, code: true, name: true } },
              year: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
              academicYear: { select: { id: true, yearName: true } }
            }
          },
          notice: {
            select: {
              id: true,
              title: true,
              noticeType: true,
              targetType: true,
              status: true
            }
          }
        }
      }),
      prisma.notification.count({ where })
    ]);

    // Protect parent phone numbers with masking before returning to client
    const sanitizedItems = items.map(item => ({
      id: item.id,
      noticeId: item.noticeId,
      studentId: item.studentId,
      studentName: item.student?.name || null,
      registerNumber: item.student?.registerNumber || null,
      parentName: item.student?.parentName || null,
      maskedMobile: NotificationService.maskPhoneNumber(item.parentMobile),
      type: item.type,
      category: item.category,
      title: item.title,
      noticeTitle: item.notice?.title || (item.category === NotificationCategory.PERFORMANCE ? item.title : null),
      message: item.message,
      status: item.status,
      providerMessageId: item.providerMessageId,
      retryCount: item.retryCount,
      sentAt: item.sentAt,
      deliveredAt: item.deliveredAt,
      failedAt: item.failedAt,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt,
      student: item.student,
      notice: item.notice
    }));

    return {
      summaryCards,
      pagination: {
        page,
        limit,
        totalItems: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit)
      },
      notifications: sanitizedItems
    };
  }

  /**
   * Retries an individual FAILED notification by resetting state and re-enqueuing into background worker
   */
  static async retryNotification(notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { student: true, notice: true }
    });

    if (!notification) {
      throw new Error(`Notification not found with ID: ${notificationId}`);
    }

    if (notification.status !== NotificationStatus.FAILED) {
      throw new Error(`Only notifications with FAILED status can be retried. Current status is ${notification.status}.`);
    }

    // Reset status to PENDING and clear previous failure details
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.PENDING,
        errorMessage: null,
        failedAt: null,
        retryCount: notification.retryCount + 1
      }
    });

    // Re-enqueue job to BullMQ / Resilient queue
    await NotificationQueue.addJob({
      notificationId: updated.id,
      recipientMobile: notification.parentMobile,
      message: notification.message,
      type: notification.type,
      category: notification.category,
      title: notification.title,
      studentId: notification.studentId || undefined,
      noticeId: notification.noticeId || undefined,
      attempt: 1,
      maxAttempts: 3
    });

    return {
      success: true,
      message: 'Failed notification requeued for delivery retry successfully',
      notification: {
        id: updated.id,
        status: updated.status,
        retryCount: updated.retryCount,
        type: updated.type,
        category: updated.category,
        maskedMobile: NotificationService.maskPhoneNumber(notification.parentMobile)
      }
    };
  }

  /**
   * Bulk retries failed notifications matching optional noticeId or category
   */
  static async retryAllFailed(filters?: {
    noticeId?: string;
    category?: NotificationCategory;
  }) {
    const where: any = {
      status: NotificationStatus.FAILED
    };

    if (filters?.noticeId) where.noticeId = filters.noticeId;
    if (filters?.category) where.category = filters.category;

    const failedNotifications = await prisma.notification.findMany({
      where
    });

    if (failedNotifications.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'No failed notifications found to retry'
      };
    }

    // Bulk update database to PENDING
    await prisma.notification.updateMany({
      where: {
        id: { in: failedNotifications.map(n => n.id) }
      },
      data: {
        status: NotificationStatus.PENDING,
        errorMessage: null,
        failedAt: null
      }
    });

    // Enqueue jobs
    const jobs: NotificationJobData[] = failedNotifications.map(n => ({
      notificationId: n.id,
      recipientMobile: n.parentMobile,
      message: n.message,
      type: n.type,
      category: n.category,
      title: n.title,
      studentId: n.studentId || undefined,
      noticeId: n.noticeId || undefined,
      attempt: 1,
      maxAttempts: 3
    }));

    await NotificationQueue.addJobs(jobs);

    return {
      success: true,
      count: failedNotifications.length,
      message: `Requeued ${failedNotifications.length} failed notifications for retry`
    };
  }
}
