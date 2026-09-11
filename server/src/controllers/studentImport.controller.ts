import { Request, Response } from 'express';
import * as xlsx from 'xlsx';
import { prisma } from '../db';
import { StudentStatus, ImportStatus, DuplicateResolutionMode } from '@prisma/client';
import { AuditAction } from '../services/audit.service';
import { config } from '../config';

const PHONE_REGEX = /^(\+?[1-9]\d{9,14}|[6-9]\d{9})$/;
const REG_NO_REGEX = /^[A-Za-z0-9\-_]{3,30}$/;

interface NormalizedRow {
  registerNumber?: string;
  name?: string;
  academicYear?: string;
  department?: string;
  year?: string | number;
  section?: string;
  parentName?: string;
  parentMobile?: string;
}

export interface RowDiagnostic {
  rowNumber: number;
  registerNumber: string;
  problem: string;
  suggestedCorrection: string;
}

export class StudentImportController {
  /**
   * GET /api/admin/students/import/template
   * Generates a sample Excel template for bulk student import.
   */
  static async downloadTemplate(_req: Request, res: Response) {
    try {
      const departments = await prisma.department.findMany({ take: 3, select: { code: true } });
      const sampleDept = departments[0]?.code || 'CSE';

      const headers = [
        'Register Number',
        'Student Name',
        'Department',
        'Year',
        'Section',
        'Parent Name',
        'Parent Mobile'
      ];

      const sampleData = [
        headers,
        ['2025CSE001', 'Arun Kumar', sampleDept, '3', 'A', 'Suresh Kumar', '+919876543210'],
        ['2025CSE002', 'Bhavani Devi', sampleDept, '3', 'A', 'Ranganathan V', '+919876543211'],
        ['2025CSE003', 'Chandran S', sampleDept, '3', 'A', 'Selvaraj P', '+919876543212']
      ];

      const ws = xlsx.utils.aoa_to_sheet(sampleData);

      ws['!cols'] = [
        { wch: 18 }, // Register Number
        { wch: 22 }, // Student Name
        { wch: 14 }, // Department
        { wch: 8 },  // Year
        { wch: 10 }, // Section
        { wch: 22 }, // Parent Name
        { wch: 18 }  // Parent Mobile
      ];

      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Student_Import_Template');

      if (_req.query.format === 'csv') {
        const csv = xlsx.utils.sheet_to_csv(ws);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="student_bulk_import_template.csv"');
        return res.status(200).send(csv);
      }

      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="student_bulk_import_template.xlsx"');
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Download template error:', error);
      return res.status(500).json({ error: 'Failed to generate import template' });
    }
  }

