import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

async function runSubjectsAssessmentsTests() {
  console.log('🧪 Starting Admin-Only Subject & Assessment Management Test Suite...\n');
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

  // Tracking IDs for cleanup
  const createdSubjectIds: string[] = [];
  const createdAssessmentIds: string[] = [];

  try {
    // 1. Authenticate Admin and Staff
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    const staffToken = staffLogin.body.token;

    // Prerequisite entities
    const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });
    const yr3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });
    const yr2 = await prisma.year.findFirst({ where: { yearNumber: 2 } });

    // Sections
    const secCSE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id, academicYearId: currentYear!.id }
    });
    const secECE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: eceDept!.id, yearId: yr3!.id, academicYearId: currentYear!.id }
    });

    // Existing Subjects
    const subDBMS = await prisma.subject.findUnique({ where: { code: 'CS8501' } });
    const subDC = await prisma.subject.findUnique({ where: { code: 'EC8501' } });

    console.log('--- SECTION 1: ADMIN SUBJECT MANAGEMENT ---');

    let testSubjectId: string = '';

    await assertTest('Admin creates new subject with complete metadata (Name, Code, Dept, Year, Sem, Max Marks, Status)', async () => {
      const res = await request(app)
        .post('/api/admin/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Distributed Systems & Cloud',
          code: 'CS8505',
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          semester: 5,
          maximumMarks: 100,
          isActive: true
        });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.subject || res.body.subject.code !== 'CS8505') throw new Error('Subject not created properly');
      if (res.body.subject.maximumMarks !== 100) throw new Error('maximumMarks did not match');
      if (res.body.subject.isActive !== true) throw new Error('isActive status did not match');

      testSubjectId = res.body.subject.id;
      createdSubjectIds.push(testSubjectId);
    });

    await assertTest('Admin creates another subject for Year 2, Semester 3', async () => {
      const res = await request(app)
        .post('/api/admin/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Digital Principles & System Design',
          code: 'CS8351',
          departmentId: cseDept!.id,
          yearId: yr2!.id,
          semester: 3,
          maximumMarks: 100,
          isActive: true
        });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      createdSubjectIds.push(res.body.subject.id);
    });

    await assertTest('Duplicate subject code prevention rejects with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/admin/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Cloud Systems',
          code: 'cs8505', // lower case check
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          semester: 5,
          maximumMarks: 100
        });

      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.code !== 'SUBJECT_CODE_EXISTS') throw new Error(`Expected code SUBJECT_CODE_EXISTS, got ${res.body.code}`);
    });

    await assertTest('Semester-Year mismatch validation rejects invalid combinations (Sem 7 for Year 3)', async () => {
      const res = await request(app)
        .post('/api/admin/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Semester Subject',
          code: 'CS8701',
          departmentId: cseDept!.id,
          yearId: yr3!.id, // Yr 3 only has Sem 5 and 6
          semester: 7,
          maximumMarks: 100
        });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (res.body.code !== 'SEMESTER_YEAR_MISMATCH') throw new Error(`Expected SEMESTER_YEAR_MISMATCH, got ${res.body.code}`);
    });

    await assertTest('Admin filters and searches subjects', async () => {
      const res = await request(app)
        .get(`/api/admin/subjects?departmentId=${cseDept!.id}&yearId=${yr3!.id}&search=Distributed`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.subjects) || res.body.subjects.length === 0) {
        throw new Error('Expected at least 1 filtered subject');
      }
      if (res.body.subjects[0].code !== 'CS8505') {
        throw new Error(`Expected CS8505, found ${res.body.subjects[0].code}`);
      }
    });

    await assertTest('Admin updates subject details (Name, Maximum Marks)', async () => {
      const res = await request(app)
        .put(`/api/admin/subjects/${testSubjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Distributed & Cloud Systems Advanced',
          maximumMarks: 150
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.subject.name !== 'Distributed & Cloud Systems Advanced') throw new Error('Name was not updated');
      if (res.body.subject.maximumMarks !== 150) throw new Error('Maximum marks was not updated');
    });

    await assertTest('Admin toggles subject status (Active -> Inactive -> Active)', async () => {
      // Toggle to inactive
      const res1 = await request(app)
        .patch(`/api/admin/subjects/${testSubjectId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      if (res1.status !== 200) throw new Error(`Expected 200, got ${res1.status}`);
      if (res1.body.subject.isActive !== false) throw new Error('Expected isActive = false');

      // Toggle back to active
      const res2 = await request(app)
        .patch(`/api/admin/subjects/${testSubjectId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });

      if (res2.status !== 200) throw new Error(`Expected 200, got ${res2.status}`);
      if (res2.body.subject.isActive !== true) throw new Error('Expected isActive = true');
    });

    await assertTest('Safe deletion guard prevents deleting referenced subject (CS8501 has teacher assignment)', async () => {
      const res = await request(app)
        .delete(`/api/admin/subjects/${subDBMS!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 400) throw new Error(`Expected 400 Bad Request, got ${res.status}`);
      if (res.body.code !== 'CANNOT_DELETE_REFERENCED_SUBJECT') {
        throw new Error(`Expected code CANNOT_DELETE_REFERENCED_SUBJECT, got ${res.body.code}`);
      }
      if (!res.body.references || res.body.references.teacherAssignments < 1) {
        throw new Error('Expected reference details in error response');
      }
    });

    await assertTest('Safe deletion successfully deletes unreferenced subject', async () => {
      // Create temporary unreferenced subject
      const tempRes = await request(app)
        .post('/api/admin/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Temporary Unreferenced Subject',
          code: 'TEMP999',
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          semester: 5,
          maximumMarks: 100
        });

      const tempId = tempRes.body.subject.id;

      const delRes = await request(app)
        .delete(`/api/admin/subjects/${tempId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (delRes.status !== 200) throw new Error(`Expected 200 OK, got ${delRes.status}`);

      // Verify deletion in DB
      const check = await prisma.subject.findUnique({ where: { id: tempId } });
      if (check) throw new Error('Subject should have been deleted from DB');
    });

    console.log('\n--- SECTION 2: ADMIN DYNAMIC ASSESSMENT MANAGEMENT ---');

    let ia1Id = '';
    let ia2Id = '';
    let ia3Id = '';
    let modelId = '';
    let semId = '';
    let customQuizId = '';

    await assertTest('Admin creates dynamic assessment: IA-1 (non-hardcoded)', async () => {
      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Internal Assessment 1 Dyn',
          code: 'IA-1-DYN',
          description: 'Unit 1 and 2 continuous assessment',
          maximumMarks: 50,
          weightage: 20,
          isActive: true
        });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      ia1Id = res.body.assessment.id;
      createdAssessmentIds.push(ia1Id);
    });

    await assertTest('Admin creates dynamic assessment: IA-2 (non-hardcoded)', async () => {
      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Internal Assessment 2 Dyn',
          code: 'IA-2-DYN',
          description: 'Unit 3 and 4 continuous assessment',
          maximumMarks: 50,
          weightage: 20,
          isActive: true
        });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      ia2Id = res.body.assessment.id;
      createdAssessmentIds.push(ia2Id);
    });

    await assertTest('Admin creates dynamic assessment: IA-3 (non-hardcoded)', async () => {
      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Internal Assessment 3 Dyn',
          code: 'IA-3-DYN',
          description: 'Full syllabus remedial assessment',
          maximumMarks: 100,
          weightage: 20,
          isActive: true
        });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      ia3Id = res.body.assessment.id;
      createdAssessmentIds.push(ia3Id);
    });

    await assertTest('Admin creates dynamic assessment: MODEL (non-hardcoded)', async () => {
      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Model Practical & Theory Exam',
          code: 'MODEL-DYN',
          description: 'Pre-university simulation exam',
          maximumMarks: 100,
          weightage: 25,
          isActive: true
        });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      modelId = res.body.assessment.id;
      createdAssessmentIds.push(modelId);
    });

    await assertTest('Admin creates dynamic assessment: SEMESTER (non-hardcoded)', async () => {
      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'End Semester University Exam',
          code: 'SEMESTER-DYN',
          description: 'Final university grading exam',
          maximumMarks: 100,
          weightage: 50,
          isActive: true
        });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      semId = res.body.assessment.id;
      createdAssessmentIds.push(semId);
    });

    await assertTest('Admin creates custom assessment type (verifying non-hardcoded flexibility)', async () => {
      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Surprise Lab Practical Assessment',
          code: 'SURPRISE-LAB',
          description: 'Hands-on programming coding challenge',
          maximumMarks: 25,
          weightage: 5,
          isActive: true
        });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      customQuizId = res.body.assessment.id;
      createdAssessmentIds.push(customQuizId);
    });

    await assertTest('Duplicate assessment code prevention returns 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate IA-1',
          code: 'ia-1-dyn',
          maximumMarks: 50
        });

      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
      if (res.body.code !== 'ASSESSMENT_CODE_EXISTS') throw new Error(`Expected ASSESSMENT_CODE_EXISTS, got ${res.body.code}`);
    });

    await assertTest('Admin updates assessment details and toggles status', async () => {
      // Update maxMarks
      const updateRes = await request(app)
        .put(`/api/admin/assessments/${customQuizId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maximumMarks: 30,
          description: 'Updated coding challenge'
        });

      if (updateRes.status !== 200) throw new Error(`Expected 200, got ${updateRes.status}`);
      if (updateRes.body.assessment.maximumMarks !== 30) throw new Error('Max marks not updated');

      // Toggle status
      const toggleRes = await request(app)
        .patch(`/api/admin/assessments/${customQuizId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      if (toggleRes.status !== 200) throw new Error(`Expected 200, got ${toggleRes.status}`);
      if (toggleRes.body.assessment.isActive !== false) throw new Error('isActive status not updated');
    });

    await assertTest('Admin safe deletion guard protects referenced assessment (with student marks)', async () => {
      // Find an existing assessment with marks (e.g. from seed)
      const existingMark = await prisma.mark.findFirst({
        include: { assessment: true }
      });

      if (existingMark) {
        const res = await request(app)
          .delete(`/api/admin/assessments/${existingMark.assessmentId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
        if (res.body.code !== 'CANNOT_DELETE_REFERENCED_ASSESSMENT') {
          throw new Error(`Expected CANNOT_DELETE_REFERENCED_ASSESSMENT, got ${res.body.code}`);
        }
      }
    });

    await assertTest('Admin safely deletes unreferenced assessment', async () => {
      const res = await request(app)
        .delete(`/api/admin/assessments/${customQuizId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const check = await prisma.assessment.findUnique({ where: { id: customQuizId } });
      if (check) throw new Error('Assessment should have been deleted');
    });

    console.log('\n--- SECTION 3: STAFF PERMISSIONS & RBAC RESTRICTIONS (403 FORBIDDEN) ---');

    await assertTest('Staff cannot create subjects -> 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/subjects')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Hacker Subject',
          code: 'HACK101',
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          semester: 5,
          maximumMarks: 100
        });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    await assertTest('Staff cannot update subjects -> 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/admin/subjects/${testSubjectId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Malicious Update' });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    await assertTest('Staff cannot toggle subject status -> 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/admin/subjects/${testSubjectId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ isActive: false });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff cannot delete subjects -> 403 Forbidden', async () => {
      const res = await request(app)
        .delete(`/api/admin/subjects/${testSubjectId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff cannot create assessments via Admin route -> 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/assessments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Staff Unauthorized Exam',
          code: 'STAFF-EXAM',
          maximumMarks: 100
        });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff cannot create assessments via Staff route -> 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/staff/assessments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Staff Exam',
          code: 'STAFF-TEST',
          maximumMarks: 100
        });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CANNOT_MANAGE_ASSESSMENTS') throw new Error(`Expected STAFF_CANNOT_MANAGE_ASSESSMENTS, got ${res.body.code}`);
    });

    await assertTest('Staff cannot delete assessments -> 403 Forbidden', async () => {
      const res = await request(app)
        .delete(`/api/staff/assessments/${ia1Id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CANNOT_MANAGE_ASSESSMENTS') throw new Error(`Expected STAFF_CANNOT_MANAGE_ASSESSMENTS, got ${res.body.code}`);
    });

    console.log('\n--- SECTION 4: STAFF SCOPED VISIBILITY ---');

    // Create an ECE-specific assessment that Sarah (CSE staff) should NOT see
    const eceAssessment = await prisma.assessment.create({
      data: {
        name: 'ECE Special Hardware Test',
        code: 'ECE-HW-TEST',
        departmentId: eceDept!.id,
        maximumMarks: 50,
        isActive: true
      }
    });
    createdAssessmentIds.push(eceAssessment.id);

    // Create an inactive assessment that should NOT appear in staff list
    const inactiveAssessment = await prisma.assessment.create({
      data: {
        name: 'Draft Deactivated Assessment',
        code: 'DRAFT-INACTIVE',
        maximumMarks: 50,
        isActive: false
      }
    });
    createdAssessmentIds.push(inactiveAssessment.id);

    await assertTest('Staff fetches assessments for assigned class (Sarah -> CSE 3A, DBMS) -> 200 OK', async () => {
      const res = await request(app)
        .get(`/api/staff/assessments?sectionId=${secCSE3A!.id}&subjectId=${subDBMS!.id}&academicYearId=${currentYear!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!Array.isArray(res.body.assessments)) throw new Error('Expected assessments array');

      const codes = res.body.assessments.map((a: any) => a.code);

      // Global active assessments should be visible
      if (!codes.includes('IA-1-DYN')) throw new Error('Expected IA-1-DYN to be visible');
      if (!codes.includes('IA-2-DYN')) throw new Error('Expected IA-2-DYN to be visible');

      // ECE-specific assessment must NOT be visible to CSE class
      if (codes.includes('ECE-HW-TEST')) throw new Error('ECE assessment should NOT be visible to CSE class');

      // Inactive assessment must NOT be visible
      if (codes.includes('DRAFT-INACTIVE')) throw new Error('Inactive assessment should NOT be visible');
    });

    await assertTest('Staff accessing assessments for UNASSIGNED class (Sarah -> ECE 3A, DC) -> 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/staff/assessments?sectionId=${secECE3A!.id}&subjectId=${subDC!.id}&academicYearId=${currentYear!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') {
        throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
      }
    });

    await assertTest('Staff fetches assigned subjects -> returns only subjects Sarah is assigned to', async () => {
      const res = await request(app)
        .get('/api/staff/subjects')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.subjects)) throw new Error('Expected subjects array');

      const subjectCodes = res.body.subjects.map((s: any) => s.code);
      if (!subjectCodes.includes('CS8501')) throw new Error('Expected assigned subject CS8501 to be present');
      if (subjectCodes.includes('EC8501')) throw new Error('Unassigned ECE subject EC8501 must NOT be present');
    });

    console.log('\n--- SECTION 5: UNAUTHENTICATED SECURITY ---');

    await assertTest('Unauthenticated access to /api/admin/subjects returns 401', async () => {
      const res = await request(app).get('/api/admin/subjects');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('Unauthenticated access to /api/admin/assessments returns 401', async () => {
      const res = await request(app).get('/api/admin/assessments');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('Unauthenticated access to /api/staff/assessments returns 401', async () => {
      const res = await request(app).get('/api/staff/assessments');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

  } finally {
    // Clean up created test entities
    console.log('\n🧹 Cleaning up test entities...');
    for (const aId of createdAssessmentIds) {
      try {
        await prisma.assessment.delete({ where: { id: aId } });
      } catch {}
    }
    for (const sId of createdSubjectIds) {
      try {
        await prisma.subject.delete({ where: { id: sId } });
      } catch {}
    }
  }

  console.log('\n=============================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSubjectsAssessmentsTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
