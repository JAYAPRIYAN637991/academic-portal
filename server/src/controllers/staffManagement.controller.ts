import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Role, StudentStatus } from '@prisma/client';
import { prisma } from '../db';
import { AuditAction } from '../services/audit.service';
import {
  generateDefaultStaffPassword,
  generateStaffUsername,
  formatDobToDDMMYYYY,
  validatePasswordComplexity
} from '../utils/credential.util';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class StaffManagementController {
  /**
   * GET /api/admin/staff
   * Lists all faculty staff accounts with their assignments count, credentials summary, and auth status.
   */
  static async getStaffList(req: Request, res: Response) {
    try {
      const search = (req.query.search as string || '').trim().toLowerCase();
      const status = req.query.status as string;

      const whereClause: any = { role: Role.STAFF };

      if (status === 'active') {
        whereClause.isActive = true;
      } else if (status === 'inactive') {
        whereClause.isActive = false;
      }

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } }
        ];
      }

      const staffList = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          dateOfBirth: true,
          passwordAuthorized: true,
          passwordAuthorizedAt: true,
          role: true,
          isActive: true,
          departmentId: true,
          department: true,
          createdAt: true,
          updatedAt: true,
          teacherAssignments: {
            include: {
              subject: true,
              section: {
                include: {
                  department: true,
                  year: true
                }
              },
              academicYear: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      const formatted = staffList.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        username: s.username,
        dateOfBirth: s.dateOfBirth,
        passwordAuthorized: s.passwordAuthorized,
        passwordAuthorizedAt: s.passwordAuthorizedAt,
        defaultPasswordPreview: s.dateOfBirth ? generateDefaultStaffPassword(s.name, s.dateOfBirth) : null,
        role: s.role,
        isActive: s.isActive,
        departmentId: s.departmentId || s.teacherAssignments[0]?.section?.departmentId || null,
        departmentCode: s.department?.code || s.teacherAssignments[0]?.section?.department?.code || null,
        departmentName: s.department?.name || s.teacherAssignments[0]?.section?.department?.name || null,
        department: s.department || (s.teacherAssignments[0]?.section?.department ? {
          id: s.teacherAssignments[0].section.department.id,
          code: s.teacherAssignments[0].section.department.code,
          name: s.teacherAssignments[0].section.department.name
        } : null),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        assignmentsCount: s.teacherAssignments.length,
        assignments: s.teacherAssignments.map(a => ({
          id: a.id,
          academicYear: a.academicYear.yearName,
          academicYearId: a.academicYearId,
          department: a.section.department.code,
          departmentName: a.section.department.name,
          year: a.section.year.name,
          yearNumber: a.section.year.yearNumber,
          section: a.section.name,
          sectionId: a.sectionId,
          subjectCode: a.subject.code,
          subjectName: a.subject.name,
          subjectId: a.subjectId
        }))
      }));

      return res.status(200).json({ staff: formatted });
    } catch (error: any) {
      console.error('Get staff list error:', error);
      return res.status(500).json({ error: 'Failed to retrieve staff directory' });
    }
  }

  /**
   * GET /api/admin/staff/:id
   * Returns a single staff member with their complete profile, credentials status, and assignments.
   */
  static async getStaffById(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const staff = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          dateOfBirth: true,
          passwordAuthorized: true,
          passwordAuthorizedAt: true,
          role: true,
          isActive: true,
          departmentId: true,
          department: true,
          createdAt: true,
          updatedAt: true,
          teacherAssignments: {
            include: {
              subject: true,
              section: {
                include: {
                  department: true,
                  year: true
                }
              },
              academicYear: true
            }
          }
        }
      });

      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      const defaultPassword = staff.dateOfBirth ? generateDefaultStaffPassword(staff.name, staff.dateOfBirth) : null;

      return res.status(200).json({
        staff: {
          ...staff,
          departmentCode: staff.department?.code || null,
          departmentName: staff.department?.name || null,
          defaultPasswordPreview: defaultPassword
        }
      });
    } catch (error: any) {
      console.error('Get staff by ID error:', error);
      return res.status(500).json({ error: 'Failed to retrieve staff profile' });
    }
  }

  /**
   * POST /api/admin/staff
   * Creates a new Staff account with automated username & Name+DOB default password or custom password.
   */
  static async createStaff(req: Request, res: Response) {
    try {
      const { name, email, password, dateOfBirth, username, departmentId, department_id, department } = req.body || {};

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Staff name is required', code: 'NAME_REQUIRED' });
      }

      if (!email || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: 'A valid email address is required', code: 'INVALID_EMAIL' });
      }

      // Resolve Department if provided
      let targetDept: any = null;
      const rawDept = departmentId || department_id || department;
      if (rawDept) {
        targetDept = await prisma.department.findFirst({
          where: {
            OR: [
              { id: String(rawDept) },
              { code: { equals: String(rawDept).trim(), mode: 'insensitive' } },
              { name: { equals: String(rawDept).trim(), mode: 'insensitive' } }
            ]
          }
        });
      }

      const trimmedDob = dateOfBirth ? String(dateOfBirth).trim() : null;
      let effectivePassword = (password || '').trim();

      if (effectivePassword) {
        const validation = validatePasswordComplexity(effectivePassword);
        if (!validation.isValid) {
          return res.status(400).json({
            error: `Password security policy violation: ${validation.errors.join(', ')}. Password must be alphanumeric and contain at least one special symbol.`,
            code: 'PASSWORD_COMPLEXITY_FAILED',
            details: validation.errors
          });
        }
      } else {
        if (!trimmedDob) {
          return res.status(400).json({
            error: 'Either a Date of Birth (for automated Name+DOB password generation) or an explicit password (min 8 chars, alphanumeric with special symbol) must be provided.',
            code: 'DOB_OR_PASSWORD_REQUIRED'
          });
        }
        effectivePassword = generateDefaultStaffPassword(name.trim(), trimmedDob);
      }

      const trimmedEmail = email.trim().toLowerCase();

      const existingEmail = await prisma.user.findUnique({
        where: { email: trimmedEmail }
      });

      if (existingEmail) {
        return res.status(409).json({
          error: `A user account with email "${trimmedEmail}" already exists.`,
          code: 'USER_ALREADY_EXISTS'
        });
      }

      // Determine unique username
      let targetUsername = username ? String(username).trim().toLowerCase() : generateStaffUsername(name.trim());
      if (!targetUsername) {
        targetUsername = trimmedEmail.split('@')[0];
      }

      const existingUserWithUsername = await prisma.user.findUnique({
        where: { username: targetUsername }
      });
      if (existingUserWithUsername) {
        targetUsername = `${targetUsername}.${Math.floor(100 + Math.random() * 900)}`;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(effectivePassword, salt);

      const newStaff = await prisma.user.create({
        data: {
          name: name.trim(),
          email: trimmedEmail,
          username: targetUsername,
          dateOfBirth: trimmedDob,
          departmentId: targetDept ? targetDept.id : null,
          passwordHash,
          passwordAuthorized: true,
          passwordAuthorizedAt: new Date(),
          role: Role.STAFF,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          dateOfBirth: true,
          departmentId: true,
          department: true,
          passwordAuthorized: true,
          passwordAuthorizedAt: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: AuditAction.STAFF_CREATED,
            entity: 'User',
            entityId: newStaff.id,
            metadata: {
              createdStaffEmail: newStaff.email,
              name: newStaff.name,
              username: newStaff.username,
              passwordAuthorized: true
            }
          }
        });
      }

      return res.status(201).json({
        message: 'Staff account created and authorized successfully',
        staff: newStaff,
        generatedPassword: effectivePassword,
        credentials: {
          name: newStaff.name,
          username: newStaff.username,
          email: newStaff.email,
          department: targetDept ? `${targetDept.code} - ${targetDept.name}` : undefined,
          password: effectivePassword,
          loginUrl: '/login'
        }
      });
    } catch (error: any) {
      console.error('Create staff error:', error);
      return res.status(500).json({ error: 'Failed to create staff account' });
    }
  }

  /**
   * PUT /api/admin/staff/:id
   * Updates staff profile information (name, email, active status, dateOfBirth, username).
   */
  static async updateStaff(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { name, email, isActive, dateOfBirth, username, departmentId, department_id, department, resetDefaultPassword } = req.body || {};

      const staff = await prisma.user.findUnique({ where: { id } });
      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      const updateData: any = {};

      const rawDept = departmentId || department_id || department;
      if (rawDept) {
        const dept = await prisma.department.findFirst({
          where: {
            OR: [
              { id: String(rawDept) },
              { code: { equals: String(rawDept).trim(), mode: 'insensitive' } },
              { name: { equals: String(rawDept).trim(), mode: 'insensitive' } }
            ]
          }
        });
        if (dept) {
          updateData.departmentId = dept.id;
        }
      }

      if (name && name.trim()) {
        updateData.name = name.trim();
      }

      if (email && email.trim()) {
        const trimmedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(trimmedEmail)) {
          return res.status(400).json({ error: 'Invalid email address', code: 'INVALID_EMAIL' });
        }

        if (trimmedEmail !== staff.email) {
          const emailExists = await prisma.user.findUnique({ where: { email: trimmedEmail } });
          if (emailExists) {
            return res.status(409).json({
              error: `Email "${trimmedEmail}" is already in use by another account.`,
              code: 'EMAIL_ALREADY_IN_USE'
            });
          }
          updateData.email = trimmedEmail;
        }
      }

      if (typeof isActive === 'boolean') {
        updateData.isActive = isActive;
      }

      if (dateOfBirth !== undefined) {
        updateData.dateOfBirth = dateOfBirth ? String(dateOfBirth).trim() : null;
      }

      if (username && username.trim()) {
        const cleanUser = username.trim().toLowerCase();
        if (cleanUser !== staff.username) {
          const uExists = await prisma.user.findUnique({ where: { username: cleanUser } });
          if (uExists) {
            return res.status(409).json({ error: `Username "${cleanUser}" is already taken.`, code: 'USERNAME_EXISTS' });
          }
          updateData.username = cleanUser;
        }
      }

      if (resetDefaultPassword) {
        const effectiveDob = updateData.dateOfBirth || staff.dateOfBirth;
        if (!effectiveDob) {
          return res.status(400).json({ error: 'Cannot reset to default password: no Date of Birth specified.', code: 'NO_DOB' });
        }
        const effectiveName = updateData.name || staff.name;
        const newPass = generateDefaultStaffPassword(effectiveName, effectiveDob);
        const salt = await bcrypt.genSalt(10);
        updateData.passwordHash = await bcrypt.hash(newPass, salt);
        updateData.passwordAuthorized = true;
        updateData.passwordAuthorizedAt = new Date();
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          dateOfBirth: true,
          departmentId: true,
          department: true,
          passwordAuthorized: true,
          passwordAuthorizedAt: true,
          role: true,
          isActive: true,
          updatedAt: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'UPDATE_STAFF',
            entity: 'User',
            entityId: id,
            metadata: { changes: updateData }
          }
        });
      }

      return res.status(200).json({
        message: 'Staff details updated successfully',
        staff: updated
      });
    } catch (error: any) {
      console.error('Update staff error:', error);
      return res.status(500).json({ error: 'Failed to update staff account' });
    }
  }

  /**
   * PATCH /api/admin/staff/:id/status
   * Toggles staff account active / deactivated state.
   */
  static async toggleStaffStatus(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const staff = await prisma.user.findUnique({ where: { id } });
      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      const newStatus = !staff.isActive;

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive: newStatus },
        select: { id: true, name: true, email: true, role: true, isActive: true }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: newStatus ? 'ACTIVATE_STAFF' : 'DEACTIVATE_STAFF',
            entity: 'User',
            entityId: id,
            metadata: { newStatus }
          }
        });
      }

      return res.status(200).json({
        message: `Staff account ${newStatus ? 'activated' : 'deactivated'} successfully`,
        staff: updated
      });
    } catch (error: any) {
      console.error('Toggle staff status error:', error);
      return res.status(500).json({ error: 'Failed to toggle staff status' });
    }
  }

  /**
   * POST /api/admin/staff/:id/reset-password
   * Admin resets a staff member's password.
   */
  static async resetStaffPassword(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { newPassword } = req.body || {};

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          error: 'New password must be at least 6 characters in length',
          code: 'PASSWORD_TOO_SHORT'
        });
      }

      const staff = await prisma.user.findUnique({ where: { id } });
      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      await prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordAuthorized: true,
          passwordAuthorizedAt: new Date()
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'RESET_STAFF_PASSWORD',
            entity: 'User',
            entityId: id,
            metadata: { targetStaffEmail: staff.email }
          }
        });
      }

      return res.status(200).json({
        message: `Password for ${staff.name} (${staff.email}) was reset and authorized successfully.`
      });
    } catch (error: any) {
      console.error('Reset staff password error:', error);
      return res.status(500).json({ error: 'Failed to reset staff password' });
    }
  }

  /**
   * POST /api/admin/staff/:id/authorize-password
   * Admin master control to authorize, reset, or revoke staff password.
   * Body: { mode: 'DEFAULT_NAME_DOB' | 'CUSTOM' | 'AUTHORIZE_ONLY' | 'REVOKE', dateOfBirth?: string, newPassword?: string }
   */
  static async authorizeStaffPassword(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { mode = 'DEFAULT_NAME_DOB', dateOfBirth, newPassword } = req.body || {};

      const staff = await prisma.user.findUnique({ where: { id } });
      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      const updateData: any = {};
      let generatedPassword = '';

      if (mode === 'REVOKE') {
        updateData.passwordAuthorized = false;
        updateData.passwordAuthorizedAt = new Date();
      } else if (mode === 'AUTHORIZE_ONLY') {
        updateData.passwordAuthorized = true;
        updateData.passwordAuthorizedAt = new Date();
      } else if (mode === 'CUSTOM') {
        const validation = validatePasswordComplexity(newPassword);
        if (!validation.isValid) {
          return res.status(400).json({
            error: `Password security policy violation: ${validation.errors.join(', ')}. Password must be alphanumeric and contain at least one special symbol.`,
            code: 'PASSWORD_COMPLEXITY_FAILED',
            details: validation.errors
          });
        }
        const salt = await bcrypt.genSalt(10);
        updateData.passwordHash = await bcrypt.hash(newPassword, salt);
        updateData.passwordAuthorized = true;
        updateData.passwordAuthorizedAt = new Date();
      } else {
        // DEFAULT_NAME_DOB mode
        const targetDob = (dateOfBirth || staff.dateOfBirth || '').trim();
        if (!targetDob) {
          return res.status(400).json({
            error: 'Date of birth is required to generate the default Name+DOB password',
            code: 'DOB_REQUIRED'
          });
        }
        generatedPassword = generateDefaultStaffPassword(staff.name, targetDob);
        const salt = await bcrypt.genSalt(10);
        updateData.passwordHash = await bcrypt.hash(generatedPassword, salt);
        updateData.dateOfBirth = targetDob;
        updateData.passwordAuthorized = true;
        updateData.passwordAuthorizedAt = new Date();
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          dateOfBirth: true,
          passwordAuthorized: true,
          passwordAuthorizedAt: true,
          updatedAt: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'AUTHORIZE_STAFF_PASSWORD',
            entity: 'User',
            entityId: id,
            metadata: {
              targetStaff: staff.name,
              targetEmail: staff.email,
              mode,
              authorized: updated.passwordAuthorized
            }
          }
        });
      }

      return res.status(200).json({
        message: mode === 'REVOKE'
          ? `Login access for ${staff.name} has been revoked (unauthorized).`
          : `Password for ${staff.name} successfully authorized.`,
        staff: updated,
        defaultPasswordPreview: generatedPassword || (updated.dateOfBirth ? generateDefaultStaffPassword(updated.name, updated.dateOfBirth) : null)
      });
    } catch (error: any) {
      console.error('Authorize staff password error:', error);
      return res.status(500).json({ error: 'Failed to update staff password authorization' });
    }
  }

  /**
   * GET /api/admin/staff/:id/credentials
   * Admin inspection endpoint: returns credentials summary and default password formula preview.
   */
  static async getStaffCredentialsSummary(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const staff = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          dateOfBirth: true,
          passwordAuthorized: true,
          passwordAuthorizedAt: true,
          role: true,
          isActive: true
        }
      });

      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      const defaultPassword = staff.dateOfBirth
        ? generateDefaultStaffPassword(staff.name, staff.dateOfBirth)
        : null;

      return res.status(200).json({
        staff: {
          ...staff,
          defaultPasswordPreview: defaultPassword,
          loginMethods: {
            byName: staff.name,
            byUsername: staff.username || generateStaffUsername(staff.name),
            byEmail: staff.email
          }
        }
      });
    } catch (error: any) {
      console.error('Get staff credentials summary error:', error);
      return res.status(500).json({ error: 'Failed to retrieve staff credentials summary' });
    }
  }

  /**
   * PATCH /api/admin/staff/:id/discontinue
   * Admin marks a faculty member as discontinued from the college.
   * Immediately deactivates account (isActive: false) and revokes login clearance (passwordAuthorized: false).
   */
  static async discontinueStaff(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body || {};

      const staff = await prisma.user.findUnique({ where: { id } });
      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          passwordAuthorized: false,
          passwordAuthorizedAt: new Date()
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          dateOfBirth: true,
          role: true,
          isActive: true,
          passwordAuthorized: true,
          updatedAt: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'DISCONTINUE_STAFF',
            entity: 'User',
            entityId: id,
            metadata: {
              targetStaff: staff.name,
              targetEmail: staff.email,
              reason: reason || 'Faculty member has discontinued from the college'
            }
          }
        });
      }

      return res.status(200).json({
        message: `Faculty member ${staff.name} has been marked as discontinued. Login access revoked.`,
        staff: updated
      });
    } catch (error: any) {
      console.error('Discontinue staff error:', error);
      return res.status(500).json({ error: 'Failed to discontinue staff member' });
    }
  }

  /**
   * POST /api/admin/staff/:id/reissue-credentials
   * Admin re-issues credentials for a staff member (re-activates and authorizes with a compliant password).
   */
  static async reissueStaffCredentials(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { password, dateOfBirth } = req.body || {};

      const staff = await prisma.user.findUnique({ where: { id } });
      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      let effectivePassword = (password || '').trim();
      let effectiveDob = dateOfBirth ? String(dateOfBirth).trim() : staff.dateOfBirth;

      if (!effectivePassword) {
        if (!effectiveDob) {
          return res.status(400).json({
            error: 'Either a Date of Birth or a custom password must be provided',
            code: 'PASSWORD_OR_DOB_REQUIRED'
          });
        }
        effectivePassword = generateDefaultStaffPassword(staff.name, effectiveDob);
      } else {
        const validation = validatePasswordComplexity(effectivePassword);
        if (!validation.isValid) {
          return res.status(400).json({
            error: `Password security policy violation: ${validation.errors.join(', ')}. Password must be alphanumeric and contain at least one special symbol.`,
            code: 'PASSWORD_COMPLEXITY_FAILED',
            details: validation.errors
          });
        }
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(effectivePassword, salt);

      const updated = await prisma.user.update({
        where: { id },
        data: {
          isActive: true,
          passwordAuthorized: true,
          passwordAuthorizedAt: new Date(),
          passwordHash,
          ...(effectiveDob ? { dateOfBirth: effectiveDob } : {})
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          dateOfBirth: true,
          isActive: true,
          passwordAuthorized: true,
          updatedAt: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'REISSUE_STAFF_CREDENTIALS',
            entity: 'User',
            entityId: id,
            metadata: { targetStaff: staff.name, targetEmail: staff.email }
          }
        });
      }

      return res.status(200).json({
        message: `Credentials re-issued and authorized for ${staff.name}`,
        staff: updated,
        credentials: {
          name: updated.name,
          username: updated.username,
          email: updated.email,
          password: effectivePassword,
          loginUrl: '/login'
        }
      });
    } catch (error: any) {
      console.error('Re-issue credentials error:', error);
      return res.status(500).json({ error: 'Failed to re-issue staff credentials' });
    }
  }

  /**
   * GET /api/admin/staff/:id/assignments
   * Fetches all class & subject assignments for a specific staff member.
   */
  static async getStaffAssignments(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const staff = await prisma.user.findUnique({ where: { id } });
      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      const assignments = await prisma.teacherAssignment.findMany({
        where: { staffId: id },
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

      // Enrich with student count per section under the assignment's academic year
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
            id: a.id,
            staffId: a.staffId,
            academicYear: a.academicYear,
            academicYearId: a.academicYearId,
            department: a.section.department,
            departmentId: a.section.departmentId,
            departmentCode: a.section.department?.code,
            departmentName: a.section.department?.name,
            year: a.section.year,
            yearId: a.section.yearId,
            section: {
              id: a.section.id,
              name: a.section.name
            },
            sectionId: a.sectionId,
            subject: a.subject,
            subjectId: a.subjectId,
            subjectCode: a.subject?.code,
            subjectName: a.subject?.name,
            semester: a.subject?.semester,
            studentCount,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt
          };
        })
      );

      return res.status(200).json({ assignments: enriched });
    } catch (error: any) {
      console.error('Get staff assignments error:', error);
      return res.status(500).json({ error: 'Failed to retrieve staff assignments' });
    }
  }

  /**
   * POST /api/admin/staff/:id/assignments
   * POST /api/admin/staff/assignments
   * Assigns a staff member to a class and subject with Department, Semester, and Subject Code.
   * Structure: Staff + Department + Semester + Subject (with Subject Code) + Section + Academic Year
   */
  static async assignStaff(req: Request, res: Response) {
    try {
      const staffId = (req.params.id as string) || (req.body?.staffId as string) || (req.body?.staff_id as string);
      let { academicYearId, departmentId, yearId, semester, sectionId, subjectId } = req.body || {};

      // Fallback for snake_case if called from legacy forms
      if (!sectionId && req.body?.class_section_id) sectionId = req.body.class_section_id;
      if (!subjectId && req.body?.subject_id) subjectId = req.body.subject_id;

      if (!staffId || !subjectId) {
        return res.status(400).json({
          error: 'Staff ID and Subject ID are mandatory for assignment.',
          code: 'MISSING_ASSIGNMENT_FIELDS'
        });
      }

      // 1. Verify Staff
      const staff = await prisma.user.findUnique({ where: { id: staffId } });
      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      // 2. Verify Subject
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: { department: true, year: true }
      });
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found', code: 'SUBJECT_NOT_FOUND' });
      }

      // Auto-populate departmentId and yearId from subject if not provided
      if (!departmentId) departmentId = subject.departmentId;
      if (!yearId) yearId = subject.yearId;

      // Verify Department match
      if (departmentId !== subject.departmentId) {
        return res.status(400).json({
          error: `Subject hierarchy mismatch: Subject ${subject.code} (${subject.name}) belongs to department ${subject.department.code}.`,
          code: 'DEPARTMENT_MISMATCH'
        });
      }

      // Verify Semester match if semester was specified
      if (semester && subject.semester !== parseInt(semester, 10)) {
        return res.status(400).json({
          error: `Subject ${subject.code} (${subject.name}) is designated for Semester ${subject.semester}, not Semester ${semester}.`,
          code: 'SEMESTER_MISMATCH'
        });
      }

      // 3. Verify / Default Academic Year
      if (!academicYearId) {
        const currentYear = await prisma.academicYear.findFirst({
          where: { isCurrent: true, isActive: true }
        }) || await prisma.academicYear.findFirst({
          where: { isActive: true },
          orderBy: { yearName: 'desc' }
        });
        if (!currentYear) {
          return res.status(404).json({ error: 'No active academic year found in the institution.', code: 'ACADEMIC_YEAR_NOT_FOUND' });
        }
        academicYearId = currentYear.id;
      }

      const academicYear = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
      if (!academicYear) {
        return res.status(404).json({ error: 'Academic Year not found', code: 'ACADEMIC_YEAR_NOT_FOUND' });
      }

      // 4. Verify / Default Section
      if (!sectionId) {
        const availableSection = await prisma.section.findFirst({
          where: { departmentId: subject.departmentId, yearId: subject.yearId, academicYearId, isActive: true }
        });
        if (!availableSection) {
          const newSec = await prisma.section.create({
            data: {
              name: 'Section A',
              departmentId: subject.departmentId,
              yearId: subject.yearId,
              academicYearId,
              isActive: true
            },
            include: { department: true, year: true }
          });
          sectionId = newSec.id;
        } else {
          sectionId = availableSection.id;
        }
      }

      let section = await prisma.section.findUnique({
        where: { id: sectionId },
        include: { department: true, year: true }
      });
      if (!section) {
        return res.status(404).json({ error: 'Section not found', code: 'SECTION_NOT_FOUND' });
      }

      // If user selected a section that belongs to a different year/department than the subject,
      // intelligently resolve or create the matching section in the target year
      if (section.departmentId !== subject.departmentId || section.yearId !== subject.yearId) {
        let matchingSection = await prisma.section.findFirst({
          where: {
            departmentId: subject.departmentId,
            yearId: subject.yearId,
            academicYearId,
            isActive: true
          },
          include: { department: true, year: true }
        });

        if (!matchingSection) {
          matchingSection = await prisma.section.create({
            data: {
              name: section.name || 'Section A',
              departmentId: subject.departmentId,
              yearId: subject.yearId,
              academicYearId,
              isActive: true
            },
            include: { department: true, year: true }
          });
        }

        section = matchingSection;
        sectionId = matchingSection.id;
      }

      // 5. Check if assignment already exists
      const existingAssignment = await prisma.teacherAssignment.findUnique({
        where: {
          subjectId_sectionId_academicYearId: {
            subjectId,
            sectionId,
            academicYearId
          }
        },
        include: { staff: true }
      });

      if (existingAssignment) {
        if (existingAssignment.staffId === staffId) {
          return res.status(409).json({
            error: `${staff.name} is already assigned to ${subject.code} (${subject.name}) for Section ${section.name} (Semester ${subject.semester}) in ${academicYear.yearName}.`,
            code: 'ALREADY_ASSIGNED'
          });
        }

        // Reassign to new staff member
        const reassigned = await prisma.teacherAssignment.update({
          where: { id: existingAssignment.id },
          data: { staffId },
          include: {
            subject: true,
            section: { include: { department: true, year: true } },
            academicYear: true
          }
        });

        if (req.user) {
          await prisma.auditLog.create({
            data: {
              userId: req.user.id,
              action: AuditAction.STAFF_ASSIGNMENT_CHANGED,
              entity: 'TeacherAssignment',
              entityId: reassigned.id,
              metadata: {
                subAction: 'REASSIGN',
                previousStaff: existingAssignment.staff.name,
                newStaff: staff.name,
                subjectCode: subject.code,
                subjectName: subject.name,
                semester: subject.semester,
                sectionName: section.name
              }
            }
          });
        }

        const formattedReassigned = {
          id: reassigned.id,
          staffId: reassigned.staffId,
          staffName: staff.name,
          staffEmail: staff.email,
          academicYear: academicYear.yearName,
          academicYearId: reassigned.academicYearId,
          academicYearName: academicYear.yearName,
          department: section.department?.code || section.department?.name || 'CSE',
          departmentId: section.departmentId,
          departmentCode: section.department?.code || 'CSE',
          departmentName: section.department?.name || 'Computer Science and Engineering',
          year: section.year?.yearNumber ?? 1,
          yearNumber: section.year?.yearNumber ?? 1,
          yearName: section.year?.name || 'First Year',
          yearId: section.yearId,
          section: section.name,
          sectionName: section.name,
          sectionId: reassigned.sectionId,
          subject: subject.name,
          subjectId: reassigned.subjectId,
          subjectCode: subject.code,
          subjectName: subject.name,
          semester: subject.semester,
          studentCount: 0,
          createdAt: reassigned.createdAt,
          updatedAt: reassigned.updatedAt
        };

        return res.status(200).json({
          message: `Course ${subject.code} - ${subject.name} (Semester ${subject.semester}) reassigned from ${existingAssignment.staff.name} to ${staff.name} successfully.`,
          assignment: formattedReassigned
        });
      }

      // Create new assignment
      const newAssignment = await prisma.teacherAssignment.create({
        data: {
          staffId,
          subjectId,
          sectionId,
          academicYearId
        },
        include: {
          subject: true,
          section: { include: { department: true, year: true } },
          academicYear: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: AuditAction.STAFF_ASSIGNMENT_CHANGED,
            entity: 'TeacherAssignment',
            entityId: newAssignment.id,
            metadata: {
              subAction: 'ASSIGN',
              staffName: staff.name,
              subjectCode: subject.code,
              subjectName: subject.name,
              semester: subject.semester,
              sectionName: section.name,
              academicYear: academicYear.yearName
            }
          }
        });
      }

      const formattedNew = {
        id: newAssignment.id,
        staffId: newAssignment.staffId,
        staffName: staff.name,
        staffEmail: staff.email,
        academicYear: academicYear.yearName,
        academicYearId: newAssignment.academicYearId,
        academicYearName: academicYear.yearName,
        department: section.department?.code || section.department?.name || 'CSE',
        departmentId: section.departmentId,
        departmentCode: section.department?.code || 'CSE',
        departmentName: section.department?.name || 'Computer Science and Engineering',
        year: section.year?.yearNumber ?? 1,
        yearNumber: section.year?.yearNumber ?? 1,
        yearName: section.year?.name || 'First Year',
        yearId: section.yearId,
        section: section.name,
        sectionName: section.name,
        sectionId: newAssignment.sectionId,
        subject: subject.name,
        subjectId: newAssignment.subjectId,
        subjectCode: subject.code,
        subjectName: subject.name,
        semester: subject.semester,
        studentCount: 0,
        createdAt: newAssignment.createdAt,
        updatedAt: newAssignment.updatedAt
      };

      return res.status(201).json({
        message: `Successfully assigned ${staff.name} to ${subject.code} (${subject.name}) - Semester ${subject.semester} for Section ${section.name}.`,
        assignment: formattedNew
      });
    } catch (error: any) {
      console.error('Assign staff error:', error);
      return res.status(500).json({ error: `Assignment failed: ${error.message}` });
    }
  }

  /**
   * PUT /api/admin/staff/assignments/:assignmentId
   * PATCH /api/admin/staff/assignments/:assignmentId/change-course
   * ADMIN ONLY: Changes faculty subject, subject code, and semester (e.g. after completed semester).
   */
  static async updateStaffAssignment(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== Role.ADMIN) {
        return res.status(403).json({
          error: 'Forbidden: Only administrators are authorized to change faculty subject, subject code, and semester assignments.',
          code: 'ADMIN_ONLY_ASSIGNMENT_CHANGE'
        });
      }

      const { assignmentId } = req.params as { assignmentId: string };
      let { subjectId, sectionId, semester, academicYearId, reason } = req.body || {};

      if (!subjectId && req.body?.subject_id) subjectId = req.body.subject_id;
      if (!sectionId && req.body?.class_section_id) sectionId = req.body.class_section_id;

      const assignment = await prisma.teacherAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          staff: true,
          subject: {
            include: { department: true, year: true }
          },
          section: {
            include: {
              department: true,
              year: true
            }
          },
          academicYear: true
        }
      });

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' });
      }

      const targetSubjectId = subjectId || assignment.subjectId;
      const targetAcademicYearId = academicYearId || assignment.academicYearId;

      // 1. Verify new subject
      const newSubject = await prisma.subject.findUnique({
        where: { id: targetSubjectId },
        include: { department: true, year: true }
      });

      if (!newSubject) {
        return res.status(404).json({ error: 'Target subject not found', code: 'SUBJECT_NOT_FOUND' });
      }

      // If semester is specified, verify it matches the subject's semester
      if (semester && newSubject.semester !== parseInt(semester, 10)) {
        return res.status(400).json({
          error: `Subject ${newSubject.code} (${newSubject.name}) belongs to Semester ${newSubject.semester}, not Semester ${semester}.`,
          code: 'SEMESTER_SUBJECT_MISMATCH'
        });
      }

      // 2. Verify section
      let targetSectionId = sectionId || assignment.sectionId;
      let targetSection = await prisma.section.findUnique({
        where: { id: targetSectionId },
        include: { department: true, year: true }
      });

      // If section is not compatible with new subject's year, find appropriate section
      if (targetSection && targetSection.yearId !== newSubject.yearId) {
        const matchingSection = await prisma.section.findFirst({
          where: {
            departmentId: newSubject.departmentId,
            yearId: newSubject.yearId,
            academicYearId: targetAcademicYearId,
            name: targetSection.name,
            isActive: true
          }
        }) || await prisma.section.findFirst({
          where: {
            departmentId: newSubject.departmentId,
            yearId: newSubject.yearId,
            academicYearId: targetAcademicYearId,
            isActive: true
          }
        });

        if (matchingSection) {
          targetSectionId = matchingSection.id;
          targetSection = await prisma.section.findUnique({
            where: { id: targetSectionId },
            include: { department: true, year: true }
          });
        }
      }

      if (!targetSection) {
        return res.status(404).json({ error: 'Target section not found', code: 'SECTION_NOT_FOUND' });
      }

      // Verify department compatibility
      if (newSubject.departmentId !== targetSection.departmentId) {
        return res.status(400).json({
          error: `Department mismatch: Subject ${newSubject.code} belongs to ${newSubject.department?.code}, but Section ${targetSection.name} belongs to ${targetSection.department?.code}.`,
          code: 'DEPARTMENT_MISMATCH'
        });
      }

      // 3. Check for conflict if changing subject, section or academic year
      if (targetSubjectId !== assignment.subjectId || targetSectionId !== assignment.sectionId || targetAcademicYearId !== assignment.academicYearId) {
        const conflict = await prisma.teacherAssignment.findUnique({
          where: {
            subjectId_sectionId_academicYearId: {
              subjectId: targetSubjectId,
              sectionId: targetSectionId,
              academicYearId: targetAcademicYearId
            }
          },
          include: { staff: true }
        });

        if (conflict && conflict.id !== assignment.id) {
          return res.status(409).json({
            error: `Conflict: Subject ${newSubject.code} is already assigned to ${conflict.staff.name} for Section ${targetSection.name} in this academic year.`,
            code: 'ASSIGNMENT_CONFLICT'
          });
        }
      }

      // 4. Update assignment with new subject (code, name, semester) and section
      const updated = await prisma.teacherAssignment.update({
        where: { id: assignmentId },
        data: {
          subjectId: targetSubjectId,
          sectionId: targetSectionId,
          academicYearId: targetAcademicYearId
        },
        include: {
          staff: { select: { id: true, name: true, email: true, username: true, role: true } },
          subject: true,
          section: {
            include: {
              department: true,
              year: true
            }
          },
          academicYear: true
        }
      });

      // 5. Create immutable audit log of the subject & semester change
      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: AuditAction.STAFF_ASSIGNMENT_CHANGED,
            entity: 'TeacherAssignment',
            entityId: assignment.id,
            metadata: {
              subAction: 'UPDATE_SUBJECT_SEMESTER',
              staffName: assignment.staff.name,
              staffId: assignment.staffId,
              previousSubjectCode: assignment.subject.code,
              previousSubjectName: assignment.subject.name,
              previousSemester: assignment.subject.semester,
              newSubjectCode: newSubject.code,
              newSubjectName: newSubject.name,
              newSemester: newSubject.semester,
              sectionName: targetSection.name,
              reason: reason || 'Completed previous semester, assigned to new subject and semester.'
            }
          }
        });
      }

      return res.status(200).json({
        message: `Successfully updated ${assignment.staff.name}'s assignment to ${newSubject.code} - ${newSubject.name} (Semester ${newSubject.semester}).`,
        assignment: {
          id: updated.id,
          staffId: updated.staffId,
          staffName: updated.staff.name,
          staffEmail: updated.staff.email,
          academicYear: updated.academicYear,
          academicYearId: updated.academicYearId,
          department: updated.section.department,
          departmentId: updated.section.departmentId,
          departmentCode: updated.section.department.code,
          departmentName: updated.section.department.name,
          year: updated.section.year,
          yearId: updated.section.yearId,
          section: {
            id: updated.section.id,
            name: updated.section.name
          },
          sectionId: updated.sectionId,
          subject: updated.subject,
          subjectId: updated.subjectId,
          subjectCode: updated.subject.code,
          subjectName: updated.subject.name,
          semester: updated.subject.semester,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt
        }
      });
    } catch (error: any) {
      console.error('Update staff assignment error:', error);
      return res.status(500).json({ error: `Failed to update staff assignment: ${error.message}` });
    }
  }

  /**
   * DELETE /api/admin/staff/assignments/:assignmentId
   * Removes a teacher assignment.
   */
  static async deleteStaffAssignment(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params as { assignmentId: string };

      const assignment = await prisma.teacherAssignment.findUnique({
        where: { id: assignmentId },
        include: { staff: true, subject: true, section: true }
      });

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' });
      }

      await prisma.teacherAssignment.delete({ where: { id: assignmentId } });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: AuditAction.STAFF_ASSIGNMENT_CHANGED,
            entity: 'TeacherAssignment',
            entityId: assignmentId,
            metadata: {
              subAction: 'UNASSIGN',
              unassignedStaff: assignment.staff.name,
              subjectCode: assignment.subject.code,
              sectionName: assignment.section.name
            }
          }
        });
      }

      return res.status(200).json({
        message: `Unassigned ${assignment.staff.name} from ${assignment.subject.code} (Section ${assignment.section.name}) successfully.`
      });
    } catch (error: any) {
      console.error('Delete assignment error:', error);
      return res.status(500).json({ error: 'Failed to remove assignment' });
    }
  }

  /**
   * DELETE /api/admin/staff/:id
   * Reference-checked deletion of staff accounts.
   */
  static async deleteStaff(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const staff = await prisma.user.findUnique({ where: { id } });
      if (!staff || staff.role !== Role.STAFF) {
        return res.status(404).json({ error: 'Staff member not found', code: 'STAFF_NOT_FOUND' });
      }

      // Check if staff has entered marks or change logs
      const [marksCount, changeLogsCount] = await Promise.all([
        prisma.mark.count({ where: { enteredBy: id } }),
        prisma.markChangeLog.count({ where: { changedBy: id } })
      ]);

      if (marksCount > 0 || changeLogsCount > 0) {
        return res.status(409).json({
          error: `Cannot delete faculty "${staff.name}" because they have entered ${marksCount} assessment mark records and ${changeLogsCount} audit change logs. Please use safe deactivation (isActive = false) to preserve institutional academic records.`,
          code: 'STAFF_REFERENCED_IN_MARKS',
          canDeactivate: true
        });
      }

      // Delete assignments first
      await prisma.teacherAssignment.deleteMany({ where: { staffId: id } });

      // Preserve audit logs by reassigning userId to the administering user
      if (req.user) {
        await prisma.auditLog.updateMany({
          where: { userId: id },
          data: { userId: req.user.id }
        });
      }

      // Delete user
      await prisma.user.delete({ where: { id } });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'DELETE_STAFF',
            entity: 'User',
            entityId: id,
            metadata: { deletedStaffEmail: staff.email, name: staff.name }
          }
        });
      }

      return res.status(200).json({
        message: `Faculty account for ${staff.name} (${staff.email}) was deleted successfully.`
      });
    } catch (error: any) {
      console.error('Delete staff error:', error);
      return res.status(500).json({ error: 'Failed to delete staff account' });
    }
  }

  /**
   * GET /api/admin/subjects
   * Returns subjects optionally filtered by departmentId and yearId
   */
  static async getSubjects(req: Request, res: Response) {
    try {
      const { departmentId, yearId } = req.query;
      const where: any = {};
      if (departmentId && departmentId !== 'all') where.departmentId = departmentId as string;
      if (yearId && yearId !== 'all') where.yearId = yearId as string;

      const subjects = await prisma.subject.findMany({
        where,
        include: {
          department: true,
          year: true
        },
        orderBy: { code: 'asc' }
      });

      return res.status(200).json({ subjects });
    } catch (error: any) {
      console.error('Get subjects error:', error);
      return res.status(500).json({ error: 'Failed to retrieve subjects' });
    }
  }

  /**
   * GET /api/admin/staff/assignments
   * Returns all teacher assignments across all faculty for institutional governance.
   */
  static async getAllAssignments(req: Request, res: Response) {
    try {
      const assignments = await prisma.teacherAssignment.findMany({
        include: {
          staff: {
            select: { id: true, name: true, email: true, role: true }
          },
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
            id: a.id,
            staffId: a.staffId,
            staffName: a.staff?.name || 'Faculty',
            staffEmail: a.staff?.email || 'staff@college.edu',
            academicYear: a.academicYear?.yearName || '2026-2027',
            academicYearId: a.academicYearId,
            academicYearName: a.academicYear?.yearName || '2026-2027',
            department: a.section.department?.code || a.section.department?.name || 'CSE',
            departmentId: a.section.departmentId,
            departmentCode: a.section.department?.code || 'CSE',
            departmentName: a.section.department?.name || 'Computer Science and Engineering',
            year: a.section.year?.yearNumber ?? 1,
            yearNumber: a.section.year?.yearNumber ?? 1,
            yearName: a.section.year?.name || 'First Year',
            yearId: a.section.yearId,
            section: a.section.name,
            sectionName: a.section.name,
            sectionId: a.sectionId,
            subject: a.subject?.name || 'Subject',
            subjectId: a.subjectId,
            subjectCode: a.subject?.code || 'SUBJ',
            subjectName: a.subject?.name || 'Course Name',
            semester: a.subject?.semester || 5,
            studentCount,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt
          };
        })
      );

      return res.status(200).json({ assignments: enriched, total: enriched.length });
    } catch (error: any) {
      console.error('Get all assignments error:', error);
      return res.status(500).json({ error: 'Failed to retrieve all assignments' });
    }
  }
}


