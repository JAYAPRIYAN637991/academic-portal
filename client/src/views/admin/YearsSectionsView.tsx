import React, { useEffect, useState } from 'react';
import { api, unpackList } from '../../services/api';
import { YearSection, Department, AcademicYear } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { Plus, Layers, Trash2, Users } from 'lucide-react';

export const YearsSectionsView: React.FC = () => {
  const { success, error } = useToast();
  const [sections, setSections] = useState<YearSection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState<string | number>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string | number>('');
  const [yearNum, setYearNum] = useState(1);
  const [sectionLetter, setSectionLetter] = useState('A');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete
  const [sectionToDelete, setSectionToDelete] = useState<YearSection | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [secRes, deptRes, yearRes]: any = await Promise.all([
        api.get('/sections').catch(() => api.get('/admin/sections')),
        api.get('/departments').catch(() => api.get('/admin/departments')),
        api.get('/academic-years').catch(() => api.get('/admin/academic-years')),
      ]);

      const sectionsList = unpackList<YearSection>(secRes, 'sections');
      const departmentsList = unpackList<Department>(deptRes, 'departments');
      const academicYearsList = unpackList<AcademicYear>(yearRes, 'academicYears');

      setSections(sectionsList);
      setDepartments(departmentsList);
      setAcademicYears(academicYearsList);

      if (departmentsList.length > 0 && !selectedDeptId) setSelectedDeptId(departmentsList[0].id);
      if (academicYearsList.length > 0 && !selectedYearId) {
        const current = academicYearsList.find((y: any) => y.isCurrent || y.is_current) || academicYearsList[0];
        setSelectedYearId(current.id);
      }
    } catch (err: any) {
      error('Failed to load data', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/sections', {
        academic_year_id: selectedYearId,
        department_id: selectedDeptId,
        year: yearNum,
        section: sectionLetter.toUpperCase(),
      });
      success('Created', `Section Year ${yearNum} - ${sectionLetter.toUpperCase()} added.`);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      error('Creation Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!sectionToDelete) return;
    try {
      await api.delete(`/sections/${sectionToDelete.id}`);
      success('Deleted', `Section removed.`);
      setSectionToDelete(null);
      fetchData();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const filtered = sections.filter((s) => {
    const matchesSearch =
      (s.department_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.department_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.section.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = filterDept === 'ALL' || String(s.department_id) === filterDept;
    return matchesSearch && matchesDept;
  });

  const columns: Column<YearSection>[] = [
    {
      header: 'Department',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-white">{row.department_name || row.department_code}</span>
          {row.department_code && <span className="text-xs text-slate-400 block">{row.department_code}</span>}
        </div>
      ),
    },
    {
      header: 'Class & Section',
      accessor: (row) => (
        <Badge variant="primary" size="md">
          Year {row.year} - Section {row.section}
        </Badge>
      ),
    },
    {
      header: 'Academic Term',
      accessor: (row) => <span className="text-slate-300">{row.academic_year_name || '2026-2027'}</span>,
    },
    {
      header: 'Enrolled Students',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>{row.student_count || 60} Students</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      accessor: (row) => (
        <button
          onClick={() => setSectionToDelete(row)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
          title="Delete Section"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Years &amp; Sections</h2>
          <p className="text-xs text-slate-400">Manage class batches and section distributions</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Section
        </Button>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Filter sections by branch or section..."
        onRefresh={fetchData}
        isRefreshing={isLoading}
        filters={
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        keyExtractor={(item) => item.id}
        emptyTitle="No Sections Found"
        emptyDescription="Create sections under departments to register students and assign faculty."
        emptyActionLabel="Add Section"
        onEmptyAction={() => setIsModalOpen(true)}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Year & Section"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Department *
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Year (1 - 4) *
              </label>
              <select
                value={yearNum}
                onChange={(e) => setYearNum(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={1}>Year 1</option>
                <option value={2}>Year 2</option>
                <option value={3}>Year 3</option>
                <option value={4}>Year 4</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Section Letter *
              </label>
              <input
                type="text"
                maxLength={2}
                value={sectionLetter}
                onChange={(e) => setSectionLetter(e.target.value.toUpperCase())}
                placeholder="A, B, C..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 uppercase"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Academic Term *
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.is_current ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Create Section
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!sectionToDelete}
        onClose={() => setSectionToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Class Section"
        message={`Are you sure you want to delete this section? All enrolled students must be reassigned.`}
      />
    </div>
  );
};