  /**
   * POST /api/admin/students/import/preview
   * Parses uploaded Excel/CSV spreadsheet and validates every row without committing.
   * Performs 14-point validation, pre-loads lookup indices for O(1) performance,
   * supports dropdown context inheritance, and produces diagnostic problem/solution pairs.
   */
  static async previewImport(req: Request, res: Response) {
    const startTime = Date.now();
    try {
      let fileBuffer: Buffer | null = null;
      let originalFileName = 'spreadsheet.xlsx';

      if (req.file && req.file.buffer) {
        fileBuffer = req.file.buffer;
        originalFileName = req.file.originalname || originalFileName;
      } else if (req.body && req.body.fileBase64) {
        const base64Data = req.body.fileBase64.replace(/^data:.*?;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
        if (req.body.fileName) originalFileName = req.body.fileName;
      } else if (Buffer.isBuffer(req.body)) {
        fileBuffer = req.body;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({
          error: 'No spreadsheet file was provided. Please upload an .xlsx, .xls, or .csv file.',
          code: 'FILE_REQUIRED'
        });
      }

      // Max file size enforcement
      const maxSizeBytes = (config.maxUploadSizeMb || 25) * 1024 * 1024;
      if (fileBuffer.length > maxSizeBytes) {
        return res.status(400).json({
          error: `Spreadsheet exceeds maximum permitted size of ${config.maxUploadSizeMb}MB.`,
          code: 'FILE_TOO_LARGE'
        });
      }

      // Dropdown context inheritance (Admin can pre-select Academic Year, Department, Year, Section)
      const queryAcadYearId = req.query.academicYearId as string;
      const bodyAcadYearId = req.body && req.body.academicYearId;
      const selectedDeptId = (req.query.departmentId as string) || (req.body && req.body.departmentId);
      const selectedYearId = (req.query.yearId as string) || (req.body && req.body.yearId);
      const selectedSectionId = (req.query.sectionId as string) || (req.body && req.body.sectionId);

      let targetAcademicYearId = queryAcadYearId || bodyAcadYearId;
      let targetAcademicYear;

      if (targetAcademicYearId && targetAcademicYearId !== 'all') {
        targetAcademicYear = await prisma.academicYear.findUnique({ where: { id: targetAcademicYearId } });
      } else {
        targetAcademicYear = await prisma.academicYear.findFirst({
          where: { isCurrent: true, isActive: true }
        }) || await prisma.academicYear.findFirst({ where: { isActive: true } });
      }

      if (!targetAcademicYear) {
        return res.status(400).json({
          error: 'No active Academic Year exists in the system. Please create or activate an Academic Year first.',
          code: 'ACADEMIC_YEAR_REQUIRED'
        });
      }

      targetAcademicYearId = targetAcademicYear.id;

      // Parse spreadsheet using SheetJS (.xlsx, .xls, .csv)
      let workbook: xlsx.WorkBook;
      try {
        workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true });
      } catch (err: any) {
        return res.status(400).json({
          error: `Failed to parse spreadsheet file: ${err.message}. Supported formats: .xlsx, .xls, .csv.`,
          code: 'INVALID_SPREADSHEET'
        });
      }

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return res.status(400).json({
          error: 'Spreadsheet contains no worksheets.',
          code: 'EMPTY_SPREADSHEET'
        });
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        return res.status(400).json({
          error: 'Spreadsheet has no data rows to import.',
          code: 'NO_DATA_ROWS'
        });
      }

      // Pre-load reference databases for ultra-fast O(1) in-memory validation
      const [allDepartments, allYears, allSections, existingStudents] = await Promise.all([
        prisma.department.findMany(),
        prisma.year.findMany(),
        prisma.section.findMany({
          where: { academicYearId: targetAcademicYearId },
          include: { department: true, year: true }
        }),
        prisma.student.findMany({
          where: { academicYearId: targetAcademicYearId },
          select: { id: true, registerNumber: true, name: true, sectionId: true }
        })
      ]);

      const existingDbRegMap = new Map<string, typeof existingStudents[0]>();
      existingStudents.forEach(s => existingDbRegMap.set(s.registerNumber.toUpperCase(), s));

      const seenFileRegSet = new Set<string>();

      // Index lookup maps
      const deptMap = new Map<string, typeof allDepartments[0]>();
      for (const d of allDepartments) {
        deptMap.set(d.id, d);
        deptMap.set(d.code.toUpperCase(), d);
        deptMap.set(d.name.toLowerCase(), d);
      }

      const yearMap = new Map<string, typeof allYears[0]>();
      for (const y of allYears) {
        yearMap.set(y.id, y);
        yearMap.set(y.yearNumber.toString(), y);
        yearMap.set(y.name.toLowerCase(), y);
        yearMap.set(`year ${y.yearNumber}`, y);
        yearMap.set(`${y.yearNumber} year`, y);
        yearMap.set(`${y.yearNumber}yr`, y);
        yearMap.set(`${y.yearNumber}st year`, y);
        yearMap.set(`${y.yearNumber}nd year`, y);
        yearMap.set(`${y.yearNumber}rd year`, y);
        yearMap.set(`${y.yearNumber}th year`, y);
      }

      const sectionKeyMap = new Map<string, typeof allSections[0]>();
      const sectionIdMap = new Map<string, typeof allSections[0]>();
      for (const s of allSections) {
        sectionIdMap.set(s.id, s);
        const cleanName = s.name.toUpperCase().replace(/^SECTION\s*/i, '');
        sectionKeyMap.set(`${s.departmentId}:${s.yearId}:${cleanName}`, s);
      }

      // Validate selected dropdown defaults if provided
      const defaultDept = selectedDeptId ? deptMap.get(selectedDeptId) : undefined;
      const defaultYear = selectedYearId ? yearMap.get(selectedYearId) : undefined;
      const defaultSection = selectedSectionId ? sectionIdMap.get(selectedSectionId) : undefined;

