import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../db';
import { AuthUser } from '../types/express';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  iat: number;
  exp: number;
}

/**
 * Generate a signed JWT token for an authenticated user.
 */
export function generateToken(user: AuthUser): string {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
}

/**
 * Authenticate incoming request via JWT Bearer token and verify against database.
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication token is missing. Please log in.',
        code: 'TOKEN_MISSING'
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({
        error: 'Invalid Authorization header format. Expected Bearer <token>',
        code: 'TOKEN_MALFORMED'
      });
    }

    const token = parts[1];
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Session has expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        error: 'Invalid token signature.',
        code: 'TOKEN_INVALID'
      });
    }

    // Verify user still exists and is active in PostgreSQL
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'User account no longer exists.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'User account is deactivated.',
        code: 'USER_INACTIVE'
      });
    }

    req.user = user as AuthUser;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

/**
 * Middleware: Strictly enforce ADMIN role. Rejects STAFF or other roles with 403.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required.',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== Role.ADMIN) {
    return res.status(403).json({
      error: 'Forbidden: Administrative privileges are strictly required.',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  next();
}

/**
 * Middleware: Strictly enforce STAFF role (or ADMIN where dual access is allowed).
 */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required.',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== Role.STAFF && req.user.role !== Role.ADMIN) {
    return res.status(403).json({
      error: 'Forbidden: Faculty credentials required.',
      code: 'STAFF_ACCESS_REQUIRED'
    });
  }

  next();
}

/**
 * Reusable database verification: Confirms that a Staff member is assigned
 * to the exact subject and section before granting access.
 * Enforces multidimensional integrity:
 * - Matching Staff ID
 * - Matching Section ID
 * - Matching Subject ID
 * - Matching Academic Year ID (if provided or derived from Section)
 * - Section & Subject must belong to the exact same Department and Year.
 * NEVER trusts client-submitted staffId or parameters.
 */
export async function checkStaffAssignment(
  staffId: string, 
  sectionId: string, 
  subjectId: string, 
  academicYearId?: string
): Promise<boolean> {
  const [section, subject] = await Promise.all([
    prisma.section.findUnique({ where: { id: sectionId } }),
    prisma.subject.findUnique({ where: { id: subjectId } })
  ]);

  if (!section || !subject) {
    return false;
  }

  // Hierarchy validation: Department & Year must match between Section & Subject
  if (section.departmentId !== subject.departmentId || section.yearId !== subject.yearId) {
    return false;
  }

  // Academic Year validation: If academicYearId is provided, it must match the section
  if (academicYearId && section.academicYearId !== academicYearId) {
    return false;
  }

  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      staffId,
      sectionId,
      subjectId,
      academicYearId: section.academicYearId
    }
  });

  return assignment !== null;
}

/**
 * Middleware: Validates that the authenticated Staff user has an active
 * TeacherAssignment for the requested sectionId and subjectId.
 */
export async function verifyStaffClassSubjectAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Admins have global institutional authority
  if (req.user.role === Role.ADMIN) {
    return next();
  }

  const sectionId = (req.body?.sectionId || req.query?.sectionId || req.params?.sectionId) as string;
  const subjectId = (req.body?.subjectId || req.query?.subjectId || req.params?.subjectId) as string;

  if (!sectionId || !subjectId) {
    return res.status(400).json({
      error: 'sectionId and subjectId parameters are required for access verification',
      code: 'PARAMS_MISSING'
    });
  }

  // Always use req.user.id extracted from JWT - NEVER trust submitted staffId
  const isAssigned = await checkStaffAssignment(req.user.id, sectionId, subjectId);

  if (!isAssigned) {
    return res.status(403).json({
      error: 'Forbidden: You are not assigned to instruct this subject for this section.',
      code: 'STAFF_CLASS_UNAUTHORIZED'
    });
  }

  next();
}
