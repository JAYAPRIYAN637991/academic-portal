import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { NotificationRecord } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Pagination } from '../../components/data/Pagination';
import { Badge } from '../../components/common/Badge';
import { History, Smartphone, MessageSquare, Clock } from 'lucide-react';

export const NotificationHistoryView: React.FC = () => {
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChannel, setFilterChannel] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/notifications/history');
      setHistory(Array.isArray(res) ? res : res?.notifications || []);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filtered = history.filter((n) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (n.category || '').toLowerCase().includes(q) ||
      (n.recipient_phone || '').includes(q);

    const matchesChannel = filterChannel === 'ALL' || n.channel === filterChannel;
    const matchesStatus = filterStatus === 'ALL' || n.status === filterStatus;

    return matchesSearch && matchesChannel && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<NotificationRecord>[] = [
    {
      header: 'Category / Notice Context',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-white block">
            {row.title || row.category || 'Internal Assessment Update'}
          </span>
          <span className="text-[11px] text-slate-400">Target Parent Notification</span>
        </div>
      ),
    },
    {
      header: 'Recipient Phone',
      accessor: (row) => (
        <span className="font-mono text-xs text-indigo-400">{row.recipient_phone}</span>
      ),
    },
    {
      header: 'Channel',
      accessor: (row) => (
        <div className="flex items-center gap-1 text-xs">
          {row.channel === 'WHATSAPP' ? (
            <Badge variant="success">
              <MessageSquare className="w-3 h-3 inline mr-1" /> WhatsApp
            </Badge>
          ) : (
            <Badge variant="info">
              <Smartphone className="w-3 h-3 inline mr-1" /> SMS
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Delivery Status',
      accessor: (row) => (
        <Badge
          variant={
            row.status === 'DELIVERED'
              ? 'success'
              : row.status === 'SENT'
              ? 'info'
              : row.status === 'FAILED'
              ? 'danger'
              : 'warning'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Timestamp',
      accessor: (row) => (
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          <span>{row.sent_at ? new Date(row.sent_at).toLocaleString() : 'Recent'}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Notification Dispatch History</h2>
        <p className="text-xs text-slate-400">
          Immutable audit record of all SMS and WhatsApp transmissions dispatched to parents
        </p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        placeholder="Search logs by recipient phone or notification category..."
        onRefresh={fetchHistory}
        isRefreshing={isLoading}
        filters={
          <>
            <select
              value={filterChannel}
              onChange={(e) => {
                setFilterChannel(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Channels</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </select>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        keyExtractor={(n, idx) => n.id || idx}
        emptyTitle="No Notification Logs Found"
        emptyDescription="All historical parent notification transmissions will appear here."
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};
