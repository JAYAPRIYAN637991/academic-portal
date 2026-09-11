import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { prisma } from '../db';
import { Auth } from '../../../client/js/auth.js';
import { Router } from '../../../client/js/router.js';

let currentPath = '/';
(global as any).window = {
  location: { pathname: '/' },
  history: {
    pushState: (_s: any, _t: any, url: string) => { currentPath = url; ((global as any).window as any).location.pathname = url; },
    replaceState: (_s: any, _t: any, url: string) => { currentPath = url; ((global as any).window as any).location.pathname = url; }
  },
  addEventListener: () => {},
  dispatchEvent: () => {}
};
(global as any).document = {
  addEventListener: () => {}
};

async function runComprehensiveTests() {
  console.log('🚀 Running Complete Authentication, RBAC & Role-Based Routing Test Suite...\n');
  const app = createApp();

  let passed = 0;
  let failed = 0;

  async function assertTest(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message || err}\n`);
      failed++;
    }
  }

  // Setup mock localStorage for Auth testing
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };

  try {
    // Fetch test entity IDs
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });

    const cse3A = await prisma.section.findFirst({ where: { name: 'A', departmentId: cseDept!.id } });
    const ece3A = await prisma.section.findFirst({ where: { name: 'A', departmentId: eceDept!.id } });

    const dbms = await prisma.subject.findUnique({ where: { code: 'CS8501' } });
    const toc = await prisma.subject.findUnique({ where: { code: 'CS8502' } });

    // Section 1: Backend Login & Redirection Contract
    let adminToken = '';
    let staffToken = '';

    await assertTest('Admin Login → Authenticates, returns role ADMIN & redirectUrl: /admin/dashboard', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@college.edu', password: 'admin123' });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.role !== 'ADMIN') throw new Error(`Role was ${res.body.role}`);
      if (res.body.redirectUrl !== '/admin/dashboard') throw new Error(`Redirect was ${res.body.redirectUrl}`);
      adminToken = res.body.token;
    });

    await assertTest('Staff Login → Authenticates, returns role STAFF & redirectUrl: /staff/dashboard', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.role !== 'STAFF') throw new Error(`Role was ${res.body.role}`);
      if (res.body.redirectUrl !== '/staff/dashboard') throw new Error(`Redirect was ${res.body.redirectUrl}`);
      staffToken = res.body.token;
    });

    // Section 2: Backend Security & Authority
    await assertTest('Admin accessing Admin API → ALLOWED (200 OK)', async () => {
      const res = await request(app).get('/api/admin/staff').set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('Staff accessing Staff marks API → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${cse3A!.id}&subjectId=${dbms!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('Staff accessing Admin API → 403 Forbidden', async () => {
      const res = await request(app).get('/api/admin/staff').set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected code ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    await assertTest('Staff trying to access another class → 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${ece3A!.id}&subjectId=${dbms!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    await assertTest('Staff trying to access another subject → 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${cse3A!.id}&subjectId=${toc!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    await assertTest('Staff trying to access overall analytics → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Unauthenticated user → 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/staff');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // Section 3: Frontend Session, Expiration & Role-Based Routing Guards
    await assertTest('Frontend Auth: Stores Admin session & verifies isAdmin()', async () => {
      localStorage.clear();
      Auth.setSession(adminToken, { id: 'admin-id', role: 'ADMIN', name: 'Chief Admin', email: 'admin@college.edu' });
      if (!Auth.isAuthenticated()) throw new Error('Expected authenticated');
      if (!Auth.isAdmin()) throw new Error('Expected isAdmin === true');
      if (Auth.isStaff()) throw new Error('Expected isStaff === false');
    });

    await assertTest('Frontend Auth: Stores Staff session & verifies isStaff()', async () => {
      localStorage.clear();
      Auth.setSession(staffToken, { id: 'staff-id', role: 'STAFF', name: 'Prof. Sarah', email: 'sarah.cse@college.edu' });
      if (!Auth.isAuthenticated()) throw new Error('Expected authenticated');
      if (!Auth.isStaff()) throw new Error('Expected isStaff === true');
      if (Auth.isAdmin()) throw new Error('Expected isAdmin === false');
    });

    await assertTest('Frontend Session Expiration: Detects expired JWT and purges session', async () => {
      localStorage.clear();
      const expiredJwt = jwt.sign(
        { sub: 'exp-user', role: 'STAFF', exp: Math.floor(Date.now() / 1000) - 30 },
        'secret'
      );
      Auth.setSession(expiredJwt, { id: 'exp-user', role: 'STAFF', name: 'Expired User' });

      if (!Auth.isTokenExpired()) throw new Error('Expected isTokenExpired === true');
      if (Auth.isAuthenticated()) throw new Error('Expected isAuthenticated === false on expired token');
      if (Auth.getToken() !== null) throw new Error('Expected token to be purged on expiration check');
    });

    await assertTest('Frontend Logout: Cleans token and user from session', async () => {
      Auth.setSession(adminToken, { id: 'admin-id', role: 'ADMIN', name: 'Admin' });
      Auth.logout();
      if (Auth.isAuthenticated()) throw new Error('Expected isAuthenticated === false after logout');
      if (Auth.getUser() !== null) throw new Error('Expected user to be null');
    });

    // Section 4: Frontend Router Role Protection & Redirection Rules
    const dummyRoutes = {
      '/': () => {},
      '/admin/login': () => {},
      '/staff/login': () => {},
      '/admin/dashboard': () => {},
      '/staff/dashboard': () => {}
    };
    const router = new Router(dummyRoutes);

    await assertTest('Router Guard: Staff manually enters /admin/dashboard → Redirected to /staff/dashboard', async () => {
      localStorage.clear();
      Auth.setSession(staffToken, { id: 'staff-id', role: 'STAFF', name: 'Faculty' });
      router.navigate('/admin/dashboard');
      if (currentPath !== '/staff/dashboard') {
        throw new Error(`Expected redirection to /staff/dashboard, but was ${currentPath}`);
      }
    });

    await assertTest('Router Guard: Staff enters /admin/login → Redirected to /staff/dashboard', async () => {
      localStorage.clear();
      Auth.setSession(staffToken, { id: 'staff-id', role: 'STAFF', name: 'Faculty' });
      router.navigate('/admin/login');
      if (currentPath !== '/staff/dashboard') {
        throw new Error(`Expected redirection to /staff/dashboard, but was ${currentPath}`);
      }
    });

    await assertTest('Router Guard: Unauthenticated user enters /admin/dashboard → Redirected to /admin/login', async () => {
      localStorage.clear();
      router.navigate('/admin/dashboard');
      if (currentPath !== '/admin/login') {
        throw new Error(`Expected redirection to /admin/login, but was ${currentPath}`);
      }
    });

    await assertTest('Router Guard: Unauthenticated user enters /staff/dashboard → Redirected to /staff/login', async () => {
      localStorage.clear();
      router.navigate('/staff/dashboard');
      if (currentPath !== '/staff/login') {
        throw new Error(`Expected redirection to /staff/login, but was ${currentPath}`);
      }
    });

    await assertTest('Router Guard: Admin enters /admin/dashboard → Permitted at /admin/dashboard', async () => {
      localStorage.clear();
      Auth.setSession(adminToken, { id: 'admin-id', role: 'ADMIN', name: 'Administrator' });
      router.navigate('/admin/dashboard');
      if (currentPath !== '/admin/dashboard') {
        throw new Error(`Expected to stay at /admin/dashboard, but was ${currentPath}`);
      }
    });

    await assertTest('Router Guard: Admin enters /staff/login → Redirected to /admin/dashboard', async () => {
      localStorage.clear();
      Auth.setSession(adminToken, { id: 'admin-id', role: 'ADMIN', name: 'Administrator' });
      router.navigate('/staff/login');
      if (currentPath !== '/admin/dashboard') {
        throw new Error(`Expected redirection to /admin/dashboard, but was ${currentPath}`);
      }
    });

    // Section 5: SPA Fallback Serving Dedicated URLs
    await assertTest('SPA Server serves /admin/login with 200 OK', async () => {
      const res = await request(app).get('/admin/login');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.text.includes('College Academic Performance')) throw new Error('Missing HTML title');
    });

    await assertTest('SPA Server serves /staff/login with 200 OK', async () => {
      const res = await request(app).get('/staff/login');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.text.includes('College Academic Performance')) throw new Error('Missing HTML title');
    });

    await assertTest('SPA Server serves /admin/dashboard with 200 OK', async () => {
      const res = await request(app).get('/admin/dashboard');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('SPA Server serves /staff/dashboard with 200 OK', async () => {
      const res = await request(app).get('/staff/dashboard');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

  } catch (err: any) {
    console.error('Fatal error during test run:', err);
  } finally {
    await prisma.$disconnect();
    console.log('\n======================================================');
    console.log(`🏁 Complete Verification: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================\n');
    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runComprehensiveTests();
