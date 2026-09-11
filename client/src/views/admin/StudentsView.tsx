import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Student, YearSection, Department } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Pagination } from '../../components/data/Pagination';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { BulkStudentImportModal } from '../../components/admin/BulkStudentImportModal';
import { StudentImportHistoryModal } from '../../components/admin/StudentImportHistoryModal';
import { Plus, UploadCloud, History, GraduationCap, Phone, Mail, Trash2, Edit2, FileSpreadsheet } from 'lucide-react';

export const StudentsView: React.FC = () => {
  const { success, error } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [sections, setSections] = useState<YearSection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; year: string; isCurrent: boolean }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [registerNumber, setRegisterNumber] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [sectionId, setSectionId] = useState<number>(1);
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Import & History Modals
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Delete Confirm
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [studRes, secRes, deptRes, ayRes] = await Promise.all([
        api.get<Student[]>('/students'),
        api.get<YearSection[]>('/sections'),
        api.get<Department[]>('/departments'),
        api.get<{ academicYears: Array<{ id: string; yearName: string; isCurrent: boolean }> }>(
          '/admin/academic-years'
        ).catch(() => ({ academicYears: [] })),
      ]);
      setStudents(Array.isArray(studRes) ? studRes : []);
      setSections(Array.isArray(secRes) ? secRes : []);
      setDepartments(Array.isArray(deptRes) ? deptRes : []);
      if (ayRes?.academicYears) {
        setAcademicYears(
          ayRes.academicYears.map((ay) => ({
            id: ay.id,
            year: ay.yearName,
            isCurrent: ay.isCurrent,
          }))
        );
      }
      if (Array.isArray(secRes) && secRes.length > 0) setSectionId(secRes[0].id);
    } catch (err: any) {
      error('Failed to load students', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setRegisterNumber('');
    setRollNumber('');
    setName('');
    setParentName('');
    setParentPhone('');
    setParentEmail('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setRegisterNumber(student.register_number);
    setRollNumber(student.roll_number);
    setName(student.name);
    setSectionId(student.class_section_id);
    setParentName(student.parent_name || '');
    setParentPhone(student.parent_phone || '');
    setParentEmail(student.parent_email || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        register_number: registerNumber,
        roll_number: rollNumber,
        name,
        class_section_id: sectionId,
        parent_name: parentName,
        parent_phone: parentPhone,
        parent_email: parentEmail,
      };

      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, payload);
        success('Updated', `Student ${name} updated successfully.`);
      } else {
        await api.post('/students', payload);
        success('Created', `Student ${name} registered successfully.`);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      error('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!studentToDelete) return;
    try {
      await api.delete(`/students/${studentToDelete.id}`);
      success('Deleted', `Student ${studentToDelete.name} removed.`);
      setStudentToDelete(null);
      fetchData();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.register_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.parent_phone || '').includes(searchQuery);

    const matchesDept = filterDept === 'ALL' || (s.department_name && s.department_name.includes(filterDept));
    const matchesYear = filterYear === 'ALL' || String(s.year) === filterYear;

    return matchesSearch && matchesDept && matchesYear;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<Student>[] = [
    {
      header: 'Register No.',
      accessor: (row) => (
        <span className="font-mono text-xs font-bold text-indigo-400">{row.register_number}</span>
      ),
    },
    {
      header: 'Student Name',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-xs font-bold shrink-0">
            {row.name.charAt(0)}
          </div>
          <div>
            <span className="font-semibold text-white block">{row.name}</span>
            <span className="text-[11px] text-slate-400">Roll: {row.roll_number}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Class & Section',
      accessor: (row) => (
        <div>
          <Badge variant="primary">
            {row.department_name || 'CSE'} - Yr {row.year || 3} ({row.section || 'A'})
          </Badge>
        </div>
      ),
    },
    {
      header: 'Parent Contact (SMS / WhatsApp)',
      accessor: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-200 font-medium">{row.parent_name || 'Parent'}</div>
          {row.parent_phone && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400">
              <Phone className="w-3 h-3" />
              <span>{row.parent_phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Edit Student"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setStudentToDelete(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
            title="Delete Student"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Students Directory</h2>
          <p className="text-xs text-slate-400">
            Total {students.length} registered students with verified parent communications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
            leftIcon={<History className="w-4 h-4 text-slate-400" />}
          >
            Import History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBulkImportOpen(true)}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
          >
            Bulk Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Student
          </Button>
        </div>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        placeholder="Search by student name, register number, parent phone..."
        onRefresh={fetchData}
        isRefreshing={isLoading}
        filters={
          <>
            <select
              value={filterDept}
              onChange={(e) => {
                setFilterDept(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.code}
                </option>
              ))}
            </select>

            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={paginatedData}
        isLoading={isLoading}
        keyExtractor={(item) => item.id}
        emptyTitle="No Students Found"
        emptyDescription="Add students manually or import students in bulk via CSV."
        emptyActionLabel="Add First Student"
        onEmptyAction={handleOpenAdd}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? 'Edit Student Details' : 'Register New Student'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Register Number *
              </label>
              <input
                type="text"
                value={registerNumber}
                onChange={(e) => setRegisterNumber(e.target.value)}
                placeholder="e.g. 922521104001"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Roll Number *
              </label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 21CS001"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aarav Sharma"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Assigned Class &amp; Section *
            </label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(Number(e.target.value))}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.department_name || sec.department_code} - Year {sec.year} Section {sec.section}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">
              Parent Contact Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Parent / Guardian Name
                </label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Parent Mobile (SMS/WhatsApp)
                </label>
                <input
                  type="text"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              {editingStudent ? 'Update Details' : 'Register Student'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Student Import Engine Modal */}
      <BulkStudentImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={fetchData}
        academicYears={academicYears}
      />

      {/* Student Import Audit Ledger Modal */}
      <StudentImportHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      <ConfirmDialog
        isOpen={!!studentToDelete}
        onClose={() => setStudentToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Student Record"
        message={`Are you sure you want to delete student ${studentToDelete?.name} (${studentToDelete?.register_number})? All associated marks and parent links will be removed.`}
      />
    </div>
  );
};
