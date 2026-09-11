import { NotificationCategory, NotificationType } from '@prisma/client';

export interface NotificationJobData {
  notificationId: string;
  type: NotificationType;
  category: NotificationCategory;
  recipientMobile: string;
  message: string;
  title?: string;
  studentId?: string;
  noticeId?: string;
  attempt?: number;
  maxAttempts?: number;
  simulateFailure?: boolean;
  templateName?: string;
  templateParameters?: string[];
}

export interface NotificationStatusCounts {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  delivered: number;
  failed: number;
}

export interface QueueStats {
  isRedisConnected: boolean;
  activeWorkerType: 'BullMQ' | 'ResilientFallback';
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}
