"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("./config");
const routes_1 = __importDefault(require("./routes"));
const db_1 = require("./db");
const queue_1 = require("./queue");
const security_middleware_1 = require("./middleware/security.middleware");
function createApp() {
    const app = (0, express_1.default)();
    // Security headers & CORS
    app.use(security_middleware_1.securityHeadersMiddleware);
    app.use((0, cors_1.default)({ origin: config_1.config.corsOrigin, credentials: true }));
    app.use(express_1.default.json());
    // Apply API rate limiter
    app.use('/api', security_middleware_1.apiRateLimiter);
    // Health check endpoints (/health and /api/health for Render, Railway, Kubernetes, container probes)
    const healthHandler = async (_req, res) => {
        try {
            const userCount = await db_1.prisma.user.count().catch(() => 0);
            return res.status(200).json({
                status: 'HEALTHY',
                database: 'PostgreSQL (Connected via Prisma)',
                usersCount: userCount,
                uptimeSeconds: Math.floor(process.uptime()),
                environment: config_1.config.nodeEnv,
                timestamp: new Date().toISOString()
            });
        }
        catch (err) {
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
    app.use('/api', routes_1.default);
    // 404 handler for unmatched API routes (prevents returning SPA index.html to API requests)
    app.use('/api', (_req, res) => {
        return res.status(404).json({
            error: 'API endpoint not found',
            code: 'API_NOT_FOUND'
        });
    });
    // Serve Frontend Static Client with robust path resolution
    let baseClientDir = path_1.default.resolve(process.cwd(), '../client');
    if (!fs_1.default.existsSync(baseClientDir)) {
        baseClientDir = path_1.default.resolve(process.cwd(), 'client');
    }
    if (!fs_1.default.existsSync(baseClientDir)) {
        baseClientDir = path_1.default.resolve(__dirname, '../../client');
    }
    const distDir = path_1.default.join(baseClientDir, 'dist');
    const clientDir = fs_1.default.existsSync(path_1.default.join(distDir, 'index.html')) ? distDir : baseClientDir;
    app.use(express_1.default.static(clientDir));
    app.use(express_1.default.static(baseClientDir));
    app.use('/admin', express_1.default.static(clientDir));
    app.use('/staff', express_1.default.static(clientDir));
    // Fallback for SPA Routing (compatible with Express 5 & Windows paths)
    app.use((_req, res) => {
        const indexPath = path_1.default.join(clientDir, 'index.html');
        if (fs_1.default.existsSync(indexPath)) {
            res.sendFile('index.html', { root: clientDir });
        }
        else {
            res.status(200).send(`<!DOCTYPE html><html><head><title>Academic Portal</title></head><body style="font-family:sans-serif;background:#090d16;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:2rem;background:#0f172a;border-radius:1rem;border:1px solid #1e293b;"><h1 style="color:#6366f1;">VSB Engineering College</h1><p>Academic Portal Server is active. Client bundle is loading or pending build.</p></div></body></html>`);
        }
    });
    // Global Error Handler
    app.use((err, _req, res, _next) => {
        console.error('Unhandled server error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });
    return app;
}
async function autoSeedDatabaseIfEmpty() {
    try {
        const userCount = await db_1.prisma.user.count().catch(() => 0);
        if (userCount === 0) {
            console.log('🌱 Empty database detected on startup. Auto-seeding master data and accounts...');
            const salt = await bcryptjs_1.default.genSalt(10);
            const hashPassword = async (pw) => bcryptjs_1.default.hash(pw, salt);
            const academicYear = await db_1.prisma.academicYear.upsert({
                where: { yearName: '2025-2026' },
                update: {},
                create: { yearName: '2025-2026', isCurrent: true }
            });
            const deptCSE = await db_1.prisma.department.upsert({
                where: { code: 'CSE' },
                update: {},
                create: { code: 'CSE', name: 'Computer Science & Engineering' }
            });
            await db_1.prisma.department.upsert({
                where: { code: 'ECE' },
                update: {},
                create: { code: 'ECE', name: 'Electronics & Communication Engineering' }
            });
            await db_1.prisma.department.upsert({
                where: { code: 'MECH' },
                update: {},
                create: { code: 'MECH', name: 'Mechanical Engineering' }
            });
            for (let y = 1; y <= 4; y++) {
                const names = ['', 'First Year', 'Second Year', 'Third Year', 'Final Year'];
                await db_1.prisma.year.upsert({
                    where: { yearNumber: y },
                    update: {},
                    create: { yearNumber: y, name: names[y] }
                });
            }
            const adminPassword = await hashPassword('admin123');
            await db_1.prisma.user.upsert({
                where: { email: 'admin@college.edu' },
                update: {},
                create: {
                    name: 'Chief Administrator',
                    email: 'admin@college.edu',
                    passwordHash: adminPassword,
                    role: 'ADMIN',
                    isActive: true
                }
            });
            const staff1Password = await hashPassword('Sarah@15081988');
            await db_1.prisma.user.upsert({
                where: { email: 'sarah.cse@college.edu' },
                update: {},
                create: {
                    name: 'Prof. Sarah Jenkins',
                    email: 'sarah.cse@college.edu',
                    username: 'sarah.jenkins',
                    dateOfBirth: '1988-08-15',
                    passwordHash: staff1Password,
                    role: 'STAFF',
                    departmentId: deptCSE.id,
                    passwordAuthorized: true,
                    passwordAuthorizedAt: new Date()
                }
            });
            console.log('✓ Cloud auto-seeding completed: Admin & Staff credentials ready!');
        }
    }
    catch (err) {
        console.warn('Auto-seed check notice:', err?.message || err);
    }
}
function startServer() {
    const app = createApp();
    const server = app.listen(config_1.config.port, () => {
        console.log(`🚀 Academic Portal Express Server running on http://127.0.0.1:${config_1.config.port}`);
        // Auto-bootstrap master records if running on fresh cloud database
        autoSeedDatabaseIfEmpty().catch(err => console.warn('Auto-seed background notice:', err?.message || err));
        // Initialize background notification processing queue
        queue_1.NotificationQueue.init().catch((err) => {
            console.warn('Queue init warning:', err?.message || err);
        });
    });
    return server;
}
if (require.main === module) {
    startServer();
}
