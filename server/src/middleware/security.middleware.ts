import { Request, Response, NextFunction } from 'express';

/**
 * Standard Security Headers Middleware
 * Protects against clickjacking, MIME-sniffing, XSS, and forces secure transports.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Control referrer information sent in HTTP requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'"
  );

  // Disable powered-by header
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * In-Memory Sliding-Window Rate Limiter
 * Guards against brute-force attacks on login and sensitive endpoints.
 */
interface RateLimitRecord {
  timestamps: number[];
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const hits = new Map<string, RateLimitRecord>();

  // Periodically clean up expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      record.timestamps = record.timestamps.filter(ts => now - ts < options.windowMs);
      if (record.timestamps.length === 0) {
        hits.delete(ip);
      }
    }
  }, options.windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    // In automated testing environments, allow bypassing if requested
    if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-rate-limit'] === 'true') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = hits.get(ip);

    if (!record) {
      record = { timestamps: [] };
      hits.set(ip, record);
    }

    // Filter to timestamps within current sliding window
    record.timestamps = record.timestamps.filter(ts => now - ts < options.windowMs);

    if (record.timestamps.length >= options.maxRequests) {
      return res.status(429).json({
        error: options.message || 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterMs: options.windowMs - (now - record.timestamps[0])
      });
    }

    record.timestamps.push(now);
    next();
  };
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 login attempts per minute per IP
  message: 'Too many authentication attempts. Please try again after 1 minute.'
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 300, // 300 requests per minute
  message: 'API rate limit exceeded. Please slow down.'
});