      const parsedRows: any[] = [];
      const diagnostics: RowDiagnostic[] = [];
      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNumber = i + 2; // Excel row numbering
        const errors: string[] = [];
        let status: 'VALID' | 'INVALID' | 'DUPLICATE' = 'VALID';

        // 1. Normalize Column Headers
        const normalized = normalizeRowHeaders(row);

        const regNo = (normalized.registerNumber || '').toString().trim().toUpperCase();
        const studentName = (normalized.name || '').toString().trim();
        const deptStr = (normalized.department || '').toString().trim().toUpperCase();
        const yearStr = (normalized.year !== undefined && normalized.year !== null) ? normalized.year.toString().trim().toLowerCase() : '';
        const sectionStr = (normalized.section || '').toString().trim().toUpperCase().replace(/^SECTION\s*/i, '');
        const parentName = (normalized.parentName || '').toString().trim();
        let parentMobile = (normalized.parentMobile || '').toString().trim().replace(/[\s-]/g, '');

        // 14-Point Validation

        // Check 1: Register Number presence
        if (!regNo) {
          errors.push('Missing Register Number');
          diagnostics.push({
            rowNumber,
            registerNumber: '—',
            problem: 'Register Number is missing or blank',
            suggestedCorrection: 'Enter a valid unique student registration number (e.g. 2025CSE001)'
          });
        } else {
          // Check 2: Register Number format
          if (!REG_NO_REGEX.test(regNo)) {
            errors.push(`Invalid Register Number format "${regNo}". Alphanumeric 3-30 characters expected.`);
            diagnostics.push({
              rowNumber,
              registerNumber: regNo,
              problem: `Register Number "${regNo}" contains invalid characters or exceeds 30 characters`,
              suggestedCorrection: 'Ensure register number uses standard alphanumeric code without spaces or special symbols'
            });
          }

          // Check 11: In-file duplicate
          if (seenFileRegSet.has(regNo)) {
            errors.push(`Duplicate Register Number "${regNo}" found earlier in this file`);
            status = 'DUPLICATE';
            diagnostics.push({
              rowNumber,
              registerNumber: regNo,
              problem: `Duplicate entry within this file for "${regNo}"`,
              suggestedCorrection: 'Remove the redundant row or correct the register number'
            });
          } else if (existingDbRegMap.has(regNo)) {
            // Check 12: Existing database duplicate
            errors.push(`Student with Register Number "${regNo}" is already enrolled in ${targetAcademicYear.yearName}`);
            status = 'DUPLICATE';
            diagnostics.push({
              rowNumber,
              registerNumber: regNo,
              problem: `Student "${regNo}" already exists in the database`,
              suggestedCorrection: 'Select "Update Existing" in Duplicate Resolution Mode to update this record, or "Skip Existing" to keep current data'
            });
          }
          seenFileRegSet.add(regNo);
        }

        // Check 3: Student Name presence
        if (!studentName) {
          errors.push('Missing Student Name');
          diagnostics.push({
            rowNumber,
            registerNumber: regNo || '—',
            problem: 'Student Name is empty',
            suggestedCorrection: 'Provide the full student name'
          });
        } else if (studentName.length < 2) {
          errors.push('Student Name must be at least 2 characters');
          diagnostics.push({
            rowNumber,
            registerNumber: regNo || '—',
            problem: `Student Name "${studentName}" is too short`,
            suggestedCorrection: 'Provide full official student name'
          });
        }

        // Check 5: Department resolution (column or dropdown fallback)
        let matchedDept = deptMap.get(deptStr) || defaultDept;
        if (!matchedDept) {
          errors.push(`Invalid Department "${deptStr || 'None'}". Valid codes: ${allDepartments.map(d => d.code).join(', ')}`);
          diagnostics.push({
            rowNumber,
            registerNumber: regNo || '—',
            problem: `Department "${deptStr || 'Unspecified'}" not found in institutional catalog`,
            suggestedCorrection: `Use an approved department code: ${allDepartments.map(d => d.code).join(', ')}`
          });
        }

        // Check 6: Year resolution (column or dropdown fallback)
        let matchedYear = yearMap.get(yearStr) || defaultYear;
        if (!matchedYear) {
          errors.push(`Invalid Year "${yearStr || 'None'}". Valid years: ${allYears.map(y => y.yearNumber).join(', ')}`);
          diagnostics.push({
            rowNumber,
            registerNumber: regNo || '—',
            problem: `Academic Year cohort "${yearStr || 'Unspecified'}" is invalid`,
            suggestedCorrection: `Specify a year level between 1 and 4 (e.g. 1, 2, 3, 4)`
          });
        }

