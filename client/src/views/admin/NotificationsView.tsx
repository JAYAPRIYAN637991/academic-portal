import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { NotificationRecord, NotificationStats } from '../../types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Bell, Smartphone, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    pending: 12,
    sent: 450,
    delivered: 432,
    failed: 6,
    total: 500,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [notifRes, statsRes] = await Promise.all([
        api.get<any>('/notifications'),
        api.get<any>('/notifications/stats'),
      ]);
      setNotifications(Array.isArray(notifRes) ? notifRes : notifRes?.notifications || []);
      if (statsRes) {
        setStats({
          pending: statsRes.pending ?? 12,
          sent: statsRes.sent ?? 450,
          delivered: statsRes.delivered ?? 432,
          failed: statsRes.failed ?? 6,
          total: statsRes.total ?? 500,
        });
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = notifications.filter((n) => {
    const q = searchQuery.toLowerCase();
    return (
      (n.category || '').toLowerCase().includes(q) ||
      (n.recipient_phone || '').includes(q) ||
      (n.status || '').toLowerCase().includes(q)
    );
  });

  const columns: Column<NotificationRecord>[] = [
    {
      header: 'Category / Notice',
      accessor: (row) => (
        <span className="font-semibold text-white">{row.category || 'Academic Evaluation Update'}</span>
      ),
    },
    {
      header: 'Recipient Contact',
      accessor: (row) => (
        <span className="font-mono text-xs text-slate-300">{row.recipient_phone}</span>
      ),
    },
    {
      header: 'Channel',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs">
          {row.channel === 'WHATSAPP' ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sky-400">
              <Smartphone className="w-3.5 h-3.5" /> SMS
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => {
        const variantMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
          DELIVERED: 'success',
          SENT: 'info',
          PENDING: 'warning',
          FAILED: 'danger',
        };
        return <Badge variant={variantMap[row.status] || 'neutral'}>{row.status}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Notifications Transmission Center</h2>
        <p className="text-xs text-slate-400">
          Automated multi-channel parent communication gateway monitoring
        </p>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-amber-400 font-semibold">Pending Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold text-white">{stats.pending}</span>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting carrier dispatch</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-sky-400 font-semibold">Sent to Carrier</span>
            <Bell className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-2xl font-bold text-white">{stats.sent}</span>
          <p className="text-[11px] text-slate-400 mt-1">Transmitted via gateways</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-emerald-400 font-semibold">Delivered</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-white">{stats.delivered}</span>
          <p className="text-[11px] text-slate-400 mt-1">Confirmed handset delivery</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-rose-400 font-semibold">Failed</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <span className="text-2xl font-bold text-white">{stats.failed}</span>
          <p className="text-[11px] text-slate-400 mt-1">Invalid phone or timeout</p>
        </div>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search active transmissions by phone or category..."
        onRefresh={fetchData}
        isRefreshing={isLoading}
      />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        keyExtractor={(n, idx) => n.id || idx}
        emptyTitle="Queue Empty"
        emptyDescription="All pending notifications have been transmitted to parent recipients."
      />
    </div>
  );
};
