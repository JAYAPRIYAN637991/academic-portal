import { Worker, Job } from 'bullmq';
import { prisma } from '../db';
import { NotificationStatus } from '@prisma/client';
import { NotificationProviderFactory } from '../providers';
import { NotificationJobData } from './types';
import { getBullMQConnectionOptions, isRedisAvailable } from './redis';
import { AuditAction } from '../services/audit.service';

export const QUEUE_NAME = 'parent-notifications';
export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Core processor for executing a single notification dispatch job.
 * Used identically by both BullMQ Worker and Resilient Fallback Queue.
 */
export async function processNotificationJob(data: NotificationJobData): Promise<{
  success: boolean;
  status: NotificationStatus;
  providerId?: string;
  errorMessage?: string;
}> {
  const attempt = data.attempt || 1;
  const maxAttempts = data.maxAttempts || DEFAULT_MAX_ATTEMPTS;

  console.log(
    `[NotificationWorker] ⚙️ Processing notification ${data.notificationId} [${data.type}] (Attempt ${attempt}/${maxAttempts})`
  );

  // 1. Mark status as PROCESSING in database and record attempt
  await prisma.notification.update({
    where: { id: data.notificationId },
    data: {
      status: NotificationStatus.PROCESSING,
      retryCount: attempt - 1
    }
  }).catch((err) => {
    console.warn(`[NotificationWorker] Notice ${data.notificationId} DB update error: ${err.message}`);
  });

  // 2. Dispatch message via Provider Adapter
  const provider = NotificationProviderFactory.getProvider(data.type);
  const result = await provider.send({
    recipientMobile: data.recipientMobile,
    message: data.message,
    type: data.type,
    category: data.category,
    title: data.title,
    studentId: data.studentId,
    noticeId: data.noticeId,
    simulateFailure: data.simulateFailure,
    templateName: data.templateName,
    templateParameters: data.templateParameters
  });

  const now = new Date();

  // 3. Handle Successful Delivery
  if (result.success) {
    await prisma.notification.update({
      where: { id: data.notificationId },
      data: {
        status: NotificationStatus.DELIVERED,
        providerMessageId: result.providerId,
        sentAt: result.sentAt || now,
        deliveredAt: result.deliveredAt || now,
        errorMessage: null
      }
    });

    // Record Audit Log for successful notification dispatch
    try {
      let authorId: string | null = null;
      if (data.noticeId) {
        const notice = await prisma.collegeNotice.findUnique({
          where: { id: data.noticeId },
          select: { createdBy: true }
        });
        authorId = notice?.createdBy || null;
      }
      if (!authorId) {
        const adminUser = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true }
        });
        authorId = adminUser?.id || null;
      }

      if (authorId) {
        await prisma.auditLog.create({
          data: {
            userId: authorId,
            action: AuditAction.NOTIFICATION_SENT,
            entity: 'Notification',
            entityId: data.notificationId,
            metadata: {
              category: data.category,
              type: data.type,
              providerId: result.providerId,
              studentId: data.studentId,
              noticeId: data.noticeId,
              title: data.title
            }
          }
        });
      }
    } catch (auditErr: any) {
      console.warn(`[NotificationWorker] Audit log warning: ${auditErr.message}`);
    }

    console.log(
      `[NotificationWorker] ✅ Delivered ${data.notificationId} [${data.type}] | Provider ID: ${result.providerId}`
    );

    return {
      success: true,
      status: NotificationStatus.DELIVERED,
      providerId: result.providerId
    };
  }

  // 4. Handle Failure & Retries
  const errorMsg = result.errorMessage || 'Provider dispatch failed';

  if (attempt < maxAttempts) {
    console.warn(
      `[NotificationWorker] ⚠️ Attempt ${attempt}/${maxAttempts} failed for ${data.notificationId}: ${errorMsg}. Scheduling retry.`
    );

    // Keep status as PROCESSING during retry cycle
    await prisma.notification.update({
      where: { id: data.notificationId },
      data: {
        status: NotificationStatus.PROCESSING,
        retryCount: attempt,
        errorMessage: `[Attempt ${attempt}/${maxAttempts} failed]: ${errorMsg}`
      }
    });

    // Throw error so queue engine registers failure and triggers backoff retry
    throw new Error(errorMsg);
  }

  // 5. Retries Exhausted -> Mark permanently FAILED
  console.error(
    `[NotificationWorker] ❌ Retries exhausted (${maxAttempts}/${maxAttempts}) for ${data.notificationId}. Status -> FAILED: ${errorMsg}`
  );

  await prisma.notification.update({
    where: { id: data.notificationId },
    data: {
      status: NotificationStatus.FAILED,
      failedAt: now,
      retryCount: attempt,
      providerMessageId: result.providerId,
      errorMessage: `[Retries exhausted]: ${errorMsg}`
    }
  });

  return {
    success: false,
    status: NotificationStatus.FAILED,
    providerId: result.providerId,
    errorMessage: errorMsg
  };
}

