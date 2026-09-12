import { Request, Response } from 'express';
import { prisma } from '../db';

export class AcademicStructureController {
  // ========================================================
  // 1. OVERVIEW & CASCADING DROPDOWN OPTIONS
  // ========================================================
  static async getOverview(req: Request, res: Response) {
    try {
      const [academicYears, departments, years, totalSections, totalStudents] = await Promise.all([
        prisma.academicYear.findMany({
          orderBy: [{ isCurrent: 'desc' }, { yearName: 'desc' }],
          select: { id: true, yearName: true, isCurrent: true, isActive: true }
        }),
        prisma.department.findMany({
          orderBy: { code: 'asc' },
          select: { id: true, code: true, name: true, isActive: true }
        }),
        prisma.year.findMany({
          orderBy: { yearNumber: 'asc' },
          select: { id: true, yearNumber: true, name: true, isActive: true }
        }),
        prisma.section.count(),
        prisma.student.count()
      ]);

      return res.status(200).json({
        academicYears,
        departments,
        years,
        stats: {
          totalAcademicYears: academicYears.length,
          totalDepartments: departments.length,
          totalYears: years.length,
          totalSections,
          totalStudents
        }
      });
    } catch (error) {
      console.error('Academic structure overview error:', error);
      return res.status(500).json({ error: 'Failed to fetch academic structure overview' });
    }
  }

  // ========================================================
  // 2. ACADEMIC YEARS
  // ========================================================
  static async getAcademicYears(req: Request, res: Response) {
    try {
      const { search, status } = req.query;
      const where: any = {};

      if (status === 'active') where.isActive = true;
      else if (status === 'inactive') where.isActive = false;

      if (search && typeof search === 'string' && search.trim()) {
        where.yearName = { contains: search.trim(), mode: 'insensitive' };
      }

      const academicYears = await prisma.academicYear.findMany({
        where,
        include: {
          _count: {
            select: { sections: true, students: true, teacherAssignments: true }
          }
        },
        orderBy: [{ isCurrent: 'desc' }, { yearName: 'desc' }]
      });

      const formattedYears = academicYears.map(ay => ({
        ...ay,
        name: ay.yearName,
        year: ay.yearName,
        yearName: ay.yearName,
        year_name: ay.yearName,
        is_current: ay.isCurrent ? 1 : 0,
        isCurrent: ay.isCurrent
      }));

      return res.status(200).json({ academicYears: formattedYears, data: formattedYears, total: formattedYears.length });
    } catch (error) {
      console.error('Get academic years error:', error);
      return res.status(500).json({ error: 'Failed to fetch academic years' });
    }
  }

  static async createAcademicYear(req: Request, res: Response) {
    try {
      const rawName = req.body?.yearName || req.body?.name || req.body?.year_name;
      const isCurrent = req.body?.isCurrent ?? (req.body?.is_current !== undefined ? !!req.body.is_current : false);
      const isActive = req.body?.isActive ?? (req.body?.is_active !== undefined ? !!req.body.is_active : true);

      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
        return res.status(400).json({
          error: 'Academic Year name is required (e.g., "2026-2027").',
          code: 'YEAR_NAME_REQUIRED'
        });
      }

      const trimmedName = rawName.trim();
      const existing = await prisma.academicYear.findUnique({
        where: { yearName: trimmedName }
      });

      if (existing) {
        return res.status(409).json({
          error: `Academic year "${trimmedName}" already exists.`,
          code: 'ACADEMIC_YEAR_EXISTS'
        });
      }

      // If marking as isCurrent, unmark all others
      if (isCurrent) {
        await prisma.academicYear.updateMany({
          data: { isCurrent: false }
        });
      }

      const created = await prisma.academicYear.create({
        data: {
          yearName: trimmedName,
          isCurrent: !!isCurrent,
          isActive: isActive !== undefined ? !!isActive : true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'CREATE_ACADEMIC_YEAR',
            entity: 'AcademicYear',
            entityId: created.id,
            metadata: { yearName: created.yearName, isCurrent: created.isCurrent }
          }
        });
      }

