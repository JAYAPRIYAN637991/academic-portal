/**
 * Notice Service
 * 
 * Manages institutional College Notices and News lifecycle:
 * Draft -> Preview -> Publish / Schedule -> Notification Queue Dispatch -> Delivery Tracking.
 * Strictly restricted to Admin users.
 */

import { prisma } from '../db';
import { NoticeStatus, NoticeTargetType, NoticeType } from '@prisma/client';
import { NotificationService, RecipientPreviewResult } from './notification.service';
import { AuditAction } from './audit.service';

export interface CreateNoticeInput {
  title: string;
  content: string;
  noticeType: NoticeType;
  targetType: NoticeTargetType;
  academicYearId?: string | null;
  departmentId?: string | null;
  yearId?: string | null;
  sectionId?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  scheduledAt?: string | Date | null;
  deliveryChannel?: string; // "SMS" | "WHATSAPP" | "BOTH"
  status?: NoticeStatus; // DRAFT | SCHEDULED | PUBLISHED
}

export interface UpdateNoticeInput {
  title?: string;
  content?: string;
  noticeType?: NoticeType;
  targetType?: NoticeTargetType;
  academicYearId?: string | null;
  departmentId?: string | null;
  yearId?: string | null;
  sectionId?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  scheduledAt?: string | Date | null;
  deliveryChannel?: string;
  status?: NoticeStatus;
}