        // Check 7 & 8: Section resolution and relational consistency
        let matchedSection: typeof allSections[0] | undefined;
        if (matchedDept && matchedYear) {
          if (sectionStr) {
            matchedSection = sectionKeyMap.get(`${matchedDept.id}:${matchedYear.id}:${sectionStr}`);
            if (!matchedSection) {
              errors.push(`Section "${sectionStr}" does not exist for Department ${matchedDept.code} Year ${matchedYear.yearNumber}`);
              diagnostics.push({
                rowNumber,
                registerNumber: regNo || '—',
                problem: `Section "${sectionStr}" does not belong to ${matchedDept.code} - ${matchedYear.name}`,
                suggestedCorrection: `Verify section code or create Section "${sectionStr}" under ${matchedDept.code} Year ${matchedYear.yearNumber} first`
              });
            }
          } else if (defaultSection && defaultSection.departmentId === matchedDept.id && defaultSection.yearId === matchedYear.id) {
            matchedSection = defaultSection;
          } else {
            // Default to Section 'A' if exists
            matchedSection = sectionKeyMap.get(`${matchedDept.id}:${matchedYear.id}:A`) || allSections.find(s => s.departmentId === matchedDept!.id && s.yearId === matchedYear!.id);
            if (!matchedSection) {
              errors.push(`No active section found for ${matchedDept.code} Year ${matchedYear.yearNumber}`);
              diagnostics.push({
                rowNumber,
                registerNumber: regNo || '—',
                problem: `No class section exists for ${matchedDept.code} Year ${matchedYear.yearNumber}`,
                suggestedCorrection: 'Configure class sections in Academic Structure before importing students'
              });
            }
          }
        }

        // Check 9: Parent Name
        if (!parentName) {
          errors.push('Missing Parent Name');
          diagnostics.push({
            rowNumber,
            registerNumber: regNo || '—',
            problem: 'Parent/Guardian name is blank',
            suggestedCorrection: 'Enter parent or legal guardian name for communication records'
          });
        }

        // Check 10: Parent Mobile verification
        if (!parentMobile) {
          errors.push('Missing Parent Mobile number');
          diagnostics.push({
            rowNumber,
            registerNumber: regNo || '—',
            problem: 'Parent Mobile number is empty',
            suggestedCorrection: 'Provide a 10-digit mobile number for SMS/WhatsApp academic notifications'
          });
        } else {
          if (!PHONE_REGEX.test(parentMobile)) {
            errors.push(`Invalid Parent Phone/Mobile "${parentMobile}". 10-digit format expected.`);
            diagnostics.push({
              rowNumber,
              registerNumber: regNo || '—',
              problem: `Phone/Mobile number "${parentMobile}" does not match E.164 or Indian 10-digit format`,
              suggestedCorrection: 'Format as 10-digit mobile number e.g. 9876543210 or +919876543210'
            });
          }
        }

        if (errors.length > 0) {
          if (status !== 'DUPLICATE') status = 'INVALID';
        }

        if (status === 'VALID') {
          validCount++;
        } else if (status === 'DUPLICATE') {
          duplicateCount++;
        } else {
          invalidCount++;
        }

