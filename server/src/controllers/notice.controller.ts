import { Request, Response } from 'express';
import { NoticeService } from '../services/notice.service';
import { NotificationService } from '../services/notification.service';

export class NoticeController {
  /**
   * POST /api/admin/notices
   * Creates a new notice. If status === 'PUBLISHED', dispatches notifications immediately.
   * Otherwise saved as DRAFT or SCHEDULED without sending notifications.
   */
  static async createNotice(req: Request, res: Response) {
    try {
      const authorId = req.user!.id;
      const result = await NoticeService.createNotice(req.body, authorId);
      return res.status(201).json(result);
    } catch (error: any) {
      console.error('Error creating notice:', error);
      return res.status(400).json({
        error: error.message || 'Failed to create notice',
        code: 'CREATE_NOTICE_ERROR'
      });
    }
  }

  /**
   * GET /api/admin/notices
   * Lists notices with search, filters, pagination, and delivery counts.
   */
  static async getNotices(req: Request, res: Response) {
    try {
      const {
        noticeType,
        status,
        departmentId,
        yearId,
        sectionId,
        academicYearId,
        startDate,
        endDate,
        search,
        page,
        limit
      } = req.query;

      const result = await NoticeService.getNotices({
        noticeType: noticeType as any,
        status: status as any,
        departmentId: departmentId as string | undefined,
        yearId: yearId as string | undefined,
        sectionId: sectionId as string | undefined,
        academicYearId: academicYearId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined
      });

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Error fetching notices:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch notices',
        code: 'GET_NOTICES_ERROR'
      });
    }
  }

  /**
   * GET /api/admin/notices/recipients-preview
   * Previews matching recipients, masked parent mobile numbers, and formatted message text.
   */
  static async getRecipientsPreview(req: Request, res: Response) {
    try {
      const {
        title,
        content,
        noticeType,
        targetType,
        deliveryChannel,
        academicYearId,
        departmentId,
        yearId,
        sectionId,
        startDate,
        endDate
      } = req.query;

      if (!noticeType || !targetType) {
        return res.status(400).json({
          error: 'noticeType and targetType are required for preview',
          code: 'MISSING_PREVIEW_PARAMS'
        });
      }

      const result = await NoticeService.getRecipientsPreview({
        title: (title as string) || '',
        content: (content as string) || '',
        noticeType: noticeType as any,
        targetType: targetType as any,
        deliveryChannel: (deliveryChannel as string) || 'BOTH',
        academicYearId: academicYearId as string | undefined,
        departmentId: departmentId as string | undefined,
        yearId: yearId as string | undefined,
        sectionId: sectionId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : null,
        endDate: endDate ? new Date(endDate as string) : null
      });

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Error generating recipients preview:', error);
      return res.status(500).json({
        error: error.message || 'Failed to generate recipients preview',
        code: 'PREVIEW_ERROR'
      });
    }
  }

  /**
   * GET /api/admin/notices/:id
   * Single notice details with delivery statistics and recipient logs.
   */
  static async getNoticeById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const notice = await NoticeService.getNoticeById(id);

      if (!notice) {
        return res.status(404).json({
          error: 'Notice not found',
          code: 'NOTICE_NOT_FOUND'
        });
      }

      return res.status(200).json(notice);
    } catch (error: any) {
      console.error('Error fetching notice details:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch notice details',
        code: 'GET_NOTICE_ERROR'
      });
    }
  }

  /**
   * PUT /api/admin/notices/:id
   * Updates notice content or schedule. Only permitted on DRAFT or SCHEDULED notices.
   */
  static async updateNotice(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const authorId = req.user!.id;
      const updated = await NoticeService.updateNotice(id, req.body, authorId);
      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Error updating notice:', error);
      return res.status(400).json({
        error: error.message || 'Failed to update notice',
        code: 'UPDATE_NOTICE_ERROR'
      });
    }
  }

  /**
   * DELETE /api/admin/notices/:id
   * Deletes a notice.
   */
  static async deleteNotice(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const authorId = req.user!.id;
      const result = await NoticeService.deleteNotice(id, authorId);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Error deleting notice:', error);
      return res.status(400).json({
        error: error.message || 'Failed to delete notice',
        code: 'DELETE_NOTICE_ERROR'
      });
    }
  }

  /**
   * POST /api/admin/notices/:id/publish
   * Explicit action to publish notice and generate parent notifications across SMS and WhatsApp.
   */
  static async publishNotice(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const authorId = req.user!.id;
      const result = await NoticeService.publishNotice(id, authorId);
      return res.status(200).json({
        message: 'Notice published and parent notifications dispatched successfully',
        ...result
      });
    } catch (error: any) {
      console.error('Error publishing notice:', error);
      return res.status(400).json({
        error: error.message || 'Failed to publish notice',
        code: 'PUBLISH_NOTICE_ERROR'
      });
    }
  }

  /**
   * POST /api/admin/notices/:id/cancel
   * Cancels a scheduled notice, preventing notification dispatch.
   */
  static async cancelNotice(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const authorId = req.user!.id;
      const cancelled = await NoticeService.cancelNotice(id, authorId);
      return res.status(200).json({
        message: 'Scheduled notice cancelled successfully',
        notice: cancelled
      });
    } catch (error: any) {
      console.error('Error cancelling notice:', error);
      return res.status(400).json({
        error: error.message || 'Failed to cancel notice',
        code: 'CANCEL_NOTICE_ERROR'
      });
    }
  }

  /**
   * GET /api/admin/notices/:id/notification-stats
   * Retrieves real-time delivery status counts (Total, Pending, Processing, Sent, Delivered, Failed) for a notice
   */
  static async getNotificationStats(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const stats = await NotificationService.getNoticeNotificationStats(id);
      return res.status(200).json(stats);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to retrieve notification statistics',
        code: 'GET_NOTIFICATION_STATS_ERROR'
      });
    }
  }
}
