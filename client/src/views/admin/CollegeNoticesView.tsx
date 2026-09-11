import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CollegeNotice, NoticeStatus } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { NoticeWorkflowModal } from '../../components/notices/NoticeWorkflowModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import {
  Megaphone,
  Plus,
  Send,
  Calendar,
  Smartphone,
  MessageSquare,
  Users,
  Trash2,
  Eye,
} from 'lucide-react';

export const CollegeNoticesView: React.FC = () => {
  const { success, error } = useToast();
  const [notices, setNotices] = useState<CollegeNotice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Workflow Modal
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<CollegeNotice | null>(null);

  // Delete
  const [noticeToDelete, setNoticeToDelete] = useState<CollegeNotice | null>(null);

  const fetchNotices = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/notices');
      setNotices(Array.isArray(res) ? res : res?.notices || []);
    } catch (err: any) {
      error('Failed to load notices', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleOpenCreate = () => {
    setSelectedNotice(null);
    setIsWorkflowOpen(true);
  };

  const handleOpenEdit = (notice: CollegeNotice) => {
    setSelectedNotice(notice);
    setIsWorkflowOpen(true);
  };

  const handleDelete = async () => {
    if (!noticeToDelete) return;
    try {
      await api.delete(`/notices/${noticeToDelete.id}`);
      success('Deleted', 'College notice removed.');
      setNoticeToDelete(null);
      fetchNotices();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const handleQuickPublish = async (notice: CollegeNotice) => {
    try {
      await api.post(`/notices/${notice.id}/publish`, {});
      success('Broadcast Triggered', `Notice ${notice.title} published to recipients.`);
      fetchNotices();
    } catch (err: any) {
      error('Publish Failed', err.message);
    }
  };

  const filtered = notices.filter((n) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'ALL' || n.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<CollegeNotice>[] = [
    {
      header: 'Notice Title & Details',
      accessor: (row) => (
        <div>
          <span className="font-bold text-white text-sm block">{row.title}</span>
          <span className="text-xs text-slate-400 line-clamp-1 mt-0.5">{row.content}</span>
        </div>
      ),
    },
    {
      header: 'Notice Type',
      accessor: (row) => (
        <Badge
          variant={
            row.notice_type === 'URGENT'
              ? 'danger'
              : row.notice_type === 'EXAM'
              ? 'warning'
              : 'primary'
          }
        >
          {row.notice_type}
        </Badge>
      ),
    },
    {
      header: 'Target Audience',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>{row.target_audience}</span>
          <span className="text-slate-400 text-[11px]">({row.recipient_count || 420})</span>
        </div>
      ),
    },
    {
      header: 'Channels',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          {(!row.channels || row.channels.includes('SMS')) && (
            <span className="p-1 rounded bg-slate-800 text-sky-400" title="SMS Enabled">
              <Smartphone className="w-3.5 h-3.5" />
            </span>
          )}
          {(!row.channels || row.channels.includes('WHATSAPP')) && (
            <span className="p-1 rounded bg-slate-800 text-emerald-400" title="WhatsApp Enabled">
              <MessageSquare className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => {
        const variantMap: Record<NoticeStatus, 'success' | 'warning' | 'neutral' | 'info' | 'danger'> = {
          PUBLISHED: 'success',
          SCHEDULED: 'info',
          DRAFT: 'neutral',
          PREVIEW: 'warning',
          CANCELLED: 'danger',
        };
        return <Badge variant={variantMap[row.status] || 'neutral'}>{row.status}</Badge>;
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.status !== 'PUBLISHED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickPublish(row)}
              leftIcon={<Send className="w-3 h-3 text-emerald-400" />}
            >
              Publish
            </Button>
          )}
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Inspect / Edit Workflow"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => setNoticeToDelete(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
            title="Delete Notice"
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
          <h2 className="text-xl font-bold text-white">College Notices &amp; Circulars</h2>
          <p className="text-xs text-slate-400">
            6-stage interactive broadcasting wizard for parent, faculty, and student notifications
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Create Notice Wizard
        </Button>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search notices by title, content..."
        onRefresh={fetchNotices}
        isRefreshing={isLoading}
        filters={
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="DRAFT">Draft</option>
          </select>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        keyExtractor={(n) => n.id}
        emptyTitle="No Notices Found"
        emptyDescription="Create institutional announcements with the 6-stage notice workflow wizard."
        emptyActionLabel="Create Notice"
        onEmptyAction={handleOpenCreate}
      />

      {/* 6-Stage Workflow Wizard Modal */}
      {isWorkflowOpen && (
        <NoticeWorkflowModal
          isOpen={isWorkflowOpen}
          onClose={() => setIsWorkflowOpen(false)}
          onSuccess={fetchNotices}
          initialNotice={selectedNotice}
        />
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!noticeToDelete}
        onClose={() => setNoticeToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Notice"
        message={`Are you sure you want to delete notice "${noticeToDelete?.title}"?`}
      />
    </div>
  );
};
