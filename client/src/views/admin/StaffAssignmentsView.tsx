import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { StaffAssignment, StaffMember, Subject, YearSection, Department } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import {
  Plus,
  UserCheck,
  BookOpen,
  Layers,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Users,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';

export const StaffAssignmentsView: React.FC = () => {
  const { success, error } = useToast();
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<YearSection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // New Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<number>(5);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Change Subject & Semester (Semester Completed Transition) Modal State
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [assignmentToChange, setAssignmentToChange] = useState<StaffAssignment | null>(null);
  const [newSemester, setNewSemester] = useState<number>(6);
  const [newSubjectId, setNewSubjectId] = useState<string>('');
  const [newSectionId, setNewSectionId] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');
  const [isSubmittingChange, setIsSubmittingChange] = useState(false);

  // Revoke / Delete Confirmation Dialog State
  const [assignmentToDelete, setAssignmentToDelete] = useState<StaffAssignment | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [assignRes, staffRes, subjRes, secRes, deptRes] = await Promise.all([
        api.get<any>('/admin/staff/assignments'),
        api.get<any>('/admin/staff'),
        api.get<any>('/subjects'),
        api.get<any>('/sections'),
        api.get<any>('/departments'),
      ]);

      // Unpack response data safely
      const rawAssignments = Array.isArray(assignRes)
        ? assignRes
        : (assignRes?.assignments || []);
      const parsedStaff = Array.isArray(staffRes)
        ? staffRes
        : (staffRes?.staff || []);
      const parsedSubjects = Array.isArray(subjRes)
        ? subjRes
        : (subjRes?.subjects || []);
      const parsedSections = Array.isArray(secRes)
        ? secRes
        : (secRes?.sections || []);
      const parsedDepts = Array.isArray(deptRes)
        ? deptRes
        : (deptRes?.departments || []);

      // Normalize assignments to guarantee all renderable fields are primitives
      const parsedAssignments = rawAssignments.map((a: any) => {
        let yr = 1;
        if (typeof a.year === 'number') yr = a.year;
        else if (typeof a.year === 'object' && a.year !== null) yr = a.year.yearNumber || a.year.year || 1;
        else if (typeof a.yearNumber === 'number') yr = a.yearNumber;
        else if (a.section?.year) {
          const sy = a.section.year;
          yr = typeof sy === 'object' ? (sy.yearNumber || sy.year || 1) : (Number(sy) || 1);
        } else if (typeof a.year === 'string') {
          yr = parseInt(a.year, 10) || 1;
        }

        let secName = 'A';
        if (typeof a.section === 'string') secName = a.section;
        else if (typeof a.section === 'object' && a.section !== null) secName = a.section.name || a.section.section || 'A';
        else if (a.sectionName) secName = a.sectionName;

        return {
          ...a,
          year: yr,
          yearNumber: yr,
          sectionName: secName,
          staffName: String(a.staffName || a.staff?.name || a.staff_name || 'Faculty'),
          staffEmail: String(a.staffEmail || a.staff?.email || 'staff@college.edu'),
          departmentCode: String(typeof a.department === 'string' ? a.department : (a.departmentCode || a.department?.code || a.departmentName || 'CSE')),
          departmentName: String(a.departmentName || (a.department as any)?.name || a.departmentCode || 'CSE'),
          subjectCode: String(a.subjectCode || a.subject?.code || a.subject_code || 'CODE'),
          subjectName: String(a.subjectName || a.subject?.name || a.subject_name || 'Course Name'),
          studentCount: typeof a.studentCount === 'number' ? a.studentCount : 0
        };
      });

      setAssignments(parsedAssignments);
      setStaffList(parsedStaff);
      setSubjects(parsedSubjects);
      setSections(parsedSections);
      setDepartments(parsedDepts);

      // Default dropdown values if empty
      if (parsedStaff.length > 0 && !selectedStaffId) {
        setSelectedStaffId(String(parsedStaff[0].id));
      }
      if (parsedDepts.length > 0 && !selectedDeptId) {
        setSelectedDeptId(String(parsedDepts[0].id));
      }
    } catch (err: any) {
      error('Failed to load assignments', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update available subjects when Dept or Semester changes in Assign Modal
  const availableSubjectsForAssign = subjects.filter((s) => {
    const matchDept = !selectedDeptId || String(s.departmentId || (s as any).department_id) === String(selectedDeptId);
    const matchSem = Number(s.semester) === Number(selectedSemester);
    return matchDept && matchSem;
  });

  // Automatically select first matching subject when filters change in Assign Modal
  useEffect(() => {
    if (availableSubjectsForAssign.length > 0) {
      const alreadyValid = availableSubjectsForAssign.some((s) => String(s.id) === String(selectedSubjectId));
      if (!alreadyValid) {
        setSelectedSubjectId(String(availableSubjectsForAssign[0].id));
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [selectedDeptId, selectedSemester, subjects]);

  // Update available sections based on selected department and semester year
  const calculatedYear = Math.ceil(selectedSemester / 2);
  const availableSectionsForAssign = sections.filter((sec) => {
    const matchDept = !selectedDeptId || String(sec.departmentId || (sec as any).department_id) === String(selectedDeptId);
    const secYear = (sec as any).year?.yearNumber || sec.year || 3;
    const matchYear = Number(secYear) === Number(calculatedYear);
    return matchDept && matchYear;
  });

  useEffect(() => {
    if (availableSectionsForAssign.length > 0) {
      const alreadyValid = availableSectionsForAssign.some((sec) => String(sec.id) === String(selectedSectionId));
      if (!alreadyValid) {
        setSelectedSectionId(String(availableSectionsForAssign[0].id));
      }
    } else if (sections.length > 0) {
      setSelectedSectionId(String(sections[0].id));
    }
  }, [selectedDeptId, selectedSemester, sections]);

  // Handle New Faculty Assignment Submission
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      error('Selection Required', 'Please select a faculty member.');
      return;
    }
    if (!selectedSubjectId) {
      error('Selection Required', 'Please select a curriculum subject with subject code.');
      return;
    }

    setIsSubmittingAssign(true);
    try {
      const res = await api.post<any>('/admin/staff/assignments', {
        staffId: selectedStaffId,
        departmentId: selectedDeptId,
        semester: Number(selectedSemester),
        subjectId: selectedSubjectId,
        sectionId: selectedSectionId,
      });

      success(
        'Assignment Created',
        res?.message || 'Faculty member assigned to course and semester successfully.'
      );
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err: any) {
      error('Assignment Failed', err.message);
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Open "Change Subject & Semester" Modal
  const handleOpenChangeModal = (assignment: StaffAssignment) => {
    setAssignmentToChange(assignment);
    const curSem = Number(assignment.semester || 5);
    const targetNextSem = curSem < 8 ? curSem + 1 : curSem;
    setNewSemester(targetNextSem);
    setNewSectionId(String(assignment.sectionId || assignment.class_section_id || ''));
    setChangeReason(`Semester ${curSem} completed. Reassigned to Semester ${targetNextSem} course.`);

    // Find subjects matching department and next semester
    const targetDeptId = assignment.departmentId;
    const matchingSubjs = subjects.filter((s) => {
      const matchDept = !targetDeptId || String(s.departmentId) === String(targetDeptId);
      return matchDept && Number(s.semester) === targetNextSem;
    });

    if (matchingSubjs.length > 0) {
      setNewSubjectId(String(matchingSubjs[0].id));
    } else {
      setNewSubjectId('');
    }

    setIsChangeModalOpen(true);
  };

  // Available subjects for the Change Modal
  const changeModalDeptId = assignmentToChange?.departmentId;
  const availableSubjectsForChange = subjects.filter((s) => {
    const matchDept = !changeModalDeptId || String(s.departmentId) === String(changeModalDeptId);
    return matchDept && Number(s.semester) === Number(newSemester);
  });

  // Handle Change Subject & Semester Submission (Admin Only)
  const handleSubmitChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentToChange) return;
    if (!newSubjectId) {
      error('Selection Required', 'Please select a new subject with subject code for the new semester.');
      return;
    }

    setIsSubmittingChange(true);
    try {
      const res = await api.put<any>(`/admin/staff/assignments/${assignmentToChange.id}`, {
        subjectId: newSubjectId,
        semester: Number(newSemester),
        sectionId: newSectionId || assignmentToChange.sectionId,
        reason: changeReason,
      });

      success(
        'Subject & Semester Updated',
        res?.message || 'Faculty member assignment updated to new subject and semester successfully.'
      );
      setIsChangeModalOpen(false);
      setAssignmentToChange(null);
      fetchData();
    } catch (err: any) {
      error('Update Failed', err.message);
    } finally {
      setIsSubmittingChange(false);
    }
  };

  // Handle Revoke / Delete Assignment
  const handleDelete = async () => {
    if (!assignmentToDelete) return;
    try {
      await api.delete(`/admin/staff/assignments/${assignmentToDelete.id}`);
      success('Assignment Revoked', 'Teaching assignment was unlinked successfully.');
      setAssignmentToDelete(null);
      fetchData();
    } catch (err: any) {
      error('Unlink Failed', err.message);
    }
  };

  // Filter assignments table
  const filteredAssignments = assignments.filter((a) => {
    const q = searchQuery.toLowerCase().trim();
    const staffName = (a.staffName || a.staff_name || '').toLowerCase();
    const subjCode = (a.subjectCode || a.subject_code || (a.subject as any)?.code || '').toLowerCase();
    const subjName = (a.subjectName || a.subject_name || (a.subject as any)?.name || '').toLowerCase();
    const deptName = (a.departmentName || a.department_name || a.departmentCode || (a.department as any)?.name || '').toLowerCase();
    const sem = String(a.semester || (a.subject as any)?.semester || '');

    const matchesSearch =
      !q ||
      staffName.includes(q) ||
      subjCode.includes(q) ||
      subjName.includes(q) ||
      deptName.includes(q);

    const matchesDept =
      selectedDeptFilter === 'all' ||
      String(a.departmentId) === selectedDeptFilter ||
      String(a.departmentCode) === selectedDeptFilter;

    const matchesSem =
      selectedSemesterFilter === 'all' ||
      sem === selectedSemesterFilter;

    return matchesSearch && matchesDept && matchesSem;
  });

  // Table Columns
  const columns: Column<StaffAssignment>[] = [
    {
      header: 'Faculty Member',
      accessor: (row) => {
        const name = String(row.staffName || (row.staff as any)?.name || row.staff_name || 'Faculty');
        const email = String(row.staffEmail || (row.staff as any)?.email || `staff@college.edu`);
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 text-indigo-300 font-bold text-sm flex items-center justify-center shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-semibold text-white block leading-tight">{name}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">{email}</span>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Department',
      accessor: (row) => {
        const dept = typeof row.department === 'string'
          ? row.department
          : (row.departmentCode || (row.department as any)?.code || row.departmentName || (row.department as any)?.name || 'CSE');
        return (
          <Badge variant="neutral" className="font-semibold uppercase tracking-wider">
            {String(dept)}
          </Badge>
        );
      },
    },
    {
      header: 'Semester',
      accessor: (row) => {
        const rawSem = row.semester ?? (row.subject as any)?.semester ?? 5;
        const sem = typeof rawSem === 'object' ? ((rawSem as any)?.number || 5) : Number(rawSem);
        const isEven = sem % 2 === 0;
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                isEven
                  ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                  : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/40'
              }`}
            >
              Semester {sem}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Subject & Subject Code',
      accessor: (row) => {
        const code = String(row.subjectCode || (row.subject as any)?.code || row.subject_code || 'CODE');
        const name = String(row.subjectName || (row.subject as any)?.name || row.subject_name || 'Course Name');
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                {code}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-200 line-clamp-1">{name}</p>
          </div>
        );
      },
    },
    {
      header: 'Class Section',
      accessor: (row) => {
        let secName = 'A';
        if (typeof row.section === 'object' && row.section !== null) {
          secName = (row.section as any).name || (row.section as any).section || 'A';
        } else if (typeof row.sectionName === 'string') {
          secName = row.sectionName;
        } else if (typeof row.section === 'string') {
          secName = row.section;
        }

        let yr: any = 1;
        if (typeof row.year === 'number') {
          yr = row.year;
        } else if (typeof row.year === 'object' && row.year !== null) {
          yr = (row.year as any).yearNumber || (row.year as any).year || 1;
        } else if (typeof (row as any).yearNumber === 'number') {
          yr = (row as any).yearNumber;
        } else if ((row.section as any)?.year) {
          const sy = (row.section as any).year;
          yr = typeof sy === 'object' ? (sy.yearNumber || sy.year || 1) : (Number(sy) || 1);
        } else if (typeof row.year === 'string') {
          yr = parseInt(row.year, 10) || 1;
        }

        const secStr = String(secName);
        const formattedSec = secStr.startsWith('Section') ? secStr : `Sec ${secStr}`;

        return (
          <Badge variant="primary" className="text-xs">
            Year {String(yr)} - {formattedSec}
          </Badge>
        );
      },
    },
    {
      header: 'Students',
      accessor: (row) => (
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          {typeof row.studentCount === 'number' ? row.studentCount : 0}
        </span>
      ),
    },
    {
      header: 'Admin Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenChangeModal(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/50 transition-colors"
            title="Change Subject and Semester after completed semester"
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Change Course</span>
          </button>
          <button
            onClick={() => setAssignmentToDelete(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/40 transition-colors"
            title="Revoke Assignment"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <GraduationCap className="w-7 h-7 text-indigo-400" />
            <span>Faculty Course & Semester Assignments</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Assign faculty members with Department, Semester (1-8), and Subject Code. Admin only can change subjects upon semester completion.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsAssignModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shadow-lg shadow-indigo-600/20 shrink-0"
        >
          Assign Faculty to Course
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Assignments</span>
            <BookOpen className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{assignments.length}</p>
          <span className="text-[11px] text-slate-400">Class & course allocations</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Teaching Faculty</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-300 mt-1">
            {new Set(assignments.map((a) => a.staffId || (a as any).staff?.id || (a as any).staff_id || a.id)).size}
          </p>
          <span className="text-[11px] text-slate-400">Active instructors</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Departments</span>
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-300 mt-1">{departments.length || 3}</p>
          <span className="text-[11px] text-slate-400">Engineering streams</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Admin Security</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xs font-bold text-amber-300 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Admin-Only Controlled
          </p>
          <span className="text-[11px] text-slate-400">Staff change locked</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search faculty name, course code (CS8501)..."
            onRefresh={fetchData}
            isRefreshing={isLoading}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.code} className="bg-slate-900 text-white">
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSemesterFilter}
              onChange={(e) => setSelectedSemesterFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={String(sem)} className="bg-slate-900 text-white">
                  Semester {sem} ({sem % 2 === 0 ? 'Even' : 'Odd'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Assignments Table */}
      <DataTable
        columns={columns}
        data={filteredAssignments}
        isLoading={isLoading}
        keyExtractor={(item) => String(item.id)}
        emptyTitle="No Faculty Assignments Found"
        emptyDescription="Assign faculty members to specific departments, semesters, and subjects to grant mark evaluation clearance."
        emptyActionLabel="Assign Faculty to Course"
        onEmptyAction={() => setIsAssignModalOpen(true)}
      />

      {/* ============================================================ */}
      {/* MODAL 1: Assign Faculty to Course (New Assignment)           */}
      {/* ============================================================ */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Faculty to Course & Semester"
        maxWidth="lg"
      >
        <form onSubmit={handleAssign} className="space-y-4">
          <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-200 leading-relaxed">
              Select the Department and Semester to filter curriculum subjects. Only the Administrator can assign or modify teaching allocations.
            </p>
          </div>

          {/* Faculty Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Faculty Member *
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="" disabled>-- Select Faculty --</option>
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.email}) - {st.designation || 'Faculty'}
                </option>
              ))}
            </select>
          </div>

          {/* Department & Semester Dual Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Department *
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.code} - {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Semester (1 to 8) *
              </label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem} (Year {Math.ceil(sem / 2)} - {sem % 2 === 0 ? 'Even' : 'Odd'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject with Subject Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Subject with Subject Code *
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              required
              disabled={availableSubjectsForAssign.length === 0}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              {availableSubjectsForAssign.length === 0 ? (
                <option value="">No subjects found for Semester {selectedSemester}</option>
              ) : (
                availableSubjectsForAssign.map((sb) => (
                  <option key={sb.id} value={sb.id}>
                    [{sb.code}] {sb.name}
                  </option>
                ))
              )}
            </select>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Showing subjects designated for Semester {selectedSemester} under the chosen department.
            </span>
          </div>

          {/* Target Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Target Class Section *
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {availableSectionsForAssign.length > 0 ? (
                availableSectionsForAssign.map((sc) => {
                  const dept = (sc as any).department?.code || sc.department_code || 'Dept';
                  const yr = typeof sc.year === 'object' ? ((sc as any).year?.yearNumber || 1) : (sc.year || 1);
                  const sec = (sc as any).name || (sc as any).section || 'A';
                  return (
                    <option key={sc.id} value={sc.id}>
                      {dept} - Year {yr} Section {sec}
                    </option>
                  );
                })
              ) : (
                sections.map((sc) => {
                  const dept = (sc as any).department?.code || sc.department_code || 'Dept';
                  const yr = typeof sc.year === 'object' ? ((sc as any).year?.yearNumber || 1) : (sc.year || 1);
                  const sec = (sc as any).name || (sc as any).section || 'A';
                  return (
                    <option key={sc.id} value={sc.id}>
                      {dept} - Year {yr} Section {sec}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* Live Preview Box */}
          {selectedSubjectId && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Assignment Configuration Preview</span>
              </div>
              <p>
                <span className="text-slate-400">Curriculum:</span> Semester {selectedSemester} | Department: {departments.find(d => String(d.id) === String(selectedDeptId))?.code || 'CSE'}
              </p>
              <p>
                <span className="text-slate-400">Course:</span>{' '}
                <span className="font-mono text-indigo-400 font-bold">
                  {subjects.find(s => String(s.id) === String(selectedSubjectId))?.code}
                </span>{' '}
                - {subjects.find(s => String(s.id) === String(selectedSubjectId))?.name}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmittingAssign}
              leftIcon={<UserCheck className="w-4 h-4" />}
            >
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: Change Subject & Semester (Semester Transition)     */}
      {/* ============================================================ */}
      <Modal
        isOpen={isChangeModalOpen}
        onClose={() => {
          setIsChangeModalOpen(false);
          setAssignmentToChange(null);
        }}
        title="Change Faculty Subject & Semester"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitChange} className="space-y-4">
          {/* Current Assignment Summary Banner */}
          {assignmentToChange && (
            <div className="bg-gradient-to-r from-indigo-950/50 to-slate-900/80 border border-indigo-700/50 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Current Active Assignment
                </span>
                <Badge variant="warning" size="sm">
                  Semester {assignmentToChange.semester || (assignmentToChange.subject as any)?.semester || 5}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Faculty Member:</span>
                  <span className="font-semibold text-white">{assignmentToChange.staffName || assignmentToChange.staff_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Current Course:</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {assignmentToChange.subjectCode || assignmentToChange.subject_code || (assignmentToChange.subject as any)?.code}
                  </span>{' '}
                  - {assignmentToChange.subjectName || assignmentToChange.subject_name || (assignmentToChange.subject as any)?.name}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-lg">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Semester Completed Transition:</strong> Admin only can reassign faculty to the next semester course. All previous assessment marks remain safely archived.
            </span>
          </div>

          {/* New Semester Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select New Semester *
            </label>
            <select
              value={newSemester}
              onChange={(e) => {
                const targetSem = Number(e.target.value);
                setNewSemester(targetSem);
                const matching = subjects.filter(
                  (s) =>
                    (!changeModalDeptId || String(s.departmentId) === String(changeModalDeptId)) &&
                    Number(s.semester) === targetSem
                );
                if (matching.length > 0) {
                  setNewSubjectId(String(matching[0].id));
                } else {
                  setNewSubjectId('');
                }
              }}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem} (Year {Math.ceil(sem / 2)} - {sem % 2 === 0 ? 'Even' : 'Odd'})
                </option>
              ))}
            </select>
          </div>

          {/* New Subject with Subject Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              New Subject with Subject Code *
            </label>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              required
              disabled={availableSubjectsForChange.length === 0}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              {availableSubjectsForChange.length === 0 ? (
                <option value="">No curriculum subjects found for Semester {newSemester}</option>
              ) : (
                availableSubjectsForChange.map((sb) => (
                  <option key={sb.id} value={sb.id}>
                    [{sb.code}] {sb.name}
                  </option>
                ))
              )}
            </select>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Showing subjects designated for Semester {newSemester}.
            </span>
          </div>

          {/* Transition Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Transition Reason / Audit Note
            </label>
            <input
              type="text"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g. Completed Semester 5, assigned to Semester 6 curriculum course."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsChangeModalOpen(false);
                setAssignmentToChange(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmittingChange}
              leftIcon={<ArrowRight className="w-4 h-4" />}
            >
              Confirm Subject & Semester Change
            </Button>
          </div>
        </form>
      </Modal>

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!assignmentToDelete}
        onClose={() => setAssignmentToDelete(null)}
        onConfirm={handleDelete}
        title="Revoke Teaching Assignment"
        message={`Are you sure you want to revoke the teaching assignment for ${assignmentToDelete?.staffName || assignmentToDelete?.staff_name} on subject [${assignmentToDelete?.subjectCode || assignmentToDelete?.subject_code}]? Faculty will lose mark entry access for this course.`}
      />
    </div>
  );
};