      return res.status(201).json({
        message: 'Academic Year created successfully',
        academicYear: {
          ...created,
          name: created.yearName,
          is_current: created.isCurrent ? 1 : 0
        }
      });
    } catch (error) {
      console.error('Create academic year error:', error);
      return res.status(500).json({ error: 'Failed to create academic year' });
    }
  }

  static async updateAcademicYear(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const rawName = req.body?.yearName || req.body?.name || req.body?.year_name;
      const isCurrent = req.body?.isCurrent ?? (req.body?.is_current !== undefined ? !!req.body.is_current : undefined);
      const isActive = req.body?.isActive ?? (req.body?.is_active !== undefined ? !!req.body.is_active : undefined);

      const existing = await prisma.academicYear.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Academic Year not found', code: 'NOT_FOUND' });
      }

      const trimmedName = rawName && typeof rawName === 'string' ? rawName.trim() : existing.yearName;
      if (trimmedName !== existing.yearName) {
        const nameDuplicate = await prisma.academicYear.findUnique({
          where: { yearName: trimmedName }
        });
        if (nameDuplicate) {
          return res.status(409).json({
            error: `Academic year "${trimmedName}" already exists.`,
            code: 'ACADEMIC_YEAR_EXISTS'
          });
        }
      }

      if (isCurrent === true) {
        await prisma.academicYear.updateMany({
          data: { isCurrent: false }
        });
      }

      const updated = await prisma.academicYear.update({
        where: { id },
        data: {
          yearName: trimmedName,
          ...(isCurrent !== undefined ? { isCurrent } : {}),
          ...(isActive !== undefined ? { isActive } : {})
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'UPDATE_ACADEMIC_YEAR',
            entity: 'AcademicYear',
            entityId: updated.id,
            metadata: { changes: req.body }
          }
        });
      }

      return res.status(200).json({
        message: 'Academic Year updated successfully',
        academicYear: {
          ...updated,
          name: updated.yearName,
          is_current: updated.isCurrent ? 1 : 0
        }
      });
    } catch (error) {
      console.error('Update academic year error:', error);
      return res.status(500).json({ error: 'Failed to update academic year' });
    }
  }

  static async toggleAcademicYearStatus(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { isActive, isCurrent } = req.body || {};

      const existing = await prisma.academicYear.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Academic Year not found', code: 'NOT_FOUND' });
      }

      if (isCurrent === true) {
        await prisma.academicYear.updateMany({
          where: { id: { not: id } },
          data: { isCurrent: false }
        });
      }

      const updated = await prisma.academicYear.update({
        where: { id },
        data: {
          ...(isActive !== undefined ? { isActive: !!isActive } : {}),
          ...(isCurrent !== undefined ? { isCurrent: !!isCurrent } : {})
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'TOGGLE_ACADEMIC_YEAR_STATUS',
            entity: 'AcademicYear',
            entityId: updated.id,
            metadata: { isActive: updated.isActive, isCurrent: updated.isCurrent }
          }
        });
      }

      return res.status(200).json({
        message: `Academic year ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
        academicYear: updated
      });
    } catch (error) {
      console.error('Toggle academic year status error:', error);
      return res.status(500).json({ error: 'Failed to toggle academic year status' });
    }
  }

  static async deleteAcademicYear(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const existing = await prisma.academicYear.findUnique({
        where: { id },
        include: {
          _count: {
            select: { sections: true, students: true, teacherAssignments: true }
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Academic Year not found', code: 'NOT_FOUND' });
      }

      const refs = existing._count;
      const totalRefs = refs.sections + refs.students + refs.teacherAssignments;

      if (totalRefs > 0) {
        return res.status(409).json({
          error: `Cannot delete Academic Year "${existing.yearName}" because it is actively referenced by existing records.`,
          code: 'CANNOT_DELETE_REFERENCED_RECORD',
          references: refs,
          recommendation: 'Use safe deactivation instead of deletion to preserve data integrity and historical marks.'
        });
      }

      await prisma.academicYear.delete({ where: { id } });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'DELETE_ACADEMIC_YEAR',
            entity: 'AcademicYear',
            entityId: id,
            metadata: { yearName: existing.yearName }
          }
        });
      }

      return res.status(200).json({
        message: `Academic Year "${existing.yearName}" deleted successfully.`
      });
    } catch (error) {
      console.error('Delete academic year error:', error);
      return res.status(500).json({ error: 'Failed to delete academic year' });
    }
  }

  // ========================================================
  // 3. DEPARTMENTS
  // ========================================================
  static async getDepartments(req: Request, res: Response) {
    try {
      const { search, status } = req.query;
      const where: any = {};

      if (status === 'active') where.isActive = true;
      else if (status === 'inactive') where.isActive = false;

      if (search && typeof search === 'string' && search.trim()) {
        where.OR = [
          { code: { contains: search.trim(), mode: 'insensitive' } },
          { name: { contains: search.trim(), mode: 'insensitive' } }
        ];
      }

      const departments = await prisma.department.findMany({
        where,
        include: {
          _count: {
            select: { sections: true, subjects: true, students: true }
          }
        },
        orderBy: { code: 'asc' }
      });

      return res.status(200).json({ departments, data: departments, total: departments.length });
    } catch (error) {
      console.error('Get departments error:', error);
      return res.status(500).json({ error: 'Failed to fetch departments' });
    }
  }

  static async createDepartment(req: Request, res: Response) {
    try {
      const { code, name, isActive = true } = req.body || {};

      if (!code || !name || !code.trim() || !name.trim()) {
        return res.status(400).json({
          error: 'Department code (e.g., "CSE") and full name are required.',
          code: 'FIELDS_REQUIRED'
        });
      }

      const normalizedCode = code.trim().toUpperCase();
      const existing = await prisma.department.findUnique({
        where: { code: normalizedCode }
      });

      if (existing) {
        return res.status(409).json({
          error: `Department with code "${normalizedCode}" already exists.`,
          code: 'DEPARTMENT_EXISTS'
        });
      }

      const created = await prisma.department.create({
        data: {
          code: normalizedCode,
          name: name.trim(),
          isActive: isActive !== undefined ? !!isActive : true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'CREATE_DEPARTMENT',
            entity: 'Department',
            entityId: created.id,
            metadata: { code: created.code, name: created.name }
          }
        });
      }

      return res.status(201).json({
        message: 'Department created successfully',
        department: created
      });
    } catch (error) {
      console.error('Create department error:', error);
      return res.status(500).json({ error: 'Failed to create department' });
    }
  }

  static async updateDepartment(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { code, name, isActive } = req.body || {};

      const existing = await prisma.department.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Department not found', code: 'NOT_FOUND' });
      }

      if (code && code.trim().toUpperCase() !== existing.code) {
        const normalizedCode = code.trim().toUpperCase();
        const codeDuplicate = await prisma.department.findUnique({
          where: { code: normalizedCode }
        });
        if (codeDuplicate) {
          return res.status(409).json({
            error: `Department code "${normalizedCode}" already exists.`,
            code: 'DEPARTMENT_EXISTS'
          });
        }
      }

      const updated = await prisma.department.update({
        where: { id },
        data: {
          ...(code ? { code: code.trim().toUpperCase() } : {}),
          ...(name ? { name: name.trim() } : {}),
          ...(isActive !== undefined ? { isActive: !!isActive } : {})
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'UPDATE_DEPARTMENT',
            entity: 'Department',
            entityId: updated.id,
            metadata: { changes: req.body }
          }
        });
      }

      return res.status(200).json({
        message: 'Department updated successfully',
        department: updated
      });
    } catch (error) {
      console.error('Update department error:', error);
      return res.status(500).json({ error: 'Failed to update department' });
    }
  }

  static async toggleDepartmentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { isActive } = req.body || {};

      const existing = await prisma.department.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Department not found', code: 'NOT_FOUND' });
      }

      const updated = await prisma.department.update({
        where: { id },
        data: { isActive: isActive !== undefined ? !!isActive : !existing.isActive }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'TOGGLE_DEPARTMENT_STATUS',
            entity: 'Department',
            entityId: updated.id,
            metadata: { isActive: updated.isActive }
          }
        });
      }

      return res.status(200).json({
        message: `Department ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
        department: updated
      });
    } catch (error) {
      console.error('Toggle department status error:', error);
      return res.status(500).json({ error: 'Failed to toggle department status' });
    }
  }

  static async deleteDepartment(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const existing = await prisma.department.findUnique({
        where: { id },
        include: {
          _count: {
            select: { sections: true, subjects: true, students: true }
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Department not found', code: 'NOT_FOUND' });
      }

      const refs = existing._count;
      const totalRefs = refs.sections + refs.subjects + refs.students;

      if (totalRefs > 0) {
        return res.status(409).json({
          error: `Cannot delete Department "${existing.code}" because it is referenced by existing academic records.`,
          code: 'CANNOT_DELETE_REFERENCED_RECORD',
          references: refs,
          recommendation: 'Use safe deactivation instead of deletion to preserve curriculum and student records.'
        });
      }

      await prisma.department.delete({ where: { id } });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'DELETE_DEPARTMENT',
            entity: 'Department',
            entityId: id,
            metadata: { code: existing.code }
          }
        });
      }

      return res.status(200).json({
        message: `Department "${existing.code}" deleted successfully.`
      });
    } catch (error) {
      console.error('Delete department error:', error);
      return res.status(500).json({ error: 'Failed to delete department' });
    }
  }

  // ========================================================
  // 4. YEARS
  // ========================================================
  static async getYears(req: Request, res: Response) {
    try {
      const { search, status } = req.query;
      const where: any = {};

      if (status === 'active') where.isActive = true;
      else if (status === 'inactive') where.isActive = false;

      if (search && typeof search === 'string' && search.trim()) {
        where.name = { contains: search.trim(), mode: 'insensitive' };
      }

      const years = await prisma.year.findMany({
        where,
        include: {
          _count: {
            select: { sections: true, subjects: true, students: true }
          }
        },
        orderBy: { yearNumber: 'asc' }
      });

      return res.status(200).json({ years });
    } catch (error) {
      console.error('Get years error:', error);
      return res.status(500).json({ error: 'Failed to fetch years' });
    }
  }

  static async createYear(req: Request, res: Response) {
    try {
      const { yearNumber, name, isActive = true } = req.body || {};

      const num = Number(yearNumber);
      if (isNaN(num) || num < 1 || num > 10) {
        return res.status(400).json({
          error: 'Valid Year Number (e.g. 1, 2, 3, 4) is required.',
          code: 'YEAR_NUMBER_INVALID'
        });
      }

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          error: 'Year Name is required (e.g. "1st Year", "2nd Year").',
          code: 'YEAR_NAME_REQUIRED'
        });
      }

      const existing = await prisma.year.findUnique({
        where: { yearNumber: num }
      });

      if (existing) {
        return res.status(409).json({
          error: `Year Number ${num} (${existing.name}) already exists.`,
          code: 'YEAR_EXISTS'
        });
      }

      const created = await prisma.year.create({
        data: {
          yearNumber: num,
          name: name.trim(),
          isActive: isActive !== undefined ? !!isActive : true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'CREATE_YEAR',
            entity: 'Year',
            entityId: created.id,
            metadata: { yearNumber: created.yearNumber, name: created.name }
          }
        });
      }

      return res.status(201).json({
        message: 'Year created successfully',
        year: created
      });
    } catch (error) {
      console.error('Create year error:', error);
      return res.status(500).json({ error: 'Failed to create year' });
    }
  }

  static async updateYear(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { yearNumber, name, isActive } = req.body || {};

      const existing = await prisma.year.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Year not found', code: 'NOT_FOUND' });
      }

      if (yearNumber !== undefined && Number(yearNumber) !== existing.yearNumber) {
        const num = Number(yearNumber);
        const duplicate = await prisma.year.findUnique({ where: { yearNumber: num } });
        if (duplicate) {
          return res.status(409).json({
            error: `Year Number ${num} already exists.`,
            code: 'YEAR_EXISTS'
          });
        }
      }

      const updated = await prisma.year.update({
        where: { id },
        data: {
          ...(yearNumber !== undefined ? { yearNumber: Number(yearNumber) } : {}),
          ...(name ? { name: name.trim() } : {}),
          ...(isActive !== undefined ? { isActive: !!isActive } : {})
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'UPDATE_YEAR',
            entity: 'Year',
            entityId: updated.id,
            metadata: { changes: req.body }
          }
        });
      }

      return res.status(200).json({
        message: 'Year updated successfully',
        year: updated
      });
    } catch (error) {
      console.error('Update year error:', error);
      return res.status(500).json({ error: 'Failed to update year' });
    }
  }

  static async toggleYearStatus(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { isActive } = req.body || {};

      const existing = await prisma.year.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Year not found', code: 'NOT_FOUND' });
      }

      const updated = await prisma.year.update({
        where: { id },
        data: { isActive: isActive !== undefined ? !!isActive : !existing.isActive }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'TOGGLE_YEAR_STATUS',
            entity: 'Year',
            entityId: updated.id,
            metadata: { isActive: updated.isActive }
          }
        });
      }

      return res.status(200).json({
        message: `Year ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
        year: updated
      });
    } catch (error) {
      console.error('Toggle year status error:', error);
      return res.status(500).json({ error: 'Failed to toggle year status' });
    }
  }

  static async deleteYear(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const existing = await prisma.year.findUnique({
        where: { id },
        include: {
          _count: {
            select: { sections: true, subjects: true, students: true }
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Year not found', code: 'NOT_FOUND' });
      }

      const refs = existing._count;
      const totalRefs = refs.sections + refs.subjects + refs.students;

      if (totalRefs > 0) {
        return res.status(409).json({
          error: `Cannot delete Year "${existing.name}" because it is referenced by existing academic records.`,
          code: 'CANNOT_DELETE_REFERENCED_RECORD',
          references: refs,
          recommendation: 'Use safe deactivation instead of deletion to preserve historical class data.'
        });
      }

      await prisma.year.delete({ where: { id } });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'DELETE_YEAR',
            entity: 'Year',
            entityId: id,
            metadata: { name: existing.name }
          }
        });
      }

      return res.status(200).json({
        message: `Year "${existing.name}" deleted successfully.`
      });
    } catch (error) {
      console.error('Delete year error:', error);
      return res.status(500).json({ error: 'Failed to delete year' });
    }
  }

  // ========================================================
  // 5. SECTIONS
  // ========================================================
  static async getSections(req: Request, res: Response) {
    try {
      const { academicYearId, departmentId, yearId, status, search } = req.query;
      const where: any = {};

      if (academicYearId && typeof academicYearId === 'string' && academicYearId !== 'all') {
        where.academicYearId = academicYearId;
      }
      if (departmentId && typeof departmentId === 'string' && departmentId !== 'all') {
        where.departmentId = departmentId;
      }
      if (yearId && typeof yearId === 'string' && yearId !== 'all') {
        where.yearId = yearId;
      }
      if (status === 'active') where.isActive = true;
      else if (status === 'inactive') where.isActive = false;

      if (search && typeof search === 'string' && search.trim()) {
        where.name = { contains: search.trim(), mode: 'insensitive' };
      }

      const sections = await prisma.section.findMany({
        where,
        include: {
          academicYear: { select: { id: true, yearName: true, isCurrent: true } },
          department: { select: { id: true, code: true, name: true } },
          year: { select: { id: true, yearNumber: true, name: true } },
          _count: {
            select: { students: true, teacherAssignments: true }
          }
        },
        orderBy: [
          { academicYear: { yearName: 'desc' } },
          { department: { code: 'asc' } },
          { year: { yearNumber: 'asc' } },
          { name: 'asc' }
        ]
      });

      const formattedSections = sections.map(s => ({
        ...s,
        department_name: s.department?.name,
        department_code: s.department?.code,
        academic_year_name: s.academicYear?.yearName,
        academicYearName: s.academicYear?.yearName,
        year: s.year?.yearNumber,
        yearNumber: s.year?.yearNumber,
        section: s.name.replace(/^Section\s*/i, ''),
        student_count: s._count?.students ?? 0
      }));

      return res.status(200).json({ sections: formattedSections, data: formattedSections, total: formattedSections.length });
    } catch (error) {
      console.error('Get sections error:', error);
      return res.status(500).json({ error: 'Failed to fetch sections' });
    }
  }

  static async createSection(req: Request, res: Response) {
    try {
      let {
        name,
        departmentId,
        yearId,
        academicYearId,
        isActive = true,
        year,
        section,
        academic_year_id,
        department_id
      } = req.body || {};

      departmentId = departmentId || department_id;
      academicYearId = academicYearId || academic_year_id;

      // Auto-resolve academicYearId if not supplied
      if (!academicYearId) {
        const activeAy = await prisma.academicYear.findFirst({
          where: { isCurrent: true }
        }) || await prisma.academicYear.findFirst({
          orderBy: { createdAt: 'desc' }
        });
        if (activeAy) academicYearId = activeAy.id;
      }

      // Auto-resolve yearId if yearNumber (1, 2, 3, 4) was provided
      if (!yearId && (year !== undefined && year !== null)) {
        const yrNum = Number(year);
        const yrRecord = await prisma.year.findFirst({
          where: { yearNumber: yrNum }
        });
        if (yrRecord) yearId = yrRecord.id;
      } else if (yearId && (typeof yearId === 'number' || (typeof yearId === 'string' && /^[1-4]$/.test(yearId)))) {
        const yrRecord = await prisma.year.findFirst({
          where: { yearNumber: Number(yearId) }
        });
        if (yrRecord) yearId = yrRecord.id;
      }

      // Auto-format section name (e.g. "A" -> "Section A")
      if (!name && section) {
        const cleanLetter = String(section).trim().toUpperCase();
        name = cleanLetter.startsWith('SECTION') ? cleanLetter : `Section ${cleanLetter}`;
      } else if (name) {
        const clean = String(name).trim();
        name = clean.toUpperCase().startsWith('SECTION') ? clean : (clean.length <= 2 ? `Section ${clean.toUpperCase()}` : clean);
      }

      if (!name || !departmentId || !yearId || !academicYearId) {
        return res.status(400).json({
          error: 'Section name (e.g. "Section A"), Department, Year, and Academic Year are all required.',
          code: 'FIELDS_REQUIRED'
        });
      }

      const trimmedName = name.trim();

      // Validate parents exist
      const [dept, yr, acadYear] = await Promise.all([
        prisma.department.findUnique({ where: { id: departmentId } }),
        prisma.year.findUnique({ where: { id: yearId } }),
        prisma.academicYear.findUnique({ where: { id: academicYearId } })
      ]);

      if (!dept) return res.status(404).json({ error: 'Selected Department not found', code: 'DEPARTMENT_NOT_FOUND' });
      if (!yr) return res.status(404).json({ error: 'Selected Year not found', code: 'YEAR_NOT_FOUND' });
      if (!acadYear) return res.status(404).json({ error: 'Selected Academic Year not found', code: 'ACADEMIC_YEAR_NOT_FOUND' });

      // Unique composite check
      const existing = await prisma.section.findUnique({
        where: {
          name_departmentId_yearId_academicYearId: {
            name: trimmedName,
            departmentId,
            yearId,
            academicYearId
          }
        }
      });

      if (existing) {
        return res.status(409).json({
          error: `Section "${trimmedName}" already exists for this Department, Year, and Academic Year.`,
          code: 'SECTION_EXISTS'
        });
      }

      const created = await prisma.section.create({
        data: {
          name: trimmedName,
          departmentId,
          yearId,
          academicYearId,
          isActive: isActive !== undefined ? !!isActive : true
        },
        include: {
          academicYear: true,
          department: true,
          year: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'CREATE_SECTION',
            entity: 'Section',
            entityId: created.id,
            metadata: {
              name: created.name,
              department: created.department.code,
              year: created.year.name,
              academicYear: created.academicYear.yearName
            }
          }
        });
      }

      return res.status(201).json({
        message: 'Section created successfully',
        section: created
      });
    } catch (error) {
      console.error('Create section error:', error);
      return res.status(500).json({ error: 'Failed to create section' });
    }
  }

  static async updateSection(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { name, departmentId, yearId, academicYearId, isActive } = req.body || {};

      const existing = await prisma.section.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Section not found', code: 'NOT_FOUND' });
      }

      const newName = name ? name.trim() : existing.name;
      const newDeptId = departmentId || existing.departmentId;
      const newYearId = yearId || existing.yearId;
      const newAcadYearId = academicYearId || existing.academicYearId;

      if (newName !== existing.name || newDeptId !== existing.departmentId || newYearId !== existing.yearId || newAcadYearId !== existing.academicYearId) {
        const duplicate = await prisma.section.findUnique({
          where: {
            name_departmentId_yearId_academicYearId: {
              name: newName,
              departmentId: newDeptId,
              yearId: newYearId,
              academicYearId: newAcadYearId
            }
          }
        });
        if (duplicate && duplicate.id !== id) {
          return res.status(409).json({
            error: `Section "${newName}" already exists for that combination.`,
            code: 'SECTION_EXISTS'
          });
        }
      }

      const updated = await prisma.section.update({
        where: { id },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(departmentId ? { departmentId } : {}),
          ...(yearId ? { yearId } : {}),
          ...(academicYearId ? { academicYearId } : {}),
          ...(isActive !== undefined ? { isActive: !!isActive } : {})
        },
        include: {
          academicYear: true,
          department: true,
          year: true
        }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'UPDATE_SECTION',
            entity: 'Section',
            entityId: updated.id,
            metadata: { changes: req.body }
          }
        });
      }

      return res.status(200).json({
        message: 'Section updated successfully',
        section: updated
      });
    } catch (error) {
      console.error('Update section error:', error);
      return res.status(500).json({ error: 'Failed to update section' });
    }
  }

  static async toggleSectionStatus(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { isActive } = req.body || {};

      const existing = await prisma.section.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Section not found', code: 'NOT_FOUND' });
      }

      const updated = await prisma.section.update({
        where: { id },
        data: { isActive: isActive !== undefined ? !!isActive : !existing.isActive }
      });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'TOGGLE_SECTION_STATUS',
            entity: 'Section',
            entityId: updated.id,
            metadata: { isActive: updated.isActive }
          }
        });
      }

      return res.status(200).json({
        message: `Section ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
        section: updated
      });
    } catch (error) {
      console.error('Toggle section status error:', error);
      return res.status(500).json({ error: 'Failed to toggle section status' });
    }
  }

  static async deleteSection(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };

      const existing = await prisma.section.findUnique({
        where: { id },
        include: {
          _count: {
            select: { students: true, teacherAssignments: true }
          }
        }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Section not found', code: 'NOT_FOUND' });
      }

      const refs = existing._count;
      const totalRefs = refs.students + refs.teacherAssignments;

      if (totalRefs > 0) {
        return res.status(409).json({
          error: `Cannot delete Section "${existing.name}" because it contains enrolled students (${refs.students}) or teacher assignments (${refs.teacherAssignments}).`,
          code: 'CANNOT_DELETE_REFERENCED_RECORD',
          references: refs,
          recommendation: 'Use safe deactivation instead of deletion to prevent orphan marks and maintain student enrollment records.'
        });
      }

      await prisma.section.delete({ where: { id } });

      if (req.user) {
        await prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'DELETE_SECTION',
            entity: 'Section',
            entityId: id,
            metadata: { name: existing.name }
          }
        });
      }

      return res.status(200).json({
        message: `Section "${existing.name}" deleted successfully.`
      });
    } catch (error) {
      console.error('Delete section error:', error);
      return res.status(500).json({ error: 'Failed to delete section' });
    }
  }
}
