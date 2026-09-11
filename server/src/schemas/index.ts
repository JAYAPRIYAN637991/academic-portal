import { z } from 'zod';

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required').optional(),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(4, 'Password must be at least 4 characters long')
}).refine(data => data.username || data.email, {
  message: 'Either username or email must be provided',
  path: ['username']
});

// ============================================================================
// STUDENT SCHEMAS
// ============================================================================

export const createStudentSchema = z.object({
  registerNumber: z.string().min(3, 'Register number must be at least 3 characters'),
  name: z.string().min(2, 'Student name is required'),
  departmentId: z.string().uuid('Valid department UUID required'),
  yearId: z.string().uuid('Valid year UUID required'),
  sectionId: z.string().uuid('Valid section UUID required'),
  academicYearId: z.string().uuid('Valid academic year UUID required'),
  parentName: z.string().min(2, 'Parent/guardian name is required'),
  parentMobile: z.string().regex(/^\+?[0-9]{10,14}$/, 'Valid 10-14 digit mobile number required')
});

export const importStudentRowSchema = z.object({
  registerNumber: z.string().min(1, 'Register number is required'),
  name: z.string().min(1, 'Student name is required'),
  parentName: z.string().min(1, 'Parent name is required'),
  parentMobile: z.string().min(10, 'Valid parent mobile required')
});

// ============================================================================
// STAFF & ASSIGNMENT SCHEMAS
// ============================================================================

export const createStaffSchema = z.object({
  name: z.string().min(2, 'Staff name is required'),
  email: z.string().email('Valid email address required'),
  employeeId: z.string().min(2, 'Employee ID is required'),
  designation: z.string().default('Assistant Professor'),
  departmentId: z.string().optional()
});

export const assignStaffSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
  subjectId: z.string().min(1, 'Subject ID is required'),
  sectionId: z.string().min(1, 'Section ID is required'),
  academicYearId: z.string().min(1, 'Academic Year ID is required')
});

// ============================================================================
// SUBJECT SCHEMAS
// ============================================================================

export const createSubjectSchema = z.object({
  code: z.string().min(2, 'Subject code is required').transform(c => c.toUpperCase()),
  name: z.string().min(2, 'Subject name is required'),
  departmentId: z.string().min(1, 'Department ID is required'),
  yearId: z.string().min(1, 'Year ID is required'),
  semester: z.number().int().min(1).max(8),
  maximumMarks: z.number().positive().default(100.0)
});

// ============================================================================
// MARKS & ASSESSMENT SCHEMAS
// ============================================================================

export const markEntrySchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  subjectId: z.string().min(1, 'Subject ID is required'),
  assessmentId: z.string().min(1, 'Assessment ID is required'),
  marksObtained: z.number().min(0, 'Marks cannot be negative'),
  maximumMarks: z.number().positive('Maximum marks must be greater than 0').default(100.0)
}).refine(data => data.marksObtained <= data.maximumMarks, {
  message: 'Marks obtained cannot exceed maximum marks',
  path: ['marksObtained']
});

export const markUpdateSchema = z.object({
  marksObtained: z.number().min(0, 'Marks cannot be negative'),
  changeReason: z.string().min(3, 'Mandatory audit trail change reason required')
});

export const batchMarkEntrySchema = z.object({
  subjectId: z.string().min(1, 'Subject ID is required'),
  assessmentId: z.string().min(1, 'Assessment ID is required'),
  sectionId: z.string().min(1, 'Section ID is required'),
  marks: z.array(z.object({
    studentId: z.string().min(1, 'Student ID is required'),
    marksObtained: z.number().min(0, 'Marks cannot be negative')
  })).min(1, 'At least one student mark must be provided')
});

// ============================================================================
// NOTICE SCHEMAS
// ============================================================================

export const createNoticeSchema = z.object({
  title: z.string().min(3, 'Notice title must be at least 3 characters'),
  content: z.string().min(5, 'Notice content must be at least 5 characters'),
  noticeType: z.enum([
    'HOLIDAY',
    'INTERNAL_EXAM',
    'SEMESTER_EXAM',
    'EXAM_TIMETABLE',
    'COLLEGE_REOPENING',
    'ACADEMIC',
    'URGENT',
    'GENERAL'
  ]),
  targetType: z.enum(['ALL_COLLEGE', 'DEPARTMENT', 'YEAR', 'SECTION']).default('ALL_COLLEGE'),
  deliveryChannel: z.enum(['SMS', 'WHATSAPP', 'BOTH']).default('BOTH'),
  departmentId: z.string().optional().nullable(),
  yearId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable()
});
