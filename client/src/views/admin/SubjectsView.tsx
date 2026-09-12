import React, { useEffect, useState } from 'react';
import { api, unpackList } from '../../services/api';
import { Subject, Department } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { Plus, BookOpen, Trash2, Edit2 } from 'lucide-react';

export const SubjectsView: React.FC = () => {
  const { success, error } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState<string | number>(1);
  const [year, setYear] = useState<number>(1);
  const [semester, setSemester] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete
  const [subjToDelete, setSubjToDelete] = useState<Subject | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [subjRes, deptRes]: any = await Promise.all([
        api.get('/subjects').catch(() => api.get('/admin/subjects')),
        api.get('/departments').catch(() => api.get('/admin/departments')),
      ]);
      const subjectsList = unpackList<Subject>(subjRes, 'subjects');
      const departmentsList = unpackList<Department>(deptRes, 'departments');

      setSubjects(subjectsList);
      setDepartments(departmentsList);
      if (departmentsList.length > 0 && !deptId) setDeptId(departmentsList[0].id);
    } catch (err: any) {
      error('Failed to load', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setCode('');
    setName('');
    setYear(3);
    setSemester(5);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Subject) => {
    setEditingSubject(s);
    setCode(s.code);
    setName(s.name);
    setDeptId(s.department_id);
    setYear(s.year);
    setSemester(s.semester);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { code: code.toUpperCase(), name, department_id: deptId, year, semester };
      if (editingSubject) {
        await api.put(`/subjects/${editingSubject.id}`, payload);
        success('Updated', `Subject ${code} updated`);
      } else {
        await api.post('/subjects', payload);
        success('Created', `Subject ${code} added to curriculum`);
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
    if (!subjToDelete) return;
    try {
      await api.delete(`/subjects/${subjToDelete.id}`);
      success('Deleted', `Subject ${subjToDelete.code} removed.`);
      setSubjToDelete(null);
      fetchData();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const filtered = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = filterDept === 'ALL' || String(s.department_id) === filterDept;
    return matchesSearch && matchesDept;
  });

  const columns: Column<Subject>[] = [
    {
      header: 'Subject Code',
      accessor: (row) => <span className="font-mono text-xs font-bold text-indigo-400">{row.code}</span>,
    },
    {
      header: 'Subject Name',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-white">{row.name}</span>
        </div>
      ),
    },
    {
      header: 'Department',
      accessor: (row) => <Badge variant="neutral">{row.department_name || 'Engineering'}</Badge>,
    },
    {
      header: 'Year & Semester',
      accessor: (row) => (
        <span className="text-xs text-slate-300">
          Year {row.year} &bull; Semester {row.semester}
        </span>
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
            title="Edit Subject"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSubjToDelete(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
            title="Delete Subject"
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
          <h2 className="text-xl font-bold text-white">Curriculum Subjects</h2>
          <p className="text-xs text-slate-400">Anna University affiliated academic courses and syllabi</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenAdd}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Subject
        </Button>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search subjects by name or code (e.g. CS8591)..."
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
        emptyTitle="No Subjects Found"
        emptyDescription="Add curriculum subjects to assign teaching faculty and record marks."
        emptyActionLabel="Add Subject"
        onEmptyAction={handleOpenAdd}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Add Curriculum Subject'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Subject Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. CS8591"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Department *
              </label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Subject Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Computer Networks"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Year (1 - 4) *
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
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
                Semester (1 - 8) *
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              {editingSubject ? 'Update Subject' : 'Add Subject'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!subjToDelete}
        onClose={() => setSubjToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Curriculum Subject"
        message={`Are you sure you want to delete ${subjToDelete?.name} (${subjToDelete?.code})?`}
      />
    </div>
  );
};
