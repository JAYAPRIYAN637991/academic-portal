import { Auth } from '../auth.js';

export function renderAuditLogsView(container) {
  let activeTab = 'mark-changes'; // 'audit-trail' or 'mark-changes'
  let auditLogs = [];
  let markChanges = [];
  let totalAuditLogs = 0;
  let totalMarkChanges = 0;
  let actionCounts = {};

  // Filter state
  let selectedAction = '';
  let selectedEntity = '';
  let searchKeyword = '';
  let markSearchKeyword = '';

  function renderLayout() {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Header & Policy Banner -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div>
            <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
              🛡️ System Audit Trail & Mark Change History
              <span style="font-size: 11px; padding: 4px 10px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 20px; font-weight: 600;">
                ✓ IMMUTABLE LEDGER
              </span>
            </h2>
            <p style="margin: 4px 0 0; font-size: 13px; color: var(--text-muted);">
              Comprehensive, tamper-proof audit logging for student records, staff governance, marks uploads, notices, and mark change histories.
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button id="btn-test-immutability" class="btn btn-secondary btn-sm" style="border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171;" title="Simulate DELETE request to verify tamper resistance">
              🔒 Verify Immutability (DELETE Test)
            </button>
            <button id="btn-refresh-audit" class="btn btn-primary btn-sm">
              🔄 Refresh Logs
            </button>
          </div>
        </div>

        <!-- Metric Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div class="metric-card" style="border-left: 4px solid #3b82f6;">
            <div class="metric-title">TOTAL AUDIT EVENTS</div>
            <div class="metric-value" id="card-total-audits" style="color: #60a5fa;">0</div>
            <div class="metric-sub">14 System Actions Logged</div>
          </div>
          <div class="metric-card" style="border-left: 4px solid #f59e0b;">
            <div class="metric-title">MARK CHANGE REVISIONS</div>
            <div class="metric-value" id="card-total-mark-changes" style="color: #fbbf24;">0</div>
            <div class="metric-sub">Grade alterations tracked</div>
          </div>
          <div class="metric-card" style="border-left: 4px solid #10b981;">
            <div class="metric-title">ACCESS SECURITY</div>
            <div class="metric-value" style="color: #34d399; font-size: 20px;">ADMIN-ONLY</div>
            <div class="metric-sub">Staff Blocked (403 Forbidden)</div>
          </div>
          <div class="metric-card" style="border-left: 4px solid #8b5cf6;">
            <div class="metric-title">DATA INTEGRITY</div>
            <div class="metric-value" style="color: #c084fc; font-size: 20px;">PROTECTED</div>
            <div class="metric-sub">Silent Deletion Prohibited</div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; border-bottom: 2px solid rgba(255, 255, 255, 0.08); gap: 16px;">
          <button id="tab-btn-mark-changes" class="btn-tab ${activeTab === 'mark-changes' ? 'tab-active' : ''}" style="padding: 10px 18px; font-weight: 600; font-size: 14px; background: none; border: none; cursor: pointer; color: ${activeTab === 'mark-changes' ? '#fbbf24' : 'var(--text-muted)'}; border-bottom: ${activeTab === 'mark-changes' ? '3px solid #fbbf24' : '3px solid transparent'};">
            📝 Mark Change History (9 Core Fields)
          </button>
          <button id="tab-btn-audit-trail" class="btn-tab ${activeTab === 'audit-trail' ? 'tab-active' : ''}" style="padding: 10px 18px; font-weight: 600; font-size: 14px; background: none; border: none; cursor: pointer; color: ${activeTab === 'audit-trail' ? '#60a5fa' : 'var(--text-muted)'}; border-bottom: ${activeTab === 'audit-trail' ? '3px solid #60a5fa' : '3px solid transparent'};">
            📋 System Audit Trail (All 14 Actions)
          </button>
        </div>

        <!-- Dynamic Content View Area -->
        <div id="audit-tab-content">
          <!-- Rendered dynamically below -->
        </div>
      </div>
    `;

    document.getElementById('tab-btn-mark-changes').addEventListener('click', () => {
      activeTab = 'mark-changes';
      renderLayout();
      fetchMarkChanges();
    });

    document.getElementById('tab-btn-audit-trail').addEventListener('click', () => {
      activeTab = 'audit-trail';
      renderLayout();
      fetchAuditLogs();
    });

    document.getElementById('btn-refresh-audit').addEventListener('click', () => {
      if (activeTab === 'mark-changes') fetchMarkChanges();
      else fetchAuditLogs();
    });

    document.getElementById('btn-test-immutability').addEventListener('click', testImmutabilityGuard);

    if (activeTab === 'mark-changes') {
      fetchMarkChanges();
    } else {
      fetchAuditLogs();
    }
  }

  // -------------------------------------------------------------
  // TAB 1: MARK CHANGE HISTORY
  // -------------------------------------------------------------
  async function fetchMarkChanges() {
    const tabContent = document.getElementById('audit-tab-content');
    if (!tabContent) return;

    tabContent.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
        Loading verified mark change logs...
      </div>
    `;

    try {
      const params = new URLSearchParams();
      if (markSearchKeyword) params.append('search', markSearchKeyword);
      params.append('limit', '50');

      const res = await fetch(`/api/admin/audit-logs/mark-changes?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });

      if (!res.ok) {
        throw new Error(`Failed to load mark change logs (${res.status})`);
      }

      const data = await res.json();
      markChanges = data.logs || [];
      totalMarkChanges = data.total || 0;

      const card = document.getElementById('card-total-mark-changes');
      if (card) card.textContent = totalMarkChanges;

      renderMarkChangesContent();
    } catch (err) {
      tabContent.innerHTML = `
        <div style="padding: 24px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #f87171;">
          ⚠️ Error loading mark change logs: ${err.message}
        </div>
      `;
    }
  }

  function renderMarkChangesContent() {
    const tabContent = document.getElementById('audit-tab-content');
    if (!tabContent) return;

    tabContent.innerHTML = `
      <div class="card-box">
        <div class="card-box-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div class="card-box-title">Mark Revision & Modification Log</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Tracking all 9 attributes: Student, Register Number, Subject, Assessment, Previous Mark, New Mark, Changed By, Reason, Date/Time.
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="input-mark-search" class="form-control form-control-sm" placeholder="Search by student, reg no, subject..." value="${markSearchKeyword}" style="width: 260px;" />
            <button id="btn-mark-filter" class="btn btn-secondary btn-sm">Filter</button>
          </div>
        </div>

        <div class="card-box-body" style="padding: 0;">
          ${markChanges.length === 0 ? `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">📑</div>
              No mark change records found matching criteria.
            </div>
          ` : `
            <div class="table-responsive">
              <table class="table" style="margin-bottom: 0; font-size: 13px;">
                <thead>
                  <tr style="background: rgba(255, 255, 255, 0.02); text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                    <th>Date / Time</th>
                    <th>Student Details</th>
                    <th>Subject</th>
                    <th>Assessment</th>
                    <th style="text-align: center;">Previous Mark</th>
                    <th style="text-align: center;">New Mark</th>
                    <th style="text-align: center;">Difference</th>
                    <th>Changed By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  ${markChanges.map(log => {
                    const diff = log.difference !== undefined ? log.difference : (log.newMarks - log.previousMarks);
                    const diffBadge = diff > 0 
                      ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600;">+${diff}</span>`
                      : diff < 0 
                      ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; background: rgba(239, 68, 68, 0.15); color: #ef4444; font-weight: 600;">${diff}</span>`
                      : `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; background: rgba(148, 163, 184, 0.15); color: #94a3b8; font-weight: 600;">0</span>`;

                    const dateFormatted = new Date(log.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    });

                    return `
                      <tr>
                        <td style="white-space: nowrap; color: var(--text-muted); font-size: 12px;">
                          ${dateFormatted}
                        </td>
                        <td>
                          <div style="font-weight: 600; color: var(--text-primary);">${log.student?.name || 'N/A'}</div>
                          <span style="font-family: monospace; font-size: 11px; color: #38bdf8;">${log.student?.registerNumber || log.studentId}</span>
                        </td>
                        <td>
                          <div style="font-weight: 600;">${log.subject?.code || 'N/A'}</div>
                          <div style="font-size: 11px; color: var(--text-muted);">${log.subject?.name || ''}</div>
                        </td>
                        <td>
                          <span style="font-weight: 500;">${log.assessment?.name || 'N/A'}</span>
                        </td>
                        <td style="text-align: center; font-weight: 600; color: #94a3b8;">
                          ${log.previousMarks}
                        </td>
                        <td style="text-align: center; font-weight: 700; color: #f8fafc;">
                          ${log.newMarks}
                        </td>
                        <td style="text-align: center;">
                          ${diffBadge}
                        </td>
                        <td>
                          <div style="font-weight: 600;">${log.changer?.name || 'Faculty / Admin'}</div>
                          <div style="font-size: 11px; color: var(--text-muted);">${log.changer?.email || ''}</div>
                        </td>
                        <td style="max-width: 220px;">
                          <span style="display: inline-block; font-size: 12px; color: #cbd5e1; background: rgba(255, 255, 255, 0.04); padding: 4px 8px; border-radius: 4px;">
                            ${escapeHtml(log.reason || 'No justification provided')}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    const searchInput = document.getElementById('input-mark-search');
    const filterBtn = document.getElementById('btn-mark-filter');

    const handleSearch = () => {
      markSearchKeyword = searchInput.value.trim();
      fetchMarkChanges();
    };

    filterBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }

  // -------------------------------------------------------------
  // TAB 2: SYSTEM AUDIT TRAIL
  // -------------------------------------------------------------
  async function fetchAuditLogs() {
    const tabContent = document.getElementById('audit-tab-content');
    if (!tabContent) return;

    tabContent.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
        Loading system audit trail...
      </div>
    `;

    try {
      const params = new URLSearchParams();
      if (selectedAction) params.append('action', selectedAction);
      if (selectedEntity) params.append('entity', selectedEntity);
      if (searchKeyword) params.append('search', searchKeyword);
      params.append('limit', '50');

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });

      if (!res.ok) {
        throw new Error(`Failed to load audit logs (${res.status})`);
      }

      const data = await res.json();
      auditLogs = data.logs || [];
      totalAuditLogs = data.total || 0;
      actionCounts = data.actionCounts || {};

      const cardAudits = document.getElementById('card-total-audits');
      if (cardAudits) cardAudits.textContent = totalAuditLogs;

      renderAuditTrailContent();
    } catch (err) {
      tabContent.innerHTML = `
        <div style="padding: 24px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #f87171;">
          ⚠️ Error loading audit logs: ${err.message}
        </div>
      `;
    }
  }

  function renderAuditTrailContent() {
    const tabContent = document.getElementById('audit-tab-content');
    if (!tabContent) return;

    const actionList = [
      { id: '', label: 'All Actions (14 Actions)' },
      { id: 'LOGIN', label: 'Login' },
      { id: 'LOGOUT', label: 'Logout' },
      { id: 'STUDENT_CREATED', label: 'Student Created' },
      { id: 'STUDENT_UPDATED', label: 'Student Updated' },
      { id: 'STUDENT_IMPORTED', label: 'Student Imported' },
      { id: 'STAFF_CREATED', label: 'Staff Created' },
      { id: 'STAFF_ASSIGNMENT_CHANGED', label: 'Staff Assignment Changed' },
      { id: 'MARKS_UPLOADED', label: 'Marks Uploaded' },
      { id: 'MARKS_UPDATED', label: 'Marks Updated' },
      { id: 'PERFORMANCE_PUBLISHED', label: 'Performance Published' },
      { id: 'COLLEGE_NOTICE_CREATED', label: 'College Notice Created' },
      { id: 'COLLEGE_NOTICE_PUBLISHED', label: 'College Notice Published' },
      { id: 'NOTIFICATION_SENT', label: 'Notification Sent' },
      { id: 'REPORT_GENERATED', label: 'Report Generated' }
    ];

    tabContent.innerHTML = `
      <div class="card-box">
        <div class="card-box-header" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div class="card-box-title">System Audit Log Trail</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                Records all administrative, evaluation, and communication events across the college platform.
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <select id="select-audit-action" class="form-control form-control-sm" style="width: 210px;">
                ${actionList.map(a => `<option value="${a.id}" ${selectedAction === a.id ? 'selected' : ''}>${a.label}</option>`).join('')}
              </select>
              <input type="text" id="input-audit-search" class="form-control form-control-sm" placeholder="Search user, entity, action..." value="${searchKeyword}" style="width: 220px;" />
              <button id="btn-audit-search" class="btn btn-secondary btn-sm">Filter</button>
            </div>
          </div>
        </div>

        <div class="card-box-body" style="padding: 0;">
          ${auditLogs.length === 0 ? `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">🛡️</div>
              No audit records found matching criteria.
            </div>
          ` : `
            <div class="table-responsive">
              <table class="table" style="margin-bottom: 0; font-size: 13px;">
                <thead>
                  <tr style="background: rgba(255, 255, 255, 0.02); text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                    <th>Date / Time</th>
                    <th>User (Initiator)</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Entity Reference</th>
                    <th>Details & Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  ${auditLogs.map(log => {
                    const actionBadge = getActionBadge(log.action);
                    const dateFormatted = new Date(log.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    });

                    const metaSnippet = log.metadata ? JSON.stringify(log.metadata) : '—';
                    const isLongMeta = metaSnippet.length > 50;

                    return `
                      <tr>
                        <td style="white-space: nowrap; color: var(--text-muted); font-size: 12px;">
                          ${dateFormatted}
                        </td>
                        <td>
                          <div style="font-weight: 600; color: var(--text-primary);">${log.user?.name || 'System / Batch'}</div>
                          <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                            <span>${log.user?.email || 'automated'}</span>
                            <span class="role-pill ${log.user?.role === 'ADMIN' ? 'badge-admin' : 'badge-staff'}" style="font-size: 9px; padding: 1px 6px;">
                              ${log.user?.role || 'SYSTEM'}
                            </span>
                          </div>
                        </td>
                        <td>
                          ${actionBadge}
                        </td>
                        <td>
                          <span style="font-weight: 500; color: #cbd5e1;">${log.entity || '—'}</span>
                        </td>
                        <td style="font-family: monospace; font-size: 11px; color: #94a3b8; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                          ${log.entityId || '—'}
                        </td>
                        <td style="max-width: 280px;">
                          <div style="font-family: monospace; font-size: 11px; color: #e2e8f0; background: rgba(0, 0, 0, 0.25); padding: 4px 8px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(metaSnippet)}">
                            ${escapeHtml(metaSnippet)}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    const actionSelect = document.getElementById('select-audit-action');
    const searchInput = document.getElementById('input-audit-search');
    const searchBtn = document.getElementById('btn-audit-search');

    const handleFilter = () => {
      selectedAction = actionSelect.value;
      searchKeyword = searchInput.value.trim();
      fetchAuditLogs();
    };

    searchBtn.addEventListener('click', handleFilter);
    actionSelect.addEventListener('change', handleFilter);
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handleFilter();
    });
  }

  // -------------------------------------------------------------
  // IMMUTABILITY VERIFICATION TEST (Proves silent delete impossible)
  // -------------------------------------------------------------
  async function testImmutabilityGuard() {
    const confirmation = confirm(
      '🔒 IMMUTABILITY SECURITY TEST\n\n' +
      'This will send an HTTP DELETE request to /api/admin/audit-logs to verify tamper resistance.\n\n' +
      'Expected behavior: The backend MUST reject this with HTTP 403 (AUDIT_LOGS_IMMUTABLE).\n\n' +
      'Proceed with the verification test?'
    );

    if (!confirmation) return;

    try {
      const res = await fetch('/api/admin/audit-logs', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data.code === 'AUDIT_LOGS_IMMUTABLE') {
        alert(
          '✅ IMMUTABILITY VERIFIED!\n\n' +
          'Status: 403 Forbidden\n' +
          'Code: AUDIT_LOGS_IMMUTABLE\n' +
          'Message: ' + (data.error || 'Audit logs are permanent and immutable') + '\n\n' +
          'Tamper-proof compliance guaranteed: No user can silently delete audit records.'
        );
      } else {
        alert(`Unexpected response: HTTP ${res.status} - ${JSON.stringify(data)}`);
      }
    } catch (err) {
      alert(`Network error testing immutability: ${err.message}`);
    }
  }

  function getActionBadge(action) {
    switch (action) {
      case 'LOGIN':
        return `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">LOGIN</span>`;
      case 'LOGOUT':
        return `<span style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">LOGOUT</span>`;
      case 'STUDENT_CREATED':
      case 'STAFF_CREATED':
        return `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">${action}</span>`;
      case 'STUDENT_UPDATED':
      case 'STAFF_ASSIGNMENT_CHANGED':
        return `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">${action}</span>`;
      case 'STUDENT_IMPORTED':
        return `<span style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">STUDENT_IMPORTED</span>`;
      case 'MARKS_UPLOADED':
        return `<span style="background: rgba(34, 197, 94, 0.15); color: #4ade80; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">MARKS_UPLOADED</span>`;
      case 'MARKS_UPDATED':
        return `<span style="background: rgba(234, 179, 8, 0.15); color: #facc15; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">MARKS_UPDATED</span>`;
      case 'PERFORMANCE_PUBLISHED':
        return `<span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">PERFORMANCE_PUBLISHED</span>`;
      case 'COLLEGE_NOTICE_CREATED':
        return `<span style="background: rgba(99, 102, 241, 0.15); color: #818cf8; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">NOTICE_CREATED</span>`;
      case 'COLLEGE_NOTICE_PUBLISHED':
        return `<span style="background: rgba(236, 72, 153, 0.15); color: #f472b6; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">NOTICE_PUBLISHED</span>`;
      case 'NOTIFICATION_SENT':
        return `<span style="background: rgba(20, 184, 166, 0.15); color: #2dd4bf; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">NOTIFICATION_SENT</span>`;
      case 'REPORT_GENERATED':
        return `<span style="background: rgba(249, 115, 22, 0.15); color: #fb923c; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">REPORT_GENERATED</span>`;
      default:
        return `<span style="background: rgba(255, 255, 255, 0.1); color: var(--text-primary); padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">${action}</span>`;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Initial render
  renderLayout();
}
