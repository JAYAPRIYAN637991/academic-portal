import { Auth } from '../auth.js';
import { renderMarksUploadView } from './marksUploadView.js';
import { renderStaffDashboardView } from './staffDashboardView.js';

export function renderStaffLayout(container, router) {
  const user = Auth.getUser();

  container.innerHTML = `
    <div id="layout-wrapper">
      
      <!-- Staff Sidebar (Restricted Faculty Portal ONLY) -->
      <aside class="sidebar" style="border-right: 1px solid rgba(16, 185, 129, 0.2);">
        <div class="sidebar-brand">
          <div class="sidebar-logo-icon" style="background: linear-gradient(135deg, #059669, #047857);">👨‍🏫</div>
          <div>
            <div class="sidebar-brand-title">Faculty Portal</div>
            <div class="sidebar-brand-sub" style="color: #34d399;">Teaching & Grading Console</div>
          </div>
        </div>

        <!-- Strict Staff Navigation: ONLY the 6 allowed faculty marks modules -->
        <nav class="sidebar-nav">
          <div class="nav-section-title">Teaching Workspace</div>
          <div class="nav-link active" data-staff-tab="dashboard">
            <span>📊</span> Dashboard
          </div>
          <div class="nav-link" data-staff-tab="classes">
            <span>🏫</span> My Classes
          </div>
          <div class="nav-link" data-staff-tab="subjects">
            <span>📚</span> My Subjects
          </div>

          <div class="nav-section-title">Assessments & Grading</div>
          <div class="nav-link" data-staff-tab="upload">
            <span>📤</span> Marks Upload
          </div>
          <div class="nav-link" data-staff-tab="management">
            <span>📝</span> Marks Management
          </div>
          <div class="nav-link" data-staff-tab="performance">
            <span>📈</span> Student Performance
          </div>
        </nav>

        <div class="sidebar-footer">
          <div class="user-profile-badge">
            <div class="avatar" style="background: #059669;">${user?.name ? user.name[0] : 'S'}</div>
            <div class="user-info">
              <div class="user-name">${user?.name || 'Faculty Member'}</div>
              <span class="role-pill badge-staff">${user?.role || 'STAFF'}</span>
            </div>
          </div>
          <button id="staff-logout-btn" class="btn btn-secondary btn-block btn-sm" style="margin-top: 10px;">
            Sign Out
          </button>
        </div>
      </aside>

      <!-- Staff Main Content -->
      <div class="main-wrapper">
        <header class="topbar" style="border-bottom: 1px solid rgba(16, 185, 129, 0.2);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="topbar-title" id="staff-page-title">Marks Management Dashboard</div>
            <span class="role-pill badge-staff">Restricted Faculty Clearance</span>
          </div>
          <div class="topbar-actions">
            <span style="font-size: 13px; color: var(--text-muted);">${user?.email}</span>
            <button id="topbar-staff-logout" class="btn btn-secondary btn-sm">Sign Out</button>
          </div>
        </header>

        <main class="content-container" id="staff-content-area">
          <!-- Content dynamically loaded here -->
        </main>
      </div>

    </div>
  `;

  // Logout Handlers
  const handleLogout = () => {
    Auth.logout();
    window.dispatchEvent(new CustomEvent('toast-notify', {
      detail: { message: 'Faculty member signed out successfully.', type: 'info' }
    }));
    router.navigate('/staff/login');
  };

  const btnLogout = document.getElementById('staff-logout-btn');
  const btnTopbarLogout = document.getElementById('topbar-staff-logout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
  if (btnTopbarLogout) btnTopbarLogout.addEventListener('click', handleLogout);

  // Tab Navigation Switching
  function switchTab(tabName) {
    const navLinks = container.querySelectorAll('.nav-link');
    navLinks.forEach(l => l.classList.remove('active'));

    const activeLink = container.querySelector(`[data-staff-tab="${tabName}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
      const title = activeLink.textContent.replace(/^[^\w]+/, '').trim();
      const titleEl = document.getElementById('staff-page-title');
      if (titleEl) titleEl.textContent = title;
    }

    const contentArea = document.getElementById('staff-content-area');
    if (!contentArea) return;

    if (tabName === 'dashboard') {
      renderStaffDashboardView(contentArea, switchTab);
    } else if (tabName === 'classes') {
      renderMyClassesView(contentArea, switchTab);
    } else if (tabName === 'subjects') {
      renderMySubjectsView(contentArea, switchTab);
    } else if (tabName === 'upload' || tabName === 'management') {
      renderMarksUploadView(contentArea);
    } else if (tabName === 'performance') {
      renderStudentPerformanceView(contentArea, switchTab);
    } else {
      renderStaffDashboardView(contentArea, switchTab);
    }
  }

  // Bind Sidebar Nav Links
  container.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-staff-tab');
      if (tab) switchTab(tab);
    });
  });

  // ========================================================
  // VIEW: My Classes View
  // ========================================================
  function renderMyClassesView(contentArea, switchTabFn) {
    contentArea.innerHTML = `
      <div class="card-box" style="border-left: 4px solid #10b981;">
        <div class="card-box-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="card-box-title">My Teaching Allocations & Classes</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
              Enrolled students and sections authorized for your marks grading.
            </div>
          </div>
          <span class="role-pill badge-staff" id="classes-view-count">Loading...</span>
        </div>

        <div class="card-box-body">
          <div id="classes-view-table-container">
            <div style="text-align: center; padding: 32px; color: var(--text-muted);">
              Loading teaching allocations...
            </div>
          </div>

          <div class="redirect-notice" style="margin-top: 24px; border-left-color: #10b981;">
            <span>🔒 Zero-Trust Class Scoping:</span>
            <span>You can only access student marks and rosters for class sections officially assigned to you. Unassigned requests are blocked.</span>
          </div>
        </div>
      </div>
    `;

    fetch('/api/staff/assigned-classes', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    })
      .then(r => r.json())
      .then(data => {
        const tableBox = document.getElementById('classes-view-table-container');
        const countBadge = document.getElementById('classes-view-count');
        if (!tableBox) return;

        const list = data.assignedClasses || [];
        if (countBadge) countBadge.textContent = `${list.length} Allocations`;

        if (list.length === 0) {
          tableBox.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-dim);">
              <div style="font-size: 32px; margin-bottom: 8px;">📚</div>
              <div style="font-weight: 600; color: #ffffff;">No Teaching Allocations Yet</div>
              <div style="font-size: 13px; margin-top: 4px;">Contact your administrator to assign you to class sections.</div>
            </div>
          `;
          return;
        }

        tableBox.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Academic Year</th>
                <th>Department & Year</th>
                <th>Section</th>
                <th>Subject</th>
                <th>Enrolled Students</th>
                <th style="text-align: right;">Marks Actions</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(a => `
                <tr>
                  <td>
                    <span class="role-pill badge-neutral">${escapeHtml(a.academicYear?.yearName || a.academicYear || 'Current')}</span>
                  </td>
                  <td>
                    <strong style="color: #ffffff;">${escapeHtml(a.section?.department?.code || a.department || '—')}</strong> - ${escapeHtml(a.section?.year?.name || a.year || '—')}
                  </td>
                  <td>
                    <span class="role-pill" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.35);">
                      Section ${escapeHtml(a.section?.name || a.section || '—')}
                    </span>
                  </td>
                  <td>
                    <div style="font-weight: 600; color: #ffffff;">[${escapeHtml(a.subject?.code || a.subjectCode)}] ${escapeHtml(a.subject?.name || a.subjectName)}</div>
                  </td>
                  <td>
                    <span class="role-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);">
                      👥 ${a.studentCount ?? 0} Students
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-primary btn-xs btn-enter-marks-jump" data-section="${a.sectionId}" data-subject="${a.subjectId}">
                      <span>📝</span> Enter Marks
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        tableBox.querySelectorAll('.btn-enter-marks-jump').forEach(btn => {
          btn.addEventListener('click', () => switchTabFn('management'));
        });
      })
      .catch(err => {
        const tableBox = document.getElementById('classes-view-table-container');
        if (tableBox) tableBox.innerHTML = `<div style="padding: 20px; color: #f43f5e;">Failed to load classes.</div>`;
      });
  }

  // ========================================================
  // VIEW: My Subjects View
  // ========================================================
  function renderMySubjectsView(contentArea, switchTabFn) {
    contentArea.innerHTML = `
      <div class="card-box" style="border-left: 4px solid #38bdf8;">
        <div class="card-box-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="card-box-title">My Assigned Subjects</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
              Curriculum courses allocated to you by the Administrator.
            </div>
          </div>
          <span class="role-pill badge-staff">Faculty Allocated Only</span>
        </div>
        <div class="card-box-body">
          <div id="staff-subjects-table-container">
            <div style="text-align: center; padding: 32px; color: var(--text-muted);">
              Loading assigned subjects...
            </div>
          </div>
        </div>
      </div>
    `;

    fetch('/api/staff/subjects', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    })
      .then(r => r.json())
      .then(data => {
        const tableBox = document.getElementById('staff-subjects-table-container');
        if (!tableBox) return;

        const subjects = data.subjects || [];
        if (subjects.length === 0) {
          tableBox.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-dim);">
              <div style="font-size: 32px; margin-bottom: 8px;">📚</div>
              <div style="font-weight: 600; color: #ffffff;">No Subjects Assigned</div>
              <div style="font-size: 13px; margin-top: 4px;">You currently have no course allocations assigned.</div>
            </div>
          `;
          return;
        }

        tableBox.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Subject Code</th>
                <th>Subject Name</th>
                <th>Department</th>
                <th>Semester</th>
                <th>Maximum Marks</th>
                <th>Assigned Sections</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${subjects.map(s => `
                <tr>
                  <td>
                    <span class="role-pill" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; font-weight: 700; border: 1px solid rgba(99, 102, 241, 0.35);">
                      ${escapeHtml(s.code)}
                    </span>
                  </td>
                  <td>
                    <strong style="color: #ffffff;">${escapeHtml(s.name)}</strong>
                  </td>
                  <td>
                    <span class="role-pill badge-neutral">${escapeHtml(s.department?.code || s.departmentCode || '—')}</span>
                  </td>
                  <td>
                    <span class="role-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);">
                      Semester ${s.semester || '—'}
                    </span>
                  </td>
                  <td>
                    <strong style="color: #ffffff;">${s.maximumMarks || 100}</strong> pts
                  </td>
                  <td>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                      ${(s.assignedSections || []).map(sec => `
                        <span class="role-pill badge-staff">
                          Sec ${escapeHtml(sec.sectionName)}
                        </span>
                      `).join('')}
                    </div>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-xs btn-subject-upload-jump" data-subject="${s.id}">
                      <span>📤</span> Upload Marks
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        tableBox.querySelectorAll('.btn-subject-upload-jump').forEach(btn => {
          btn.addEventListener('click', () => switchTabFn('upload'));
        });
      })
      .catch(err => {
        const tableBox = document.getElementById('staff-subjects-table-container');
        if (tableBox) {
          tableBox.innerHTML = `<div style="padding: 20px; color: #f43f5e;">Failed to load assigned subjects.</div>`;
        }
      });
  }

  // ========================================================
  // VIEW: Student Performance View (Scoped Section Performance)
  // ========================================================
  function renderStudentPerformanceView(contentArea, switchTabFn) {
    contentArea.innerHTML = `
      <div class="card-box" style="border-left: 4px solid #6366f1;">
        <div class="card-box-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="card-box-title">Assigned Class Performance</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
              View marks distribution, average grades, and pass percentages for your assigned classes.
            </div>
          </div>
          <span class="role-pill badge-staff">Faculty Scoped Performance</span>
        </div>

        <div class="card-box-body">
          <div style="display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; background: rgba(255,255,255,0.02); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="flex: 1; min-width: 250px;">
              <label class="form-label">Select Assigned Class & Subject</label>
              <select id="perf-class-selector" class="form-select">
                <option value="">Loading your classes...</option>
              </select>
            </div>
          </div>

          <div id="perf-results-container">
            <div style="text-align: center; padding: 48px; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">📈</div>
              <div style="font-weight: 600; color: #ffffff;">Select an Allocated Class</div>
              <div style="font-size: 13px; margin-top: 4px;">Choose a class section above to view marks statistics and performance metrics.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Fetch assigned classes
    fetch('/api/staff/assigned-classes', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    })
      .then(r => r.json())
      .then(data => {
        const sel = document.getElementById('perf-class-selector');
        if (!sel) return;
        const list = data.assignedClasses || [];
        if (list.length === 0) {
          sel.innerHTML = `<option value="">No classes allocated</option>`;
          return;
        }

        sel.innerHTML = `<option value="">-- Choose Class & Subject --</option>` + list.map(a => `
          <option value="${a.id}" data-section-id="${a.sectionId}" data-subject-id="${a.subjectId}">
            [${escapeHtml(a.subject?.code || a.subjectCode)}] ${escapeHtml(a.subject?.name || a.subjectName)} - Sec ${escapeHtml(a.section?.name || a.section)} (${escapeHtml(a.section?.department?.code || a.department)})
          </option>
        `).join('');

        sel.addEventListener('change', () => {
          const selected = sel.options[sel.selectedIndex];
          const secId = selected.getAttribute('data-section-id');
          const subId = selected.getAttribute('data-subject-id');

          if (!secId || !subId) return;
          loadSectionPerformance(secId, subId);
        });
      });

    function loadSectionPerformance(sectionId, subjectId) {
      const container = document.getElementById('perf-results-container');
      if (!container) return;
      container.innerHTML = `<div style="text-align: center; padding: 32px; color: var(--text-muted);">Calculating section marks performance...</div>`;

      fetch(`/api/staff/analytics/section?sectionId=${sectionId}&subjectId=${subjectId}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(data => {
          const s = data.summary || {};
          const marksCount = data.marksCount || 0;

          container.innerHTML = `
            <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 24px;">
              <div class="metric-card">
                <div class="metric-title">TOTAL MARKS RECORDED</div>
                <div class="metric-value" style="color: #38bdf8;">${marksCount}</div>
                <div class="metric-sub">Evaluated entries</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">AVERAGE SCORE</div>
                <div class="metric-value" style="color: #34d399;">${s.averageMarks ? s.averageMarks.toFixed(1) : (s.averageScore ? s.averageScore.toFixed(1) : '—')}</div>
                <div class="metric-sub">Class Mean</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">PASS PERCENTAGE</div>
                <div class="metric-value" style="color: #fbbf24;">${s.passPercentage ? s.passPercentage.toFixed(1) + '%' : '—'}</div>
                <div class="metric-sub">Passing threshold >= 50%</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">HIGHEST SCORE</div>
                <div class="metric-value" style="color: #a5b4fc;">${s.highestMark ?? s.highestScore ?? '—'}</div>
                <div class="metric-sub">Top mark achieved</div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button class="btn btn-primary btn-sm" id="btn-perf-enter-marks">
                <span>📝</span> Enter / Update Marks
              </button>
            </div>
          `;

          const btnEnter = document.getElementById('btn-perf-enter-marks');
          if (btnEnter) btnEnter.addEventListener('click', () => switchTabFn('management'));
        })
        .catch(err => {
          container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #f43f5e;">
              <div>Failed to load performance metrics.</div>
              <div style="font-size: 12px; margin-top: 4px; color: var(--text-muted);">Ensure marks have been entered for this class.</div>
            </div>
          `;
        });
    }
  }

  // Initial tab load
  switchTab('dashboard');

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
