# Role-Based Access Control (RBAC) Specification

## 1. Principles of Security

1. **Server-Side Enforcement**: Client-side UI guards are exclusively for usability. All security guarantees are verified by backend decorators on incoming HTTP requests.
2. **Principle of Least Privilege**: Staff users have visibility and mutation rights strictly confined to the exact subjects and sections assigned to them in the database for the active academic term.
3. **Immutability of Audit Trails**: All administrative actions and mark modifications are permanently logged to an audit table that cannot be edited or purged by staff.

---

## 2. Comprehensive Role Permission Matrix

| Capability / Module | Admin Role | Staff Role | Backend Security Policy |
| :--- | :---: | :---: | :--- |
| **Authentication (Login / Logout)** | Full | Full | Authenticates credentials, returns signed JWT with `role` claim. |
| **Profile Access** | Full | Self Only | Validates token identity. |
| **Academic Structure (Years, Depts, Sections)** | Create / Read / Update / Delete | Read Assigned Only | Admin-only decorator (`@admin_required`); Staff cannot access structure CRUD. |
| **Subject Management** | Create / Read / Update / Delete | Read Assigned Only | Staff can only query subjects linked via `staff_assignments`. |
| **Staff Accounts & Allocations** | Full Management | None | Staff route calls to `/api/admin/staff*` return `403 Forbidden`. |
| **Student Directory** | Full CRUD | Scoped Read Only | Staff can only list students within their assigned section. |
| **Parent Information** | Full CRUD | None / Scoped Contact View | Sensitive contact management restricted to Admin. |
| **IA-1 & IA-2 Marks Upload / Entry** | Full CRUD | Assigned Classes/Subjects Only | Mutation handler validates that `(staff_id, subject_id, section_id)` exists in active assignments. |
| **Marks Viewing** | Global Access | Uploaded / Assigned Only | Staff cannot inspect marks of subjects taught by other faculty. |
| **Section Analytics** | Global Access | Assigned Section Only | Filtered to assigned subject/section. |
| **Department / Year / College Analytics** | Global Access | **PROHIBITED** | Staff requests to multi-tier analytics return `403 Forbidden`. |
| **Report Generation (PDF/Excel)** | Full System Reports | Scoped Marks Sheet Only | College-wide reports locked to Admin. |
| **College Notices & News** | Create / Publish / Delete | View Published Circulars | Staff cannot author or publish notices. |
| **Parent Notifications (SMS & WhatsApp)** | Trigger & Monitor | **PROHIBITED** | Dispatches locked to Admin; Staff cannot access notification triggers. |
| **Notification History & Delivery Logs** | Full Access | **PROHIBITED** | Staff calls to `/api/notifications/logs` return `403 Forbidden`. |
| **Audit Logs & Mark Change History** | Full Access | **PROHIBITED** | Staff cannot query `/api/admin/audit-logs`. |
| **System Settings** | Full Access | **PROHIBITED** | Staff calls return `403 Forbidden`. |

---

## 3. Express TypeScript Backend Enforcement Architecture

### Token Claims
The JWT payload issued upon authentication contains:
```json
{
  "sub": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  "email": "sarah.cse@college.edu",
  "name": "Prof. Sarah Jenkins",
  "role": "STAFF",
  "iat": 1757340000,
  "exp": 1757426400
}
```

### Security Middlewares (`server/src/middleware/auth.middleware.ts`)
1. **`authenticateUser`**:
   - Decodes and verifies JWT signature and expiration.
   - Verifies the user exists and is active (`isActive === true`) in PostgreSQL.
   - Populates `req.user`.
   - Returns `401 Unauthorized` if token is missing, expired, or malformed.
2. **`requireAdmin`**:
   - Strictly asserts `req.user.role === Role.ADMIN`.
   - Rejects Staff with `403 Forbidden` (`ADMIN_ACCESS_REQUIRED`).
3. **`requireStaff`**:
   - Enforces `req.user.role === Role.STAFF` (or Admin where dual access is granted).
   - Rejects non-staff with `403 Forbidden`.
4. **`verifyStaffClassSubjectAccess` / `checkStaffAssignment`**:
   - **Never trusts client input**: Extracts `staffId` exclusively from `req.user.id` in the verified JWT.
   - Queries PostgreSQL via Prisma `TeacherAssignment` table for `(staffId, sectionId, subjectId)`.
   - Rejects attempts to access another class or subject with `403 Forbidden` (`STAFF_CLASS_UNAUTHORIZED`).

---

## 4. Authentication Redirection Policies

- **Admin Login (`admin@college.edu`)** -> Authenticated payload includes `role: "ADMIN"` and `redirectUrl: "/admin/dashboard"`.
- **Staff Login (`sarah.cse@college.edu`)** -> Authenticated payload includes `role: "STAFF"` and `redirectUrl: "/staff/dashboard"`.
- **Admin Account Creation**: No public registration. Accounts are initialized via system migrations/seeds or managed directly by existing administrators. Staff accounts can be created by Admins via `POST /api/admin/staff`.