        parsedRows.push({
          rowNumber,
          status,
          errors,
          warnings: [],
          registerNumber: regNo,
          name: studentName,
          departmentCode: matchedDept?.code || deptStr,
          yearNumber: matchedYear ? matchedYear.yearNumber : (Number(yearStr) || 1),
          sectionName: matchedSection?.name || sectionStr,
          parentName,
          parentPhone: parentMobile,
          parentMobile,
          departmentId: matchedDept?.id,
          yearId: matchedYear?.id,
          sectionId: matchedSection?.id,
          data: {
            registerNumber: regNo,
            name: studentName,
            department: matchedDept?.code || deptStr,
            year: matchedYear?.name || yearStr,
            section: matchedSection?.name || sectionStr,
            parentName,
            parentMobile
          },
          resolved: (status === 'VALID' || status === 'DUPLICATE') && matchedDept && matchedYear && matchedSection ? {
            registerNumber: regNo,
            name: studentName,
            departmentId: matchedDept.id,
            yearId: matchedYear.id,
            sectionId: matchedSection.id,
            academicYearId: targetAcademicYearId,
            parentName,
            parentMobile,
            status: StudentStatus.ACTIVE
          } : null
        });
      }

      const processingTimeMs = Date.now() - startTime;

      return res.status(200).json({
        totalRows: rawRows.length,
        validCount,
        invalidCount,
        duplicateCount,
        validRows: validCount,
        invalidRows: invalidCount,
        duplicateRows: duplicateCount,
        processingTimeMs,
        fileName: originalFileName,
        fileSize: fileBuffer.length,
        previewRows: parsedRows,
        rows: parsedRows,
        diagnostics,
        summary: {
          totalRows: rawRows.length,
          validRows: validCount,
          invalidRows: invalidCount,
          duplicateRows: duplicateCount
        },
        academicYear: {
          id: targetAcademicYear.id,
          yearName: targetAcademicYear.yearName
        }
      });
    } catch (error: any) {
      console.error('Preview import error:', error);
      return res.status(500).json({ error: `Bulk import preview failed: ${error.message}` });
    }
  }

  /**
   * POST /api/admin/students/import/confirm
   * Commits validated student records using configurable batch size (default 500).
   * Implements safe duplicate handling modes:
   * - SKIP: Preserves existing records (safe default)
   * - UPDATE: Upserts profile data without duplicate generation
   * - STOP: Rejects import if duplicates exist
   * Records processing metrics and audit logs in StudentImportHistory.
   */
  static async confirmImport(req: Request, res: Response) {
    const startTime = Date.now();
    try {
      const {
        students,
        academicYearId,
        fileName = 'student_import.xlsx',
        fileSize = 0,
        duplicateMode = 'SKIP'
      } = req.body || {};

      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({
          error: 'No validated student records provided to import.',
          code: 'EMPTY_IMPORT_PAYLOAD'
        });
      }

      const mode = (duplicateMode || 'SKIP').toUpperCase() as DuplicateResolutionMode;
      const batchSize = Math.max(50, Math.min(2000, config.importBatchSize || 500));
      const uploaderId = req.user!.id;

      // Identify target academic year
      const targetAcadYear = await prisma.academicYear.findUnique({
        where: { id: academicYearId }
      }) || await prisma.academicYear.findFirst({ where: { isCurrent: true } });

      if (!targetAcadYear) {
        return res.status(400).json({
          error: 'Invalid or missing Academic Year ID for confirmation.',
          code: 'INVALID_ACADEMIC_YEAR'
        });
      }

      // Pre-load existing students in this academic year for O(1) duplicate checks
      const existingInDb = await prisma.student.findMany({
        where: { academicYearId: targetAcadYear.id },
        select: { id: true, registerNumber: true }
      });
      const existingDbMap = new Map<string, string>();
      existingInDb.forEach(s => existingDbMap.set(s.registerNumber.toUpperCase(), s.id));

      // Categorize incoming student rows
      const validPayloads: any[] = [];
      const duplicatePayloads: any[] = [];
      const errorLog: RowDiagnostic[] = [];

      for (let i = 0; i < students.length; i++) {
        const raw = students[i];
        const item = raw.resolved || raw;
        const regNo = (item.registerNumber || raw.registerNumber || raw.data?.registerNumber || '').toString().trim().toUpperCase();
        const studentName = (item.name || raw.name || raw.data?.name || '').toString().trim();
        const sectionId = item.sectionId || raw.sectionId;
        const departmentId = item.departmentId || raw.departmentId;
        const yearId = item.yearId || raw.yearId;
        const parentName = (item.parentName || raw.parentName || raw.data?.parentName || '').toString().trim();
        const parentMobile = (item.parentMobile || item.parentPhone || raw.parentMobile || raw.parentPhone || raw.data?.parentMobile || '').toString().trim().replace(/[\s-]/g, '');

        if (raw.status === 'INVALID') {
          errorLog.push({
            rowNumber: raw.rowNumber || i + 1,
            registerNumber: regNo || '—',
            problem: (raw.errors && raw.errors.join('; ')) || 'Row failed preliminary validation',
            suggestedCorrection: 'Fix validation errors reported during preview'
          });
          continue;
        }

        if (!regNo || !studentName || !sectionId || !departmentId || !yearId || !PHONE_REGEX.test(parentMobile)) {
          errorLog.push({
            rowNumber: raw.rowNumber || i + 1,
            registerNumber: regNo || '—',
            problem: !PHONE_REGEX.test(parentMobile) ? `Invalid Parent Phone/Mobile "${parentMobile}"` : 'Missing critical foreign keys or student metadata',
            suggestedCorrection: 'Ensure student has register number, name, department, year, section, and valid 10-digit mobile'
          });
          continue;
        }

        const studentRecord = {
          registerNumber: regNo,
          name: studentName,
          academicYearId: targetAcadYear.id,
          departmentId,
          yearId,
          sectionId,
          parentName,
          parentMobile,
          status: StudentStatus.ACTIVE
        };

        if (existingDbMap.has(regNo)) {
          duplicatePayloads.push({
            ...studentRecord,
            existingId: existingDbMap.get(regNo)!
          });
        } else {
          validPayloads.push(studentRecord);
        }
      }

      // Check STOP mode
      if (mode === DuplicateResolutionMode.STOP && duplicatePayloads.length > 0) {
        const processingTimeMs = Date.now() - startTime;
        await prisma.studentImportHistory.create({
          data: {
            fileName,
            fileSize,
            uploadedBy: uploaderId,
            academicYearId: targetAcadYear.id,
            totalRows: students.length,
            validRows: validPayloads.length,
            invalidRows: errorLog.length,
            duplicateRows: duplicatePayloads.length,
            importedRows: 0,
            skippedRows: 0,
            failedRows: students.length,
            status: ImportStatus.FAILED,
            duplicateMode: mode,
            processingTimeMs,
            errorLog: [
              {
                problem: `Import aborted: ${duplicatePayloads.length} existing duplicate register numbers detected in STOP mode.`,
                suggestedCorrection: 'Review duplicate student list or select "SKIP" or "UPDATE" mode'
              },
              ...errorLog
            ] as any
          }
        });

        return res.status(409).json({
          error: `Import aborted: ${duplicatePayloads.length} duplicate register numbers exist in the database and mode is set to STOP.`,
          code: 'DUPLICATE_IMPORT_ABORTED',
          duplicateCount: duplicatePayloads.length,
          duplicateSamples: duplicatePayloads.slice(0, 10).map(d => d.registerNumber)
        });
      }

      // Execute Batched Operations
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      // 1. Batch Insert New Students using createMany in chunks of batchSize
      for (let i = 0; i < validPayloads.length; i += batchSize) {
        const chunk = validPayloads.slice(i, i + batchSize);
        const result = await prisma.student.createMany({
          data: chunk,
          skipDuplicates: true
        });
        importedCount += result.count;
      }

      // 2. Handle Duplicates according to mode
      if (mode === DuplicateResolutionMode.UPDATE) {
        // Update existing records in batched transactions
        for (let i = 0; i < duplicatePayloads.length; i += batchSize) {
          const chunk = duplicatePayloads.slice(i, i + batchSize);
          await prisma.$transaction(
            chunk.map(d =>
              prisma.student.update({
                where: { id: d.existingId },
                data: {
                  name: d.name,
                  departmentId: d.departmentId,
                  yearId: d.yearId,
                  sectionId: d.sectionId,
                  parentName: d.parentName,
                  parentMobile: d.parentMobile,
                  status: StudentStatus.ACTIVE
                }
              })
            )
          );
          updatedCount += chunk.length;
        }
      } else {
        // SKIP mode: Existing records are ignored safely
        skippedCount = duplicatePayloads.length;
      }

      const processingTimeMs = Date.now() - startTime;
      const totalSuccess = importedCount + updatedCount;
      const failedCount = errorLog.length;

      let importStatus: ImportStatus = ImportStatus.COMPLETED;
      if (failedCount > 0 && totalSuccess === 0) {
        importStatus = ImportStatus.FAILED;
      } else if (failedCount > 0) {
        importStatus = ImportStatus.COMPLETED_WITH_ERRORS;
      }

      // Record Import History in Database
      const history = await prisma.studentImportHistory.create({
        data: {
          fileName,
          fileSize,
          uploadedBy: uploaderId,
          academicYearId: targetAcadYear.id,
          totalRows: students.length,
          validRows: validPayloads.length,
          invalidRows: failedCount,
          duplicateRows: duplicatePayloads.length,
          importedRows: importedCount,
          skippedRows: skippedCount,
          failedRows: failedCount,
          status: importStatus,
          duplicateMode: mode,
          processingTimeMs,
          errorLog: errorLog.length > 0 ? (errorLog as any) : undefined
        }
      });

      // Log Central Audit
      await prisma.auditLog.create({
        data: {
          userId: uploaderId,
          action: AuditAction.STUDENT_IMPORTED,
          entity: 'Student',
          entityId: history.id,
          metadata: {
            importHistoryId: history.id,
            fileName,
            totalRows: students.length,
            importedCount,
            updatedCount,
            skippedCount,
            failedCount,
            duplicateMode: mode,
            processingTimeMs
          }
        }
      });

      return res.status(200).json({
        message: `Successfully processed ${students.length} rows (${importedCount} imported, ${updatedCount} updated, ${skippedCount} skipped, ${failedCount} errors) in ${processingTimeMs}ms.`,
        summary: {
          totalRows: students.length,
          importedCount,
          updatedCount,
          skippedCount,
          failedCount,
          duplicateCount: duplicatePayloads.length,
          duplicateMode: mode,
          status: importStatus,
          processingTimeMs,
          importHistoryId: history.id
        }
      });
    } catch (error: any) {
      console.error('Confirm import error:', error);
      return res.status(500).json({ error: `Import confirmation failed: ${error.message}` });
    }
  }

  /**
   * GET /api/admin/students/import/history
   * Admin-Only: Retrieves paginated history of past bulk student imports with metrics.
   */
  static async getImportHistory(req: Request, res: Response) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      const [history, total] = await Promise.all([
        prisma.studentImportHistory.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: {
              select: { id: true, name: true, email: true }
            }
          }
        }),
        prisma.studentImportHistory.count()
      ]);

      return res.status(200).json({
        history,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error: any) {
      console.error('Get import history error:', error);
      return res.status(500).json({ error: 'Failed to fetch student import history' });
    }
  }

  /**
   * GET /api/admin/students/import/history/:id
   * Admin-Only: Retrieves detailed diagnostics and error log of a specific import job.
   */
  static async getImportHistoryDetails(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const record = await prisma.studentImportHistory.findUnique({
        where: { id },
        include: {
          uploader: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      if (!record) {
        return res.status(404).json({ error: 'Import history record not found', code: 'RECORD_NOT_FOUND' });
      }

      return res.status(200).json({ record });
    } catch (error: any) {
      console.error('Get import history details error:', error);
      return res.status(500).json({ error: 'Failed to fetch import history details' });
    }
  }
}

/**
 * Normalizes case and spacing of row column headers
 */
function normalizeRowHeaders(row: Record<string, any>): NormalizedRow {
  const normalized: NormalizedRow = {};
  for (const [rawKey, val] of Object.entries(row)) {
    const key = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (key.includes('reg') || key.includes('admission') || key === 'regno' || key === 'registerno' || key === 'registernumber') {
      normalized.registerNumber = val;
    } else if (key.includes('student') || (key.includes('name') && !key.includes('parent') && !key.includes('guardian') && !key.includes('father') && !key.includes('mother'))) {
      normalized.name = val;
    } else if (key.includes('academicyear') || key.includes('batch') || key.includes('session')) {
      normalized.academicYear = val;
    } else if (key.includes('dept') || key.includes('department') || key.includes('branch') || key.includes('course')) {
      normalized.department = val;
    } else if (key === 'year' || key === 'classyear' || key === 'yr' || key === 'currentyear' || key === 'studyear') {
      normalized.year = val;
    } else if (key === 'sec' || key.includes('section') || key.includes('division')) {
      normalized.section = val;
    } else if (
      key.includes('parentname') || 
      key.includes('guardianname') || 
      ((key.includes('parent') || key.includes('guardian') || key.includes('father') || key.includes('mother')) && !key.includes('mobile') && !key.includes('phone') && !key.includes('contact'))
    ) {
      normalized.parentName = val;
    } else if (key.includes('mobile') || key.includes('phone') || key.includes('contact') || key.includes('sms')) {
      normalized.parentMobile = val;
    } else if (key.includes('roll') && !normalized.registerNumber) {
      normalized.registerNumber = val;
    }
  }
  return normalized;
}
