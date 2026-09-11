import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import routes from './routes';
import { prisma } from './db';
import { NotificationQueue } from './queue';
import { securityHeadersMiddleware, apiRateLimiter } from './middleware/security.middleware';

export function createApp() {
  const app = express();

  // Security headers & CORS
  app.use(securityHeadersMiddleware);
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());

  // Apply API rate limiter
  app.use('/api', apiRateLimiter);

  // Health check endpoints (/health and /api/health for Render, Railway, Kubernetes, container probes)
  const healthHandler = async (_req: Request, res: Response) => {
    try {
      const userCount = await prisma.user.count().catch(() => 0);
      return res.status(200).json({
        status: 'HEALTHY',
        database: 'PostgreSQL (Connected via Prisma)',
        usersCount: userCount,
        uptimeSeconds: Math.floor(process.uptime()),
        environment: config.nodeEnv,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(200).json({
        status: 'INITIALIZING',
        database: 'Connecting / Initializing',
        warning: err?.message || 'Database initializing',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    }
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // API Routes
  app.use('/api', routes);

  // 404 handler for unmatched API routes (prevents returning SPA index.html to API requests)
  app.use('/api', (_req: Request, res: Response) => {
    return res.status(404).json({
      error: 'API endpoint not found',
      code: 'API_NOT_FOUND'
    });
  });

  // Serve Frontend Static Client with robust path resolution
  let baseClientDir = path.resolve(process.cwd(), '../client');
  if (!fs.existsSync(baseClientDir)) {
    baseClientDir = path.resolve(process.cwd(), 'client');
  }
  if (!fs.existsSync(baseClientDir)) {
    baseClientDir = path.resolve(__dirname, '../../client');
  }

  const distDir = path.join(baseClientDir, 'dist');
  const clientDir = fs.existsSync(path.join(distDir, 'index.html')) ? distDir : baseClientDir;

  app.use(express.static(clientDir));
  app.use(express.static(baseClientDir));
  app.use('/admin', express.static(clientDir));
  app.use('/staff', express.static(clientDir));

  // Fallback for SPA Routing (compatible with Express 5 & Windows paths)
  app.use((_req: Request, res: Response) => {
    const indexPath = path.join(clientDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile('index.html', { root: clientDir });
    } else {
      res.status(200).send(`<!DOCTYPE html><html><head><title>Academic Portal</title></head><body style="font-family:sans-serif;background:#090d16;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:2rem;background:#0f172a;border-radius:1rem;border:1px solid #1e293b;"><h1 style="color:#6366f1;">VSB Engineering College</h1><p>Academic Portal Server is active. Client bundle is loading or pending build.</p></div></body></html>`);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

export function startServer() {
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`🚀 Academic Portal Express Server running on http://127.0.0.1:${config.port}`);
    // Initialize background notification processing queue
    NotificationQueue.init().catch((err: any) => {
      console.warn('Queue init warning:', err?.message || err);
    });
  });
  return server;
}

if (require.main === module) {
  startServer();
}
