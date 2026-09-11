import { PrismaClient, Role, StudentStatus, NoticeType, NoticeTargetType, NoticeStatus, NotificationType, NotificationCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(pw: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pw, salt);
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Academic Year
  const academicYear = await prisma.academicYear.upsert({
    where: { yearName: '2025-2026' },
    update: {},
    create: {
      yearName: '2025-2026',
      isCurrent: true
    }
  });
  console.log(`✓ Academic Year: ${academicYear.yearName}`);

  // 2. Seed Departments
  const deptCSE = await prisma.department.upsert({
    where: { code: 'CSE' },
    update: {},
    create: {
      code: 'CSE',
      name: 'Computer Science & Engineering'
    }
  });

  const deptECE = await prisma.department.upsert({
    where: { code: 'ECE' },
    update: {},
    create: {
      code: 'ECE',
      name: 'Electronics & Communication Engineering'
    }
  });

  const deptMECH = await prisma.department.upsert({
    where: { code: 'MECH' },
    update: {},
    create: {
      code: 'MECH',
      name: 'Mechanical Engineering'
    }
  });
  console.log('✓ Departments: CSE, ECE, MECH');

  // 3. Seed Years
  const year1 = await prisma.year.upsert({
    where: { yearNumber: 1 },
    update: {},
    create: { yearNumber: 1, name: 'First Year' }
  });
  const year2 = await prisma.year.upsert({
    where: { yearNumber: 2 },
    update: {},
    create: { yearNumber: 2, name: 'Second Year' }
  });
  const year3 = await prisma.year.upsert({
    where: { yearNumber: 3 },
    update: {},
    create: { yearNumber: 3, name: 'Third Year' }
  });
  const year4 = await prisma.year.upsert({
    where: { yearNumber: 4 },
    update: {},
    create: { yearNumber: 4, name: 'Final Year' }
  });
  console.log('✓ Academic Years: 1, 2, 3, 4');

  // 4. Seed Sections
  const secCSE3A = await prisma.section.upsert({
    where: {
      name_departmentId_yearId_academicYearId: {
        name: 'A',
        departmentId: deptCSE.id,
        yearId: year3.id,
        academicYearId: academicYear.id
      }
    },
    update: {},
    create: {
      name: 'A',
      departmentId: deptCSE.id,
      yearId: year3.id,
      academicYearId: academicYear.id
    }
  });

  const secCSE3B = await prisma.section.upsert({
    where: {
      name_departmentId_yearId_academicYearId: {
        name: 'B',
        departmentId: deptCSE.id,
        yearId: year3.id,
        academicYearId: academicYear.id
      }
    },
    update: {},
    create: {
      name: 'B',
      departmentId: deptCSE.id,
      yearId: year3.id,
      academicYearId: academicYear.id
    }
  });

  const secECE3A = await prisma.section.upsert({
    where: {
      name_departmentId_yearId_academicYearId: {
        name: 'A',
        departmentId: deptECE.id,
        yearId: year3.id,
        academicYearId: academicYear.id
      }
    },
    update: {},
    create: {
      name: 'A',
      departmentId: deptECE.id,
      yearId: year3.id,
      academicYearId: academicYear.id
    }
  });
  console.log('✓ Sections: CSE 3A, CSE 3B, ECE 3A');

  // 5. Seed Users (1 Admin, 2 Staff)
  const adminPassword = await hashPassword('admin123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@college.edu' },
    update: {},
    create: {
      name: 'Chief Administrator',
      email: 'admin@college.edu',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isActive: true
    }
  });

  const staff1Password = await hashPassword('Sarah@15081988');
  const staff1 = await prisma.user.upsert({
    where: { email: 'sarah.cse@college.edu' },
    update: {
      username: 'sarah.jenkins',
      dateOfBirth: '1988-08-15',
      passwordHash: staff1Password,
      passwordAuthorized: true,
      passwordAuthorizedAt: new Date()
    },
    create: {
      name: 'Prof. Sarah Jenkins',
      email: 'sarah.cse@college.edu',
      username: 'sarah.jenkins',
      dateOfBirth: '1988-08-15',
      passwordHash: staff1Password,
      passwordAuthorized: true,
      passwordAuthorizedAt: new Date(),
      role: Role.STAFF,
      isActive: true
    }
  });

  const staff2Password = await hashPassword('Michael@20111985');
  const staff2 = await prisma.user.upsert({
    where: { email: 'michael.ece@college.edu' },
    update: {
      username: 'michael.chang',
      dateOfBirth: '1985-11-20',
      passwordHash: staff2Password,
      passwordAuthorized: true,
      passwordAuthorizedAt: new Date()
    },
    create: {
      name: 'Dr. Michael Chang',
      email: 'michael.ece@college.edu',
      username: 'michael.chang',
      dateOfBirth: '1985-11-20',
      passwordHash: staff2Password,
      passwordAuthorized: true,
      passwordAuthorizedAt: new Date(),
      role: Role.STAFF,
      isActive: true
    }
  });
  console.log('✓ Users: 1 Admin (admin@college.edu), 2 Staff with Name+DOB logins (Prof. Sarah Jenkins / Sarah@15081988, Dr. Michael Chang / Michael@20111985)');

  // 6. Seed Subjects
  const subDBMS = await prisma.subject.upsert({
    where: { code: 'CS8501' },
    update: {},
    create: {
      code: 'CS8501',
      name: 'Database Management Systems',
      departmentId: deptCSE.id,
      yearId: year3.id,
      semester: 5
    }
  });

  const subTOC = await prisma.subject.upsert({
    where: { code: 'CS8502' },
    update: {},
    create: {
      code: 'CS8502',
      name: 'Theory of Computation',
      departmentId: deptCSE.id,
      yearId: year3.id,
      semester: 5
    }
  });

  const subDC = await prisma.subject.upsert({
    where: { code: 'EC8501' },
    update: {},
    create: {
      code: 'EC8501',
      name: 'Digital Communication',
      departmentId: deptECE.id,
      yearId: year3.id,
      semester: 5
    }
  });
  console.log('✓ Subjects: CS8501 (DBMS), CS8502 (TOC), EC8501 (DC)');

  // 7. Seed Staff Assignments (TeacherAssignment)
  const assign1 = await prisma.teacherAssignment.upsert({
    where: {
      subjectId_sectionId_academicYearId: {
        subjectId: subDBMS.id,
        sectionId: secCSE3A.id,
        academicYearId: academicYear.id
      }
    },
    update: { staffId: staff1.id },
    create: {
      staffId: staff1.id,
      subjectId: subDBMS.id,
      sectionId: secCSE3A.id,
      academicYearId: academicYear.id
    }
  });

  const assign2 = await prisma.teacherAssignment.upsert({
    where: {
      subjectId_sectionId_academicYearId: {
        subjectId: subDC.id,
        sectionId: secECE3A.id,
        academicYearId: academicYear.id
      }
    },
    update: { staffId: staff2.id },
    create: {
      staffId: staff2.id,
      subjectId: subDC.id,
      sectionId: secECE3A.id,
      academicYearId: academicYear.id
    }
  });
  console.log('✓ Teacher Assignments: Sarah -> DBMS (CSE 3A), Michael -> DC (ECE 3A)');

  // 8. Seed Assessments (Non-hardcoded)
  const assessments = [
    { name: 'Internal Assessment 1', code: 'IA-1', description: 'Unit 1 & Unit 2 Evaluation' },
    { name: 'Internal Assessment 2', code: 'IA-2', description: 'Unit 3 & Unit 4 Evaluation' },
    { name: 'Internal Assessment 3', code: 'IA-3', description: 'Full Syllabus Remedial' },
    { name: 'Model Examination', code: 'MODEL', description: 'Pre-University Model Exam' },
    { name: 'End Semester Exam', code: 'SEMESTER', description: 'University Final Examination' }
  ];

  const assessmentMap: Record<string, string> = {};
  for (const a of assessments) {
    const record = await prisma.assessment.upsert({
      where: { code: a.code },
      update: {},
      create: a
    });
    assessmentMap[a.code] = record.id;
  }
  console.log('✓ Assessments: IA-1, IA-2, IA-3, MODEL, SEMESTER');

  // 9. Seed Students (with dummy parent phone numbers)
  const sampleStudents = [
    { reg: '723723106001', name: 'Ethan Vance', sec: secCSE3A.id, dept: deptCSE.id, pName: 'Robert Vance', pMobile: '+919800000001' },
    { reg: '723723106002', name: 'Chloe Miller', sec: secCSE3A.id, dept: deptCSE.id, pName: 'David Miller', pMobile: '+919800000002' },
    { reg: '723723106003', name: 'Lucas Scott', sec: secCSE3A.id, dept: deptCSE.id, pName: 'Nathan Scott', pMobile: '+919800000003' },
    { reg: '723723106004', name: 'Aria Montgomery', sec: secCSE3A.id, dept: deptCSE.id, pName: 'Byron Montgomery', pMobile: '+919800000004' },
    { reg: '723723106005', name: 'Liam Davis', sec: secECE3A.id, dept: deptECE.id, pName: 'Mark Davis', pMobile: '+919800000005' }
  ];

  const studentRecords = [];
  for (const s of sampleStudents) {
    const student = await prisma.student.upsert({
      where: {
        registerNumber_academicYearId: {
          registerNumber: s.reg,
          academicYearId: academicYear.id
        }
      },
      update: {},
      create: {
        registerNumber: s.reg,
        name: s.name,
        academicYearId: academicYear.id,
        departmentId: s.dept,
        yearId: year3.id,
        sectionId: s.sec,
        parentName: s.pName,
        parentMobile: s.pMobile,
        status: StudentStatus.ACTIVE
      }
    });
    studentRecords.push(student);
  }
  console.log(`✓ Students: ${studentRecords.length} enrolled with verified parent contact records`);

  // 10. Seed Marks (IA-1 for DBMS)
  const ia1Id = assessmentMap['IA-1'];
  const ia1MarksData = [
    { studentId: studentRecords[0].id, marks: 88.5 },
    { studentId: studentRecords[1].id, marks: 74.0 },
    { studentId: studentRecords[2].id, marks: 58.0 },
    { studentId: studentRecords[3].id, marks: 95.0 }
  ];

  for (const m of ia1MarksData) {
    await prisma.mark.upsert({
      where: {
        studentId_subjectId_assessmentId: {
          studentId: m.studentId,
          subjectId: subDBMS.id,
          assessmentId: ia1Id
        }
      },
      update: { marksObtained: m.marks },
      create: {
        studentId: m.studentId,
        subjectId: subDBMS.id,
        assessmentId: ia1Id,
        marksObtained: m.marks,
        maximumMarks: 100.0,
        enteredBy: staff1.id
      }
    });
  }
  console.log('✓ Marks: Seeded IA-1 marks for DBMS');

  // 11. Seed Performance Snapshots
  for (const m of ia1MarksData) {
    const percentage = (m.marks / 100.0) * 100.0;
    const status = percentage >= 75 ? 'EXCELLENT' : percentage >= 50 ? 'GOOD' : 'NEEDS_IMPROVEMENT';

    await prisma.performanceSnapshot.upsert({
      where: {
        studentId_assessmentId: {
          studentId: m.studentId,
          assessmentId: ia1Id
        }
      },
      update: {},
      create: {
        studentId: m.studentId,
        assessmentId: ia1Id,
        total: m.marks,
        maximumTotal: 100.0,
        percentage,
        performanceStatus: status
      }
    });
  }
  console.log('✓ Performance Snapshots created for IA-1');

  // 12. Seed College Notice
  await prisma.collegeNotice.create({
    data: {
      title: 'Internal Assessment 2 (IA-2) Schedule Released',
      content: 'The second internal assessment exams will commence from October 15th, 2026. All faculty must complete syllabus portions by October 10th.',
      noticeType: NoticeType.INTERNAL_EXAM,
      targetType: NoticeTargetType.ALL_COLLEGE,
      academicYearId: academicYear.id,
      createdBy: adminUser.id,
      status: NoticeStatus.PUBLISHED,
      publishedAt: new Date()
    }
  });
  console.log('✓ College Notice: IA-2 Schedule Announcement');

  // 13. Seed Sample Notifications
  await prisma.notification.create({
    data: {
      studentId: studentRecords[0].id,
      parentMobile: studentRecords[0].parentMobile,
      type: NotificationType.WHATSAPP,
      category: NotificationCategory.PERFORMANCE,
      title: 'IA-1 Marks Report: Ethan Vance',
      message: 'Dear Parent, your ward Ethan Vance has scored 88.5/100 in CS8501 Database Management Systems (IA-1). Status: EXCELLENT.',
      status: 'SENT',
      providerMessageId: 'WA-MSG-DUMMY-001',
      sentAt: new Date()
    }
  });
  console.log('✓ Parent Notification record created');

  // 14. Seed Audit Log
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SYSTEM_SEED',
      entity: 'SystemDatabase',
      entityId: 'ALL',
      metadata: { initializedAt: new Date().toISOString(), environment: 'development' }
    }
  });
  console.log('✓ Initial Audit Log recorded');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
