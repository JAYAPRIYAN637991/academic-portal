import { Queue } from 'bullmq';
import { NotificationJobData, QueueStats } from './types';
import { getBullMQConnectionOptions, isRedisAvailable, checkRedisConnection } from './redis';
import {
  QUEUE_NAME,
  DEFAULT_MAX_ATTEMPTS,
  fallbackQueue,
  initBullWorker
} from './notification.worker';

let bullQueue: Queue | null = null;
let isInitialized = false;

export class NotificationQueue {
  /**
   * Initializes queue connections and workers
   */
  static async init(): Promise<void> {
    if (isInitialized) return;

    const redisOnline = await checkRedisConnection();

    if (redisOnline) {
      try {
        bullQueue = new Queue(QUEUE_NAME, {
          connection: getBullMQConnectionOptions(),
          defaultJobOptions: {
            attempts: DEFAULT_MAX_ATTEMPTS,
            backoff: {
              type: 'exponential',
              delay: 1000
            },
            removeOnComplete: 1000,
            removeOnFail: 5000
          }
        });

        initBullWorker();
        console.log(`[NotificationQueue] 🚀 BullMQ Queue initialized successfully on Redis`);
      } catch (err: any) {
        console.warn(`[NotificationQueue] Failed to initialize BullMQ queue: ${err.message}. Using fallback queue.`);
        bullQueue = null;
      }
    } else {
      console.log(`[NotificationQueue] 🛡️ Running with in-process resilient fallback queue`);
    }

    isInitialized = true;
  }

  /**
   * Enqueues a single notification job (non-blocking)
   */
  static async addJob(jobData: NotificationJobData): Promise<string> {
    await this.ensureInitialized();

    if (bullQueue && isRedisAvailable()) {
      try {
        const job = await bullQueue.add('send-notification', jobData, {
          attempts: jobData.maxAttempts || DEFAULT_MAX_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        });
        return String(job.id);
      } catch (err: any) {
        console.warn(`[NotificationQueue] BullMQ add error: ${err.message}. Routing to fallback queue.`);
        fallbackQueue.push(jobData);
        return `fallback_${jobData.notificationId}`;
      }
    }

    // Resilient Fallback Queue
    fallbackQueue.push(jobData);
    return `fallback_${jobData.notificationId}`;
  }

  /**
   * Enqueues multiple notification jobs in batch (non-blocking)
   */
  static async addJobs(jobsData: NotificationJobData[]): Promise<string[]> {
    if (jobsData.length === 0) return [];
    await this.ensureInitialized();

    if (bullQueue && isRedisAvailable()) {
      try {
        const bulkJobs = jobsData.map(data => ({
          name: 'send-notification',
          data,
          opts: {
            attempts: data.maxAttempts || DEFAULT_MAX_ATTEMPTS,
            backoff: {
              type: 'exponential',
              delay: 1000
            }
          }
        }));

        const added = await bullQueue.addBulk(bulkJobs);
        return added.map(j => String(j.id));
      } catch (err: any) {
        console.warn(`[NotificationQueue] BullMQ bulk add error: ${err.message}. Routing to fallback queue.`);
        fallbackQueue.pushBulk(jobsData);
        return jobsData.map(j => `fallback_${j.notificationId}`);
      }
    }

    // Resilient Fallback Queue
    fallbackQueue.pushBulk(jobsData);
    return jobsData.map(j => `fallback_${j.notificationId}`);
  }

  /**
   * Returns current queue metrics and active worker type
   */
  static async getQueueStats(): Promise<QueueStats> {
    await this.ensureInitialized();

    const redisConnected = isRedisAvailable();
    const activeWorkerType = redisConnected && bullQueue ? 'BullMQ' : 'ResilientFallback';

    if (redisConnected && bullQueue) {
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          bullQueue.getWaitingCount(),
          bullQueue.getActiveCount(),
          bullQueue.getCompletedCount(),
          bullQueue.getFailedCount()
        ]);

        return {
          isRedisConnected: true,
          activeWorkerType: 'BullMQ',
          waiting,
          active,
          completed,
          failed
        };
      } catch (err) {
        // Redis failure during stat query
      }
    }

    const fallbackStats = fallbackQueue.getStats();
    return {
      isRedisConnected: false,
      activeWorkerType: 'ResilientFallback',
      waiting: fallbackStats.waiting,
      active: fallbackStats.active,
      completed: 0,
      failed: 0
    };
  }

  /**
   * Waits for pending queue jobs to drain (used in test suites)
   */
  static async waitUntilIdle(timeoutMs = 5000): Promise<void> {
    await fallbackQueue.waitUntilIdle(timeoutMs);
  }

  private static async ensureInitialized(): Promise<void> {
    if (!isInitialized) {
      await this.init();
    }
  }
}
