import { Request, Response } from 'express';
import { prisma } from '../db';
import { checkStaffAssignment } from '../middleware/auth.middleware';
import { StudentStatus } from '@prisma/client';
import { AcademicPerformanceService } from '../services/academicPerformance.service';
import { AuditAction } from '../services/audit.service';

export class StaffController {
  /**
   * GET /api/staff/assigned-classes
   * Returns only classes & subjects assigned to the logged in staff member
   * enriched with live student count.
   */
  static async getAssignedClasses(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;

      const assignments = await prisma.teacherAssignment.findMany({
        where: { staffId },
        include: {
          subject: true,
          section: {
            include: {
              department: true,
              year: true
            }
          },
          academicYear: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const enriched = await Promise.all(
        assignments.map(async (a) => {
          const studentCount = await prisma.student.count({
            where: {
              sectionId: a.sectionId,
              academicYearId: a.academicYearId,
              status: StudentStatus.ACTIVE
            }
          });
          return {
            ...a,
            id: a.id,
            sectionId: a.sectionId,
            section: a.section.name,
            department: a.section.department?.code || 'CSE',
            department_name: a.section.department?.name || 'Department',
            year: a.section.year?.yearNumber ?? 1,
            yearName: a.section.year?.name || 'First Year',
            yearNumber: a.section.year?.yearNumber ?? 1,
            studentCount,
            student_count: studentCount
          };
        })
      );

      return res.status(200).json({ assignedClasses: enriched, classes: enriched });
    } catch (error) {
      console.error('Get assigned classes error:', error);
      return res.status(500).json({ error: 'Failed to fetch assigned classes' });
    }
  }

  /**
   * GET /api/staff/dashboard-summary
   * Returns information strictly required for marks management:
   * Cards: Assigned Classes, Assigned Subjects, Total Students, Pending Marks, Completed Assessments.
   * Sections: My Classes, My Subjects, Recent Marks Uploads.
   * Zero exposure to admin governance, college analytics, or non-marks metadata.
   */
  static async getDashboardSummary(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;

      // 1. Fetch all teacher assignments for this staff member
      const assignments = await prisma.teacherAssignment.findMany({
        where: { staffId },
        include: {
          subject: {
            include: {
              department: true,
              year: true
            }
          },
          section: {
            include: {
              department: true,
              year: true
            }
          },
          academicYear: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // 2. Extract unique keys
      const assignedSectionIds = Array.from(new Set(assignments.map(a => a.sectionId)));
      const assignedSubjectIds = Array.from(new Set(assignments.map(a => a.subjectId)));
      const assignedAcadYearIds = Array.from(new Set(assignments.map(a => a.academicYearId)));
      const assignedDeptIds = Array.from(new Set(assignments.map(a => a.section.departmentId)));

      // 3. Fetch active students in assigned sections
      const activeStudents = await prisma.student.findMany({
        where: {
          sectionId: { in: assignedSectionIds },
          status: StudentStatus.ACTIVE
        },
        select: {
          id: true,
          registerNumber: true,
          name: true,
          sectionId: true,
          academicYearId: true
        }
      });

      const studentsBySection = new Map<string, typeof activeStudents>();
      for (const st of activeStudents) {
        if (!studentsBySection.has(st.sectionId)) {
          studentsBySection.set(st.sectionId, []);
        }
        studentsBySection.get(st.sectionId)!.push(st);
      }

      const totalStudents = activeStudents.length;

      // 4. Fetch applicable active assessments for staff assignments
      const activeAssessments = await prisma.assessment.findMany({
        where: {
          isActive: true,
          AND: [
            {
              OR: [
                { academicYearId: null },
                { academicYearId: { in: assignedAcadYearIds } }
              ]
            },
            {
              OR: [
                { departmentId: null },
                { departmentId: { in: assignedDeptIds } }
              ]
            },
            {
              OR: [
                { subjectId: null },
                { subjectId: { in: assignedSubjectIds } }
              ]
            }
          ]
        },
        orderBy: { createdAt: 'asc' }
      });

      // 5. Query existing marks recorded for assigned subjects & sections
      const existingMarks = await prisma.mark.findMany({
        where: {
          subjectId: { in: assignedSubjectIds },
          student: {
            sectionId: { in: assignedSectionIds },
            status: StudentStatus.ACTIVE
          }
        },
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          assessmentId: true,
          marksObtained: true,
          maximumMarks: true,
          enteredBy: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              sectionId: true
            }
          }
        }
      });

      const markLookup = new Set(existingMarks.map(m => `${m.studentId}_${m.subjectId}_${m.assessmentId}`));

      // 6. Calculate Pending Marks & Completed Assessments
      let pendingMarks = 0;
      let completedAssessments = 0;

      for (const a of assignments) {
        const applicableAssessments = activeAssessments.filter(ass => {
          if (ass.academicYearId && ass.academicYearId !== a.academicYearId) return false;
          if (ass.departmentId && ass.departmentId !== a.section.departmentId) return false;
          if (ass.subjectId && ass.subjectId !== a.subjectId) return false;
          return true;
        });

        const sectionStudents = studentsBySection.get(a.sectionId) || [];
        const studentCount = sectionStudents.length;

        if (studentCount === 0) continue;

        for (const ass of applicableAssessments) {
          let marksCountForUnit = 0;
          for (const st of sectionStudents) {
            if (markLookup.has(`${st.id}_${a.subjectId}_${ass.id}`)) {
              marksCountForUnit++;
            }
          }

          const missing = studentCount - marksCountForUnit;
          if (missing > 0) {
            pendingMarks += missing;
          } else if (studentCount > 0 && marksCountForUnit >= studentCount) {
            completedAssessments++;
          }
        }
      }

      // 7. Structure "myClasses" section
      const classesMap = new Map<string, any>();
      for (const a of assignments) {
        const sectionId = a.sectionId;
        const enrolled = (studentsBySection.get(sectionId) || []).length;
        if (!classesMap.has(sectionId)) {
          classesMap.set(sectionId, {
            sectionId,
            sectionName: a.section.name,
            departmentCode: a.section.department.code,
            departmentName: a.section.department.name,
            yearName: a.section.year.name,
            academicYear: a.academicYear.yearName,
            academicYearId: a.academicYearId,
            studentCount: enrolled,
            subjects: []
          });
        }
        classesMap.get(sectionId).subjects.push({
          id: a.subject.id,
          code: a.subject.code,
          name: a.subject.name
        });
      }
      const myClasses = Array.from(classesMap.values());

      // 8. Structure "mySubjects" section
      const subjectsMap = new Map<string, any>();
      for (const a of assignments) {
        const subjectId = a.subjectId;
        if (!subjectsMap.has(subjectId)) {
          subjectsMap.set(subjectId, {
            subjectId,
            code: a.subject.code,
            name: a.subject.name,
            departmentCode: a.section.department.code,
            departmentName: a.section.department.name,
            yearName: a.section.year.name,
            semester: a.subject.semester,
            academicYear: a.academicYear.yearName,
            sections: []
          });
        }
        const subj = subjectsMap.get(subjectId);
        if (!subj.sections.some((s: any) => s.sectionId === a.sectionId)) {
          subj.sections.push({
            sectionId: a.sectionId,
            sectionName: a.section.name,
            studentCount: (studentsBySection.get(a.sectionId) || []).length
          });
        }
      }
      const mySubjects = Array.from(subjectsMap.values());

      // 9. Structure "recentMarksUploads" section
      // Query recent marks authored by this staff
      const recentMarksList = await prisma.mark.findMany({
        where: { enteredBy: staffId },
        include: {
          subject: true,
          assessment: true,
          student: {
            include: {
              section: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 40
      });

      // Group recent marks by subject, section, assessment, and minute
      const groupedBatches = new Map<string, any>();
      for (const m of recentMarksList) {
        const dateKey = m.updatedAt.toISOString().substring(0, 16);
        const key = `${m.subjectId}_${m.student.sectionId}_${m.assessmentId}_${dateKey}`;
        if (!groupedBatches.has(key)) {
          groupedBatches.set(key, {
            subjectCode: m.subject.code,
            subjectName: m.subject.name,
            sectionName: m.student.section.name,
            sectionId: m.student.sectionId,
            subjectId: m.subjectId,
            assessmentId: m.assessmentId,
            assessmentName: m.assessment.name,
            assessmentCode: m.assessment.code,
            recordsCount: 0,
            timestamp: m.updatedAt,
            status: 'Recorded'
          });
        }
        groupedBatches.get(key).recordsCount++;
      }
      const recentMarksUploads = Array.from(groupedBatches.values()).slice(0, 10);

      // Backwards-compatible assignedClasses enriched list
      const enrichedAssignedClasses = assignments.map(a => {
        const count = (studentsBySection.get(a.sectionId) || []).length;
        return {
          id: a.id,
          academicYear: a.academicYear.yearName,
          academicYearId: a.academicYearId,
          isCurrentAcademicYear: a.academicYear.isCurrent,
          department: a.section.department.code,
          departmentName: a.section.department.name,
          year: a.section.year.name,
          yearNumber: a.section.year.yearNumber,
          section: a.section.name,
          sectionId: a.sectionId,
          subjectCode: a.subject.code,
          subjectName: a.subject.name,
          subjectId: a.subjectId,
          studentCount: count
        };
      });

      const activeAcademicYear = assignments[0]?.academicYear.yearName || 'Current Academic Year';

      return res.status(200).json({
        summary: {
          // 5 Required Dashboard Cards
          assignedClasses: assignedSectionIds.length,
          assignedSubjects: assignedSubjectIds.length,
          totalStudents: totalStudents,
          pendingMarks,
          completedAssessments,

          // Backward-compatibility aliases
          totalAssignedClasses: assignedSectionIds.length,
          totalAssignedSubjects: assignedSubjectIds.length,
          totalStudentsTaught: totalStudents,
          academicYear: activeAcademicYear
        },
        // 3 Required Dashboard Sections
        myClasses,
        mySubjects,
        recentMarksUploads,

        // Backward-compatibility
        assignedClasses: enrichedAssignedClasses
      });
    } catch (error) {
      console.error('Staff dashboard summary error:', error);
      return res.status(500).json({ error: 'Failed to fetch staff dashboard summary' });
    }
  }

  /**
   * GET /api/staff/marks
   * Staff accessing Staff marks API → ALLOWED (if assigned).
   * Checks database assignment for sectionId, subjectId, and academicYearId.
   */
  static async getMarksForClass(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;
      const sectionId = req.query.sectionId as string;
      const subjectId = req.query.subjectId as string;
      const academicYearId = req.query.academicYearId as string;

      if (!sectionId || !subjectId) {
        return res.status(400).json({
          error: 'sectionId and subjectId are required',
          code: 'MISSING_PARAMS'
        });
      }

      // Check assignment if user is not admin
      if (req.user!.role !== 'ADMIN') {
        const isAssigned = await checkStaffAssignment(staffId, sectionId, subjectId, academicYearId);
        if (!isAssigned) {
          return res.status(403).json({
            error: 'Forbidden: You are not assigned to instruct this subject for this section.',
            code: 'STAFF_CLASS_UNAUTHORIZED'
          });
        }
      }

      // Security & Privacy Guard: Staff only receives the minimum student info required for marks entry.
      // Parent name and parent mobile number are strictly excluded.
      const students = await prisma.student.findMany({
        where: { sectionId },
        select: {
          id: true,
          registerNumber: true,
          name: true,
          status: true,
          sectionId: true,
          marks: {
            where: { subjectId },
            include: { assessment: true }
          }
        },
        orderBy: { registerNumber: 'asc' }
      });

      return res.status(200).json({ students });
    } catch (error) {
      console.error('Get marks error:', error);
      return res.status(500).json({ error: 'Failed to retrieve class marks' });
    }
  }

  /**
   * POST /api/staff/marks
   * Enters or updates marks.
   * Performs database check on staff assignment.
   */
  static async enterMarks(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;
      const { studentId, subjectId, assessmentId, marksObtained, maximumMarks = 100 } = req.body || {};
      const reason = (req.body?.reason || req.body?.changeReason || '').toString().trim();

      if (!studentId || !subjectId || !assessmentId || marksObtained === undefined) {
        return res.status(400).json({
          error: 'studentId, subjectId, assessmentId, and marksObtained are required',
          code: 'MISSING_MARK_FIELDS'
        });
      }

      // Find the student's section
      const student = await prisma.student.findUnique({
        where: { id: studentId }
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found', code: 'STUDENT_NOT_FOUND' });
      }

      // Database verification: Staff can ONLY grade their assigned section, subject, and academic year
      if (req.user!.role !== 'ADMIN') {
        const isAssigned = await checkStaffAssignment(staffId, student.sectionId, subjectId, student.academicYearId);
        if (!isAssigned) {
          return res.status(403).json({
            error: 'Forbidden: You do not have permission to enter marks for this student/subject.',
            code: 'STAFF_CLASS_UNAUTHORIZED'
          });
        }
      }

      // Check if mark already exists
      const existingMark = await prisma.mark.findUnique({
        where: {
          studentId_subjectId_assessmentId: {
            studentId,
            subjectId,
            assessmentId
          }
        }
      });

      let mark;
      if (existingMark) {
        // Record change log
        await prisma.markChangeLog.create({
          data: {
            markId: existingMark.id,
            studentId,
            subjectId,
            assessmentId,
            previousMarks: existingMark.marksObtained,
            newMarks: Number(marksObtained),
            changedBy: staffId,
            reason: reason || 'Faculty revised marks'
          }
        });

        mark = await prisma.mark.update({
          where: { id: existingMark.id },
          data: {
            marksObtained: Number(marksObtained),
            maximumMarks: Number(maximumMarks),
            enteredBy: staffId
          }
        });

        await prisma.auditLog.create({
          data: {
            userId: staffId,
            action: AuditAction.MARKS_UPDATED,
            entity: 'Mark',
            entityId: mark.id,
            metadata: {
              studentId,
              registerNumber: student.registerNumber,
              subjectId,
              assessmentId,
              previousMarks: existingMark.marksObtained,
              newMarks: Number(marksObtained),
              reason: reason || 'Faculty revised marks'
            }
          }
        });
      } else {
        mark = await prisma.mark.create({
          data: {
            studentId,
            subjectId,
            assessmentId,
            marksObtained: Number(marksObtained),
            maximumMarks: Number(maximumMarks),
            enteredBy: staffId
          }
        });

        await prisma.auditLog.create({
          data: {
            userId: staffId,
            action: AuditAction.MARKS_UPLOADED,
            entity: 'Mark',
            entityId: mark.id,
            metadata: {
              studentId,
              registerNumber: student.registerNumber,
              subjectId,
              assessmentId,
              marksObtained: Number(marksObtained),
              reason: reason || 'Individual marks entry'
            }
          }
        });
      }

      return res.status(200).json({
        message: 'Marks recorded successfully',
        mark
      });
    } catch (error) {
      console.error('Enter marks error:', error);
      return res.status(500).json({ error: 'Failed to record marks' });
    }
  }

  /**
   * GET /api/staff/analytics/section
   * Scoped class performance analytics.
   * Access to other sections/subjects is rejected with 403 Forbidden.
   */
  static async getSectionPerformance(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;
      const sectionId = req.query.sectionId as string;
      const subjectId = req.query.subjectId as string;

      if (!sectionId || !subjectId) {
        return res.status(400).json({ error: 'sectionId and subjectId are required' });
      }

      if (req.user!.role !== 'ADMIN') {
        const isAssigned = await checkStaffAssignment(staffId, sectionId, subjectId);
        if (!isAssigned) {
          return res.status(403).json({
            error: 'Forbidden: You cannot view performance for unassigned classes.',
            code: 'STAFF_CLASS_UNAUTHORIZED'
          });
        }
      }

      const marks = await prisma.mark.findMany({
        where: {
          subjectId,
          student: { sectionId }
        },
        include: {
          assessment: true
        }
      });

      const summary = await AcademicPerformanceService.getSectionPerformanceFromDb(sectionId, subjectId);

      return res.status(200).json({
        sectionId,
        subjectId,
        marksCount: marks.length,
        summary
      });
    } catch (error) {
      console.error('Section performance error:', error);
      return res.status(500).json({ error: 'Failed to calculate section performance' });
    }
  }

  /**
   * GET /api/staff/assessments
   * Returns only active assessments relevant to the staff member's assigned classes/subjects.
   * If subjectId/sectionId provided, enforces staff assignment authorization.
   */
  static async getStaffAssessments(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;
      const { sectionId, subjectId, academicYearId } = req.query;

      // 1. If sectionId or subjectId provided, check assignment
      if (sectionId || subjectId) {
        if (!sectionId || !subjectId) {
          return res.status(400).json({
            error: 'Both sectionId and subjectId must be provided when querying class assessments',
            code: 'MISSING_PARAMS'
          });
        }

        if (req.user!.role !== 'ADMIN') {
          const isAssigned = await checkStaffAssignment(
            staffId,
            sectionId as string,
            subjectId as string,
            academicYearId as string
          );

          if (!isAssigned) {
            return res.status(403).json({
              error: 'Forbidden: You are not assigned to instruct this subject for this section.',
              code: 'STAFF_CLASS_UNAUTHORIZED'
            });
          }
        }

        // Fetch section and subject metadata for scoping
        const [section, subject] = await Promise.all([
          prisma.section.findUnique({ where: { id: sectionId as string } }),
          prisma.subject.findUnique({ where: { id: subjectId as string } })
        ]);

        if (!section || !subject) {
          return res.status(404).json({ error: 'Section or Subject not found' });
        }

        // Find active assessments applicable to this specific class/subject or global
        const assessments = await prisma.assessment.findMany({
          where: {
            isActive: true,
            AND: [
              {
                OR: [
                  { academicYearId: null },
                  { academicYearId: section.academicYearId }
                ]
              },
              {
                OR: [
                  { departmentId: null },
                  { departmentId: section.departmentId }
                ]
              },
              {
                OR: [
                  { yearId: null },
                  { yearId: section.yearId }
                ]
              },
              {
                OR: [
                  { semester: null },
                  { semester: subject.semester }
                ]
              },
              {
                OR: [
                  { subjectId: null },
                  { subjectId: subject.id }
                ]
              }
            ]
          },
          orderBy: { createdAt: 'asc' }
        });

        return res.status(200).json({ assessments });
      }

      // 2. Querying all assessments relevant to staff's assignments
      const assignments = await prisma.teacherAssignment.findMany({
        where: { staffId },
        include: {
          section: true,
          subject: true
        }
      });

      if (assignments.length === 0) {
        // Staff has no assignments, return only global assessments
        const globalAssessments = await prisma.assessment.findMany({
          where: {
            isActive: true,
            academicYearId: null,
            departmentId: null,
            subjectId: null
          },
          orderBy: { createdAt: 'asc' }
        });
        return res.status(200).json({ assessments: globalAssessments });
      }

      const assignedSubjectIds = [...new Set(assignments.map(a => a.subjectId))];
      const assignedDeptIds = [...new Set(assignments.map(a => a.section.departmentId))];
      const assignedAcadYearIds = [...new Set(assignments.map(a => a.academicYearId))];

      const assessments = await prisma.assessment.findMany({
        where: {
          isActive: true,
          AND: [
            {
              OR: [
                { academicYearId: null },
                { academicYearId: { in: assignedAcadYearIds } }
              ]
            },
            {
              OR: [
                { departmentId: null },
                { departmentId: { in: assignedDeptIds } }
              ]
            },
            {
              OR: [
                { subjectId: null },
                { subjectId: { in: assignedSubjectIds } }
              ]
            }
          ]
        },
        orderBy: { createdAt: 'asc' }
      });

      return res.status(200).json({ assessments });
    } catch (error: any) {
      console.error('Get staff assessments error:', error);
      return res.status(500).json({ error: 'Failed to retrieve staff assessments' });
    }
  }

  /**
   * GET /api/staff/subjects
   * Returns only subjects assigned to the authenticated staff member.
   */
  static async getAssignedSubjects(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;

      const assignments = await prisma.teacherAssignment.findMany({
        where: { staffId },
        include: {
          subject: {
            include: {
              department: true,
              year: true
            }
          },
          section: true,
          academicYear: true
        }
      });

      // Deduplicate subjects
      const subjectMap = new Map<string, any>();
      for (const a of assignments) {
        if (!subjectMap.has(a.subject.id)) {
          subjectMap.set(a.subject.id, {
            ...a.subject,
            assignedSections: []
          });
        }
        subjectMap.get(a.subject.id).assignedSections.push({
          sectionId: a.sectionId,
          sectionName: a.section.name,
          academicYear: a.academicYear.yearName
        });
      }

      const subjects = Array.from(subjectMap.values());
      return res.status(200).json({ subjects });
    } catch (error: any) {
      console.error('Get staff assigned subjects error:', error);
      return res.status(500).json({ error: 'Failed to retrieve assigned subjects' });
    }
  }
}

