# Relational Database Schema Specification

## 1. Overview
The database engine is **PostgreSQL 16**, managed through **Prisma ORM** with **TypeScript**. All models enforce strict foreign key referential integrity (`onDelete: Cascade` / `Restrict` / `SetNull`), custom composite uniqueness constraints, and performance indexes.

---

## 2. Prisma Models & Schema Structure

| Model Name | Purpose | Key Constraints & Relations |
| :--- | :--- | :--- |
| **`User`** | Admin & Faculty accounts | `Role` enum (`ADMIN`, `STAFF`), unique email, `isActive` |
| **`AcademicYear`** | Academic term calendar | Unique `yearName` (e.g., '2025-2026'), `isCurrent` boolean |
| **`Department`** | Academic departments | Unique `code` (e.g., 'CSE', 'ECE', 'MECH'), `name` |
| **`Year`** | Degree year levels | Unique `yearNumber` (1, 2, 3, 4), `name` ('First Year'...) |
| **`Section`** | Class sections | Composite unique `[name, departmentId, yearId, academicYearId]` |
| **`Subject`** | Curricular courses | Unique `code` (e.g., 'CS8501'), semester (1-8), Dept/Year relation |
| **`Student`** | Enrolled students | Composite unique `[registerNumber, academicYearId]`, parent details |
| **`TeacherAssignment`** | Staff class/subject allocation | Composite unique `[subjectId, sectionId, academicYearId]`, links `staffId` |
| **`Assessment`** | Dynamic assessments | Non-hardcoded: 'IA-1', 'IA-2', 'IA-3', 'MODEL', 'SEMESTER' |
| **`Mark`** | Evaluation scores | Composite unique `[studentId, subjectId, assessmentId]`, `marksObtained` |
| **`MarkChangeLog`** | Immutable audit trail | Tracks `previousMarks`, `newMarks`, `changedBy`, `reason` |
| **`PerformanceSnapshot`** | Aggregate metrics | Unique `[studentId, assessmentId]`, total, percentage, status |
| **`Notification`** | Multi-channel parental alerts | `NotificationType` (`SMS`, `WHATSAPP`), status, retryCount |
| **`CollegeNotice`** | Official circulars | `NoticeType`, `NoticeTargetType` (ALL_COLLEGE, DEPT, YEAR, SEC) |
| **`AuditLog`** | System activity audit | `userId`, `action`, `entity`, `entityId`, `metadata` (JSON) |

---

## 2. Table Definitions

### 2.1 `users`
System accounts for Administrators and Faculty.
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK(role IN ('admin', 'staff')) NOT NULL,
    department_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
```

### 2.2 `academic_years`
```sql
CREATE TABLE academic_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_name TEXT UNIQUE NOT NULL, -- e.g. "2025-2026"
    is_current BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 `departments`
```sql
CREATE TABLE departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dept_code TEXT UNIQUE NOT NULL, -- e.g. "CSE", "ECE", "MECH"
    dept_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 `years`
Represents the degree year (1st, 2nd, 3rd, 4th year).
```sql
CREATE TABLE years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_number INTEGER UNIQUE NOT NULL, -- 1, 2, 3, 4
    year_name TEXT NOT NULL              -- "First Year", etc.
);
```

### 2.5 `sections`
```sql
CREATE TABLE sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_name TEXT NOT NULL,          -- "A", "B", "C"
    department_id INTEGER NOT NULL,
    year_id INTEGER NOT NULL,
    academic_year_id INTEGER NOT NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    UNIQUE(section_name, department_id, year_id, academic_year_id)
);
```

### 2.6 `subjects`
```sql
CREATE TABLE subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_code TEXT UNIQUE NOT NULL,   -- e.g. "CS8501"
    subject_name TEXT NOT NULL,
    department_id INTEGER NOT NULL,
    year_id INTEGER NOT NULL,
    semester INTEGER NOT NULL,           -- 1 to 8
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE CASCADE
);
```

### 2.7 `staff_assignments`
Maps which faculty member is allocated to teach a specific subject to a specific section.
```sql
CREATE TABLE staff_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    section_id INTEGER NOT NULL,
    academic_year_id INTEGER NOT NULL,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    UNIQUE(subject_id, section_id, academic_year_id)
);
```

### 2.8 `parents`
Parents do NOT have login credentials; this table stores contact details for SMS/WhatsApp dispatches.
```sql
CREATE TABLE parents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    father_name TEXT,
    mother_name TEXT,
    guardian_name TEXT,
    primary_phone TEXT NOT NULL,
    secondary_phone TEXT,
    whatsapp_number TEXT NOT NULL,
    email TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.9 `students`
```sql
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    register_number TEXT UNIQUE NOT NULL,
    roll_number TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    section_id INTEGER NOT NULL,
    parent_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE
);
```

### 2.10 `marks`
Internal Assessment marks (IA-1 and IA-2).
```sql
CREATE TABLE marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    assessment_type TEXT CHECK(assessment_type IN ('IA1', 'IA2')) NOT NULL,
    max_marks REAL DEFAULT 100.0,
    marks_obtained REAL NOT NULL CHECK(marks_obtained >= 0 AND marks_obtained <= max_marks),
    entered_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE(student_id, subject_id, assessment_type)
);
```

### 2.11 `mark_audit_logs`
Immutable audit log tracking every mark update.
```sql
CREATE TABLE mark_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mark_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    assessment_type TEXT NOT NULL,
    previous_marks REAL,
    new_marks REAL NOT NULL,
    changed_by INTEGER NOT NULL,
    change_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mark_id) REFERENCES marks(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);
```

### 2.12 `notices`
Official college and departmental circulars.
```sql
CREATE TABLE notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',     -- 'Academic', 'Exam', 'General', 'Urgent'
    target_audience TEXT DEFAULT 'All',  -- 'All', 'Students', 'Parents', 'Staff'
    department_id INTEGER,               -- NULL means all departments
    published_by INTEGER NOT NULL,
    is_published BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
```

### 2.13 `notification_logs`
Dispatched parental alerts via SMS and WhatsApp.
```sql
CREATE TABLE notification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_phone TEXT NOT NULL,
    channel TEXT CHECK(channel IN ('SMS', 'WhatsApp')) NOT NULL,
    notification_type TEXT NOT NULL,     -- 'IA1_MARKS', 'IA2_MARKS', 'PERFORMANCE_ALERT', 'NOTICE'
    student_id INTEGER,
    message_body TEXT NOT NULL,
    status TEXT CHECK(status IN ('SENT', 'DELIVERED', 'FAILED')) DEFAULT 'SENT',
    triggered_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE RESTRICT
);
```
