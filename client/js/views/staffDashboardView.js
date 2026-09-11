import { Auth } from '../auth.js';

/**
 * Restricted Staff Dashboard View
 * Strictly displays information required for marks management:
 * - Cards: Assigned Classes, Assigned Subjects, Total Students, Pending Marks, Completed Assessments
 * - Sections: My Classes, My Subjects, Recent Marks Uploads
 * - Quick Actions: Upload Marks, Enter Marks, View Assigned Students, View Assigned Performance
 * 
 * Strict Negative Boundary: Scoped exclusively to teacher marks management and assessment operations.
 */
export function renderStaffDashboardView(container, switchTab) {
  const user = Auth.getUser();

  container.innerHTML = `
    <div class="staff-dashboard-wrapper">
      
      <!-- Faculty Command Header -->
      <div class="card-box" style="margin-bottom: 24px; border-left: 4px solid #10b981;">
        <div class="card-box-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <h1 class="card-box-title" style="margin: 0; font-size: 20px;">Marks Management Dashboard</h1>
              <span class="role-pill badge-staff">Restricted Faculty Clearance</span>
            </div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
              Welcome back, <strong>${escapeHtml(user?.name || 'Faculty Member')}</strong> (${escapeHtml(user?.email)}). Academic console strictly scoped to your teaching allocations.
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span id="staff-dash-acad-year" class="role-pill badge-neutral" style="font-size: 12px; padding: 4px 10px;">
              Loading term...
            </span>
            <button id="btn-refresh-staff-dash" class="btn btn-secondary btn-sm" title="Refresh Dashboard">
              <span>🔄</span> Refresh
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Actions Grid (4 Mandatory Actions) -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 10px;">
          Quick Actions
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          
          <button id="qa-btn-upload-marks" class="btn btn-primary" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 14px 18px; text-align: left; height: auto;">
            <div style="font-size: 22px; line-height: 1;">📤</div>
            <div>
              <div style="font-weight: 700; font-size: 14px;">Upload Marks</div>
              <div style="font-size: 11px; opacity: 0.85; font-weight: 400;">Batch Excel/CSV upload</div>
            </div>
          </button>

          <button id="qa-btn-enter-marks" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 14px 18px; text-align: left; height: auto; border: 1px solid rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.08);">
            <div style="font-size: 22px; line-height: 1;">📝</div>
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #34d399;">Enter Marks</div>
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 400;">Direct student grading</div>
            </div>
          </button>

          <button id="qa-btn-view-students" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 14px 18px; text-align: left; height: auto; border: 1px solid var(--border-subtle);">
            <div style="font-size: 22px; line-height: 1;">👥</div>
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #ffffff;">View Assigned Students</div>
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 400;">Enrolled class rosters</div>
            </div>
          </button>

          <button id="qa-btn-view-performance" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 14px 18px; text-align: left; height: auto; border: 1px solid var(--border-subtle);">
            <div style="font-size: 22px; line-height: 1;">📈</div>
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #ffffff;">View Assigned Performance</div>
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 400;">Section marks analysis</div>
            </div>
          </button>

        </div>
      </div>

      <!-- 5 Mandatory KPI Cards -->
      <div style="margin-bottom: 28px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 10px;">
          Marks & Assignment Overview
        </div>
        <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          
          <!-- Card 1: Assigned Classes -->
          <div class="metric-card" id="card-assigned-classes">
            <div class="metric-title">ASSIGNED CLASSES</div>
            <div class="metric-value" id="val-assigned-classes" style="color: #34d399;">—</div>
            <div class="metric-sub">Class sections assigned</div>
          </div>

          <!-- Card 2: Assigned Subjects -->
          <div class="metric-card" id="card-assigned-subjects">
            <div class="metric-title">ASSIGNED SUBJECTS</div>
            <div class="metric-value" id="val-assigned-subjects" style="color: #38bdf8;">—</div>
            <div class="metric-sub">Curriculum courses taught</div>
          </div>

          <!-- Card 3: Total Students -->
          <div class="metric-card" id="card-total-students">
            <div class="metric-title">TOTAL STUDENTS</div>
            <div class="metric-value" id="val-total-students" style="color: #a5b4fc;">—</div>
            <div class="metric-sub">Active enrolled students</div>
          </div>

          <!-- Card 4: Pending Marks -->
          <div class="metric-card" id="card-pending-marks">
            <div class="metric-title">PENDING MARKS</div>
            <div class="metric-value" id="val-pending-marks" style="color: #fbbf24;">—</div>
            <div class="metric-sub">Marks awaiting submission</div>
          </div>

          <!-- Card 5: Completed Assessments -->
          <div class="metric-card" id="card-completed-assessments">
            <div class="metric-title">COMPLETED ASSESSMENTS</div>
            <div class="metric-value" id="val-completed-assessments" style="color: #10b981;">—</div>
            <div class="metric-sub">Fully evaluated units</div>
          </div>

        </div>
      </div>

      <!-- 3 Mandatory Sections Grid -->
      <div style="display: flex; flex-direction: column; gap: 28px;">
        
        <!-- Section 1: My Classes -->
        <div class="card-box" id="section-my-classes">
          <div class="card-box-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">🏫</span>
              <div>
                <div class="card-box-title">My Classes</div>
                <div style="font-size: 12px; color: var(--text-muted);">Class sections and student rosters allocated to your instruction.</div>
              </div>
            </div>
            <span class="role-pill badge-staff" id="badge-my-classes-count">0 Classes</span>
          </div>
          <div class="card-box-body" style="padding: 0;">
            <div id="container-my-classes-table">
              <div style="text-align: center; padding: 32px; color: var(--text-muted);">Loading assigned classes...</div>
            </div>
          </div>
        </div>

        <!-- Section 2: My Subjects -->
        <div class="card-box" id="section-my-subjects">
          <div class="card-box-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">📚</span>
              <div>
                <div class="card-box-title">My Subjects</div>
                <div style="font-size: 12px; color: var(--text-muted);">Course syllabus allocations and their associated class sections.</div>
              </div>
            </div>
            <span class="role-pill badge-staff" id="badge-my-subjects-count">0 Subjects</span>
          </div>
          <div class="card-box-body" style="padding: 0;">
            <div id="container-my-subjects-table">
              <div style="text-align: center; padding: 32px; color: var(--text-muted);">Loading assigned subjects...</div>
            </div>
          </div>
        </div>

        <!-- Section 3: Recent Marks Uploads -->
        <div class="card-box" id="section-recent-marks-uploads">
          <div class="card-box-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">🕒</span>
              <div>
                <div class="card-box-title">Recent Marks Uploads</div>
                <div style="font-size: 12px; color: var(--text-muted);">Recent marks entered or uploaded by you for grading verification.</div>
              </div>
            </div>
            <span class="badge badge-neutral" id="badge-recent-uploads-count">Recent Activity</span>
          </div>
          <div class="card-box-body" style="padding: 0;">
            <div id="container-recent-uploads-table">
              <div style="text-align: center; padding: 32px; color: var(--text-muted);">Loading recent uploads...</div>
            </div>
          </div>
        </div>

      </div>

      <!-- Scoped Access Security Banner -->
      <div class="redirect-notice" style="margin-top: 28px; border-left-color: #10b981;">
        <span style="font-weight: 700; color: #34d399;">🔒 Scoped Marks Management Clearance:</span>
        <span>
          This portal strictly grants access to information and actions required for marks management in your allocated classes. All administrative systems, college-wide analytics, notice broadcasts, reports, and system settings are strictly inaccessible.
        </span>
      </div>

    </div>
  `;

  // Wire Quick Action Buttons
  const btnUpload = document.getElementById('qa-btn-upload-marks');
  const btnEnter = document.getElementById('qa-btn-enter-marks');
  const btnStudents = document.getElementById('qa-btn-view-students');
  const btnPerf = document.getElementById('qa-btn-view-performance');
  const btnRefresh = document.getElementById('btn-refresh-staff-dash');

  if (btnUpload) btnUpload.addEventListener('click', () => switchTab('upload'));
  if (btnEnter) btnEnter.addEventListener('click', () => switchTab('management'));
  if (btnStudents) btnStudents.addEventListener('click', () => {
    // If on dashboard, scroll to My Classes section smoothly
    const section = document.getElementById('section-my-classes');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
    else switchTab('classes');
  });
  if (btnPerf) btnPerf.addEventListener('click', () => switchTab('performance'));
  if (btnRefresh) btnRefresh.addEventListener('click', () => loadStaffDashboardData());

  // Initial load
  loadStaffDashboardData();

  function loadStaffDashboardData() {
    fetch('/api/staff/dashboard-summary', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        renderSummaryCards(data.summary);
        renderMyClassesSection(data.myClasses || data.assignedClasses || []);
        renderMySubjectsSection(data.mySubjects || []);
        renderRecentUploadsSection(data.recentMarksUploads || []);
      })
      .catch(err => {
        console.error('Failed to load staff dashboard data:', err);
        const errHtml = `<div style="text-align: center; padding: 32px; color: #f43f5e;">Failed to load data. Please refresh.</div>`;
        const c1 = document.getElementById('container-my-classes-table');
        const c2 = document.getElementById('container-my-subjects-table');
        const c3 = document.getElementById('container-recent-uploads-table');
        if (c1) c1.innerHTML = errHtml;
        if (c2) c2.innerHTML = errHtml;
        if (c3) c3.innerHTML = errHtml;
      });
  }

  function renderSummaryCards(summary) {
    if (!summary) return;
    const termEl = document.getElementById('staff-dash-acad-year');
    if (termEl) termEl.textContent = summary.academicYear || 'Active Academic Session';

    const elClasses = document.getElementById('val-assigned-classes');
    const elSubjects = document.getElementById('val-assigned-subjects');
    const elStudents = document.getElementById('val-total-students');
    const elPending = document.getElementById('val-pending-marks');
    const elCompleted = document.getElementById('val-completed-assessments');

    if (elClasses) elClasses.textContent = summary.assignedClasses ?? summary.totalAssignedClasses ?? 0;
    if (elSubjects) elSubjects.textContent = summary.assignedSubjects ?? summary.totalAssignedSubjects ?? 0;
    if (elStudents) elStudents.textContent = summary.totalStudents ?? summary.totalStudentsTaught ?? 0;
    if (elPending) elPending.textContent = summary.pendingMarks ?? 0;
    if (elCompleted) elCompleted.textContent = summary.completedAssessments ?? 0;
  }

  function renderMyClassesSection(classes) {
    const container = document.getElementById('container-my-classes-table');
    const badgeCount = document.getElementById('badge-my-classes-count');
    if (!container) return;

    if (badgeCount) {
      badgeCount.textContent = `${classes.length} ${classes.length === 1 ? 'Class' : 'Classes'}`;
    }

    if (!classes || classes.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div style="font-size: 32px; margin-bottom: 8px;">🏫</div>
          <div style="font-weight: 600; color: #ffffff;">No Classes Assigned</div>
          <div style="font-size: 13px; margin-top: 4px;">You have no active class section allocations. Contact the administrator.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Class / Section</th>
            <th>Department & Year</th>
            <th>Academic Term</th>
            <th>Assigned Subjects</th>
            <th>Enrolled Students</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${classes.map(c => {
            const secName = c.sectionName || c.section || '—';
            const deptCode = c.departmentCode || c.department || '—';
            const yearName = c.yearName || c.year || '—';
            const term = c.academicYear || 'Current';
            const count = c.studentCount ?? 0;
            const subjectsList = c.subjects && Array.isArray(c.subjects) && c.subjects.length > 0
              ? c.subjects.map(s => `[${escapeHtml(s.code)}] ${escapeHtml(s.name)}`).join(', ')
              : (c.subjectCode ? `[${escapeHtml(c.subjectCode)}] ${escapeHtml(c.subjectName)}` : 'Assigned Courses');

            return `
              <tr>
                <td>
                  <span class="role-pill" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; font-weight: 700; border: 1px solid rgba(99, 102, 241, 0.35);">
                    Section ${escapeHtml(secName)}
                  </span>
                </td>
                <td>
                  <strong style="color: #ffffff;">${escapeHtml(deptCode)}</strong> - ${escapeHtml(yearName)}
                </td>
                <td>
                  <span class="role-pill badge-neutral">${escapeHtml(term)}</span>
                </td>
                <td>
                  <div style="font-size: 13px; color: #e2e8f0; font-weight: 500;">
                    ${escapeHtml(subjectsList)}
                  </div>
                </td>
                <td>
                  <span class="role-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);">
                    👥 ${count} Students
                  </span>
                </td>
                <td style="text-align: right;">
                  <button class="btn btn-primary btn-xs btn-action-enter-marks" data-section-id="${c.sectionId || ''}">
                    <span>📝</span> Enter Marks
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.btn-action-enter-marks').forEach(btn => {
      btn.addEventListener('click', () => switchTab('management'));
    });
  }

  function renderMySubjectsSection(subjects) {
    const container = document.getElementById('container-my-subjects-table');
    const badgeCount = document.getElementById('badge-my-subjects-count');
    if (!container) return;

    if (badgeCount) {
      badgeCount.textContent = `${subjects.length} ${subjects.length === 1 ? 'Subject' : 'Subjects'}`;
    }

    if (!subjects || subjects.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div style="font-size: 32px; margin-bottom: 8px;">📚</div>
          <div style="font-weight: 600; color: #ffffff;">No Subjects Assigned</div>
          <div style="font-size: 13px; margin-top: 4px;">You have no active subject allocations. Contact the administrator.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Subject Title</th>
            <th>Department</th>
            <th>Semester</th>
            <th>Assigned Sections</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${subjects.map(s => {
            const sections = s.sections || [];
            return `
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
                  <span class="role-pill badge-neutral">${escapeHtml(s.departmentCode || s.department?.code || '—')}</span>
                </td>
                <td>
                  <span class="role-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);">
                    Sem ${s.semester || '—'}
                  </span>
                </td>
                <td>
                  <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    ${sections.map(sec => `
                      <span class="role-pill badge-staff">
                        Sec ${escapeHtml(sec.sectionName)} (${sec.studentCount ?? 0} students)
                      </span>
                    `).join('')}
                  </div>
                </td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-xs btn-action-upload-subject" data-subject-id="${s.subjectId || ''}">
                    <span>📤</span> Upload Marks
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.btn-action-upload-subject').forEach(btn => {
      btn.addEventListener('click', () => switchTab('upload'));
    });
  }

  function renderRecentUploadsSection(uploads) {
    const container = document.getElementById('container-recent-uploads-table');
    const badgeCount = document.getElementById('badge-recent-uploads-count');
    if (!container) return;

    if (badgeCount) {
      badgeCount.textContent = uploads.length > 0 ? `${uploads.length} Recorded` : 'No Recent Uploads';
    }

    if (!uploads || uploads.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
          <div style="font-weight: 600; color: #ffffff;">No Recent Marks Uploads</div>
          <div style="font-size: 13px; margin-top: 4px;">Marks uploaded or entered will appear here for verification.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Section</th>
            <th>Assessment</th>
            <th>Records Count</th>
            <th>Timestamp</th>
            <th style="text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${uploads.map(u => {
            const timeStr = u.timestamp ? new Date(u.timestamp).toLocaleString() : 'Just now';
            return `
              <tr>
                <td>
                  <strong style="color: #ffffff;">[${escapeHtml(u.subjectCode)}]</strong> ${escapeHtml(u.subjectName)}
                </td>
                <td>
                  <span class="role-pill" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.35);">
                    Sec ${escapeHtml(u.sectionName)}
                  </span>
                </td>
                <td>
                  <span class="role-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);">
                    ${escapeHtml(u.assessmentName || u.assessmentCode || 'Assessment')}
                  </span>
                </td>
                <td>
                  <strong style="color: #34d399;">${u.recordsCount || 1}</strong> marks
                </td>
                <td style="font-size: 12px; color: var(--text-muted);">
                  ${escapeHtml(timeStr)}
                </td>
                <td style="text-align: right;">
                  <span class="badge badge-success">Recorded</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

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
