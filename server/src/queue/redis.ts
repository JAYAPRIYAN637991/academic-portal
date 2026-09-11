import Redis, { RedisOptions } from 'ioredis';
import { ConnectionOptions } from 'bullmq';
import { config } from '../config';

let redisClient: Redis | null = null;
let redisAvailable: boolean = false;
let hasChecked: boolean = false;

export function getRedisOptions(): RedisOptions {
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 2000,
    retryStrategy(times: number) {
      if (times > 2) {
        return null;
      }
      return Math.min(times * 500, 2000);
    }
  };
}

export function getBullMQConnectionOptions(): ConnectionOptions {
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

export async function checkRedisConnection(): Promise<boolean> {
  if (!config.redis.enabled) {
    redisAvailable = false;
    hasChecked = true;
    return false;
  }

  try {
    const probe = new Redis({
      ...getRedisOptions(),
      connectTimeout: 1500,
      retryStrategy: () => null
    });

    probe.on('error', () => {
      // Suppress unhandled error
    });

    await probe.connect();
    const pingRes = await probe.ping();
    await probe.quit().catch(() => {});

    redisAvailable = pingRes === 'PONG';
  } catch (err: any) {
    redisAvailable = false;
    console.warn(
      `[NotificationQueue] ⚠️ Redis is unavailable (${err.message || 'connection failed'}). Operating with in-process resilient background worker.`
    );
  }

  hasChecked = true;
  return redisAvailable;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export function getRedisConnection(): Redis {
  if (!redisClient) {
    redisClient = new Redis(getRedisOptions());
    redisClient.on('error', (err) => {
      console.warn(`[Redis] Connection warning: ${err.message}`);
    });
  }
  return redisClient;
}
