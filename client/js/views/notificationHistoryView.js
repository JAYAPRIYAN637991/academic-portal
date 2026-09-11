import { Auth } from '../auth.js';

export function renderNotificationHistoryView(container) {
  let notificationsList = [];
  let summaryCards = {
    total: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
    processing: 0
  };
  let pagination = {
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1
  };

  // Academic metadata
  let academicYears = [];
  let departments = [];
  let years = [];
  let sections = [];

  // Filter state
  let filterAcademicYearId = '';
  let filterDepartmentId = '';
  let filterYearId = '';
  let filterSectionId = '';
  let filterType = '';
  let filterCategory = '';
  let filterStatus = '';
  let filterDate = '';
  let filterSearch = '';
  let isLoading = false;
  let selectedNotification = null;

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Auth.getToken()}`
    };
  }

  function showToast(message, type = 'info') {
    window.dispatchEvent(new CustomEvent('toast-notify', {
      detail: { message, type }
    }));
  }

  function formatDate(dStr) {
    if (!dStr) return '—';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '—';
    }
  }

  // Fetch structure dropdown data
  async function loadMetadata() {
    try {
      const [ayRes, dRes, yRes, sRes] = await Promise.all([
        fetch('/api/admin/academic-years', { headers: getHeaders() }),
        fetch('/api/admin/departments', { headers: getHeaders() }),
        fetch('/api/admin/years', { headers: getHeaders() }),
        fetch('/api/admin/sections', { headers: getHeaders() })
      ]);

      if (ayRes.ok) academicYears = await ayRes.json();
      if (dRes.ok) departments = await dRes.json();
      if (yRes.ok) years = await yRes.json();
      if (sRes.ok) sections = await sRes.json();
    } catch (err) {
      console.error('Error loading academic hierarchy metadata:', err);
    }
  }

  // Fetch paginated & filtered notification history
  async function fetchHistory(page = 1) {
    isLoading = true;
    render();

    try {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('limit', String(pagination.limit));

      if (filterAcademicYearId) q.set('academicYearId', filterAcademicYearId);
      if (filterDepartmentId) q.set('departmentId', filterDepartmentId);
      if (filterYearId) q.set('yearId', filterYearId);
      if (filterSectionId) q.set('sectionId', filterSectionId);
      if (filterType) q.set('type', filterType);
      if (filterCategory) q.set('category', filterCategory);
      if (filterStatus) q.set('status', filterStatus);
      if (filterDate) q.set('date', filterDate);
      if (filterSearch) q.set('search', filterSearch);

      const res = await fetch(`/api/admin/notifications/history?${q.toString()}`, {
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error(`Failed to load notification history (HTTP ${res.status})`);
      }

      const data = await res.json();
      notificationsList = data.notifications || [];
      summaryCards = data.summaryCards || summaryCards;
      pagination = data.pagination || pagination;
    } catch (err) {
      console.error('Fetch notification history error:', err);
      showToast(err.message || 'Error loading notification history', 'error');
    } finally {
      isLoading = false;
      render();
    }
  }

  // Single notification retry handler
  async function handleRetry(notifId) {
    try {
      showToast('Initiating retry dispatch...', 'info');
      const res = await fetch(`/api/admin/notifications/${notifId}/retry`, {
        method: 'POST',
        headers: getHeaders()
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to retry notification');
      }

      showToast('✅ Notification requeued for background retry successfully!', 'success');
      // Refresh current page
      await fetchHistory(pagination.page);
    } catch (err) {
      console.error('Retry notification error:', err);
      showToast(err.message || 'Error retrying notification', 'error');
    }
  }

  // Bulk retry failed notifications
  async function handleBulkRetry() {
    const failedCount = summaryCards.failed;
    if (failedCount === 0) {
      showToast('There are no failed notifications to retry.', 'info');
      return;
    }

    if (!confirm(`Are you sure you want to retry all ${failedCount} failed notification(s)? They will be queued for background re-processing.`)) {
      return;
    }

    try {
      showToast('Initiating bulk retry...', 'info');
      const res = await fetch('/api/admin/notifications/retry-failed', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          category: filterCategory || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to bulk retry notifications');
      }

      showToast(`✅ Successfully requeued ${data.count || failedCount} failed notifications!`, 'success');
      await fetchHistory(1);
    } catch (err) {
      console.error('Bulk retry error:', err);
      showToast(err.message || 'Error bulk retrying notifications', 'error');
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'DELIVERED':
        return '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">✓ Delivered</span>';
      case 'SENT':
        return '<span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9; border: 1px solid rgba(14, 165, 233, 0.3);">Sent</span>';
      case 'PROCESSING':
        return '<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);"><span class="spinner-inline"></span> Processing</span>';
      case 'FAILED':
        return '<span class="badge" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3);">⚠️ Failed</span>';
      case 'PENDING':
      default:
        return '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);">⏳ Pending</span>';
    }
  }

  function getCategoryBadge(category) {
    if (category === 'PERFORMANCE') {
      return '<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">📊 Performance</span>';
    }
    return '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);">📢 Notice</span>';
  }

  function getTypeBadge(type) {
    if (type === 'WHATSAPP') {
      return '<span class="badge" style="background: rgba(37, 211, 102, 0.15); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.3);">💬 WhatsApp</span>';
    }
    return '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">📱 SMS</span>';
  }

  function render() {
    container.innerHTML = `
      <div class="notification-history-view" style="animation: fadeIn 0.25s ease-out;">
        
        <!-- Header & Breadcrumbs -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <div>
            <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px;">
              <span>📱</span> Parent Notification History
            </h2>
            <p style="margin: 4px 0 0; color: var(--text-muted); font-size: 14px;">
              Admin-only audit trail and delivery ledger. Parent contact numbers are strictly masked for privacy.
            </p>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            ${summaryCards.failed > 0 ? `
              <button id="btn-bulk-retry" class="btn btn-sm" style="background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid #f43f5e; display: flex; align-items: center; gap: 6px;">
                <span>🔄</span> Retry All Failed (${summaryCards.failed})
              </button>
            ` : ''}
            <button id="btn-refresh-history" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px;">
              <span>⚡</span> Refresh
            </button>
          </div>
        </div>

        <!-- 1. SUMMARY CARDS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
          
          <div class="metric-card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.5px;">TOTAL NOTIFICATIONS</span>
              <span style="font-size: 16px;">📋</span>
            </div>
            <div style="font-size: 28px; font-weight: 700; color: #fff; margin-top: 8px;">${summaryCards.total}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Outbound records</div>
          </div>

          <div class="metric-card" style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 12px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #38bdf8; font-weight: 600; letter-spacing: 0.5px;">SENT</span>
              <span style="font-size: 16px;">📤</span>
            </div>
            <div style="font-size: 28px; font-weight: 700; color: #38bdf8; margin-top: 8px;">${summaryCards.sent}</div>
            <div style="font-size: 12px; color: #7dd3fc; margin-top: 4px;">Dispatched to gateway</div>
          </div>

          <div class="metric-card" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #34d399; font-weight: 600; letter-spacing: 0.5px;">DELIVERED</span>
              <span style="font-size: 16px;">✅</span>
            </div>
            <div style="font-size: 28px; font-weight: 700; color: #34d399; margin-top: 8px;">${summaryCards.delivered}</div>
            <div style="font-size: 12px; color: #6ee7b7; margin-top: 4px;">Delivered to parent phone</div>
          </div>

          <div class="metric-card" style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.25); border-radius: 12px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #fb7185; font-weight: 600; letter-spacing: 0.5px;">FAILED</span>
              <span style="font-size: 16px;">⚠️</span>
            </div>
            <div style="font-size: 28px; font-weight: 700; color: #fb7185; margin-top: 8px;">${summaryCards.failed}</div>
            <div style="font-size: 12px; color: #fda4af; margin-top: 4px;">Eligible for retry</div>
          </div>

          <div class="metric-card" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; text-transform: uppercase; color: #fbbf24; font-weight: 600; letter-spacing: 0.5px;">PENDING / QUEUED</span>
              <span style="font-size: 16px;">⏳</span>
            </div>
            <div style="font-size: 28px; font-weight: 700; color: #fbbf24; margin-top: 8px;">${summaryCards.pending + summaryCards.processing}</div>
            <div style="font-size: 12px; color: #fde68a; margin-top: 4px;">In background queue</div>
          </div>

        </div>

        <!-- 2. FILTER CONTROLS BAR -->
        <div class="card-box" style="margin-bottom: 24px; padding: 16px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>🔍</span> Filter Ledger
            </span>
            <button id="btn-reset-filters" class="btn btn-sm btn-secondary" style="font-size: 12px; padding: 4px 10px;">
              Reset Filters
            </button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
            
            <!-- Academic Year -->
            <div>
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Academic Year</label>
              <select id="filter-academic-year" class="form-control" style="font-size: 13px; height: 36px; padding: 4px 8px;">
                <option value="">All Academic Years</option>
                ${academicYears.map(ay => `<option value="${ay.id}" ${filterAcademicYearId === ay.id ? 'selected' : ''}>${ay.yearName || ay.name}</option>`).join('')}
              </select>
            </div>

            <!-- Department -->
            <div>
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Department</label>
              <select id="filter-department" class="form-control" style="font-size: 13px; height: 36px; padding: 4px 8px;">
                <option value="">All Departments</option>
                ${departments.map(d => `<option value="${d.id}" ${filterDepartmentId === d.id ? 'selected' : ''}>${d.code} - ${d.name}</option>`).join('')}
              </select>
            </div>

            <!-- Year Cohort -->
            <div>
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Year</label>
              <select id="filter-year" class="form-control" style="font-size: 13px; height: 36px; padding: 4px 8px;">
                <option value="">All Years</option>
                ${years.map(y => `<option value="${y.id}" ${filterYearId === y.id ? 'selected' : ''}>${y.name}</option>`).join('')}
              </select>
            </div>

            <!-- Section -->
            <div>
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Section</label>
              <select id="filter-section" class="form-control" style="font-size: 13px; height: 36px; padding: 4px 8px;">
                <option value="">All Sections</option>
                ${sections
                  .filter(s => !filterDepartmentId || s.departmentId === filterDepartmentId)
                  .map(s => `<option value="${s.id}" ${filterSectionId === s.id ? 'selected' : ''}>Section ${s.name}</option>`).join('')}
              </select>
            </div>

            <!-- Notification Type (Channel) -->
            <div>
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Channel / Type</label>
              <select id="filter-type" class="form-control" style="font-size: 13px; height: 36px; padding: 4px 8px;">
                <option value="">All Channels</option>
                <option value="SMS" ${filterType === 'SMS' ? 'selected' : ''}>📱 SMS</option>
                <option value="WHATSAPP" ${filterType === 'WHATSAPP' ? 'selected' : ''}>💬 WhatsApp</option>
              </select>
            </div>

            <!-- Category -->
            <div>
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Category</label>
              <select id="filter-category" class="form-control" style="font-size: 13px; height: 36px; padding: 4px 8px;">
                <option value="">All Categories</option>
                <option value="PERFORMANCE" ${filterCategory === 'PERFORMANCE' ? 'selected' : ''}>📊 Performance</option>
                <option value="COLLEGE_NOTICE" ${filterCategory === 'COLLEGE_NOTICE' ? 'selected' : ''}>📢 College Notice</option>
              </select>
            </div>

            <!-- Status -->
            <div>
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Status</label>
              <select id="filter-status" class="form-control" style="font-size: 13px; height: 36px; padding: 4px 8px;">
                <option value="">All Statuses</option>
                <option value="PENDING" ${filterStatus === 'PENDING' ? 'selected' : ''}>Pending</option>
                <option value="PROCESSING" ${filterStatus === 'PROCESSING' ? 'selected' : ''}>Processing</option>
                <option value="SENT" ${filterStatus === 'SENT' ? 'selected' : ''}>Sent</option>
                <option value="DELIVERED" ${filterStatus === 'DELIVERED' ? 'selected' : ''}>Delivered</option>
                <option value="FAILED" ${filterStatus === 'FAILED' ? 'selected' : ''}>Failed</option>
              </select>
            </div>

            <!-- Date -->
            <div>
              <label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Dispatch Date</label>
              <input type="date" id="filter-date" class="form-control" value="${filterDate}" style="font-size: 13px; height: 36px; padding: 4px 8px;" />
            </div>

          </div>

          <!-- Search Input -->
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <input type="text" id="filter-search" class="form-control" placeholder="Search by student name, register number, notice title..." value="${filterSearch}" style="flex: 1; height: 36px; font-size: 13px;" />
            <button id="btn-apply-search" class="btn btn-primary btn-sm" style="height: 36px; padding: 0 16px;">
              Search
            </button>
          </div>
        </div>

        <!-- 3. DATA TABLE -->
        <div class="card-box" style="padding: 0; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden;">
          <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 14px; font-weight: 600; color: #fff;">
              Notification Dispatch Logs (${pagination.totalItems} total)
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">
              Page ${pagination.page} of ${pagination.totalPages || 1}
            </div>
          </div>

          <div class="table-responsive" style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: rgba(15, 23, 42, 0.6); border-bottom: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); text-align: left;">
                  <th style="padding: 12px 16px;">Student</th>
                  <th style="padding: 12px 16px;">Category</th>
                  <th style="padding: 12px 16px;">Notice / Title</th>
                  <th style="padding: 12px 16px;">Channel</th>
                  <th style="padding: 12px 16px;">Masked Parent Contact</th>
                  <th style="padding: 12px 16px;">Status</th>
                  <th style="padding: 12px 16px;">Sent Time</th>
                  <th style="padding: 12px 16px;">Delivered Time</th>
                  <th style="padding: 12px 16px;">Failure Reason</th>
                  <th style="padding: 12px 16px; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${isLoading ? `
                  <tr>
                    <td colspan="10" style="padding: 40px; text-align: center; color: var(--text-muted);">
                      <div style="display: flex; justify-content: center; align-items: center; gap: 8px;">
                        <span class="spinner-inline"></span> Loading notification history...
                      </div>
                    </td>
                  </tr>
                ` : notificationsList.length === 0 ? `
                  <tr>
                    <td colspan="10" style="padding: 40px; text-align: center; color: var(--text-muted);">
                      <div style="font-size: 28px; margin-bottom: 8px;">📭</div>
                      <div>No notification records match the specified filters.</div>
                    </td>
                  </tr>
                ` : notificationsList.map(item => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s ease;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                    
                    <!-- Student & Reg No -->
                    <td style="padding: 12px 16px;">
                      ${item.student ? `
                        <div style="font-weight: 600; color: #fff;">${item.student.name}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">${item.student.registerNumber} | ${item.student.department?.code || ''} ${item.student.section?.name ? 'Sec ' + item.student.section.name : ''}</div>
                      ` : `
                        <div style="color: var(--text-muted); font-style: italic;">General / Entire Batch</div>
                      `}
                    </td>

                    <!-- Category -->
                    <td style="padding: 12px 16px;">
                      ${getCategoryBadge(item.category)}
                    </td>

                    <!-- Notice / Title -->
                    <td style="padding: 12px 16px;">
                      <div style="font-weight: 500; color: #f1f5f9; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.noticeTitle || item.title}">
                        ${item.noticeTitle || item.title}
                      </div>
                    </td>

                    <!-- Channel -->
                    <td style="padding: 12px 16px;">
                      ${getTypeBadge(item.type)}
                    </td>

                    <!-- Protected Masked Mobile -->
                    <td style="padding: 12px 16px; font-family: monospace; color: #cbd5e1;">
                      <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
                        ${item.maskedMobile || '—'}
                      </span>
                    </td>

                    <!-- Status -->
                    <td style="padding: 12px 16px;">
                      ${getStatusBadge(item.status)}
                      ${item.retryCount > 0 ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Retries: ${item.retryCount}</div>` : ''}
                    </td>

                    <!-- Sent Time -->
                    <td style="padding: 12px 16px; color: #cbd5e1; font-size: 12px;">
                      ${formatDate(item.sentAt)}
                    </td>

                    <!-- Delivered Time -->
                    <td style="padding: 12px 16px; color: #cbd5e1; font-size: 12px;">
                      ${formatDate(item.deliveredAt)}
                    </td>

                    <!-- Failure Reason -->
                    <td style="padding: 12px 16px; max-width: 180px;">
                      ${item.status === 'FAILED' && item.errorMessage ? `
                        <div style="color: #fb7185; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.errorMessage}">
                          ⚠️ ${item.errorMessage}
                        </div>
                      ` : `
                        <span style="color: var(--text-muted); font-size: 11px;">—</span>
                      `}
                    </td>

                    <!-- Actions -->
                    <td style="padding: 12px 16px; text-align: right; white-space: nowrap;">
                      <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm btn-view-detail" data-notif-id="${item.id}" style="padding: 4px 8px; font-size: 11px;" title="View exact message text & details">
                          👁️ View
                        </button>
                        ${item.status === 'FAILED' ? `
                          <button class="btn btn-sm btn-retry-notif" data-notif-id="${item.id}" style="padding: 4px 8px; font-size: 11px; background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.4);" title="Retry sending notification">
                            🔄 Retry
                          </button>
                        ` : ''}
                      </div>
                    </td>

                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pagination footer -->
          ${pagination.totalPages > 1 ? `
            <div style="padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.4);">
              <span style="font-size: 12px; color: var(--text-muted);">
                Showing ${notificationsList.length} of ${pagination.totalItems} entries
              </span>
              <div style="display: flex; gap: 6px;">
                <button id="btn-prev-page" class="btn btn-secondary btn-sm" ${pagination.page <= 1 ? 'disabled' : ''} style="padding: 4px 10px;">
                  &larr; Prev
                </button>
                <span style="font-size: 12px; color: #fff; display: flex; align-items: center; padding: 0 8px;">
                  ${pagination.page} / ${pagination.totalPages}
                </span>
                <button id="btn-next-page" class="btn btn-secondary btn-sm" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} style="padding: 4px 10px;">
                  Next &rarr;
                </button>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- 4. NOTIFICATION DETAILS MODAL -->
        ${selectedNotification ? `
          <div class="modal-backdrop" id="notif-details-modal" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999; justify-content: center; align-items: center; padding: 20px;">
            <div class="modal-dialog" style="background: #1e293b; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; width: 100%; max-width: 550px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
              
              <div style="padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 16px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                  <span>📱</span> Notification Dispatch Details
                </div>
                <button id="btn-close-modal" style="background: transparent; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">&times;</button>
              </div>

              <div style="padding: 24px; max-height: 75vh; overflow-y: auto;">
                
                <div style="display: flex; gap: 8px; margin-bottom: 16px; align-items: center; flex-wrap: wrap;">
                  ${getCategoryBadge(selectedNotification.category)}
                  ${getTypeBadge(selectedNotification.type)}
                  ${getStatusBadge(selectedNotification.status)}
                </div>

                <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px; margin-bottom: 16px;">
                  <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; font-weight: 600;">Outbound Message Body</div>
                  <pre style="margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 13px; color: #f8fafc; line-height: 1.5;">${selectedNotification.message}</pre>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; margin-bottom: 16px;">
                  <div>
                    <span style="color: var(--text-muted); display: block;">Recipient Student:</span>
                    <span style="color: #fff; font-weight: 500;">${selectedNotification.student?.name || 'All Target Students'}</span>
                  </div>
                  <div>
                    <span style="color: var(--text-muted); display: block;">Protected Mobile:</span>
                    <span style="color: #38bdf8; font-family: monospace;">${selectedNotification.maskedMobile || '—'}</span>
                  </div>
                  <div>
                    <span style="color: var(--text-muted); display: block;">Provider Message ID:</span>
                    <span style="color: #94a3b8; font-family: monospace;">${selectedNotification.providerMessageId || '—'}</span>
                  </div>
                  <div>
                    <span style="color: var(--text-muted); display: block;">Retry Count:</span>
                    <span style="color: #94a3b8;">${selectedNotification.retryCount || 0}</span>
                  </div>
                  <div>
                    <span style="color: var(--text-muted); display: block;">Sent At:</span>
                    <span style="color: #94a3b8;">${formatDate(selectedNotification.sentAt)}</span>
                  </div>
                  <div>
                    <span style="color: var(--text-muted); display: block;">Delivered At:</span>
                    <span style="color: #94a3b8;">${formatDate(selectedNotification.deliveredAt)}</span>
                  </div>
                </div>

                ${selectedNotification.status === 'FAILED' ? `
                  <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 12px; color: #fb7185; font-size: 12px;">
                    <div style="font-weight: 600; margin-bottom: 4px;">Failure Reason / Gateway Error:</div>
                    <div>${selectedNotification.errorMessage || 'Unknown provider error'}</div>
                    ${selectedNotification.failedAt ? `<div style="font-size: 11px; margin-top: 4px; color: #f43f5e;">Failed timestamp: ${formatDate(selectedNotification.failedAt)}</div>` : ''}
                  </div>
                ` : ''}

              </div>

              <div style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; gap: 10px;">
                <button id="btn-modal-close" class="btn btn-secondary btn-sm">Close</button>
                ${selectedNotification.status === 'FAILED' ? `
                  <button id="btn-modal-retry" class="btn btn-primary btn-sm" style="background: #e11d48;">
                    🔄 Retry Dispatch Now
                  </button>
                ` : ''}
              </div>

            </div>
          </div>
        ` : ''}

      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Refresh button
    const refreshBtn = container.querySelector('#btn-refresh-history');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => fetchHistory(pagination.page));
    }

    // Bulk retry button
    const bulkRetryBtn = container.querySelector('#btn-bulk-retry');
    if (bulkRetryBtn) {
      bulkRetryBtn.addEventListener('click', handleBulkRetry);
    }

    // Filter changes
    const aySelect = container.querySelector('#filter-academic-year');
    if (aySelect) {
      aySelect.addEventListener('change', (e) => {
        filterAcademicYearId = e.target.value;
        fetchHistory(1);
      });
    }

    const deptSelect = container.querySelector('#filter-department');
    if (deptSelect) {
      deptSelect.addEventListener('change', (e) => {
        filterDepartmentId = e.target.value;
        filterSectionId = ''; // reset section cascade
        fetchHistory(1);
      });
    }

    const yrSelect = container.querySelector('#filter-year');
    if (yrSelect) {
      yrSelect.addEventListener('change', (e) => {
        filterYearId = e.target.value;
        fetchHistory(1);
      });
    }

    const secSelect = container.querySelector('#filter-section');
    if (secSelect) {
      secSelect.addEventListener('change', (e) => {
        filterSectionId = e.target.value;
        fetchHistory(1);
      });
    }

    const typeSelect = container.querySelector('#filter-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        filterType = e.target.value;
        fetchHistory(1);
      });
    }

    const catSelect = container.querySelector('#filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        filterCategory = e.target.value;
        fetchHistory(1);
      });
    }

    const statusSelect = container.querySelector('#filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        filterStatus = e.target.value;
        fetchHistory(1);
      });
    }

    const dateInput = container.querySelector('#filter-date');
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        filterDate = e.target.value;
        fetchHistory(1);
      });
    }

    // Search action
    const searchBtn = container.querySelector('#btn-apply-search');
    const searchInput = container.querySelector('#filter-search');
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        filterSearch = searchInput.value.trim();
        fetchHistory(1);
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          filterSearch = searchInput.value.trim();
          fetchHistory(1);
        }
      });
    }

    // Reset filters
    const resetBtn = container.querySelector('#btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filterAcademicYearId = '';
        filterDepartmentId = '';
        filterYearId = '';
        filterSectionId = '';
        filterType = '';
        filterCategory = '';
        filterStatus = '';
        filterDate = '';
        filterSearch = '';
        fetchHistory(1);
      });
    }

    // Pagination
    const prevBtn = container.querySelector('#btn-prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (pagination.page > 1) fetchHistory(pagination.page - 1);
      });
    }

    const nextBtn = container.querySelector('#btn-next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (pagination.page < pagination.totalPages) fetchHistory(pagination.page + 1);
      });
    }

    // Retry buttons
    container.querySelectorAll('.btn-retry-notif').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const notifId = e.currentTarget.getAttribute('data-notif-id');
        if (notifId) handleRetry(notifId);
      });
    });

    // View Details buttons
    container.querySelectorAll('.btn-view-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const notifId = e.currentTarget.getAttribute('data-notif-id');
        const notif = notificationsList.find(n => n.id === notifId);
        if (notif) {
          selectedNotification = notif;
          render();
        }
      });
    });

    // Modal close
    const closeModal = () => {
      selectedNotification = null;
      render();
    };

    const closeBtn = container.querySelector('#btn-close-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const modalCloseBtn = container.querySelector('#btn-modal-close');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

    const modalBackdrop = container.querySelector('#notif-details-modal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    // Modal retry button
    const modalRetryBtn = container.querySelector('#btn-modal-retry');
    if (modalRetryBtn && selectedNotification) {
      modalRetryBtn.addEventListener('click', async () => {
        const notifId = selectedNotification.id;
        closeModal();
        await handleRetry(notifId);
      });
    }
  }

  // Initial load
  loadMetadata().then(() => {
    fetchHistory(1);
  });
}