export interface NoticeFilterOptions {
  noticeType?: NoticeType | 'ALL';
  status?: NoticeStatus | 'ALL';
  departmentId?: string;
  yearId?: string;
  sectionId?: string;
  academicYearId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class NoticeService {
  /**
   * Creates a new College Notice.
   * If status is DRAFT or SCHEDULED, NO notifications are dispatched.
   * If status is PUBLISHED, parent notifications are created and sent immediately.
   */
  static async createNotice(input: CreateNoticeInput, authorId: string) {
    if (!input.title || !input.title.trim()) {
      throw new Error('Notice title is required');
    }
    if (!input.content || !input.content.trim()) {
      throw new Error('Notice content is required');
    }
    if (!input.noticeType) {
      throw new Error('Notice type is required');
    }
    if (!input.targetType) {
      throw new Error('Target audience type is required');
    }

    // Determine initial status
    let initialStatus: NoticeStatus = NoticeStatus.DRAFT;
    let publishedAt: Date | null = null;
    let scheduledAt: Date | null = null;

    if (input.scheduledAt) {
      scheduledAt = new Date(input.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        throw new Error('Invalid scheduled date/time');
      }
    }

    if (input.status === NoticeStatus.SCHEDULED && scheduledAt) {
      initialStatus = NoticeStatus.SCHEDULED;
    } else if (input.status === NoticeStatus.PUBLISHED) {
      initialStatus = NoticeStatus.PUBLISHED;
      publishedAt = new Date();
    } else {
      initialStatus = NoticeStatus.DRAFT;
    }

    const startDate = input.startDate ? new Date(input.startDate) : null;
    const endDate = input.endDate ? new Date(input.endDate) : null;

    const notice = await prisma.collegeNotice.create({
      data: {
        title: input.title.trim(),
        content: input.content.trim(),
        noticeType: input.noticeType,
        targetType: input.targetType,
        academicYearId: input.academicYearId || null,
        departmentId: input.departmentId || null,
        yearId: input.yearId || null,
        sectionId: input.sectionId || null,
        startDate,
        endDate,
        scheduledAt,
        publishedAt,
        deliveryChannel: (input.deliveryChannel || 'BOTH').toUpperCase(),
        status: initialStatus,
        createdBy: authorId
      },
      include: {
        academicYear: true,
        department: true,
        year: true,
        section: true,
        author: { select: { id: true, name: true, email: true } }
      }
    });

    let notificationSummary = null;

    // Only dispatch notifications if explicitly PUBLISHED
    if (initialStatus === NoticeStatus.PUBLISHED) {
      notificationSummary = await NotificationService.dispatchNoticeNotifications(notice.id);
    }

    // Log in AuditLog
    await prisma.auditLog.create({
      data: {
        userId: authorId,
        action: AuditAction.COLLEGE_NOTICE_CREATED,
        entity: 'CollegeNotice',
        entityId: notice.id,
        metadata: {
          title: notice.title,
          noticeType: notice.noticeType,
          targetType: notice.targetType,
          status: notice.status,
          notificationSummary
        }
      }
    });

    return {
      notice,
      notificationSummary
    };
  }

  /**
   * Retrieves notices with search, filtering, and delivery statistics.
   */
  static async getNotices(filters?: NoticeFilterOptions) {
    const where: any = {};

    if (filters?.noticeType && filters.noticeType !== 'ALL') {
      where.noticeType = filters.noticeType;
    }

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters?.yearId) {
      where.yearId = filters.yearId;
    }

    if (filters?.sectionId) {
      where.sectionId = filters.sectionId;
    }

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.startDate) {
      where.createdAt = { gte: new Date(filters.startDate) };
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } }
      ];
    }

    const page = Math.max(1, filters?.page || 1);
    const limit = Math.max(1, Math.min(100, filters?.limit || 20));
    const skip = (page - 1) * limit;

    const [notices, total] = await Promise.all([
      prisma.collegeNotice.findMany({
        where,
        include: {
          academicYear: true,
          department: true,
          year: true,
          section: true,
          author: { select: { id: true, name: true, email: true } },
          _count: {
            select: { notifications: true }
          }
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit
      }),
      prisma.collegeNotice.count({ where })
    ]);

    return {
      notices: notices.map(n => ({
        ...n,
        totalNotificationsDispatched: n._count.notifications
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Retrieves single notice details with target description and notification delivery statistics.
   */
  static async getNoticeById(id: string) {
    const notice = await prisma.collegeNotice.findUnique({
      where: { id },
      include: {
        academicYear: true,
        department: true,
        year: true,
        section: true,
        author: { select: { id: true, name: true, email: true } },
        notifications: {
          select: {
            id: true,
            type: true,
            status: true,
            sentAt: true,
            deliveredAt: true,
            failedAt: true,
            studentId: true,
            parentMobile: true
          }
        }
      }
    });

    if (!notice) return null;

    const targetDescription = await NotificationService.getTargetDescription({
      targetType: notice.targetType,
      departmentId: notice.departmentId,
      yearId: notice.yearId,
      sectionId: notice.sectionId
    });

    const formattedMessage = NotificationService.formatNoticeMessage({
      title: notice.title,
      content: notice.content,
      noticeType: notice.noticeType,
      startDate: notice.startDate,
      endDate: notice.endDate
    });

    // Breakdown notification delivery stats
    const smsCount = notice.notifications.filter(n => n.type === 'SMS').length;
    const waCount = notice.notifications.filter(n => n.type === 'WHATSAPP').length;
    const deliveredCount = notice.notifications.filter(n => n.status === 'DELIVERED' || n.status === 'SENT').length;
    const failedCount = notice.notifications.filter(n => n.status === 'FAILED').length;

    return {
      ...notice,
      targetDescription,
      formattedMessage,
      stats: {
        totalNotifications: notice.notifications.length,
        smsCount,
        whatsappCount: waCount,
        deliveredCount,
        failedCount
      }
    };
  }

  /**
   * Previews recipient count, channels, and formatted message text before publishing.
   */
  static async getRecipientsPreview(data: {
    title: string;
    content: string;
    noticeType: NoticeType;
    targetType: NoticeTargetType;
    deliveryChannel?: string;
    academicYearId?: string | null;
    departmentId?: string | null;
    yearId?: string | null;
    sectionId?: string | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
  }): Promise<RecipientPreviewResult> {
    return NotificationService.getRecipientsPreview({
      title: data.title || '',
      content: data.content || '',
      noticeType: data.noticeType,
      targetType: data.targetType,
      deliveryChannel: data.deliveryChannel,
      academicYearId: data.academicYearId,
      departmentId: data.departmentId,
      yearId: data.yearId,
      sectionId: data.sectionId,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null
    });
  }

  /**
   * Updates a notice. Only allowed for DRAFT or SCHEDULED notices.
   */
  static async updateNotice(id: string, input: UpdateNoticeInput, authorId: string) {
    const existing = await prisma.collegeNotice.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Notice not found with ID: ${id}`);
    }

    if (existing.status === NoticeStatus.PUBLISHED) {
      throw new Error('Cannot edit a notice that has already been published');
    }
    if (existing.status === NoticeStatus.CANCELLED) {
      throw new Error('Cannot edit a cancelled notice');
    }

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.content !== undefined) updateData.content = input.content.trim();
    if (input.noticeType !== undefined) updateData.noticeType = input.noticeType;
    if (input.targetType !== undefined) updateData.targetType = input.targetType;
    if (input.academicYearId !== undefined) updateData.academicYearId = input.academicYearId || null;
    if (input.departmentId !== undefined) updateData.departmentId = input.departmentId || null;
    if (input.yearId !== undefined) updateData.yearId = input.yearId || null;
    if (input.sectionId !== undefined) updateData.sectionId = input.sectionId || null;
    if (input.startDate !== undefined) updateData.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.endDate !== undefined) updateData.endDate = input.endDate ? new Date(input.endDate) : null;
    if (input.scheduledAt !== undefined) updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (input.deliveryChannel !== undefined) updateData.deliveryChannel = input.deliveryChannel.toUpperCase();

    if (input.status) {
      updateData.status = input.status;
    }

    const updated = await prisma.collegeNotice.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: true,
        department: true,
        year: true,
        section: true
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: authorId,
        action: 'UPDATE_NOTICE',
        entity: 'CollegeNotice',
        entityId: id,
        metadata: { changes: updateData }
      }
    });

    return updated;
  }

  /**
   * Explicitly publishes a notice and generates parent notifications across SMS / WhatsApp.
   */
  static async publishNotice(id: string, authorId: string) {
    const existing = await prisma.collegeNotice.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Notice not found with ID: ${id}`);
    }

    if (existing.status === NoticeStatus.PUBLISHED) {
      throw new Error('Notice is already published');
    }

    const now = new Date();

    const publishedNotice = await prisma.collegeNotice.update({
      where: { id },
      data: {
        status: NoticeStatus.PUBLISHED,
        publishedAt: now
      },
      include: {
        academicYear: true,
        department: true,
        year: true,
        section: true
      }
    });

    // Generate and dispatch parent notifications
    const notificationSummary = await NotificationService.dispatchNoticeNotifications(id);

    await prisma.auditLog.create({
      data: {
        userId: authorId,
        action: AuditAction.COLLEGE_NOTICE_PUBLISHED,
        entity: 'CollegeNotice',
        entityId: id,
        metadata: {
          publishedAt: now,
          notificationSummary
        }
      }
    });

    return {
      notice: publishedNotice,
      notificationSummary
    };
  }

  /**
   * Cancels a scheduled or draft notice. Prevents notification dispatch.
   */
  static async cancelNotice(id: string, authorId: string) {
    const existing = await prisma.collegeNotice.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Notice not found with ID: ${id}`);
    }

    if (existing.status === NoticeStatus.PUBLISHED) {
      throw new Error('Cannot cancel a notice that has already been published to parents');
    }
    if (existing.status === NoticeStatus.CANCELLED) {
      throw new Error('Notice is already cancelled');
    }

    const cancelledNotice = await prisma.collegeNotice.update({
      where: { id },
      data: {
        status: NoticeStatus.CANCELLED,
        cancelledAt: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: authorId,
        action: 'CANCEL_NOTICE',
        entity: 'CollegeNotice',
        entityId: id,
        metadata: { cancelledAt: new Date() }
      }
    });

    return cancelledNotice;
  }

  /**
   * Deletes a notice. Allowed for DRAFT, SCHEDULED, or CANCELLED notices.
   */
  static async deleteNotice(id: string, authorId: string) {
    const existing = await prisma.collegeNotice.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Notice not found with ID: ${id}`);
    }

    await prisma.collegeNotice.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: authorId,
        action: 'DELETE_NOTICE',
        entity: 'CollegeNotice',
        entityId: id,
        metadata: { title: existing.title, noticeType: existing.noticeType }
      }
    });

    return { success: true, message: `Notice "${existing.title}" deleted successfully` };
  }
}
