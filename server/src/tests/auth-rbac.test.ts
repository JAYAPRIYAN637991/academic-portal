import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

const app = createApp();

let adminToken: string;
let staff1Token: string;
let staff2Token: string;

let cseSectionAId: string;
let eceSectionAId: string;
let dbmsSubjectId: string;
let tocSubjectId: string;

beforeAll(async () => {
  // Fetch IDs from seeded database
  const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
  const eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });

  const cse3A = await prisma.section.findFirst({
    where: { name: 'A', departmentId: cseDept!.id }
  });
  cseSectionAId = cse3A!.id;

  const ece3A = await prisma.section.findFirst({
    where: { name: 'A', departmentId: eceDept!.id }
  });
  eceSectionAId = ece3A!.id;

  const dbms = await prisma.subject.findUnique({ where: { code: 'CS8501' } });
  dbmsSubjectId = dbms!.id;

  const toc = await prisma.subject.findUnique({ where: { code: 'CS8502' } });
  tocSubjectId = toc!.id;

  // 1. Authenticate Admin
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@college.edu', password: 'admin123' });
  expect(adminRes.status).toBe(200);
  expect(adminRes.body.role).toBe('ADMIN');
  expect(adminRes.body.redirectUrl).toBe('/admin/dashboard');
  adminToken = adminRes.body.token;

  // 2. Authenticate Staff 1 (Sarah - assigned to DBMS on CSE 3A)
  const staff1Res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
  expect(staff1Res.status).toBe(200);
  expect(staff1Res.body.role).toBe('STAFF');
  expect(staff1Res.body.redirectUrl).toBe('/staff/dashboard');
  staff1Token = staff1Res.body.token;

  // 3. Authenticate Staff 2 (Michael - assigned to DC on ECE 3A)
  const staff2Res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'michael.ece@college.edu', password: 'staff123' });
  expect(staff2Res.status).toBe(200);
  expect(staff2Res.body.role).toBe('STAFF');
  staff2Token = staff2Res.body.token;
});

describe('Authentication & Authorization Tests (Role-Based Access Control)', () => {

  test('1. Unauthenticated user accessing protected API → 401 Unauthorized', async () => {
    // Attempt accessing Admin route without token
    const resAdmin = await request(app).get('/api/admin/staff');
    expect(resAdmin.status).toBe(401);
    expect(resAdmin.body.code).toBe('TOKEN_MISSING');

    // Attempt accessing Staff route without token
    const resStaff = await request(app).get('/api/staff/assigned-classes');
    expect(resStaff.status).toBe(401);
    expect(resStaff.body.code).toBe('TOKEN_MISSING');
  });

  test('2. Admin accessing Admin API → ALLOWED (200 OK)', async () => {
    const res = await request(app)
      .get('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.staff).toBeDefined();
    expect(Array.isArray(res.body.staff)).toBe(true);
  });

  test('3. Staff accessing Staff marks API for assigned class/subject → ALLOWED (200 OK)', async () => {
    // Sarah accessing DBMS for CSE 3A (her valid assignment)
    const res = await request(app)
      .get(`/api/staff/marks?sectionId=${cseSectionAId}&subjectId=${dbmsSubjectId}`)
      .set('Authorization', `Bearer ${staff1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.students).toBeDefined();
    expect(Array.isArray(res.body.students)).toBe(true);
  });

  test('4. Staff accessing Admin API → 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/staff')
      .set('Authorization', `Bearer ${staff1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_ACCESS_REQUIRED');
  });

  test('5. Staff trying to access another class → 403 Forbidden', async () => {
    // Sarah is NOT assigned to ECE 3A
    const res = await request(app)
      .get(`/api/staff/marks?sectionId=${eceSectionAId}&subjectId=${dbmsSubjectId}`)
      .set('Authorization', `Bearer ${staff1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAFF_CLASS_UNAUTHORIZED');
  });

  test('6. Staff trying to access another subject → 403 Forbidden', async () => {
    // Sarah teaches DBMS (CS8501) on CSE 3A, NOT TOC (CS8502)
    const res = await request(app)
      .get(`/api/staff/marks?sectionId=${cseSectionAId}&subjectId=${tocSubjectId}`)
      .set('Authorization', `Bearer ${staff1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAFF_CLASS_UNAUTHORIZED');
  });

  test('7. Staff trying to access overall analytics → 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/overall')
      .set('Authorization', `Bearer ${staff1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_ACCESS_REQUIRED');
  });

  test('8. Admin accessing overall analytics → ALLOWED (200 OK)', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/overall')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('OVERALL_COLLEGE_ANALYTICS');
    expect(res.body.metrics.totalDepartments).toBeGreaterThan(0);
    expect(res.body.metrics.totalStudents).toBeGreaterThan(0);
  });

  test('9. Admin can create new Staff account from Admin panel → 201 Created', async () => {
    const uniqueEmail = `test.staff.${Date.now()}@college.edu`;
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr. New Faculty',
        email: uniqueEmail,
        password: 'securePassword123'
      });

    expect(res.status).toBe(201);
    expect(res.body.staff.email).toBe(uniqueEmail);
    expect(res.body.staff.role).toBe('STAFF');

    // Verify new staff can now login and receive redirectUrl: /staff/dashboard
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail, password: 'securePassword123' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.role).toBe('STAFF');
    expect(loginRes.body.redirectUrl).toBe('/staff/dashboard');
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
