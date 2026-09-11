# 🎓 Institutional Academic Portal & Governance System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18.0+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.0+-336791.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748.svg)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/System_Tests-51%2F51_Passed-brightgreen.svg)]()

A comprehensive, enterprise-grade academic management, marks administration, performance analytics, and parent notification platform designed specifically for higher-education colleges and universities.

---

## 📑 Table of Contents
1. [Project Overview](#1-project-overview)
2. [System Architecture & High-Level Design](#2-system-architecture--high-level-design)
3. [Complete Technology Stack](#3-complete-technology-stack)
4. [Prerequisites & Environment Setup](#4-prerequisites--environment-setup)
5. [PostgreSQL Database Schema & Prisma Setup](#5-postgresql-database-schema--prisma-setup)
6. [Role-Based Access Control (RBAC) & Security Policy](#6-role-based-access-control-rbac--security-policy)
7. [Authentication Flow & Token Lifecycle](#7-authentication-flow--token-lifecycle)
8. [Academic Structure & Hierarchy](#8-academic-structure--hierarchy)
9. [Student Management & Bulk Import (Excel/CSV)](#9-student-management--bulk-import-excelcsv)
10. [Marks Management, IA-1/IA-2 Assessments & Audit Trails](#10-marks-management-ia-1ia-2-assessments--audit-trails)
11. [Multi-Tier Academic Performance Analytics](#11-multi-tier-academic-performance-analytics)
12. [College Notices Workflow & Notification Channels](#12-college-notices-workflow--notification-channels)
13. [Background Notification Queue, Retries & Fallback System](#13-background-notification-queue-retries--fallback-system)
14. [Institutional Reports Generation (PDF, Excel, CSV)](#14-institutional-reports-generation-pdf-excel-csv)
15. [Complete API Reference Directory](#15-complete-api-reference-directory)
16. [Frontend Architecture, UI Components & Responsive Design](#16-frontend-architecture-ui-components--responsive-design)
17. [Automated Testing Suite & Test Verification Results](#17-automated-testing-suite--test-verification-results)
18. [Production Deployment & Security Hardening Checklist](#18-production-deployment--security-hardening-checklist)

---

## 1. Project Overview
The Academic Portal is engineered to eliminate fragmented record-keeping across academic institutions. It provides a hardened multi-role environment where Central Administrators govern college structures, academic policies, curriculum catalogs, parent communications, and audit histories, while Teaching Faculty (Staff) are granted strictly scoped, least-privilege workspaces to upload marks, review class rosters, and evaluate student progress.

### Key Objectives
* **Zero-Trust Role Segregation**: Central Administrators and Faculty members operate in strictly isolated permission realms.
* **Granular Academic Tracking**: Track continuous assessment progress (IA-1, IA-2, IA-3, Model, Semester exams) across sections and departments.
* **Parental Transparency**: Multi-channel notifications via SMS and Meta WhatsApp Business Cloud API with carrier failure handling.
* **Forensic Auditability**: Every marks modification, student update, and notice dispatch is permanently logged in immutable audit records.
* **Institutional Intelligence**: Real-time pass rates, improvement trajectories, and multi-tier comparative rankings.

---

## 2. System Architecture & High-Level Design

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts UI        |
|  - Role-Guarded Navigation & SPA Dynamic Routing                                 |
|  - Admin Dashboard (18 Governance Modules) | Staff Dashboard (5 Restricted Cards) |
+------------------------------------------+----------------------------------------+
                                           | HTTPS / JSON (Bearer JWT)
                                           v
+-----------------------------------------------------------------------------------+
|                                 SECURITY LAYER                                    |
|  - HTTP Security Headers: X-Frame-Options: DENY, nosniff, CSP, HSTS              |
|  - CORS Whitelisting & Sliding-Window Rate Limiters (Auth: 20 req/15m, API)       |
|  - Zod Input Validation & Sanitization Schema Middleware                          |
|  - Zero-Trust RBAC Middleware (`authenticateUser`, `requireAdmin`, `requireStaff`) |
+------------------------------------------+----------------------------------------+
                                           | Validated Request Context
                                           v
+-----------------------------------------------------------------------------------+
|                             BACKEND CORE (Node.js & Express)                      |
|  Controllers: Auth, Structure, Students, Staff, Marks, Analytics, Notices, Reports|
|  Services: Academic Performance, Admin Analytics, Audit Trail, Report Generator   |
+-------------------+---------------------------------------+-----------------------+
                    |                                       |
                    v                                       v
+---------------------------------------+  +----------------------------------------+
|          DATA PERSISTENCE             |  |      ASYNCHRONOUS NOTIFICATION QUEUE   |
|  PostgreSQL 16 Engine via Prisma ORM  |  |  Primary: Redis + BullMQ Queue         |
|  - 15 Relational Models & Indexes     |  |  Fallback: In-Process Resilient Queue  |
|  - Cascades, Unique Constraints, Enums|  |  Channels: SMS Gateway & WhatsApp API  |
+---------------------------------------+  +----------------------------------------+
```

---

## 3. Complete Technology Stack

### Frontend
* **Core Framework**: React 18 with TypeScript 5
* **Build System**: Vite 6 (Optimized production chunking, Hot Module Replacement)
* **Styling**: Tailwind CSS with custom academic design tokens and glassmorphism styling
* **Icons**: Lucide React
* **Data Visualization**: Recharts (Cohort bar charts, progression curves, status distribution donuts)
* **HTTP Client**: Axios with automatic JWT interceptors and session purge on 401

### Backend
* **Runtime**: Node.js 18+ LTS
* **Framework**: Express 5 (TypeScript)
* **Database & ORM**: PostgreSQL 16 with Prisma ORM 5
* **Security & Auth**: JWT (`jsonwebtoken`), `bcryptjs`, `zod`, custom rate limiters
* **File Processing**: `multer` (in-memory uploads), `xlsx` (Excel engine), `pdfkit` (PDF rendering), `fast-csv` (CSV streaming)
* **Queuing & Workers**: `bullmq` & `ioredis` with auto-activating in-process fallback worker

---

## 4. Prerequisites & Environment Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher (`node -v`)
* **npm**: v9.0.0 or higher (`npm -v`)
* **PostgreSQL**: v14.0 or higher running on port 5432
* **Redis** (Optional): v6.0 or higher running on port 6379 (automatically falls back if absent)

### Installation Steps

1. **Clone Repository & Enter Directory**:
   ```bash
   git clone <repository_url>
   cd academic-portal
   ```

2. **Configure Backend Environment**:
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your PostgreSQL credentials
   ```

3. **Install Backend Dependencies & Generate Prisma Client**:
   ```bash
   npm install
   npx prisma generate
   ```

4. **Run Database Migrations & Initial Seed**:
   ```bash
   npx prisma migrate dev --name init
   npm run seed
   ```

5. **Install Frontend Dependencies**:
   ```bash
   cd ../client
   npm install
   ```

6. **Start Local Development Servers**:
   * **Backend**: `cd ../server && npm run dev` (Runs on `http://localhost:5000`)
   * **Frontend**: `cd ../client && npm run dev` (Runs on `http://localhost:5173`)

---

## 5. PostgreSQL Database Schema & Prisma Setup

The system model consists of 15 relational entities managed through Prisma ORM:

```prisma
enum Role { ADMIN, STAFF }
enum StudentStatus { ACTIVE, INACTIVE, DETAINED, ALUMNI }
enum NotificationType { SMS, WHATSAPP, BOTH }
enum NotificationCategory { HOLIDAY, INTERNAL_EXAM, SEMESTER_EXAM, PERFORMANCE_UPDATE, COLLEGE_NOTICE, EMERGENCY }
enum NotificationStatus { PENDING, PROCESSING, SENT, DELIVERED, FAILED }
enum NoticeStatus { DRAFT, SCHEDULED, PUBLISHED, ARCHIVED }
```

### Key Models
1. **User**: Credentials, hashed passwords (`bcrypt`), role (`ADMIN` / `STAFF`), phone, active status.
2. **AcademicYear**: Academic cycles (`2025-2026`), `isCurrent` boolean, date boundaries.
3. **Department**: Institutional engineering departments (`CSE`, `ECE`, `MECH`, `CIVIL`, `IT`).
4. **Year**: Academic progression levels (`1st Year` through `4th Year`, year numbers 1-4).
5. **Section**: Class cohorts (`A`, `B`, `C`) tied to department, year, and academic year.
6. **Student**: Register number, student name, class foreign keys, parent name, protected parent mobile number.
7. **Subject**: Curriculum course units with course code, semester number, and credit definitions.
8. **TeacherAssignment**: Mapping linking faculty members (`staffId`) to specific `sectionId`, `subjectId`, and `academicYearId`.
9. **Assessment**: Centrally created examination milestones (`IA-1`, `IA-2`, `IA-3`, `MODEL`, `SEMESTER`).
10. **Mark**: Evaluation scores (`marksObtained`, `maximumMarks`) linked to student, subject, assessment, and entering faculty.
11. **MarkChangeLog**: Audit trail tracking previous marks, new marks, changer ID, timestamp, and mandatory change reason.
12. **PerformanceSnapshot**: Pre-computed performance metrics for accelerated analytics dashboards.
13. **CollegeNotice**: Institutional broadcasts with audience targets, category, channels, and publish state.
14. **Notification**: Individual recipient dispatch records with carrier provider ID, retry count, status, and error details.
15. **AuditLog**: Immutable institutional audit records capturing entity, action, metadata diffs, IP, and timestamp.

---

## 6. Role-Based Access Control (RBAC) & Security Policy

### Permission Matrix

| Module / Action | Central Admin | Teaching Staff | Unauthenticated |
| :--- | :---: | :---: | :---: |
| **Academic Structure Governance** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Student Directory & Management** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Parent Directory & Contact Data** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Staff Management & Allocation** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Subject & Curriculum Management** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Assessment Creation & Deletion** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **College-Wide Analytics** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Department & Year Analytics** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Institutional Reports Generation** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Notice Publishing & Dispatch** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Notification History & Logs** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Audit Logs & Tamper History** | ✅ ALLOWED | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Staff Dashboard Summary** | ❌ 403 FORBIDDEN | ✅ ALLOWED | ❌ 401 UNAUTHORIZED |
| **Assigned Classes & Subjects** | ❌ 403 FORBIDDEN | ✅ ALLOWED | ❌ 401 UNAUTHORIZED |
| **Marks Entry (Assigned Classes)** | ✅ ALLOWED | ✅ ALLOWED | ❌ 401 UNAUTHORIZED |
| **Marks Entry (Unassigned Classes)**| ❌ 403 FORBIDDEN | ❌ 403 FORBIDDEN | ❌ 401 UNAUTHORIZED |
| **Parent Mobile / Name Visibility** | ✅ ALLOWED | ❌ STRICTLY EXCLUDED | ❌ 401 UNAUTHORIZED |

---

## 7. Authentication Flow & Token Lifecycle

1. **User Authentication**:
   * Post credentials to `/api/auth/login` with email/username and password.
   * Password verified using `bcryptjs.compare()` against stored salt hash.
2. **Token Generation**:
   * Server signs a JWT containing `{ id, email, role }` with a 24-hour expiration (`expiresIn: '24h'`).
   * Returns token, user profile, and deterministic `redirectUrl` (`/admin/dashboard` or `/staff/dashboard`).
3. **Session Verification**:
   * Protected endpoints verify authorization header (`Bearer <token>`).
   * Token signature validated against `JWT_SECRET`; expired or tampered tokens return `401 Unauthorized`.
4. **Session Termination**:
   * Calling `/api/auth/logout` records session audit entry; client purges localStorage credentials.

---

## 8. Academic Structure & Hierarchy

The portal enforces strict relational hierarchy across 5 tiers:
```
Academic Year (e.g., 2025-2026)
    └── Department (e.g., Computer Science & Engineering - CSE)
          └── Year Level (e.g., 3rd Year - Semester 5 & 6)
                └── Section (e.g., Section A)
                      ├── Students (Enrolled cohort)
                      └── Teacher Assignments (Staff -> Subject mapping)
```

Cascading dropdown endpoints (`/api/admin/academic-structure/overview`) guarantee that teachers are only assigned to valid department/year/section tuples.

---

## 9. Student Management & Bulk Import (Excel/CSV)

* **Individual Management**: Add, update, view, and safely toggle student status (`ACTIVE`, `INACTIVE`, `DETAINED`, `ALUMNI`).
* **High-Performance Bulk Import Engine**:
  * **14-Point Pre-Commit Validation Engine**:
    1. Register Number: 3-30 chars, alphanumeric format (`^[A-Za-z0-9\-_]{3,30}$`).
    2. Student Full Name: 2-100 characters.
    3. Parent Mobile: Valid E.164 or Indian 10-digit mobile number (`^(\+?[1-9]\d{9,14}|[6-9]\d{9})$`).
    4. Department Code: Validated against database department catalog (e.g., CSE, ECE, EEE, MECH).
    5. Academic Year Cohort: Validated year level (1 to 4).
    6. Class Section: Relational verification ensuring section exists for target department and year.
    7. In-Memory Duplicate Detection: Pre-loads lookup maps for ultra-fast $O(1)$ indexing.
    8. In-File Duplicate Detection: Flags redundant rows within the uploaded file.
    9. Optional Gender & Roll Number Normalization.
    10. Parent Email Format: Validates RFC 5322 syntax if provided.
    11. Blank Row Filtration: Skips empty or whitespace-only rows cleanly.
    12. Transactional Chunking: Batches writes (`IMPORT_BATCH_SIZE=500`) to avoid memory bottlenecks and single-query loops.
    13. Audit Ledger Logging: Every import produces a `StudentImportHistory` record with full row error diagnostics and correction suggestions.
    14. Safe Default Resolution: Default duplicate resolution mode is non-destructive (`SKIP`).
  * **Duplicate Resolution Modes**:
    * **`SKIP`** (Default / Safe): Inserts new students and safely preserves existing student data and parent phone numbers.
    * **`UPDATE`**: Overwrites existing student name, parent phone, department, year, and section with uploaded values.
    * **`STOP`**: Aborts entire import with `409 Conflict` (`DUPLICATE_IMPORT_ABORTED`) if any duplicates are detected.
  * **Endpoints**:
    * `GET /api/admin/students/import/template?format=xlsx|csv`: Downloads sample spreadsheet with pre-formatted columns.
    * `POST /api/admin/students/import/preview`: Multipart file upload returning dry-run validation preview, metrics, and diagnostics without committing.
    * `POST /api/admin/students/import/confirm`: Commits validated records using batched `createMany` and transactional updates.
    * `GET /api/admin/students/import/history`: Paginated audit ledger of previous bulk upload operations.
    * `GET /api/admin/students/import/history/:id`: Drilldown diagnostic logs and row error traces for a specific import job.

---

## 10. Marks Management, IA-1/IA-2 Assessments & Audit Trails

* **Scoped Faculty Grading**: Staff members can only view marks rosters and enter grades for classes where a verified `TeacherAssignment` exists in the database.
* **Continuous Assessment Milestones**:
  * **IA-1** (Internal Assessment 1)
  * **IA-2** (Internal Assessment 2)
  * Model Exams & End-Semester Examinations
* **Mandatory Change Reason & Audit Trail**:
  * Modifying any pre-existing mark requires faculty to specify a change reason.
  * System writes a record to `MarkChangeLog` capturing the previous mark, new mark, diff score, changer ID, timestamp, and explanation.
  * Central Administrators can filter, inspect, and export this audit ledger at `/api/admin/audit-logs/mark-changes`.

---

## 11. Multi-Tier Academic Performance Analytics

Analytics are computed in real time across four distinct institutional tiers:
1. **Section Analytics**: Class average, highest/lowest scores, pass percentage, subject performance breakdown, and student rosters.
2. **Year-Wise Analytics**: Cohort comparison across 1st, 2nd, 3rd, and 4th Year engineering students.
3. **Department Analytics**: Departmental rankings, faculty workload analysis, and pass rate benchmarking.
4. **Overall College Analytics**: Institutional pass percentage, top 10 rankers, most improved students, and students needing academic attention.

---

## 12. College Notices Workflow & Notification Channels

### Notice Lifecycle Workflow
```
[DRAFT] ──> [PREVIEW] ──> [CONFIRM] ──> [SCHEDULE / PUBLISH] ──> [DISPATCH QUEUE] ──> [DELIVERY TRACKING]
```

### Notice Types & Categorization
* **HOLIDAY**: College closures, festival notifications, weather holidays.
* **INTERNAL_EXAM**: IA-1, IA-2, and Model exam timetables, seat arrangements, and hall ticket notices.
* **SEMESTER_EXAM**: Anna University end-semester theory and practical exam schedules.
* **PERFORMANCE_UPDATE**: Automated student academic report delivery to parents.
* **EMERGENCY / URGENT**: High-priority institutional announcements.

### Delivery Channels
* **SMS**: Delivered via enterprise SMS gateway provider.
* **WhatsApp**: Delivered via Meta WhatsApp Business Cloud API with structured message templates.
* **Dual Channel (BOTH)**: Simultaneously dispatches across both SMS and WhatsApp.

---

## 13. Background Notification Queue, Retries & Fallback System

* **Dual Queue Architecture**:
  * **Primary**: Redis + BullMQ asynchronous background queue for high-throughput concurrency.
  * **Resilient Fallback**: If Redis is unavailable or disconnected, the system automatically activates an in-process background worker with exponential backoff retries.
* **Carrier Failure Isolation**:
  * Provider timeouts, network errors, and simulated provider failures are caught and recorded.
  * Failed notifications are recorded with `status: FAILED`, error description, and failure timestamp.
  * Carrier failures never crash the server or block user API requests.

---

## 14. Institutional Reports Generation (PDF, Excel, CSV)

Central Administrators can generate and export formal reports across multiple formats:
* **Student Performance Report** (`/api/admin/reports/student-performance?format=pdf|excel|csv`)
* **Section Performance Report** (`/api/admin/reports/section-performance?format=pdf|excel|csv`)
* **Year Performance Report** (`/api/admin/reports/year-performance?format=pdf|excel|csv`)
* **Department Performance Report** (`/api/admin/reports/department-performance?format=pdf|excel|csv`)
* **Overall College Result Report** (`/api/admin/reports/overall-college?format=pdf|excel|csv`)
* **Parent Notification Delivery Report** (`/api/admin/reports/notifications?format=csv|excel`)
* **College Notice Activity Report** (`/api/admin/reports/notices?format=csv|excel`)

---

## 15. Complete API Reference Directory

### Authentication (`/api/auth`)
* `POST /api/auth/login`: Authenticate user and obtain JWT token.
* `GET /api/auth/me`: Retrieve authenticated user profile and permissions.
* `POST /api/auth/logout`: Terminate session and record audit entry.

### Central Administration (`/api/admin`)
* `GET /api/admin/dashboard-summary`: 8 core dashboard metrics, rankings, and notice queues.
* `GET /api/admin/academic-structure/overview`: Full academic hierarchy and stats.
* `GET /api/admin/academic-years`: List academic cycles.
* `GET /api/admin/departments`: List active academic departments.
* `GET /api/admin/years`: List engineering study years (1-4).
* `GET /api/admin/sections`: List class sections.
* `GET /api/admin/students`: Directory of enrolled students.
* `GET /api/admin/students/import/template`: Download bulk import spreadsheet template.
* `POST /api/admin/students/import/preview`: Validate spreadsheet upload dry-run.
* `POST /api/admin/students/import/confirm`: Commit validated student batch.
* `GET /api/admin/staff`: Directory of teaching faculty.
* `GET /api/admin/staff/assignments`: Staff teaching assignments ledger.
* `GET /api/admin/subjects`: Curriculum subject directory.
* `GET /api/admin/analytics/overall`: Institutional college-wide analytics.
* `GET /api/admin/analytics/departments`: Department comparative analytics.
* `GET /api/admin/analytics/years`: Year-wise cohort progression.
* `GET /api/admin/analytics/sections`: Section performance breakdown.
* `GET /api/admin/analytics/performance/overview`: Comprehensive performance statistics.
* `GET /api/admin/analytics/performance/student/:id`: Individual student IA comparison report.
* `POST /api/admin/notices`: Create notice draft.
* `POST /api/admin/notices/:id/publish`: Publish notice and queue notifications.
* `GET /api/admin/notifications/stats`: Delivery counts and queue status.
* `GET /api/admin/notifications/history`: Paginated notification log.
* `GET /api/admin/audit-logs/mark-changes`: Mark change history audit trail.
* `GET /api/admin/reports/:reportType`: Multi-format report export engine.

### Faculty Workspaces (`/api/staff`)
* `GET /api/staff/dashboard-summary`: 5 marks management KPI cards and 3 sections.
* `GET /api/staff/assigned-classes`: Classes assigned to authenticated teacher.
* `GET /api/staff/subjects`: Subjects assigned to authenticated teacher.
* `GET /api/staff/assessments`: Active assessments for marks entry.
* `GET /api/staff/marks`: Class marks roster (parent contacts strictly excluded).
* `POST /api/staff/marks`: Enter or update student marks (mandatory reason for changes).
* `GET /api/staff/marks/template`: Download marks entry spreadsheet template.
* `POST /api/staff/marks/upload-preview`: Validate marks spreadsheet upload.
* `POST /api/staff/marks/upload-confirm`: Commit bulk marks upload.
* `POST /api/staff/marks/batch`: Submit grid of marks entries.

---

## 16. Frontend Architecture, UI Components & Responsive Design

* **Design Philosophy**: High-density academic portal interface using glassmorphism, responsive grid layouts, and color-coded status badges.
* **Admin Layout (`AdminLayout.tsx`)**: 18-module navigation sidebar with search, notifications counter, and breadcrumb headers.
* **Staff Layout (`StaffLayout.tsx`)**: Restrictive faculty navigation isolating marks management and assigned performance.
* **Interactive Components**:
  * Real-time search filters and cascading dropdown selectors
  * Multi-column sortable paginated data tables
  * Interactive modal dialogs with focus trapping and ESC-dismissal
  * Confirmation modals for destructive actions (e.g. status changes, notice publication)
  * Dynamic Toast notification system for instant feedback
  * Visual loading skeletons and informative empty states

---

## 17. Automated Testing Suite & Test Verification Results

The portal features an automated test harness covering all functional requirements, security policies, and performance edge cases:

```bash
# Run Bulk Student Import Engine & Validation Suite (13 tests)
npm --prefix server run test:bulk-import

# Run Final Complete System Test (51 tests)
npm --prefix server run test:system

# Run Security RBAC Matrix Suite (49 tests)
npm --prefix server run test:rbac

# Run Staff Dashboard Isolation Suite (30 tests)
npm --prefix server run test:staff

# Run Admin Dashboard Suite (19 tests)
npm --prefix server run test:admin

# Run Full End-to-End Suite (23 tests)
npm --prefix server run test:all
```

### Verification Scorecard

| Test Suite | Assertions | Passed | Failed | Success Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Bulk Student Import Engine Test** | 13 | 13 | 0 | **100.0%** |
| **Final Complete System Test** | 51 | 51 | 0 | **100.0%** |
| **RBAC Security Matrix Test** | 49 | 49 | 0 | **100.0%** |
| **Staff Dashboard Restriction Test** | 30 | 30 | 0 | **100.0%** |
| **Admin Dashboard Integrity Test** | 19 | 19 | 0 | **100.0%** |
| **Authentication & RBAC Routing Test** | 23 | 23 | 0 | **100.0%** |
| **Database & Prisma Connection Test** | 15 Models | 15 Models | 0 | **100.0%** |
| **Total Automated Assertions** | **200** | **200** | **0** | **100.0%** |

---

## 18. Production Deployment & Security Hardening Checklist

### Environment & Server Configuration
- [ ] Set `NODE_ENV=production` in production `.env`.
- [ ] Configure a cryptographically strong `JWT_SECRET` (minimum 64 random characters).
- [ ] Update `DATABASE_URL` with SSL mode enabled (`?sslmode=require`).
- [ ] Restrict `CORS_ORIGIN` to the exact production frontend domain.
- [ ] Connect production Redis instance for BullMQ clustering.
- [ ] Provide live Meta WhatsApp Cloud API credentials and register approved message templates.
- [ ] Configure enterprise SMS gateway credentials and sender ID.

### Database & Backups
- [ ] Execute database migrations in production: `npx prisma migrate deploy`.
- [ ] Configure automated daily PostgreSQL snapshots with point-in-time recovery (PITR).
- [ ] Verify connection pooling with PgBouncer or Prisma Accelerate.

### Process Management & Reverse Proxy
- [ ] Run backend under a process supervisor like PM2 or Docker container:
  ```bash
  pm2 start dist/server.js --name "academic-portal-api" -i max
  ```
- [ ] Terminate SSL/TLS at reverse proxy (Nginx, Caddy, or Cloudflare).
- [ ] Ensure reverse proxy passes standard proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`).

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
