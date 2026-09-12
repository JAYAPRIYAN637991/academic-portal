import React, { useEffect, useState } from 'react';
import { api, unpackList } from '../../services/api';
import { Mark, Subject } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Pagination } from '../../components/data/Pagination';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { FileSpreadsheet, Edit2, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const MarksManagementView: React.FC = () => {
  const { success, error } = useToast();
  const [marks, setMarks] = useState<Mark[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssessment, setFilterAssessment] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMark, setSelectedMark] = useState<Mark | null>(null);
  const [newMarksObtained, setNewMarksObtained] = useState<number>(0);
  const [changeReason, setChangeReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Delete Confirm
  const [markToDelete, setMarkToDelete] = useState<Mark | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [marksRes, subjRes]: any = await Promise.all([
        api.get('/marks').catch(() => api.get('/admin/marks')),
        api.get('/subjects').catch(() => api.get('/admin/subjects')),
      ]);
      const marksList = unpackList<Mark>(marksRes, 'marks');
      const subjectsList = unpackList<Subject>(subjRes, 'subjects');

      setMarks(marksList);
      setSubjects(subjectsList);
    } catch (err: any) {
      error('Failed to load marks', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenEdit = (m: Mark) => {
    setSelectedMark(m);
    setNewMarksObtained(m.marks_obtained);
    setChangeReason('');
    setIsEditModalOpen(true);
  };

  const handleUpdateMark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMark) return;
    if (!changeReason.trim()) {
      error('Validation', 'Change reason is mandatory for mark modifications (audit requirement).');
      return;
    }

    setIsUpdating(true);
    try {
      await api.put(`/marks/${selectedMark.id}`, {
        marks_obtained: Number(newMarksObtained),
        change_reason: changeReason,
      });
      success('Updated', `Mark updated for ${selectedMark.student_name || 'student'}`);
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      error('Update Failed', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!markToDelete) return;
    try {
      await api.delete(`/marks/${markToDelete.id}`);
      success('Deleted', 'Mark record removed.');
      setMarkToDelete(null);
      fetchData();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const filtered = marks.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (m.student_name || '').toLowerCase().includes(q) ||
      (m.register_number || '').toLowerCase().includes(q) ||
      (m.subject_code || '').toLowerCase().includes(q) ||
      (m.subject_name || '').toLowerCase().includes(q);

    const matchesAssessment =
      filterAssessment === 'ALL' || m.assessment_name === filterAssessment;

    return matchesSearch && matchesAssessment;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<Mark>[] = [
    {
      header: 'Student',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-white block">{row.student_name || 'Student'}</span>
          <span className="font-mono text-xs text-indigo-400">{row.register_number || 'REG123'}</span>
        </div>
      ),
    },
    {
      header: 'Subject',
      accessor: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-300 block">{row.subject_code}</span>
          <span className="text-xs text-slate-400">{row.subject_name}</span>
        </div>
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
        const isPass = pct >= 50;
        return (
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">
              {row.marks_obtained} / {row.max_marks}
            </span>
            <Badge variant={isPass ? 'success' : 'danger'} size="sm">
              {pct.toFixed(1)}% {isPass ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
        );
      },
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
            title="Edit Mark"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMarkToDelete(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
            title="Delete Mark"
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
          <h2 className="text-xl font-bold text-white">Assessment Marks Management</h2>
          <p className="text-xs text-slate-400">
            Audit and regulate student performance evaluations with mandatory change logging
          </p>
        </div>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        placeholder="Search marks by student name, register number, course code..."
        onRefresh={fetchData}
        isRefreshing={isLoading}
        filters={
          <select
            value={filterAssessment}
            onChange={(e) => {
              setFilterAssessment(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
        keyExtractor={(item) => item.id}
        emptyTitle="No Marks Found"
        emptyDescription="Upload marks via the Marks Upload tab to view and manage student evaluation records."
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      {/* Edit Mark Modal with Reason Input */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Modify Assessment Mark"
        subtitle="Mandatory audit trail reason required for ISO academic compliance"
        maxWidth="md"
      >
        <form onSubmit={handleUpdateMark} className="space-y-4">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <div className="font-semibold text-white">{selectedMark?.student_name}</div>
            <div className="text-slate-400">
              {selectedMark?.register_number} &bull; {selectedMark?.subject_code} ({selectedMark?.assessment_name})
            </div>
            <div className="text-indigo-400 font-bold mt-1">
              Current Score: {selectedMark?.marks_obtained} / {selectedMark?.max_marks}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              New Marks Obtained (Max: {selectedMark?.max_marks || 50}) *
            </label>
            <input
              type="number"
              min={0}
              max={selectedMark?.max_marks || 100}
              value={newMarksObtained}
              onChange={(e) => setNewMarksObtained(Number(e.target.value))}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Reason for Mark Modification *
            </label>
            <textarea
              rows={3}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g. Re-evaluation of Question 4 after student verification"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isUpdating}>
              Save &amp; Log Audit
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!markToDelete}
        onClose={() => setMarkToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Mark Record"
        message={`Are you sure you want to remove the ${markToDelete?.assessment_name} score for ${markToDelete?.student_name}?`}
      />
    </div>
  );
};
