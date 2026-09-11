import { Auth } from '../auth.js';

export function renderNoticeManagementView(container) {
  let activeTab = 'list'; // 'list' | 'create' | 'edit' | 'scheduled' | 'published' | 'history'
  let noticesList = [];
  let editingNotice = null;

  // Metadata caches
  let academicYears = [];
  let departments = [];
  let years = [];
  let sections = [];

  // Filter state
  let filterType = 'ALL';
  let filterStatus = 'ALL';
  let filterDepartmentId = '';
  let filterYearId = '';
  let filterSectionId = '';
  let filterSearch = '';

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

  // Predefined example templates
  const NOTICE_EXAMPLES = {
    HOLIDAY: {
      title: 'Declared Holiday Announcement',
      content: 'College will remain closed on 10 September due to a declared state holiday. Regular academic sessions will resume the following day.',
      startDate: '2026-09-10',
      endDate: '2026-09-10'
    },
    INTERNAL_EXAM: {
      title: 'Internal Assessment-2 Schedule Announcement',
      content: 'Internal Assessment-2 examinations will commence from 15 September 2026. All students are advised to check subject timetables.',
      startDate: '2026-09-15',
      endDate: '2026-09-22'
    },
    SEMESTER_EXAM: {
      title: 'End Semester Examinations Notification',
      content: 'Semester examinations are scheduled to begin from 20 November 2026. Hall tickets will be issued one week prior.',
      startDate: '2026-11-20',
      endDate: '2026-12-10'
    },
    EXAM_TIMETABLE: {
      title: 'Official Examination Timetable Released',
      content: 'The official examination timetable for the upcoming examinations has been finalized and published on the notice board and student portal.',
      startDate: '',
      endDate: ''
    },
    COLLEGE_REOPENING: {
      title: 'College Reopening for Upcoming Term',
      content: 'College will reopen on 5 October 2026 following the term vacation. Attendance on the reopening day is mandatory for all students.',
      startDate: '2026-10-05',
      endDate: ''
    },
    ACADEMIC: {
      title: 'Important Academic Instructions',
      content: 'Important academic guidelines and submission deadlines have been announced by the college academic council.',
      startDate: '',
      endDate: ''
    },
    URGENT: {
      title: 'URGENT: Advisory Notice for All Students and Parents',
      content: 'Due to severe weather warnings issued by the meteorological department, college will close early today. Safe transit arrangements are advised.',
      startDate: '',
      endDate: ''
    },
    GENERAL: {
      title: 'General College Announcement',
      content: 'Important general instructions have been announced by the college administration for the attention of all students and parents.',
      startDate: '',
      endDate: ''
    }
  };

  async function loadMetadata() {
    try {
      const [ayRes, dRes, yRes, sRes] = await Promise.all([
        fetch('/api/admin/academic-years', { headers: getHeaders() }),
        fetch('/api/admin/departments', { headers: getHeaders() }),
        fetch('/api/admin/years', { headers: getHeaders() }),
        fetch('/api/admin/sections', { headers: getHeaders() })
      ]);

      if (ayRes.ok) {
        const d = await ayRes.json();
        academicYears = d.academicYears || [];
      }
      if (dRes.ok) {
        const d = await dRes.json();
        departments = d.departments || [];
      }
      if (yRes.ok) {
        const d = await yRes.json();
        years = d.years || [];
      }
      if (sRes.ok) {
        const d = await sRes.json();
        sections = d.sections || [];
      }
    } catch (e) {
      console.error('Error loading notice metadata:', e);
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'PUBLISHED':
        return `<span class="badge badge-success" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">🚀 PUBLISHED</span>`;
      case 'SCHEDULED':
        return `<span class="badge badge-info" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 700;">⏰ SCHEDULED</span>`;
      case 'DRAFT':
        return `<span class="badge badge-secondary" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); font-weight: 700;">📝 DRAFT</span>`;
      case 'CANCELLED':
        return `<span class="badge badge-danger" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); font-weight: 700;">🚫 CANCELLED</span>`;
      default:
        return `<span class="badge badge-secondary">${status}</span>`;
    }
  }

  function getTypeBadge(type) {
    switch (type) {
      case 'HOLIDAY':
        return `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">🏖️ HOLIDAY</span>`;
      case 'INTERNAL_EXAM':
        return `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);">📝 INTERNAL EXAM</span>`;
      case 'SEMESTER_EXAM':
        return `<span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.3);">🎓 SEMESTER EXAM</span>`;
      case 'EXAM_TIMETABLE':
        return `<span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.3);">📅 TIMETABLE</span>`;
      case 'COLLEGE_REOPENING':
        return `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);">🏛️ REOPENING</span>`;
      case 'URGENT':
        return `<span class="badge badge-danger" style="background: rgba(244, 63, 94, 0.2); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.4); font-weight: 800;">🚨 URGENT</span>`;
      case 'ACADEMIC':
        return `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">📚 ACADEMIC</span>`;
      case 'GENERAL':
      default:
        return `<span class="badge badge-secondary">📢 GENERAL</span>`;
    }
  }

  function getChannelPill(ch) {
    const c = (ch || 'BOTH').toUpperCase();
    if (c === 'BOTH') {
      return `<span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #34d399; font-size: 11px;">📱 WhatsApp + SMS</span>`;
    }
    if (c === 'WHATSAPP') {
      return `<span class="badge" style="background: rgba(37, 211, 102, 0.1); color: #25d366; font-size: 11px;">💬 WhatsApp Only</span>`;
    }
    return `<span class="badge" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; font-size: 11px;">✉️ SMS Only</span>`;
  }

  function formatDateDisplay(d) {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  }

  function formatDateTimeDisplay(d) {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  }

  function renderShell() {
    container.innerHTML = `
      <div class="notice-management-root">
        <!-- Top Banner -->
        <div class="card-box" style="margin-bottom: 20px; border-left: 4px solid #f43f5e;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <h2 style="font-size: 20px; font-weight: 800; color: #fff; margin: 0;">College News & Notice Broadcast System</h2>
                <span class="badge badge-admin">Admin Exclusive Clearance</span>
              </div>
              <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px; margin-bottom: 0;">
                Announce institution-wide or targeted notices and notify parents directly through SMS and WhatsApp.
              </p>
            </div>
            <div>
              <button id="btn-create-new-notice" class="btn btn-primary" style="font-weight: 700;">
                ➕ Create College Notice
              </button>
            </div>
          </div>

          <!-- Secondary Sub-Tab Navigation -->
          <div class="notice-subtabs" style="display: flex; gap: 8px; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; overflow-x: auto;">
            <button class="btn btn-sm subtab-btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}" data-tab="list">
              📋 All Notices
            </button>
            <button class="btn btn-sm subtab-btn ${activeTab === 'scheduled' ? 'btn-primary' : 'btn-secondary'}" data-tab="scheduled">
              ⏰ Scheduled Notices
            </button>
            <button class="btn btn-sm subtab-btn ${activeTab === 'published' ? 'btn-primary' : 'btn-secondary'}" data-tab="published">
              🚀 Published Broadcasts
            </button>
            <button class="btn btn-sm subtab-btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}" data-tab="history">
              📊 Dispatch History & Logs
            </button>
          </div>
        </div>

        <!-- Dynamic Body Container -->
        <div id="notice-tab-body"></div>

        <!-- Global Modal Container for Preview & Confirm -->
        <div id="notice-modal-container"></div>
      </div>
    `;

    // Wire Shell buttons
    const createBtn = document.getElementById('btn-create-new-notice');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        editingNotice = null;
        switchTab('create');
      });
    }

    container.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-tab');
        switchTab(target);
      });
    });

    renderCurrentTab();
  }

  function switchTab(tabName) {
    activeTab = tabName;
    container.querySelectorAll('.subtab-btn').forEach(b => {
      if (b.getAttribute('data-tab') === tabName) {
        b.classList.add('btn-primary');
        b.classList.remove('btn-secondary');
      } else {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      }
    });
    renderCurrentTab();
  }

  function renderCurrentTab() {
    const body = document.getElementById('notice-tab-body');
    if (!body) return;

    if (activeTab === 'list' || activeTab === 'scheduled' || activeTab === 'published') {
      renderNoticeList(body);
    } else if (activeTab === 'create' || activeTab === 'edit') {
      renderNoticeForm(body);
    } else if (activeTab === 'history') {
      renderDispatchHistory(body);
    }
  }

  /**
   * -------------------------------------------------------------------------
   * VIEW: NOTICE LIST (All / Scheduled / Published)
   * -------------------------------------------------------------------------
   */
  async function renderNoticeList(containerEl) {
    containerEl.innerHTML = `
      <!-- Filters Box -->
      <div class="card-box" style="margin-bottom: 20px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: flex-end;">
          <div>
            <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Search Keyword:</label>
            <input type="text" id="filter-search-notice" class="form-control" placeholder="Search title or content..." value="${filterSearch}">
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Notice Category:</label>
            <select id="filter-type-notice" class="form-control">
              <option value="ALL">All Categories</option>
              <option value="HOLIDAY" ${filterType === 'HOLIDAY' ? 'selected' : ''}>🏖️ Holiday</option>
              <option value="INTERNAL_EXAM" ${filterType === 'INTERNAL_EXAM' ? 'selected' : ''}>📝 Internal Exam</option>
              <option value="SEMESTER_EXAM" ${filterType === 'SEMESTER_EXAM' ? 'selected' : ''}>🎓 Semester Exam</option>
              <option value="EXAM_TIMETABLE" ${filterType === 'EXAM_TIMETABLE' ? 'selected' : ''}>📅 Exam Timetable</option>
              <option value="COLLEGE_REOPENING" ${filterType === 'COLLEGE_REOPENING' ? 'selected' : ''}>🏛️ College Reopening</option>
              <option value="ACADEMIC" ${filterType === 'ACADEMIC' ? 'selected' : ''}>📚 Academic</option>
              <option value="URGENT" ${filterType === 'URGENT' ? 'selected' : ''}>🚨 Urgent</option>
              <option value="GENERAL" ${filterType === 'GENERAL' ? 'selected' : ''}>📢 General</option>
            </select>
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Status:</label>
            <select id="filter-status-notice" class="form-control">
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED" ${filterStatus === 'PUBLISHED' || activeTab === 'published' ? 'selected' : ''}>Published</option>
              <option value="SCHEDULED" ${filterStatus === 'SCHEDULED' || activeTab === 'scheduled' ? 'selected' : ''}>Scheduled</option>
              <option value="DRAFT" ${filterStatus === 'DRAFT' ? 'selected' : ''}>Draft</option>
              <option value="CANCELLED" ${filterStatus === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Department:</label>
            <select id="filter-dept-notice" class="form-control">
              <option value="">All Departments</option>
              ${departments.map(d => `<option value="${d.id}" ${filterDepartmentId === d.id ? 'selected' : ''}>${d.code} - ${d.name}</option>`).join('')}
            </select>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-apply-filters" class="btn btn-primary" style="flex: 1;">Filter</button>
            <button id="btn-reset-filters" class="btn btn-secondary">Reset</button>
          </div>
        </div>
      </div>

      <!-- Table Container -->
      <div class="card-box" style="padding: 0;">
        <div id="notice-table-placeholder" style="padding: 40px; text-align: center; color: var(--text-muted);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          Fetching college notices...
        </div>
      </div>
    `;

    // Overwrite filterStatus if navigating via tab
    if (activeTab === 'scheduled') filterStatus = 'SCHEDULED';
    if (activeTab === 'published') filterStatus = 'PUBLISHED';

    // Wire filter events
    document.getElementById('btn-apply-filters').addEventListener('click', () => {
      filterSearch = document.getElementById('filter-search-notice').value.trim();
      filterType = document.getElementById('filter-type-notice').value;
      filterStatus = document.getElementById('filter-status-notice').value;
      filterDepartmentId = document.getElementById('filter-dept-notice').value;
      loadNoticeData();
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
      filterSearch = '';
      filterType = 'ALL';
      filterStatus = 'ALL';
      filterDepartmentId = '';
      if (activeTab === 'scheduled') filterStatus = 'SCHEDULED';
      if (activeTab === 'published') filterStatus = 'PUBLISHED';
      renderCurrentTab();
    });

    loadNoticeData();
  }

  async function loadNoticeData() {
    const tableContainer = document.getElementById('notice-table-placeholder');
    if (!tableContainer) return;

    try {
      const params = new URLSearchParams();
      if (filterType !== 'ALL') params.append('noticeType', filterType);
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterDepartmentId) params.append('departmentId', filterDepartmentId);
      if (filterSearch) params.append('search', filterSearch);

      const res = await fetch(`/api/admin/notices?${params.toString()}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      noticesList = data.notices || [];

      if (noticesList.length === 0) {
        tableContainer.innerHTML = `
          <div style="padding: 40px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">📢</div>
            <div style="font-weight: 600; font-size: 15px; color: #fff;">No notices found</div>
            <p style="font-size: 13px; margin-top: 4px;">There are no college notices matching your filter criteria.</p>
          </div>
        `;
        return;
      }

      tableContainer.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Notice Title & Content</th>
                <th>Category</th>
                <th>Target Audience</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Scheduled / Published</th>
                <th>Notifications</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${noticesList.map(n => `
                <tr>
                  <td style="max-width: 260px;">
                    <strong style="color: #fff; font-size: 14px;">${n.title}</strong>
                    <div style="color: var(--text-muted); font-size: 12px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${n.content}
                    </div>
                  </td>
                  <td>${getTypeBadge(n.noticeType)}</td>
                  <td>
                    <strong>${n.targetType}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">
                      ${n.department?.code || ''} ${n.year?.name ? `(${n.year.name})` : ''} ${n.section?.name ? `Sec ${n.section.name}` : ''}
                    </div>
                  </td>
                  <td>${getChannelPill(n.deliveryChannel)}</td>
                  <td>${getStatusBadge(n.status)}</td>
                  <td style="font-size: 12px;">
                    ${n.status === 'SCHEDULED' ? `<span style="color: #38bdf8;">⏰ ${formatDateTimeDisplay(n.scheduledAt)}</span>` : ''}
                    ${n.status === 'PUBLISHED' ? `<span style="color: #34d399;">🚀 ${formatDateTimeDisplay(n.publishedAt)}</span>` : ''}
                    ${n.status === 'DRAFT' ? `<span style="color: var(--text-muted);">Saved Draft</span>` : ''}
                    ${n.status === 'CANCELLED' ? `<span style="color: #fb7185;">Cancelled</span>` : ''}
                  </td>
                  <td>
                    <span class="badge ${n.totalNotificationsDispatched > 0 ? 'badge-info' : 'badge-secondary'}" style="font-weight: 700;">
                      ${n.totalNotificationsDispatched} sent
                    </span>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-sm btn-secondary btn-action-view" data-id="${n.id}" title="Preview / Details">👁️</button>
                    ${n.status === 'DRAFT' || n.status === 'SCHEDULED' ? `
                      <button class="btn btn-sm btn-secondary btn-action-edit" data-id="${n.id}" title="Edit Notice">✏️</button>
                    ` : ''}
                    ${n.status === 'DRAFT' ? `
                      <button class="btn btn-sm btn-primary btn-action-publish-direct" data-id="${n.id}" title="Publish & Notify Parents">🚀 Publish</button>
                    ` : ''}
                    ${n.status === 'SCHEDULED' ? `
                      <button class="btn btn-sm btn-danger btn-action-cancel" data-id="${n.id}" title="Cancel Scheduled Notice">🚫 Cancel</button>
                    ` : ''}
                    ${n.status === 'DRAFT' || n.status === 'CANCELLED' ? `
                      <button class="btn btn-sm btn-danger btn-action-delete" data-id="${n.id}" title="Delete Notice">🗑️</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Wire action buttons
      tableContainer.querySelectorAll('.btn-action-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          openPreviewModal(id);
        });
      });

      tableContainer.querySelectorAll('.btn-action-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const notice = noticesList.find(n => n.id === id);
          if (notice) {
            editingNotice = notice;
            switchTab('edit');
          }
        });
      });

      tableContainer.querySelectorAll('.btn-action-publish-direct').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          openPreviewModal(id, true); // Open directly with publish prompt
        });
      });

      tableContainer.querySelectorAll('.btn-action-cancel').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if (confirm('Are you sure you want to cancel this scheduled notice? No notifications will be dispatched.')) {
            await handleCancelNotice(id);
          }
        });
      });

      tableContainer.querySelectorAll('.btn-action-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if (confirm('Are you sure you want to delete this notice?')) {
            await handleDeleteNotice(id);
          }
        });
      });

    } catch (err) {
      console.error('Failed to load notices:', err);
      tableContainer.innerHTML = `<div style="color: #fb7185; padding: 20px;">Failed to load notices: ${err.message}</div>`;
    }
  }

  /**
   * -------------------------------------------------------------------------
   * VIEW: CREATE / EDIT NOTICE FORM
   * -------------------------------------------------------------------------
   */
  function renderNoticeForm(containerEl) {
    const isEdit = !!editingNotice;
    const n = editingNotice || {
      title: '',
      content: '',
      noticeType: 'HOLIDAY',
      targetType: 'ALL_COLLEGE',
      deliveryChannel: 'BOTH',
      startDate: '',
      endDate: '',
      scheduledAt: '',
      departmentId: '',
      yearId: '',
      sectionId: ''
    };

    containerEl.innerHTML = `
      <div class="card-box" style="border-left: 4px solid #6366f1;">
        <div class="card-box-header">
          <div>
            <div class="card-box-title" style="font-size: 18px; color: #fff;">
              ${isEdit ? `✏️ Edit Notice: "${n.title}"` : '➕ Create New College Notice & Parent Broadcast'}
            </div>
            <span style="font-size: 13px; color: var(--text-muted);">
              Notice is saved as <strong>Draft</strong> by default. Notifications to parents are only sent when you explicitly publish.
            </span>
          </div>
          <button id="btn-form-back-list" class="btn btn-secondary btn-sm">⬅ Back to List</button>
        </div>

        <div class="card-box-body">
          <!-- Preset Category Helper Pills -->
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 14px; border-radius: 8px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 8px;">
              ⚡ Quick Template Presets (Click to Auto-Fill):
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-sm btn-secondary btn-preset-example" data-preset="HOLIDAY">🏖️ Holiday</button>
              <button class="btn btn-sm btn-secondary btn-preset-example" data-preset="INTERNAL_EXAM">📝 Internal Exam</button>
              <button class="btn btn-sm btn-secondary btn-preset-example" data-preset="SEMESTER_EXAM">🎓 Semester Exam</button>
              <button class="btn btn-sm btn-secondary btn-preset-example" data-preset="COLLEGE_REOPENING">🏛️ Reopening</button>
              <button class="btn btn-sm btn-secondary btn-preset-example" data-preset="EXAM_TIMETABLE">📅 Timetable</button>
              <button class="btn btn-sm btn-secondary btn-preset-example" data-preset="URGENT">🚨 Urgent</button>
              <button class="btn btn-sm btn-secondary btn-preset-example" data-preset="GENERAL">📢 General</button>
            </div>
          </div>

          <form id="form-notice-manage">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px;">
              <!-- Notice Title -->
              <div>
                <label style="font-size: 13px; font-weight: 700; color: #fff; display: block; margin-bottom: 6px;">Notice Title *</label>
                <input type="text" id="notice-input-title" class="form-control" placeholder="e.g. Holiday Announcement for 10 September" value="${n.title}" required>
              </div>

              <!-- Notice Category -->
              <div>
                <label style="font-size: 13px; font-weight: 700; color: #fff; display: block; margin-bottom: 6px;">Notice Category *</label>
                <select id="notice-input-type" class="form-control" required>
                  <option value="HOLIDAY" ${n.noticeType === 'HOLIDAY' ? 'selected' : ''}>🏖️ Holiday</option>
                  <option value="INTERNAL_EXAM" ${n.noticeType === 'INTERNAL_EXAM' ? 'selected' : ''}>📝 Internal Assessment Exam</option>
                  <option value="SEMESTER_EXAM" ${n.noticeType === 'SEMESTER_EXAM' ? 'selected' : ''}>🎓 Semester Examination</option>
                  <option value="EXAM_TIMETABLE" ${n.noticeType === 'EXAM_TIMETABLE' ? 'selected' : ''}>📅 Exam Timetable</option>
                  <option value="COLLEGE_REOPENING" ${n.noticeType === 'COLLEGE_REOPENING' ? 'selected' : ''}>🏛️ College Reopening</option>
                  <option value="ACADEMIC" ${n.noticeType === 'ACADEMIC' ? 'selected' : ''}>📚 Academic Instruction</option>
                  <option value="URGENT" ${n.noticeType === 'URGENT' ? 'selected' : ''}>🚨 Urgent Notice</option>
                  <option value="GENERAL" ${n.noticeType === 'GENERAL' ? 'selected' : ''}>📢 General Announcement</option>
                </select>
              </div>
            </div>

            <!-- Content Area -->
            <div style="margin-bottom: 16px;">
              <label style="font-size: 13px; font-weight: 700; color: #fff; display: block; margin-bottom: 6px;">Notice Content / Announcement Details *</label>
              <textarea id="notice-input-content" class="form-control" rows="4" placeholder="Enter full announcement text that will be dispatched to parents..." required>${n.content}</textarea>
            </div>

            <!-- Dates Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
              <div>
                <label style="font-size: 13px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px;">Effective Start Date (Optional)</label>
                <input type="date" id="notice-input-start-date" class="form-control" value="${n.startDate ? new Date(n.startDate).toISOString().slice(0, 10) : ''}">
              </div>
              <div>
                <label style="font-size: 13px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px;">Effective End Date (Optional)</label>
                <input type="date" id="notice-input-end-date" class="form-control" value="${n.endDate ? new Date(n.endDate).toISOString().slice(0, 10) : ''}">
              </div>
              <div>
                <label style="font-size: 13px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px;">Schedule For Later (Optional)</label>
                <input type="datetime-local" id="notice-input-scheduled-at" class="form-control" value="${n.scheduledAt ? new Date(n.scheduledAt).toISOString().slice(0, 16) : ''}">
              </div>
            </div>

            <!-- Target Audience Section -->
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 18px; border-radius: 8px; margin-bottom: 20px;">
              <div style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 12px;">🎯 Target Audience Scope</div>

              <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 16px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #fff;">
                  <input type="radio" name="targetType" value="ALL_COLLEGE" ${n.targetType === 'ALL_COLLEGE' ? 'checked' : ''}>
                  🌐 Entire College (All Students)
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #fff;">
                  <input type="radio" name="targetType" value="DEPARTMENT" ${n.targetType === 'DEPARTMENT' ? 'checked' : ''}>
                  🏢 Specific Department
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #fff;">
                  <input type="radio" name="targetType" value="YEAR" ${n.targetType === 'YEAR' ? 'checked' : ''}>
                  🎓 Specific Year Cohort
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #fff;">
                  <input type="radio" name="targetType" value="SECTION" ${n.targetType === 'SECTION' ? 'checked' : ''}>
                  🏫 Specific Class Section
                </label>
              </div>

              <!-- Dependent Dropdowns Container -->
              <div id="target-dropdowns-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
                <!-- Dynamically visible based on targetType -->
              </div>
            </div>

            <!-- Delivery Channel Selector -->
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 18px; border-radius: 8px; margin-bottom: 24px;">
              <div style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 8px;">📡 Delivery Channels to Parents</div>
              <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Select which channels will receive the message when this notice is published.</p>

              <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #fff;">
                  <input type="radio" name="deliveryChannel" value="BOTH" ${(!n.deliveryChannel || n.deliveryChannel === 'BOTH') ? 'checked' : ''}>
                  📱 WhatsApp + SMS (Recommended)
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #fff;">
                  <input type="radio" name="deliveryChannel" value="WHATSAPP" ${n.deliveryChannel === 'WHATSAPP' ? 'checked' : ''}>
                  💬 WhatsApp Only
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #fff;">
                  <input type="radio" name="deliveryChannel" value="SMS" ${n.deliveryChannel === 'SMS' ? 'checked' : ''}>
                  ✉️ SMS Only
                </label>
              </div>
            </div>

            <!-- Form Action Buttons -->
            <div style="display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
              <button type="button" id="btn-save-draft" class="btn btn-secondary">
                💾 Save as Draft
              </button>
              <button type="button" id="btn-save-schedule" class="btn btn-secondary">
                ⏰ Save & Schedule
              </button>
              <button type="button" id="btn-preview-and-publish" class="btn btn-primary" style="font-weight: 700;">
                👁️ Preview Recipients & Publish...
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Preset click handler
    containerEl.querySelectorAll('.btn-preset-example').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.currentTarget.getAttribute('data-preset');
        const ex = NOTICE_EXAMPLES[key];
        if (ex) {
          document.getElementById('notice-input-title').value = ex.title;
          document.getElementById('notice-input-content').value = ex.content;
          document.getElementById('notice-input-type').value = key;
          if (ex.startDate) document.getElementById('notice-input-start-date').value = ex.startDate;
          if (ex.endDate) document.getElementById('notice-input-end-date').value = ex.endDate;
          showToast(`Loaded ${key} template preset`, 'info');
        }
      });
    });

    // Dependent target dropdowns
    function updateTargetDropdowns() {
      const targetTypeEl = containerEl.querySelector('input[name="targetType"]:checked');
      const targetType = targetTypeEl ? targetTypeEl.value : 'ALL_COLLEGE';
      const ddContainer = document.getElementById('target-dropdowns-container');
      if (!ddContainer) return;

      if (targetType === 'ALL_COLLEGE') {
        ddContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; grid-column: 1 / -1;">Notice will be addressed to all active students across all departments and classes.</div>`;
        return;
      }

      let html = '';

      if (targetType === 'DEPARTMENT' || targetType === 'YEAR' || targetType === 'SECTION') {
        html += `
          <div>
            <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Department *</label>
            <select id="notice-target-dept" class="form-control" required>
              <option value="">Select Department</option>
              ${departments.map(d => `<option value="${d.id}" ${n.departmentId === d.id ? 'selected' : ''}>${d.code} - ${d.name}</option>`).join('')}
            </select>
          </div>
        `;
      }

      if (targetType === 'YEAR' || targetType === 'SECTION') {
        html += `
          <div>
            <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Year Cohort *</label>
            <select id="notice-target-year" class="form-control" required>
              <option value="">Select Year</option>
              ${years.map(y => `<option value="${y.id}" ${n.yearId === y.id ? 'selected' : ''}>${y.name}</option>`).join('')}
            </select>
          </div>
        `;
      }

      if (targetType === 'SECTION') {
        html += `
          <div>
            <label style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Class Section *</label>
            <select id="notice-target-section" class="form-control" required>
              <option value="">Select Section</option>
              ${sections.map(s => `
                <option value="${s.id}" ${n.sectionId === s.id ? 'selected' : ''}>
                  ${s.department?.code || ''} - ${s.year?.name || ''} (Sec ${s.name})
                </option>
              `).join('')}
            </select>
          </div>
        `;
      }

      ddContainer.innerHTML = html;
    }

    containerEl.querySelectorAll('input[name="targetType"]').forEach(radio => {
      radio.addEventListener('change', updateTargetDropdowns);
    });
    updateTargetDropdowns();

    // Back to list
    document.getElementById('btn-form-back-list').addEventListener('click', () => {
      switchTab('list');
    });

    // Helper to extract form data
    function getFormData() {
      const title = document.getElementById('notice-input-title').value.trim();
      const content = document.getElementById('notice-input-content').value.trim();
      const noticeType = document.getElementById('notice-input-type').value;
      const targetType = containerEl.querySelector('input[name="targetType"]:checked')?.value || 'ALL_COLLEGE';
      const deliveryChannel = containerEl.querySelector('input[name="deliveryChannel"]:checked')?.value || 'BOTH';
      const startDate = document.getElementById('notice-input-start-date').value || null;
      const endDate = document.getElementById('notice-input-end-date').value || null;
      const scheduledAt = document.getElementById('notice-input-scheduled-at').value || null;

      const deptEl = document.getElementById('notice-target-dept');
      const yearEl = document.getElementById('notice-target-year');
      const secEl = document.getElementById('notice-target-section');

      const departmentId = deptEl ? deptEl.value : null;
      const yearId = yearEl ? yearEl.value : null;
      const sectionId = secEl ? secEl.value : null;

      return {
        title,
        content,
        noticeType,
        targetType,
        deliveryChannel,
        startDate,
        endDate,
        scheduledAt,
        departmentId,
        yearId,
        sectionId
      };
    }

    // Save as Draft
    document.getElementById('btn-save-draft').addEventListener('click', async () => {
      const payload = getFormData();
      if (!payload.title || !payload.content) {
        showToast('Please provide both notice title and content.', 'error');
        return;
      }
      payload.status = 'DRAFT';

      try {
        if (isEdit) {
          const res = await fetch(`/api/admin/notices/${n.id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          showToast('Draft notice updated successfully.', 'success');
        } else {
          const res = await fetch('/api/admin/notices', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          showToast('Notice saved as Draft. No notifications dispatched.', 'success');
        }
        editingNotice = null;
        switchTab('list');
      } catch (err) {
        showToast(err.message || 'Failed to save notice', 'error');
      }
    });

    // Save & Schedule
    document.getElementById('btn-save-schedule').addEventListener('click', async () => {
      const payload = getFormData();
      if (!payload.title || !payload.content) {
        showToast('Please provide both notice title and content.', 'error');
        return;
      }
      if (!payload.scheduledAt) {
        showToast('Please select a Schedule Date/Time to schedule this notice.', 'error');
        return;
      }
      payload.status = 'SCHEDULED';

      try {
        if (isEdit) {
          const res = await fetch(`/api/admin/notices/${n.id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          showToast('Scheduled notice updated.', 'success');
        } else {
          const res = await fetch('/api/admin/notices', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          showToast('Notice scheduled successfully.', 'success');
        }
        editingNotice = null;
        switchTab('scheduled');
      } catch (err) {
        showToast(err.message || 'Failed to schedule notice', 'error');
      }
    });

    // Preview & Publish Trigger
    document.getElementById('btn-preview-and-publish').addEventListener('click', async () => {
      const payload = getFormData();
      if (!payload.title || !payload.content) {
        showToast('Please provide notice title and content before previewing.', 'error');
        return;
      }

      // First save as draft or update if needed, then open preview modal
      try {
        let noticeId = n.id;
        if (!isEdit) {
          payload.status = 'DRAFT';
          const res = await fetch('/api/admin/notices', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const d = await res.json();
          noticeId = d.notice.id;
        } else {
          const res = await fetch(`/api/admin/notices/${noticeId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }

        openPreviewModal(noticeId, true);
      } catch (err) {
        showToast(err.message || 'Failed to prepare notice preview', 'error');
      }
    });
  }

  /**
   * -------------------------------------------------------------------------
   * MODAL: PREVIEW & PUBLISH CONFIRMATION
   * -------------------------------------------------------------------------
   */
  async function openPreviewModal(noticeId, showPublishAction = false) {
    const modalContainer = document.getElementById('notice-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div class="card-box" style="width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; border-top: 4px solid #f43f5e; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
          <div style="padding: 40px; text-align: center; color: var(--text-muted);">
            <div class="spinner" style="margin: 0 auto 12px auto;"></div>
            Resolving audience & formatting exact message...
          </div>
        </div>
      </div>
    `;

    try {
      const resNotice = await fetch(`/api/admin/notices/${noticeId}`, { headers: getHeaders() });
      if (!resNotice.ok) throw new Error(`HTTP ${resNotice.status}`);
      const notice = await resNotice.json();

      const params = new URLSearchParams({
        title: notice.title,
        content: notice.content,
        noticeType: notice.noticeType,
        targetType: notice.targetType,
        deliveryChannel: notice.deliveryChannel || 'BOTH'
      });
      if (notice.departmentId) params.append('departmentId', notice.departmentId);
      if (notice.yearId) params.append('yearId', notice.yearId);
      if (notice.sectionId) params.append('sectionId', notice.sectionId);
      if (notice.startDate) params.append('startDate', notice.startDate);
      if (notice.endDate) params.append('endDate', notice.endDate);

      const resPrev = await fetch(`/api/admin/notices/recipients-preview?${params.toString()}`, { headers: getHeaders() });
      const preview = resPrev.ok ? await resPrev.json() : null;

      const channelsStr = (preview?.channels || []).join(' + ') || notice.deliveryChannel;
      const totalRecipients = preview ? preview.totalStudents : 0;
      const totalParents = preview ? preview.totalParents : 0;

      modalContainer.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
          <div class="card-box" style="width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; border-top: 4px solid #f43f5e; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div class="card-box-header" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <div>
                <div class="card-box-title" style="font-size: 18px; color: #fff;">👁️ Notice & Parent Notification Preview</div>
                <span style="font-size: 12px; color: var(--text-muted);">${notice.title}</span>
              </div>
              <button id="btn-close-preview-modal" class="btn btn-secondary btn-sm">✕</button>
            </div>

            <div class="card-box-body">
              <!-- Broadcast Scope & Recipient Counter Card -->
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; text-align: center;">
                  <div>
                    <div style="font-size: 11px; color: var(--text-muted);">TARGET AUDIENCE</div>
                    <div style="font-size: 14px; font-weight: 700; color: #38bdf8; margin-top: 2px;">
                      ${preview?.targetDescription || notice.targetType}
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: var(--text-muted);">MATCHING RECIPIENTS</div>
                    <div style="font-size: 18px; font-weight: 800; color: #34d399; margin-top: 2px;">
                      ${totalParents} Parents
                    </div>
                    <div style="font-size: 11px; color: #94a3b8;">${totalRecipients} Enrolled Students</div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: var(--text-muted);">DELIVERY CHANNELS</div>
                    <div style="font-size: 14px; font-weight: 700; color: #fbbf24; margin-top: 2px;">
                      ${channelsStr}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Formatted Outbound Message Preview Bubble -->
              <div style="margin-bottom: 20px;">
                <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 6px;">
                  📱 Formatted Parent Message Preview (Exact SMS / WhatsApp Text):
                </div>
                <div style="background: #0f172a; border: 1px solid #1e293b; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #38bdf8; white-space: pre-wrap; line-height: 1.5;">
${preview?.formattedMessage || notice.formattedMessage}
                </div>
              </div>

              <!-- Masked Recipient Sample List -->
              ${preview?.sampleRecipients && preview.sampleRecipients.length > 0 ? `
                <div style="margin-bottom: 20px;">
                  <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
                    🔒 Sample Recipients (Parent Mobile Numbers Masked for Privacy):
                  </div>
                  <div style="max-height: 140px; overflow-y: auto; background: rgba(255,255,255,0.02); border-radius: 6px; padding: 8px;">
                    ${preview.sampleRecipients.map(r => `
                      <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                        <span><strong>${r.studentName}</strong> (<code>${r.registerNumber}</code>)</span>
                        <span style="color: var(--text-muted);">${r.parentName}: <code>${r.maskedMobile}</code></span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Pre-Publish Confirmation Callout -->
              ${notice.status !== 'PUBLISHED' ? `
                <div class="redirect-notice" style="border-left: 4px solid #10b981; margin-bottom: 20px;">
                  <span style="font-weight: 700; color: #34d399;">⚠️ Confirmation Required Before Sending:</span>
                  <span style="color: #fff; display: block; margin-top: 4px;">
                    Are you sure you want to publish this notice and queue background notifications for <strong>${totalParents} parents</strong> via <strong>${channelsStr}</strong>?
                  </span>
                </div>
              ` : `
                <!-- Real-Time Delivery Metrics -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px; margin-bottom: 20px;">
                  <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 8px;">
                    📊 Real-Time Background Notification Status (BullMQ / Background Worker):
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px;">
                    <div style="background: #1e293b; padding: 8px; border-radius: 6px; text-align: center;">
                      <div style="font-size: 18px; font-weight: 800; color: #f8fafc;" id="stat-total-val">—</div>
                      <div style="font-size: 11px; color: var(--text-muted);">Total</div>
                    </div>
                    <div style="background: #1e293b; padding: 8px; border-radius: 6px; text-align: center;">
                      <div style="font-size: 18px; font-weight: 800; color: #94a3b8;" id="stat-pending-val">—</div>
                      <div style="font-size: 11px; color: #94a3b8;">Pending</div>
                    </div>
                    <div style="background: #1e293b; padding: 8px; border-radius: 6px; text-align: center;">
                      <div style="font-size: 18px; font-weight: 800; color: #fbbf24;" id="stat-processing-val">—</div>
                      <div style="font-size: 11px; color: #fbbf24;">Processing</div>
                    </div>
                    <div style="background: #1e293b; padding: 8px; border-radius: 6px; text-align: center;">
                      <div style="font-size: 18px; font-weight: 800; color: #38bdf8;" id="stat-sent-val">—</div>
                      <div style="font-size: 11px; color: #38bdf8;">Sent</div>
                    </div>
                    <div style="background: #1e293b; padding: 8px; border-radius: 6px; text-align: center;">
                      <div style="font-size: 18px; font-weight: 800; color: #10b981;" id="stat-delivered-val">—</div>
                      <div style="font-size: 11px; color: #10b981;">Delivered</div>
                    </div>
                    <div style="background: #1e293b; padding: 8px; border-radius: 6px; text-align: center;">
                      <div style="font-size: 18px; font-weight: 800; color: #f43f5e;" id="stat-failed-val">—</div>
                      <div style="font-size: 11px; color: #f43f5e;">Failed</div>
                    </div>
                  </div>
                </div>
              `}

              <!-- Modal Action Buttons -->
              <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button id="btn-modal-cancel" class="btn btn-secondary">Close</button>
                ${notice.status !== 'PUBLISHED' ? `
                  <button id="btn-modal-confirm-publish" class="btn btn-primary" style="background: #10b981; border-color: #10b981; font-weight: 700;">
                    🚀 Confirm & Publish (Non-Blocking)
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;

      if (notice.status === 'PUBLISHED') {
        fetch(`/api/admin/notices/${noticeId}/notification-stats`, { headers: getHeaders() })
          .then(r => r.ok ? r.json() : null)
          .then(stats => {
            if (stats) {
              const elTot = document.getElementById('stat-total-val');
              const elPen = document.getElementById('stat-pending-val');
              const elPro = document.getElementById('stat-processing-val');
              const elSen = document.getElementById('stat-sent-val');
              const elDel = document.getElementById('stat-delivered-val');
              const elFai = document.getElementById('stat-failed-val');
              if (elTot) elTot.textContent = stats.total;
              if (elPen) elPen.textContent = stats.pending;
              if (elPro) elPro.textContent = stats.processing;
              if (elSen) elSen.textContent = stats.sent;
              if (elDel) elDel.textContent = stats.delivered;
              if (elFai) elFai.textContent = stats.failed;
            }
          })
          .catch(() => {});
      }

      document.getElementById('btn-close-preview-modal').addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
      document.getElementById('btn-modal-cancel').addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });

      const confirmPublishBtn = document.getElementById('btn-modal-confirm-publish');
      if (confirmPublishBtn) {
        confirmPublishBtn.addEventListener('click', async () => {
          confirmPublishBtn.disabled = true;
          confirmPublishBtn.textContent = 'Dispatching Notifications...';
          await handlePublishNotice(noticeId);
          modalContainer.innerHTML = '';
          switchTab('published');
        });
      }

    } catch (err) {
      console.error('Error rendering modal:', err);
      modalContainer.innerHTML = '';
      showToast(err.message || 'Failed to load notice preview', 'error');
    }
  }

  /**
   * -------------------------------------------------------------------------
   * ACTIONS: PUBLISH, CANCEL, DELETE
   * -------------------------------------------------------------------------
   */
  async function handlePublishNotice(noticeId) {
    try {
      const res = await fetch(`/api/admin/notices/${noticeId}/publish`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      showToast(`Notice published! ${data.notificationSummary?.totalNotificationsCreated || 0} notifications dispatched to parents.`, 'success');
      loadNoticeData();
    } catch (err) {
      showToast(err.message || 'Failed to publish notice', 'error');
    }
  }

  async function handleCancelNotice(noticeId) {
    try {
      const res = await fetch(`/api/admin/notices/${noticeId}/cancel`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Scheduled notice cancelled successfully. No notifications sent.', 'info');
      loadNoticeData();
    } catch (err) {
      showToast(err.message || 'Failed to cancel notice', 'error');
    }
  }

  async function handleDeleteNotice(noticeId) {
    try {
      const res = await fetch(`/api/admin/notices/${noticeId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Notice deleted successfully.', 'info');
      loadNoticeData();
    } catch (err) {
      showToast(err.message || 'Failed to delete notice', 'error');
    }
  }

  /**
   * -------------------------------------------------------------------------
   * VIEW: DISPATCH HISTORY & NOTIFICATION LOGS
   * -------------------------------------------------------------------------
   */
  async function renderDispatchHistory(containerEl) {
    containerEl.innerHTML = `
      <div class="card-box" style="padding: 0;">
        <div class="card-box-header" style="padding: 16px 20px;">
          <div>
            <div class="card-box-title">📊 Parent Dispatch History & Real-Time Delivery Log</div>
            <span style="font-size: 12px; color: var(--text-muted);">
              Audit trail of all SMS and WhatsApp messages sent to parents across published college notices.
            </span>
          </div>
          <button id="btn-refresh-history" class="btn btn-secondary btn-sm">🔄 Refresh Logs</button>
        </div>
        <div class="card-box-body" style="padding: 0;">
          <div id="history-logs-placeholder" style="padding: 30px; text-align: center; color: var(--text-muted);">
            <div class="spinner" style="margin: 0 auto 12px auto;"></div>
            Loading delivery audit logs...
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-refresh-history').addEventListener('click', loadDispatchLogs);
    loadDispatchLogs();
  }

  async function loadDispatchLogs() {
    const placeholder = document.getElementById('history-logs-placeholder');
    if (!placeholder) return;

    try {
      const res = await fetch('/api/admin/notices?status=PUBLISHED&limit=20', { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const published = data.notices || [];

      if (published.length === 0) {
        placeholder.innerHTML = `
          <div style="padding: 30px; text-align: center; color: var(--text-muted);">
            No published notices with parent notifications logged yet.
          </div>
        `;
        return;
      }

      placeholder.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Notice Title</th>
                <th>Notice Type</th>
                <th>Target Audience</th>
                <th>Channels</th>
                <th>Dispatched At</th>
                <th>Notifications Logged</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${published.map(n => `
                <tr>
                  <td><strong>${n.title}</strong></td>
                  <td>${getTypeBadge(n.noticeType)}</td>
                  <td>${n.targetType}</td>
                  <td>${getChannelPill(n.deliveryChannel)}</td>
                  <td>${formatDateTimeDisplay(n.publishedAt)}</td>
                  <td>
                    <span class="badge badge-success" style="font-weight: 700;">
                      ${n.totalNotificationsDispatched} messages
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-secondary btn-action-view" data-id="${n.id}">
                      View Log ➔
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      placeholder.querySelectorAll('.btn-action-view').forEach(b => {
        b.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          openPreviewModal(id);
        });
      });

    } catch (err) {
      placeholder.innerHTML = `<div style="color: #fb7185; padding: 20px;">Failed to load logs: ${err.message}</div>`;
    }
  }

  // Initial boot
  loadMetadata().then(() => {
    renderShell();
  });
}
