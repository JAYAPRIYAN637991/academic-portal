import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AcademicYear } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { Plus, Check, Calendar, Trash2 } from 'lucide-react';

export const AcademicYearsView: React.FC = () => {
  const { success, error } = useToast();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm delete
  const [yearToDelete, setYearToDelete] = useState<AcademicYear | null>(null);

  const fetchYears = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<AcademicYear[]>('/academic-years');
      setAcademicYears(Array.isArray(res) ? res : []);
    } catch (err: any) {
      error('Failed to load', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post('/academic-years', { name: newName, is_current: isCurrent ? 1 : 0 });
      success('Success', `Academic year ${newName} created`);
      setIsAddModalOpen(false);
      setNewName('');
      setIsCurrent(false);
      fetchYears();
    } catch (err: any) {
      error('Creation Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetActive = async (year: AcademicYear) => {
    try {
      await api.put(`/academic-years/${year.id}`, { name: year.name, is_current: 1 });
      success('Updated', `${year.name} is now the active academic year.`);
      fetchYears();
    } catch (err: any) {
      error('Update Failed', err.message);
    }
  };

  const handleDelete = async () => {
    if (!yearToDelete) return;
    try {
      await api.delete(`/academic-years/${yearToDelete.id}`);
      success('Deleted', `Academic year ${yearToDelete.name} removed.`);
      setYearToDelete(null);
      fetchYears();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const filteredYears = academicYears.filter((y) =>
    y.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: Column<AcademicYear>[] = [
    {
      header: 'Academic Year',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-white">{row.name}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <Badge variant={row.is_current ? 'success' : 'neutral'}>
          {row.is_current ? 'Active / Current' : 'Archived'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-2">
          {!row.is_current && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSetActive(row)}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Set Current
            </Button>
          )}
          <button
            onClick={() => setYearToDelete(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
            title="Delete Academic Year"
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
          <h2 className="text-xl font-bold text-white">Academic Years</h2>
          <p className="text-xs text-slate-400">Manage institutional terms and active evaluation cycle</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Academic Year
        </Button>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search academic years..."
        onRefresh={fetchYears}
        isRefreshing={isLoading}
      />

      <DataTable
        columns={columns}
        data={filteredYears}
        isLoading={isLoading}
        keyExtractor={(item) => item.id}
        emptyTitle="No Academic Years Found"
        emptyDescription="Get started by creating the current academic year."
        emptyActionLabel="Add Academic Year"
        onEmptyAction={() => setIsAddModalOpen(true)}
      />

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Academic Year"
        subtitle="Define a new academic evaluation term"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Year Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. 2026-2027"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Set as Current Active Academic Year</span>
          </label>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Save Year
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!yearToDelete}
        onClose={() => setYearToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Academic Year"
        message={`Are you sure you want to delete ${yearToDelete?.name}? All associated classes and records may be affected.`}
      />
    </div>
  );
};
