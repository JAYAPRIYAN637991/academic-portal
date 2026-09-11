import { Request, Response } from 'express';
import * as xlsx from 'xlsx';
import { prisma } from '../db';
import { checkStaffAssignment } from '../middleware/auth.middleware';
import { AuditAction } from '../services/audit.service';

interface PreviewRow {
  rowNumber: number;
  registerNumber: string;
  studentName?: string;
  studentId?: string;
  rawMarks: any;
  marksObtained?: number;
  maximumMarks?: number;
  previousMarks?: number | null;
  action?: 'INSERT' | 'UPDATE';
  status: 'VALID' | 'INVALID' | 'DUPLICATE';
  error?: string;
  errorCode?: string;
}

export class MarksUploadController {
  /**
   * GET /api/staff/marks/template or /api/admin/marks/template
   * Generates a pre-formatted Excel template (.xlsx) with columns:
   * Register Number | Student Name | Marks
   * Pre-populates enrolled active students for the selected class.
   */
  static async downloadTemplate(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;
      const { sectionId, subjectId, assessmentId, academicYearId } = req.query;

      if (!sectionId) {
        return res.status(400).json({ error: 'sectionId is required to generate class template', code: 'MISSING_SECTION' });
      }

      // Check staff assignment if not admin
      if (req.user!.role !== 'ADMIN') {
        if (!subjectId) {
          return res.status(400).json({ error: 'subjectId is required for faculty verification', code: 'MISSING_SUBJECT' });
        }
        const isAssigned = await checkStaffAssignment(
          staffId,
          sectionId as string,
          subjectId as string,
          academicYearId as string
        );
        if (!isAssigned) {
          return res.status(403).json({
            error: 'Forbidden: You are not assigned to instruct this class/subject.',
            code: 'STAFF_CLASS_UNAUTHORIZED'
          });
        }
      }

      // Fetch section, subject, and assessment details
      const [section, subject, assessment] = await Promise.all([
        prisma.section.findUnique({
          where: { id: sectionId as string },
          include: { department: true, year: true, academicYear: true }
        }),
        subjectId ? prisma.subject.findUnique({ where: { id: subjectId as string } }) : null,
        assessmentId ? prisma.assessment.findUnique({ where: { id: assessmentId as string } }) : null
      ]);

      if (!section) {
        return res.status(404).json({ error: 'Section not found', code: 'SECTION_NOT_FOUND' });
      }

      // Fetch enrolled active students for this section
      const students = await prisma.student.findMany({
        where: {
          sectionId: section.id,
          status: 'ACTIVE',
          ...(academicYearId ? { academicYearId: academicYearId as string } : {})
        },
        select: {
          registerNumber: true,
          name: true
        },
        orderBy: { registerNumber: 'asc' }
      });

      const headers = ['Register Number', 'Student Name', 'Marks'];
      const dataRows = students.length > 0
        ? students.map(s => [s.registerNumber, s.name, ''])
        : [
            ['2025CSE001', 'Sample Student 1', ''],
            ['2025CSE002', 'Sample Student 2', '']
          ];

      const sheetData = [headers, ...dataRows];
      const ws = xlsx.utils.aoa_to_sheet(sheetData);

      // Formatting column widths
      ws['!cols'] = [
        { wch: 18 }, // Register Number
        { wch: 26 }, // Student Name
        { wch: 12 }  // Marks
      ];

      const wb = xlsx.utils.book_new();
      const sheetTitle = `${section.department.code}_Yr${section.year.yearNumber}_${section.name}`.substring(0, 31);
      xlsx.utils.book_append_sheet(wb, ws, sheetTitle);

      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const fileName = `marks_template_${section.department.code}_sec${section.name}_${subject ? subject.code : 'subject'}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.status(200).send(buffer);
    } catch (error: any) {
      console.error('Download marks template error:', error);
      return res.status(500).json({ error: 'Failed to generate marks template' });
    }
  }

  /**
   * POST /api/staff/marks/upload-preview or /api/admin/marks/upload-preview
   * Parses uploaded Excel (.xlsx, .xls) or CSV (.csv) file and performs exhaustive row-by-row validation.
   */
  static async previewMarksUpload(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;
      const sectionId = (req.body && req.body.sectionId) || (req.query.sectionId as string);
      const subjectId = (req.body && req.body.subjectId) || (req.query.subjectId as string);
      const assessmentId = (req.body && req.body.assessmentId) || (req.query.assessmentId as string);
      const academicYearId = (req.body && req.body.academicYearId) || (req.query.academicYearId as string);

      // 1. Parameter Validation
      if (!sectionId || !subjectId || !assessmentId) {
        return res.status(400).json({
          error: 'sectionId, subjectId, and assessmentId are required',
          code: 'MISSING_PARAMS'
        });
      }

      // 2. Database verification: Staff can ONLY upload marks for their assigned section & subject
      if (req.user!.role !== 'ADMIN') {
        const isAssigned = await checkStaffAssignment(staffId, sectionId, subjectId, academicYearId);
        if (!isAssigned) {
          return res.status(403).json({
            error: 'Forbidden: You are not assigned to instruct this subject for this section.',
            code: 'STAFF_CLASS_UNAUTHORIZED'
          });
        }
      }

      // 3. Extract File Buffer
      let fileBuffer: Buffer | null = null;
      if (req.file && req.file.buffer) {
        fileBuffer = req.file.buffer;
      } else if (req.body && req.body.fileBase64) {
        const base64Data = req.body.fileBase64.replace(/^data:.*?;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
      } else if (Buffer.isBuffer(req.body)) {
        fileBuffer = req.body;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({
          error: 'No spreadsheet file provided. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.',
          code: 'FILE_REQUIRED'
        });
      }

      // 4. Load metadata (Assessment, Subject, Section, and Students)
      const [assessment, subject, section] = await Promise.all([
        prisma.assessment.findUnique({ where: { id: assessmentId } }),
        prisma.subject.findUnique({ where: { id: subjectId } }),
        prisma.section.findUnique({
          where: { id: sectionId },
          include: { department: true, year: true, academicYear: true }
        })
      ]);

      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
      }
      if (!assessment.isActive) {
        return res.status(400).json({ error: 'Selected assessment is currently inactive', code: 'ASSESSMENT_INACTIVE' });
      }
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found', code: 'SUBJECT_NOT_FOUND' });
      }
      if (!section) {
        return res.status(404).json({ error: 'Section not found', code: 'SECTION_NOT_FOUND' });
      }

      const maxMarks = assessment.maximumMarks || 100;

      // 5. Load all active enrolled students for this section
      const enrolledStudents = await prisma.student.findMany({
        where: {
          sectionId,
          status: 'ACTIVE',
          ...(academicYearId ? { academicYearId } : {})
        },
        select: {
          id: true,
          registerNumber: true,
          name: true,
          sectionId: true,
          academicYearId: true
        }
      });

      const enrolledStudentMap = new Map<string, typeof enrolledStudents[0]>();
      for (const s of enrolledStudents) {
        enrolledStudentMap.set(s.registerNumber.trim().toUpperCase(), s);
      }

      // Preload existing marks for change detection
      const existingMarks = await prisma.mark.findMany({
        where: {
          subjectId,
          assessmentId,
          studentId: { in: enrolledStudents.map(s => s.id) }
        }
      });
      const existingMarkMap = new Map<string, typeof existingMarks[0]>();
      for (const m of existingMarks) {
        existingMarkMap.set(m.studentId, m);
      }

      // 6. Parse Workbook with SheetJS
      let workbook: xlsx.WorkBook;
      try {
        workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      } catch (parseError: any) {
        return res.status(400).json({
          error: `Failed to parse spreadsheet: ${parseError.message || 'Invalid or corrupted file.'}`,
          code: 'PARSE_FAILED'
        });
      }

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ error: 'Spreadsheet contains no worksheets.', code: 'EMPTY_WORKBOOK' });
      }

      const rawRows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      if (!rawRows || rawRows.length === 0) {
        return res.status(400).json({
          error: 'Spreadsheet is empty or contains no data rows.',
          code: 'EMPTY_SHEET'
        });
      }

      // 7. Validate Row by Row
      const previewRows: PreviewRow[] = [];
      const seenRegisterNumbers = new Set<string>();

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNumber = i + 2; // Accounting for 1-based index and header row

        // Flexible header resolution
        let rawReg: any = '';
        let rawMarks: any = '';
        let rawName: any = '';

        for (const [key, val] of Object.entries(row)) {
          const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanKey.includes('registernumber') || cleanKey.includes('regno') || cleanKey === 'reg' || cleanKey === 'registerno' || cleanKey === 'rollno') {
            rawReg = val;
          } else if (cleanKey === 'marks' || cleanKey === 'mark' || cleanKey === 'score' || cleanKey === 'marksobtained') {
            rawMarks = val;
          } else if (cleanKey.includes('name') || cleanKey.includes('student')) {
            rawName = val;
          }
        }

        const cleanReg = String(rawReg || '').trim().toUpperCase();

        const previewRow: PreviewRow = {
          rowNumber,
          registerNumber: cleanReg,
          rawMarks,
          maximumMarks: maxMarks,
          status: 'VALID'
        };

        // Check 1: Register number existence in file
        if (!cleanReg) {
          previewRow.status = 'INVALID';
          previewRow.error = 'Register number is missing or empty in row';
          previewRow.errorCode = 'MISSING_REGISTER_NUMBER';
          previewRows.push(previewRow);
          continue;
        }

        // Check 2: Duplicate record detection in the same file
        if (seenRegisterNumbers.has(cleanReg)) {
          previewRow.status = 'DUPLICATE';
          previewRow.error = `Duplicate entry for register number "${cleanReg}" in uploaded file.`;
          previewRow.errorCode = 'DUPLICATE_IN_FILE';
          previewRows.push(previewRow);
          continue;
        }
        seenRegisterNumbers.add(cleanReg);

        // Check 3: Student belongs to selected class
        const student = enrolledStudentMap.get(cleanReg);
        if (!student) {
          // Check if student exists in another class
          const otherStudent = await prisma.student.findFirst({
            where: { registerNumber: { equals: cleanReg, mode: 'insensitive' } },
            include: { section: true, department: true }
          });

          if (otherStudent) {
            previewRow.status = 'INVALID';
            previewRow.studentName = otherStudent.name;
            previewRow.error = `Student [${cleanReg}] ${otherStudent.name} is enrolled in Section ${otherStudent.section.name} (${otherStudent.department.code}), NOT the selected class.`;
            previewRow.errorCode = 'STUDENT_NOT_IN_SECTION';
          } else {
            previewRow.status = 'INVALID';
            previewRow.error = `Register number "${cleanReg}" does not exist in the student directory.`;
            previewRow.errorCode = 'STUDENT_NOT_FOUND';
          }

          previewRows.push(previewRow);
          continue;
        }

        previewRow.studentName = student.name;
        previewRow.studentId = student.id;

        // Check 4: Marks validation
        if (rawMarks === '' || rawMarks === null || rawMarks === undefined) {
          previewRow.status = 'INVALID';
          previewRow.error = 'Marks value is missing or blank.';
          previewRow.errorCode = 'MISSING_MARKS';
          previewRows.push(previewRow);
          continue;
        }

        const parsedMark = parseFloat(String(rawMarks).trim());
        if (isNaN(parsedMark)) {
          previewRow.status = 'INVALID';
          previewRow.error = `Marks "${rawMarks}" is not a valid number.`;
          previewRow.errorCode = 'NON_NUMERIC_MARKS';
          previewRows.push(previewRow);
          continue;
        }

        if (parsedMark < 0) {
          previewRow.status = 'INVALID';
          previewRow.error = `Marks cannot be negative (${parsedMark}). Value must be >= 0.`;
          previewRow.errorCode = 'NEGATIVE_MARKS';
          previewRows.push(previewRow);
          continue;
        }

        if (parsedMark > maxMarks) {
          previewRow.status = 'INVALID';
          previewRow.error = `Marks (${parsedMark}) exceed the maximum allowable marks (${maxMarks}) for ${assessment.name}.`;
          previewRow.errorCode = 'MARKS_EXCEED_MAXIMUM';
          previewRows.push(previewRow);
          continue;
        }

        // Check 5: Previous marks & action type (INSERT vs UPDATE)
        previewRow.marksObtained = parsedMark;
        const existingMark = existingMarkMap.get(student.id);
        if (existingMark) {
          previewRow.action = 'UPDATE';
          previewRow.previousMarks = existingMark.marksObtained;
        } else {
          previewRow.action = 'INSERT';
          previewRow.previousMarks = null;
        }

        previewRows.push(previewRow);
      }

      const totalRows = previewRows.length;
      const validRows = previewRows.filter(r => r.status === 'VALID').length;
      const invalidRows = previewRows.filter(r => r.status === 'INVALID').length;
      const duplicateRows = previewRows.filter(r => r.status === 'DUPLICATE').length;

      return res.status(200).json({
        totalRows,
        validRows,
        invalidRows,
        duplicateRows,
        assessment: {
          id: assessment.id,
          name: assessment.name,
          code: assessment.code,
          maximumMarks: maxMarks
        },
        subject: {
          id: subject.id,
          name: subject.name,
          code: subject.code
        },
        section: {
          id: section.id,
          name: section.name,
          department: section.department.code,
          year: section.year.name,
          academicYear: section.academicYear.yearName
        },
        rows: previewRows
      });
    } catch (error: any) {
      console.error('Preview marks upload error:', error);
      return res.status(500).json({ error: 'Failed to process marks spreadsheet' });
    }
  }

  /**
   * POST /api/staff/marks/upload-confirm or /api/admin/marks/upload-confirm
   * Commits validated marks within an atomic database transaction.
   * Re-verifies staff class assignment directly against the database.
   */
  static async confirmMarksUpload(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;
      const { sectionId, subjectId, assessmentId, academicYearId, validRows, reason } = req.body || {};

      if (!sectionId || !subjectId || !assessmentId || !Array.isArray(validRows) || validRows.length === 0) {
        return res.status(400).json({
          error: 'sectionId, subjectId, assessmentId, and a non-empty validRows array are required',
          code: 'MISSING_PARAMS'
        });
      }

      // Zero-Trust Check: Staff MUST be assigned to this class and subject in the database
      if (req.user!.role !== 'ADMIN') {
        const isAssigned = await checkStaffAssignment(staffId, sectionId, subjectId, academicYearId);
        if (!isAssigned) {
          return res.status(403).json({
            error: 'Forbidden: You are not assigned to instruct this subject for this section.',
            code: 'STAFF_CLASS_UNAUTHORIZED'
          });
        }
      }

      const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
      if (!assessment || !assessment.isActive) {
        return res.status(400).json({ error: 'Assessment is invalid or inactive', code: 'INVALID_ASSESSMENT' });
      }

      const maxMarks = assessment.maximumMarks || 100;
      let insertedCount = 0;
      let updatedCount = 0;

      // Atomic commit transaction
      await prisma.$transaction(async (tx) => {
        for (const row of validRows) {
          const { studentId, registerNumber, marksObtained } = row;

          if (!studentId || marksObtained === undefined) continue;

          const numMarks = parseFloat(marksObtained);
          if (isNaN(numMarks) || numMarks < 0 || numMarks > maxMarks) {
            throw new Error(`Invalid mark value ${marksObtained} for student ${registerNumber}`);
          }

          // Verify student actually belongs to this section
          const student = await tx.student.findUnique({ where: { id: studentId } });
          if (!student || student.sectionId !== sectionId) {
            throw new Error(`Cross-class violation: Student ${registerNumber} does not belong to section ${sectionId}`);
          }

          // Check if mark exists
          const existing = await tx.mark.findUnique({
            where: {
              studentId_subjectId_assessmentId: {
                studentId,
                subjectId,
                assessmentId
              }
            }
          });

          if (existing) {
            // Log revision change
            await tx.markChangeLog.create({
              data: {
                markId: existing.id,
                studentId,
                subjectId,
                assessmentId,
                previousMarks: existing.marksObtained,
                newMarks: numMarks,
                changedBy: staffId,
                reason: reason || 'Bulk spreadsheet upload revision'
              }
            });

            // Update mark
            await tx.mark.update({
              where: { id: existing.id },
              data: {
                marksObtained: numMarks,
                maximumMarks: maxMarks,
                enteredBy: staffId
              }
            });
            updatedCount++;
          } else {
            // Create new mark
            await tx.mark.create({
              data: {
                studentId,
                subjectId,
                assessmentId,
                marksObtained: numMarks,
                maximumMarks: maxMarks,
                enteredBy: staffId
              }
            });
            insertedCount++;
          }
        }

        // Record Audit Logs
        if (insertedCount > 0) {
          await tx.auditLog.create({
            data: {
              userId: staffId,
              action: AuditAction.MARKS_UPLOADED,
              entity: 'Mark',
              entityId: assessmentId,
              metadata: {
                sectionId,
                subjectId,
                assessmentId,
                insertedCount,
                reason: reason || 'Bulk spreadsheet upload'
              }
            }
          });
        }

        if (updatedCount > 0) {
          await tx.auditLog.create({
            data: {
              userId: staffId,
              action: AuditAction.MARKS_UPDATED,
              entity: 'Mark',
              entityId: assessmentId,
              metadata: {
                sectionId,
                subjectId,
                assessmentId,
                updatedCount,
                reason: reason || 'Bulk spreadsheet upload revision'
              }
            }
          });
        }
      });

      return res.status(200).json({
        message: `Successfully recorded ${insertedCount + updatedCount} marks (${insertedCount} added, ${updatedCount} revised).`,
        insertedCount,
        updatedCount,
        totalProcessed: insertedCount + updatedCount
      });
    } catch (error: any) {
      console.error('Confirm marks upload error:', error);
      return res.status(500).json({ error: error.message || 'Failed to commit marks' });
    }
  }

  /**
   * POST /api/staff/marks/batch or /api/admin/marks/batch
   * Batch manual entry for multiple students from a classroom grading roster.
   */
  static async batchManualEntry(req: Request, res: Response) {
    try {
      const staffId = req.user!.id;
      const { sectionId, subjectId, assessmentId, academicYearId, entries, reason } = req.body || {};

      if (!sectionId || !subjectId || !assessmentId || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({
          error: 'sectionId, subjectId, assessmentId, and entries array are required',
          code: 'MISSING_PARAMS'
        });
      }

      // Check staff assignment
      if (req.user!.role !== 'ADMIN') {
        const isAssigned = await checkStaffAssignment(staffId, sectionId, subjectId, academicYearId);
        if (!isAssigned) {
          return res.status(403).json({
            error: 'Forbidden: You are not assigned to instruct this subject for this section.',
            code: 'STAFF_CLASS_UNAUTHORIZED'
          });
        }
      }

      const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
      if (!assessment || !assessment.isActive) {
        return res.status(400).json({ error: 'Assessment is invalid or inactive', code: 'INVALID_ASSESSMENT' });
      }

      const maxMarks = assessment.maximumMarks || 100;
      let insertedCount = 0;
      let updatedCount = 0;

      await prisma.$transaction(async (tx) => {
        for (const item of entries) {
          const { studentId, marksObtained } = item;
          if (!studentId || marksObtained === undefined || marksObtained === null || marksObtained === '') continue;

          const numMarks = parseFloat(marksObtained);
          if (isNaN(numMarks) || numMarks < 0 || numMarks > maxMarks) {
            throw new Error(`Mark value ${marksObtained} must be between 0 and ${maxMarks}`);
          }

          const student = await tx.student.findUnique({ where: { id: studentId } });
          if (!student || student.sectionId !== sectionId) {
            throw new Error(`Student ${studentId} does not belong to section ${sectionId}`);
          }

          const existing = await tx.mark.findUnique({
            where: {
              studentId_subjectId_assessmentId: {
                studentId,
                subjectId,
                assessmentId
              }
            }
          });

          if (existing) {
            if (existing.marksObtained !== numMarks) {
              await tx.markChangeLog.create({
                data: {
                  markId: existing.id,
                  studentId,
                  subjectId,
                  assessmentId,
                  previousMarks: existing.marksObtained,
                  newMarks: numMarks,
                  changedBy: staffId,
                  reason: reason || 'Manual roster update'
                }
              });
            }
            await tx.mark.update({
              where: { id: existing.id },
              data: { marksObtained: numMarks, maximumMarks: maxMarks, enteredBy: staffId }
            });
            updatedCount++;
          } else {
            await tx.mark.create({
              data: {
                studentId,
                subjectId,
                assessmentId,
                marksObtained: numMarks,
                maximumMarks: maxMarks,
                enteredBy: staffId
              }
            });
            insertedCount++;
          }
        }

        // Record Audit Logs
        if (insertedCount > 0) {
          await tx.auditLog.create({
            data: {
              userId: staffId,
              action: AuditAction.MARKS_UPLOADED,
              entity: 'Mark',
              entityId: assessmentId,
              metadata: {
                sectionId,
                subjectId,
                assessmentId,
                insertedCount,
                reason: reason || 'Classroom grading roster entry'
              }
            }
          });
        }

        if (updatedCount > 0) {
          await tx.auditLog.create({
            data: {
              userId: staffId,
              action: AuditAction.MARKS_UPDATED,
              entity: 'Mark',
              entityId: assessmentId,
              metadata: {
                sectionId,
                subjectId,
                assessmentId,
                updatedCount,
                reason: reason || 'Classroom grading roster revision'
              }
            }
          });
        }
      });

      return res.status(200).json({
        message: `Successfully saved marks (${insertedCount} new, ${updatedCount} updated).`,
        insertedCount,
        updatedCount,
        total: insertedCount + updatedCount
      });
    } catch (error: any) {
      console.error('Batch manual entry error:', error);
      return res.status(500).json({ error: error.message || 'Failed to save marks roster' });
    }
  }
}
