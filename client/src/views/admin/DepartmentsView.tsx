import React, { useEffect, useState } from 'react';
import { api, unpackList } from '../../services/api';
import { Department } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { Plus, Building2, Trash2, Edit2 } from 'lucide-react';

export const DepartmentsView: React.FC = () => {
  const { success, error } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm delete
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);

  const fetchDepts = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/departments').catch(() => api.get('/admin/departments'));
      const list = unpackList<Department>(res, 'departments');
      setDepartments(list);
    } catch (err: any) {
      error('Failed to load', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  const handleOpenAdd = () => {
    setEditingDept(null);
    setCode('');
    setName('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setCode(dept.code);
    setName(dept.name);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, { code, name });
        success('Updated', `Department ${code} updated successfully`);
      } else {
        await api.post('/departments', { code, name });
        success('Created', `Department ${code} created successfully`);
      }
      setIsModalOpen(false);
      fetchDepts();
    } catch (err: any) {
      error('Operation Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deptToDelete) return;
    try {
      await api.delete(`/departments/${deptToDelete.id}`);
      success('Deleted', `Department ${deptToDelete.code} removed.`);
      setDeptToDelete(null);
      fetchDepts();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const filtered = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: Column<Department>[] = [
    {
      header: 'Department Code',
      accessor: (row) => <Badge variant="primary">{row.code}</Badge>,
    },
    {
      header: 'Department Name',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-white">{row.name}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Edit Department"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeptToDelete(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
            title="Delete Department"
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
          <h2 className="text-xl font-bold text-white">Departments</h2>
          <p className="text-xs text-slate-400">Manage engineering and science academic branches</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenAdd}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Department
        </Button>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by department name or code (e.g. CSE)..."
        onRefresh={fetchDepts}
        isRefreshing={isLoading}
      />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        keyExtractor={(item) => item.id}
        emptyTitle="No Departments Found"
        emptyDescription="Get started by adding institutional engineering departments."
        emptyActionLabel="Add Department"
        onEmptyAction={handleOpenAdd}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? 'Edit Department' : 'Add Department'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Department Code *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. CSE"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Department Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Computer Science and Engineering"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              {editingDept ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deptToDelete}
        onClose={() => setDeptToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Department"
        message={`Are you sure you want to delete ${deptToDelete?.name} (${deptToDelete?.code})?`}
      />
    </div>
  );
};