// -----------------------------------------------------------------------------
// RESILIENT IN-PROCESS FALLBACK QUEUE (Active when Redis is Offline)
// -----------------------------------------------------------------------------

class ResilientFallbackQueue {
  private queue: NotificationJobData[] = [];
  private isProcessing = false;
  private concurrency = 5;
  private activeWorkers = 0;
  private pendingRetries = 0;

  push(job: NotificationJobData): void {
    this.queue.push({
      ...job,
      attempt: job.attempt || 1,
      maxAttempts: job.maxAttempts || DEFAULT_MAX_ATTEMPTS
    });
    this.triggerProcessing();
  }

  pushBulk(jobs: NotificationJobData[]): void {
    for (const j of jobs) {
      this.push(j);
    }
  }

  private triggerProcessing(): void {
    if (this.isProcessing && this.activeWorkers >= this.concurrency) return;
    this.isProcessing = true;

    setImmediate(() => this.drainQueue());
  }

  private async drainQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeWorkers < this.concurrency) {
      const job = this.queue.shift();
      if (!job) break;

      this.activeWorkers++;
      this.executeJob(job).finally(() => {
        this.activeWorkers--;
        if (this.queue.length > 0) {
          this.triggerProcessing();
        } else if (this.activeWorkers === 0 && this.pendingRetries === 0) {
          this.isProcessing = false;
        }
      });
    }
  }

  private async executeJob(job: NotificationJobData): Promise<void> {
    try {
      await processNotificationJob(job);
    } catch (err: any) {
      const nextAttempt = (job.attempt || 1) + 1;
      const maxAttempts = job.maxAttempts || DEFAULT_MAX_ATTEMPTS;

      if (nextAttempt <= maxAttempts) {
        this.pendingRetries++;
        const delayMs = Math.min(Math.pow(2, nextAttempt - 1) * 100, 1000);
        setTimeout(() => {
          this.pendingRetries--;
          this.push({
            ...job,
            attempt: nextAttempt
          });
        }, delayMs);
      }
    }
  }

  getStats() {
    return {
      waiting: this.queue.length + this.pendingRetries,
      active: this.activeWorkers
    };
  }

  /**
   * Helper to wait until fallback queue has completed all pending items (useful for testing)
   */
  async waitUntilIdle(timeoutMs = 6000): Promise<void> {
    const start = Date.now();
    while (this.queue.length > 0 || this.activeWorkers > 0 || this.pendingRetries > 0) {
      if (Date.now() - start > timeoutMs) break;
      await new Promise(r => setTimeout(r, 50));
    }
  }
}

export const fallbackQueue = new ResilientFallbackQueue();

// -----------------------------------------------------------------------------
// BULLMQ WORKER INITIALIZATION (Active when Redis is Online)
// -----------------------------------------------------------------------------

let bullWorker: Worker | null = null;

export function initBullWorker(): Worker | null {
  if (!isRedisAvailable() || bullWorker) {
    return bullWorker;
  }

  try {
    bullWorker = new Worker(
      QUEUE_NAME,
      async (job: Job<NotificationJobData>) => {
        return await processNotificationJob({
          ...job.data,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts || DEFAULT_MAX_ATTEMPTS
        });
      },
      {
        connection: getBullMQConnectionOptions(),
        concurrency: 5
      }
    );

    bullWorker.on('completed', (job) => {
      console.log(`[BullMQ Worker] Job ${job.id} completed successfully`);
    });

    bullWorker.on('failed', (job, err) => {
      console.warn(`[BullMQ Worker] Job ${job?.id} attempt failed: ${err.message}`);
    });

    bullWorker.on('error', (err) => {
      console.warn(`[BullMQ Worker] Error: ${err.message}`);
    });

    console.log(`[BullMQ Worker] 🚀 Worker listening on queue: ${QUEUE_NAME}`);
    return bullWorker;
  } catch (err: any) {
    console.warn(`[BullMQ Worker] Could not start BullMQ worker: ${err.message}`);
    bullWorker = null;
    return null;
  }
}
