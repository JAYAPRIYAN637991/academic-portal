export type UserRole = 'ADMIN' | 'STAFF';

export interface User {
  id: any;
  username: string;
  email: string;
  role: UserRole;
  name?: string;
  staffId?: any;
  staffName?: string;
  departmentId?: any;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AcademicYear {
  id: number;
  name: string;
  is_current: boolean | number;
  start_date?: string;
  end_date?: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  hod_name?: string;
}

export interface YearSection {
  id: any;
  academic_year_id?: any;
  academicYearId?: string;
  department_id?: any;
  departmentId?: string;
  year?: number;
  yearId?: string;
  section: string;
  name?: string;
  department_name?: string;
  department_code?: string;
  department?: any;
  academic_year_name?: string;
  student_count?: number;
}

export interface Subject {
  id: any;
  code: string;
  name: string;
  department_id: any;
  departmentId?: string;
  year: number;
  yearId?: string;
  semester: number;
  department_name?: string;
  department?: any;
}

export interface StaffMember {
  id: string | number;
  user_id?: string | number;
  employee_id?: string;
  name: string;
  email: string;
  username?: string;
  dateOfBirth?: string;
  passwordAuthorized?: boolean;
  passwordAuthorizedAt?: string;
  defaultPasswordPreview?: string | null;
  phone?: string;
  designation?: string;
  department_id?: number | string;
  departmentId?: string;
  department_name?: string;
  role?: string;
  isActive?: boolean;
  assignmentsCount?: number;
  assignments?: any[];
}

export interface StaffAssignment {
  id: string;
  staffId?: string;
  staff_id?: string | number;
  staffName?: string;
  staff_name?: string;
  staffEmail?: string;
  staff?: any;
  subjectId?: string;
  subject_id?: string | number;
  subjectCode?: string;
  subject_code?: string;
  subjectName?: string;
  subject_name?: string;
  subject?: any;
  semester?: number;
  sectionId?: string;
  class_section_id?: string | number;
  section?: any;
  sectionName?: string;
  departmentId?: string;
  departmentCode?: string;
  departmentName?: string;
  department_name?: string;
  department?: any;
  yearId?: string;
  year?: number;
  academicYear?: any;
  academicYearId?: string;
  studentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Student {
  id: number;
  register_number: string;
  roll_number: string;
  name: string;
  class_section_id: number;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  department_name?: string;
  year?: number;
  section?: string;
}

export interface Mark {
  id: number;
  student_id: number;
  student_name?: string;
  register_number?: string;
  subject_id: number;
  subject_code?: string;
  subject_name?: string;
  assessment_name: string;
  marks_obtained: number;
  max_marks: number;
  percentage?: number;
  is_improvement?: boolean | number;
  updated_at?: string;
}

export interface MarkChangeLog {
  id: number;
  student_id: number;
  student_name: string;
  register_number: string;
  subject_code: string;
  assessment_name: string;
  old_marks: number;
  new_marks: number;
  changed_by: string;
  change_reason: string;
  changed_at: string;
}

export type NoticeType = 'CIRCULAR' | 'EVENT' | 'EXAM' | 'URGENT' | 'GENERAL';
export type TargetAudience = 'ALL' | 'PARENTS' | 'STAFF' | 'STUDENTS';
export type NoticeStatus = 'DRAFT' | 'PREVIEW' | 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED';

export interface CollegeNotice {
  id: number;
  title: string;
  content: string;
  notice_type: NoticeType;
  target_audience: TargetAudience;
  scheduled_date?: string;
  status: NoticeStatus;
  channels: ('SMS' | 'WHATSAPP')[];
  recipient_count: number;
  created_at: string;
}

export interface NotificationRecord {
  id: number;
  notice_id?: number;
  title?: string;
  category: string;
  recipient_phone: string;
  channel: 'SMS' | 'WHATSAPP';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  sent_at?: string;
}

export interface NotificationStats {
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
  total: number;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name: string;
  action: string;
  resource: string;
  details?: string;
  ip_address?: string;
  timestamp: string;
}

export interface SystemSettings {
  college_name: string;
  academic_year_current: string;
  sms_provider_enabled: boolean;
  whatsapp_api_status: string;
  pass_mark_threshold: number;
  ia1_max_marks: number;
  ia2_max_marks: number;
}

export interface AdminDashboardData {
  metrics: {
    total_students: number;
    total_staff: number;
    departments: number;
    sections: number;
    ia1_average: number;
    ia2_average: number;
    overall_improvement: number;
    pass_percentage: number;
  };
  notices: {
    draft: number;
    scheduled: number;
    published: number;
  };
  notifications: {
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
  };
  department_performance: Array<{
    name: string;
    code: string;
    ia1_avg: number;
    ia2_avg: number;
    pass_rate: number;
  }>;
  year_performance: Array<{
    year: number;
    ia1_avg: number;
    ia2_avg: number;
    improvement: number;
    pass_rate: number;
  }>;
  section_performance: Array<{
    section: string;
    dept: string;
    ia1_avg: number;
    ia2_avg: number;
    pass_rate: number;
  }>;
  top_students: Array<{
    id: number;
    name: string;
    register_number: string;
    department: string;
    year: number;
    percentage: number;
  }>;
  students_needing_attention: Array<{
    id: number;
    name: string;
    register_number: string;
    department: string;
    year: number;
    percentage: number;
    failing_subjects: number;
  }>;
}

export interface StaffDashboardData {
  metrics: {
    assigned_classes: number;
    assigned_subjects: number;
    total_students: number;
    pending_marks: number;
    completed_assessments: number;
  };
  assigned_classes: Array<{
    id: number;
    department: string;
    year: number;
    section: string;
    student_count: number;
  }>;
  assigned_subjects: Array<{
    id: number;
    code: string;
    name: string;
    department: string;
    year: number;
    semester: number;
  }>;
  recent_uploads: Array<{
    id: number;
    subject_code: string;
    assessment: string;
    section: string;
    count: number;
    date: string;
  }>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export type DuplicateResolutionMode = 'SKIP' | 'UPDATE' | 'STOP';

export interface StudentImportPreviewRow {
  rowNumber: number;
  registerNumber: string;
  name: string;
  rollNumber?: string;
  gender?: string;
  departmentCode: string;
  yearNumber: number;
  sectionName: string;
  semester?: number;
  parentName?: string;
  parentPhone: string;
  parentEmail?: string;
  address?: string;
  status: 'VALID' | 'INVALID' | 'DUPLICATE';
  errors: string[];
  warnings: string[];
}

export interface StudentImportPreviewResponse {
  fileName: string;
  fileSize: number;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  duplicateMode: DuplicateResolutionMode;
  previewRows: StudentImportPreviewRow[];
  errorSummary: Array<{
    rowNumber: number;
    registerNumber: string;
    errors: string[];
  }>;
  validPayloads: any[];
  duplicatePayloads: any[];
  invalidRowsCount: number;
  processingTimeMs: number;
}

export interface StudentImportHistoryItem {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  academicYearId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  duplicateMode: DuplicateResolutionMode;
  processingTimeMs: number;
  errorLog?: Array<{
    rowNumber?: number;
    registerNumber?: string;
    problem: string;
    suggestedCorrection?: string;
  }>;
  uploader?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

