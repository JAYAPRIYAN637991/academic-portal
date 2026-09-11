import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Mark } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Pagination } from '../../components/data/Pagination';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { Edit2 } from 'lucide-react';

export const StaffMarksManagementView: React.FC = () => {
  const { success, error } = useToast();
  const [marks, setMarks] = useState<Mark[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssessment, setFilterAssessment] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Edit Mark
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMark, setSelectedMark] = useState<Mark | null>(null);
  const [newMarksObtained, setNewMarksObtained] = useState<number>(0);
  const [changeReason, setChangeReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchMarks = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/staff/marks');
      setMarks(Array.isArray(res) ? res : res?.marks || []);
    } catch (err) {
      console.error('Failed to load marks', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarks();
  }, []);

  const handleOpenEdit = (m: Mark) => {
    setSelectedMark(m);
    setNewMarksObtained(m.marks_obtained);
    setChangeReason('');
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMark) return;
    if (!changeReason.trim()) {
      error('Reason Required', 'Modification reason is required for student score revisions.');
      return;
    }

    setIsUpdating(true);
    try {
      await api.put(`/marks/${selectedMark.id}`, {
        marks_obtained: Number(newMarksObtained),
        change_reason: changeReason,
      });
      success('Updated', `Marks updated for ${selectedMark.student_name}`);
      setIsEditModalOpen(false);
      fetchMarks();
    } catch (err: any) {
      error('Update Failed', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const filtered = marks.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (m.student_name || '').toLowerCase().includes(q) ||
      (m.register_number || '').toLowerCase().includes(q) ||
      (m.subject_code || '').toLowerCase().includes(q);
    const matchesAssessment =
      filterAssessment === 'ALL' || m.assessment_name === filterAssessment;
    return matchesSearch && matchesAssessment;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<Mark>[] = [
    {
      header: 'Register Number',
      accessor: (row) => <span className="font-mono text-xs font-bold text-indigo-400">{row.register_number}</span>,
    },
    {
      header: 'Student Name',
      accessor: (row) => <span className="font-semibold text-white">{row.student_name}</span>,
    },
    {
      header: 'Subject',
      accessor: (row) => (
        <span className="font-mono text-xs text-slate-300 font-bold">{row.subject_code}</span>
      ),
    },
    {
      header: 'Assessment',
      accessor: (row) => <Badge variant="primary">{row.assessment_name}</Badge>,
    },
    {
      header: 'Score',
      accessor: (row) => {
        const pct = row.max_marks > 0 ? (row.marks_obtained / row.max_marks) * 100 : 0;
        return (
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">
              {row.marks_obtained} / {row.max_marks}
            </span>
            <Badge variant={pct >= 50 ? 'success' : 'danger'} size="sm">
              {pct >= 50 ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
        );
      },
    },
    {
      header: 'Action',
      className: 'text-right',
      headerClassName: 'text-right',
      accessor: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenEdit(row)}
          leftIcon={<Edit2 className="w-3.5 h-3.5" />}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Assigned Marks Management</h2>
        <p className="text-xs text-slate-400">
          Review and adjust scores for your assigned teaching subjects and batches
        </p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        placeholder="Search marks by student name or register number..."
        onRefresh={fetchMarks}
        isRefreshing={isLoading}
        filters={
          <select
            value={filterAssessment}
            onChange={(e) => {
              setFilterAssessment(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Assessments</option>
            <option value="IA-1">IA-1</option>
            <option value="IA-2">IA-2</option>
            <option value="MODEL">Model Exam</option>
          </select>
        }
      />

      <DataTable
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        keyExtractor={(m) => m.id}
        emptyTitle="No Marks Found"
        emptyDescription="Upload assessment scores via the Marks Upload tab to review student grades."
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Student Assessment Score"
        maxWidth="md"
      >
        <form onSubmit={handleUpdate} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <div className="font-semibold text-white">{selectedMark?.student_name}</div>
            <div className="text-slate-400">{selectedMark?.register_number} &bull; {selectedMark?.subject_code}</div>
            <div className="text-emerald-400 font-bold mt-1">Current: {selectedMark?.marks_obtained} / {selectedMark?.max_marks}</div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">
              Revised Marks Obtained (Max: {selectedMark?.max_marks}) *
            </label>
            <input
              type="number"
              min={0}
              max={selectedMark?.max_marks || 100}
              value={newMarksObtained}
              onChange={(e) => setNewMarksObtained(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-bold focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">
              Reason for Adjustment *
            </label>
            <textarea
              rows={3}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g. Recalculation after answer key correction"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" type="submit" isLoading={isUpdating}>
              Save Modification
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
