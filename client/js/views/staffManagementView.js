import { Auth } from '../auth.js';

export function renderStaffManagementView(container) {
  let staffList = [];
  let overviewData = { academicYears: [], departments: [], years: [] };
  let allSections = [];
  let allSubjects = [];

  let searchTerm = '';
  let statusFilter = 'all';

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Auth.getToken()}`
    };
  }

  function showNotification(message, type = 'info') {
    window.dispatchEvent(new CustomEvent('toast-notify', {
      detail: { message, type }
    }));
  }

  async function loadInitialData() {
    try {
      const [overviewRes, sectionsRes, subjectsRes] = await Promise.all([
        fetch('/api/admin/academic-structure/overview', { headers: getHeaders() }),
        fetch('/api/admin/sections', { headers: getHeaders() }),
        fetch('/api/admin/subjects', { headers: getHeaders() })
      ]);

      if (overviewRes.ok) overviewData = await overviewRes.json();
      if (sectionsRes.ok) {
        const secData = await sectionsRes.json();
        allSections = secData.sections || [];
      }
      if (subjectsRes.ok) {
        const subData = await subjectsRes.json();
        allSubjects = subData.subjects || [];
      }
    } catch (err) {
      console.error('Failed to load initial metadata:', err);
    }
  }

  async function loadStaffList() {
    const tableDiv = container.querySelector('#staff-table-container');
    if (!tableDiv) return;

    let url = `/api/admin/staff?search=${encodeURIComponent(searchTerm)}`;
    if (statusFilter !== 'all') url += `&status=${statusFilter}`;

    try {
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      staffList = data.staff || [];

      renderTable();
    } catch (err) {
      console.error('Failed to load staff list:', err);
      tableDiv.innerHTML = `<div style="color: #fb7185; padding: 20px;">Failed to load staff records.</div>`;
    }
  }

  function renderTable() {
    const tableDiv = container.querySelector('#staff-table-container');
    if (!tableDiv) return;

    if (staffList.length === 0) {
      tableDiv.innerHTML = `
        <div style="text-align: center; padding: 48px; border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
          <div style="font-size: 36px; margin-bottom: 8px;">👨‍🏫</div>
          <div style="font-weight: 700; color: #ffffff; font-size: 15px;">No Faculty Members Found</div>
          <div style="font-size: 13px; color: var(--text-dim); margin-top: 4px;">
            No faculty accounts match your current search and filter criteria.
          </div>
        </div>
      `;
      return;
    }

    tableDiv.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Faculty Member</th>
              <th>Email Address</th>
              <th>Status</th>
              <th>Active Allocations</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${staffList.map(s => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="avatar" style="background: linear-gradient(135deg, #059669, #047857);">
                      ${escapeHtml(s.name ? s.name[0] : 'S')}
                    </div>
                    <div>
                      <div style="font-weight: 700; color: #ffffff;">${escapeHtml(s.name)}</div>
                      <div style="font-size: 11px; color: var(--text-dim);">ID: ${escapeHtml(s.id.substring(0, 8))}...</div>
                    </div>
                  </div>
                </td>
                <td style="font-family: monospace; font-size: 13px; color: var(--text-main);">
                  ${escapeHtml(s.email)}
                </td>
                <td>
                  <button class="status-toggle-pill ${s.isActive ? 'active' : 'inactive'}" data-staff-id="${s.id}" data-action="toggle-status">
                    ${s.isActive ? '● Active' : '○ Deactivated'}
                  </button>
                </td>
                <td>
                  <span class="role-pill" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.35);">
                    ${s.assignmentsCount} ${s.assignmentsCount === 1 ? 'Class' : 'Classes'}
                  </span>
                </td>
                <td style="text-align: right;">
                  <div style="display: inline-flex; gap: 8px;">
                    <button class="btn btn-primary btn-xs" data-staff-id="${s.id}" data-action="manage-assignments" title="Assign Class & Subject">
                      <span>🏫</span> Allocations
                    </button>
                    <button class="btn btn-secondary btn-xs" data-staff-id="${s.id}" data-action="reset-password" title="Reset Password">
                      <span>🔑</span> Reset
                    </button>
                    <button class="btn btn-secondary btn-xs" data-staff-id="${s.id}" data-action="edit-staff" title="Edit Profile">
                      <span>✏️</span>
                    </button>
                    <button class="btn btn-danger btn-xs" data-staff-id="${s.id}" data-action="delete-staff" title="Delete Account">
                      <span>🗑️</span>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    bindTableEvents();
  }

  function render() {
    container.innerHTML = `
      <div class="staff-management-container">
        <!-- Faculty Authority Notice -->
        <div class="privacy-banner" style="background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.3);">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="font-size: 28px;">🧑‍🏫</div>
            <div>
              <div style="font-size: 14px; font-weight: 700; color: #ffffff;">Faculty Account & Teaching Allocations Governance</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                Administrators manage faculty accounts and class-subject mappings. Staff can strictly access marks only for their allocated subjects and sections.
              </div>
            </div>
          </div>
          <div class="role-pill badge-admin" style="font-size: 11px;">Admin Authority</div>
        </div>

        <div class="card-box" style="margin-top: 20px;">
          <div class="card-box-header" style="flex-wrap: wrap; gap: 16px;">
            <div>
              <div class="card-box-title">Faculty & Staff Directory</div>
              <div style="font-size: 13px; color: var(--text-muted);">
                Authorized academic teaching staff, course allocations, and system credentials
              </div>
            </div>
            <button id="btn-create-staff" class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px;">
              <span>➕</span> Register Faculty Member
            </button>
          </div>

          <!-- Filter & Search Bar -->
          <div class="cascade-filter-bar" style="margin-top: 0; border-top: none; border-left: none; border-right: none; border-radius: 0;">
            <div class="filter-col" style="flex: 2; min-width: 240px;">
              <label class="filter-label">Search Faculty</label>
              <input type="text" id="staff-search-input" class="form-input" placeholder="Search by faculty name or email..." value="${escapeHtml(searchTerm)}" style="padding-left: 14px;" />
            </div>

            <div class="filter-col">
              <label class="filter-label">Account Status</label>
              <select id="staff-status-filter" class="form-input form-select">
                <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Faculty Accounts</option>
                <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>Active Accounts Only</option>
                <option value="inactive" ${statusFilter === 'inactive' ? 'selected' : ''}>Deactivated Accounts Only</option>
              </select>
            </div>
          </div>

          <div class="card-box-body" id="staff-table-container">
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
              Loading faculty directory...
            </div>
          </div>
        </div>
      </div>
    `;

    bindHeaderEvents();
    loadStaffList();
  }

  function bindHeaderEvents() {
    const searchInp = container.querySelector('#staff-search-input');
    const statusSel = container.querySelector('#staff-status-filter');
    const btnCreate = container.querySelector('#btn-create-staff');

    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        loadStaffList();
      });
    }

    if (statusSel) {
      statusSel.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        loadStaffList();
      });
    }

    if (btnCreate) {
      btnCreate.addEventListener('click', () => {
        openCreateStaffModal();
      });
    }
  }

  function bindTableEvents() {
    const tableDiv = container.querySelector('#staff-table-container');
    if (!tableDiv) return;

    // Status Toggle
    tableDiv.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const staffId = e.currentTarget.getAttribute('data-staff-id');
        try {
          const res = await fetch(`/api/admin/staff/${staffId}/status`, {
            method: 'PATCH',
            headers: getHeaders()
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          showNotification(data.message, 'success');
          loadStaffList();
        } catch (err) {
          showNotification(err.message, 'error');
        }
      });
    });

    // Reset Password
    tableDiv.querySelectorAll('[data-action="reset-password"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const staffId = e.currentTarget.getAttribute('data-staff-id');
        const staff = staffList.find(s => s.id === staffId);
        if (staff) openResetPasswordModal(staff);
      });
    });

    // Edit Staff
    tableDiv.querySelectorAll('[data-action="edit-staff"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const staffId = e.currentTarget.getAttribute('data-staff-id');
        const staff = staffList.find(s => s.id === staffId);
        if (staff) openEditStaffModal(staff);
      });
    });

    // Manage Assignments
    tableDiv.querySelectorAll('[data-action="manage-assignments"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const staffId = e.currentTarget.getAttribute('data-staff-id');
        const staff = staffList.find(s => s.id === staffId);
        if (staff) openManageAssignmentsModal(staff);
      });
    });

    // Delete Staff
    tableDiv.querySelectorAll('[data-action="delete-staff"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const staffId = e.currentTarget.getAttribute('data-staff-id');
        const staff = staffList.find(s => s.id === staffId);
        if (!staff) return;

        const confirmed = confirm(`Are you sure you want to delete the faculty account for ${staff.name}? This cannot be undone.`);
        if (!confirmed) return;

        try {
          const res = await fetch(`/api/admin/staff/${staffId}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          showNotification(data.message, 'success');
          loadStaffList();
        } catch (err) {
          alert('Deletion Blocked:\n' + err.message);
        }
      });
    });
  }

  // ========================================================
  // MODAL: CREATE STAFF
  // ========================================================
  function openCreateStaffModal() {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';

    modalBackdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">Register Faculty Member</div>
          <button class="btn-close-modal">&times;</button>
        </div>
        <form id="create-staff-form">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="staff-name" class="form-input" placeholder="e.g. Prof. Arvind Raman" required style="padding-left: 14px;" />
          </div>
          <div class="form-group">
            <label class="form-label">Official College Email</label>
            <input type="email" id="staff-email" class="form-input" placeholder="e.g. arvind.cse@college.edu" required style="padding-left: 14px;" />
          </div>
          <div class="form-group">
            <label class="form-label">Temporary Password (Min 6 chars)</label>
            <input type="password" id="staff-password" class="form-input" placeholder="••••••••" required minlength="6" style="padding-left: 14px;" />
          </div>
          <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Faculty Account</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalBackdrop);

    modalBackdrop.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalBackdrop.remove());
    });

    const form = modalBackdrop.querySelector('#create-staff-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modalBackdrop.querySelector('#staff-name').value;
      const email = modalBackdrop.querySelector('#staff-email').value;
      const password = modalBackdrop.querySelector('#staff-password').value;

      try {
        const res = await fetch('/api/admin/staff', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showNotification(data.message, 'success');
        modalBackdrop.remove();
        loadStaffList();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ========================================================
  // MODAL: EDIT STAFF
  // ========================================================
  function openEditStaffModal(staff) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';

    modalBackdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">Edit Faculty Profile</div>
          <button class="btn-close-modal">&times;</button>
        </div>
        <form id="edit-staff-form">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="edit-staff-name" class="form-input" value="${escapeHtml(staff.name)}" required style="padding-left: 14px;" />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="edit-staff-email" class="form-input" value="${escapeHtml(staff.email)}" required style="padding-left: 14px;" />
          </div>
          <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalBackdrop);

    modalBackdrop.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalBackdrop.remove());
    });

    const form = modalBackdrop.querySelector('#edit-staff-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modalBackdrop.querySelector('#edit-staff-name').value;
      const email = modalBackdrop.querySelector('#edit-staff-email').value;

      try {
        const res = await fetch(`/api/admin/staff/${staff.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ name, email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showNotification(data.message, 'success');
        modalBackdrop.remove();
        loadStaffList();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ========================================================
  // MODAL: RESET PASSWORD
  // ========================================================
  function openResetPasswordModal(staff) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';

    modalBackdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">Reset Faculty Password</div>
          <button class="btn-close-modal">&times;</button>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 18px;">
          Set a new login password for <strong>${escapeHtml(staff.name)}</strong> (<code>${escapeHtml(staff.email)}</code>).
        </p>
        <form id="reset-pwd-form">
          <div class="form-group">
            <label class="form-label">New Password (Min 6 characters)</label>
            <input type="password" id="new-password" class="form-input" placeholder="••••••••" required minlength="6" style="padding-left: 14px;" />
          </div>
          <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalBackdrop);

    modalBackdrop.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => modalBackdrop.remove());
    });

    const form = modalBackdrop.querySelector('#reset-pwd-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = modalBackdrop.querySelector('#new-password').value;

      try {
        const res = await fetch(`/api/admin/staff/${staff.id}/reset-password`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showNotification(data.message, 'success');
        modalBackdrop.remove();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ========================================================
  // MODAL: MANAGE ASSIGNMENTS (Staff + AcadYear + Dept + Yr + Sec + Subj)
  // ========================================================
  async function openManageAssignmentsModal(staff) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';

    let assignments = [];

    async function fetchAssignments() {
      try {
        const res = await fetch(`/api/admin/staff/${staff.id}/assignments`, { headers: getHeaders() });
        const data = await res.json();
        assignments = data.assignments || [];
      } catch (err) {
        console.error('Failed to fetch assignments:', err);
      }
    }

    await fetchAssignments();

    function renderModalContent() {
      modalBackdrop.innerHTML = `
        <div class="modal-card modal-card-lg">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">🏛️</span>
              <div>
                <div class="modal-title">Class & Subject Allocations</div>
                <div style="font-size: 12px; color: var(--text-muted);">
                  Faculty: <strong style="color: #ffffff;">${escapeHtml(staff.name)}</strong> (${escapeHtml(staff.email)})
                </div>
              </div>
            </div>
            <button class="btn-close-modal">&times;</button>
          </div>

          <div class="modal-body-scroll">
            <!-- Current Assignments Section -->
            <div style="margin-bottom: 24px;">
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                <span>Current Allocated Classes (${assignments.length})</span>
              </div>

              ${assignments.length === 0 ? `
                <div style="padding: 24px; text-align: center; border: 1px dashed var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-dim); font-size: 13px;">
                  No classes or subjects currently allocated to this faculty member.
                </div>
              ` : `
                <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); overflow: hidden;">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Academic Year</th>
                        <th>Class Placement</th>
                        <th>Subject</th>
                        <th>Enrolled</th>
                        <th style="text-align: right;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${assignments.map(a => `
                        <tr>
                          <td>
                            <span class="role-pill badge-neutral">${escapeHtml(a.academicYear.yearName)}</span>
                          </td>
                          <td>
                            <strong style="color: #ffffff;">${escapeHtml(a.department.code)}</strong> - ${escapeHtml(a.year.name)}
                            <div style="font-size: 12px; color: var(--text-muted);">Section ${escapeHtml(a.section.name)}</div>
                          </td>
                          <td>
                            <div style="font-weight: 600; color: #ffffff;">[${escapeHtml(a.subject.code)}] ${escapeHtml(a.subject.name)}</div>
                            <div style="font-size: 11px; color: var(--text-dim);">Semester ${a.subject.semester}</div>
                          </td>
                          <td>
                            <span class="role-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);">
                              ${a.studentCount} Students
                            </span>
                          </td>
                          <td style="text-align: right;">
                            <button class="btn btn-danger btn-xs" data-assignment-id="${a.id}" data-action="unassign">
                              Unassign
                            </button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>

            <!-- Allocate New Class Form (Dependent Dropdowns) -->
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 20px;">
              <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
                ➕ Allocate New Class & Subject
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                Strict 6-entity structure: Staff + Academic Year + Department + Year + Section + Subject
              </div>

              <form id="assign-class-form">
                <div class="import-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
                  <!-- 1. Academic Year -->
                  <div>
                    <label class="filter-label">1. Academic Year</label>
                    <select id="assign-acad-year" class="form-input form-select" required>
                      ${overviewData.academicYears.map(y => `
                        <option value="${y.id}" ${y.isCurrent ? 'selected' : ''}>${y.yearName} ${y.isCurrent ? '★' : ''}</option>
                      `).join('')}
                    </select>
                  </div>

                  <!-- 2. Department -->
                  <div>
                    <label class="filter-label">2. Department</label>
                    <select id="assign-dept" class="form-input form-select" required>
                      <option value="">Select Department</option>
                      ${overviewData.departments.map(d => `
                        <option value="${d.id}">[${d.code}] ${d.name}</option>
                      `).join('')}
                    </select>
                  </div>

                  <!-- 3. Year -->
                  <div>
                    <label class="filter-label">3. Study Year</label>
                    <select id="assign-year" class="form-input form-select" required>
                      <option value="">Select Year</option>
                      ${overviewData.years.map(y => `
                        <option value="${y.id}">${y.name} (Yr ${y.yearNumber})</option>
                      `).join('')}
                    </select>
                  </div>

                  <!-- 4. Section (Filtered) -->
                  <div>
                    <label class="filter-label">4. Section</label>
                    <select id="assign-section" class="form-input form-select" required disabled>
                      <option value="">Select Section</option>
                    </select>
                  </div>

                  <!-- 5. Subject (Filtered) -->
                  <div style="grid-column: 1 / -1;">
                    <label class="filter-label">5. Subject</label>
                    <select id="assign-subject" class="form-input form-select" required disabled>
                      <option value="">Select Subject</option>
                    </select>
                  </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                  <button type="submit" id="btn-save-assignment" class="btn btn-primary" disabled>
                    ✓ Confirm Class Allocation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;

      bindAssignmentEvents();
    }

    function bindAssignmentEvents() {
      modalBackdrop.querySelectorAll('.btn-close-modal').forEach(b => {
        b.addEventListener('click', () => {
          modalBackdrop.remove();
          loadStaffList(); // Refresh badge counts on parent list
        });
      });

      // Unassign action
      modalBackdrop.querySelectorAll('[data-action="unassign"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const assignmentId = e.currentTarget.getAttribute('data-assignment-id');
          const confirmed = confirm('Are you sure you want to unassign this faculty member from this class?');
          if (!confirmed) return;

          try {
            const res = await fetch(`/api/admin/staff/assignments/${assignmentId}`, {
              method: 'DELETE',
              headers: getHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showNotification(data.message, 'success');
            await fetchAssignments();
            renderModalContent();
          } catch (err) {
            alert(err.message);
          }
        });
      });

      // Dependent dropdown cascading
      const acadSel = modalBackdrop.querySelector('#assign-acad-year');
      const deptSel = modalBackdrop.querySelector('#assign-dept');
      const yearSel = modalBackdrop.querySelector('#assign-year');
      const secSel = modalBackdrop.querySelector('#assign-section');
      const subjSel = modalBackdrop.querySelector('#assign-subject');
      const saveBtn = modalBackdrop.querySelector('#btn-save-assignment');

      function updateDependentFields() {
        const acadId = acadSel.value;
        const deptId = deptSel.value;
        const yrId = yearSel.value;

        if (deptId && yrId && acadId) {
          // Filter Sections
          const matchingSections = allSections.filter(s =>
            s.academicYearId === acadId && s.departmentId === deptId && s.yearId === yrId
          );

          secSel.innerHTML = `
            <option value="">Select Section</option>
            ${matchingSections.map(s => `<option value="${s.id}">Section ${s.name}</option>`).join('')}
          `;
          secSel.disabled = matchingSections.length === 0;

          // Filter Subjects
          const matchingSubjects = allSubjects.filter(sub =>
            sub.departmentId === deptId && sub.yearId === yrId
          );

          subjSel.innerHTML = `
            <option value="">Select Subject</option>
            ${matchingSubjects.map(sub => `
              <option value="${sub.id}">[${sub.code}] ${sub.name} (Sem ${sub.semester})</option>
            `).join('')}
          `;
          subjSel.disabled = matchingSubjects.length === 0;
        } else {
          secSel.innerHTML = `<option value="">Select Section</option>`;
          secSel.disabled = true;
          subjSel.innerHTML = `<option value="">Select Subject</option>`;
          subjSel.disabled = true;
        }

        checkSaveReady();
      }

      function checkSaveReady() {
        const ready = acadSel.value && deptSel.value && yearSel.value && secSel.value && subjSel.value;
        saveBtn.disabled = !ready;
      }

      acadSel.addEventListener('change', updateDependentFields);
      deptSel.addEventListener('change', updateDependentFields);
      yearSel.addEventListener('change', updateDependentFields);
      secSel.addEventListener('change', checkSaveReady);
      subjSel.addEventListener('change', checkSaveReady);

      // Form submission
      const assignForm = modalBackdrop.querySelector('#assign-class-form');
      assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
          academicYearId: acadSel.value,
          departmentId: deptSel.value,
          yearId: yearSel.value,
          sectionId: secSel.value,
          subjectId: subjSel.value
        };

        try {
          const res = await fetch(`/api/admin/staff/${staff.id}/assignments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          showNotification(data.message, 'success');
          await fetchAssignments();
          renderModalContent();
        } catch (err) {
          alert('Assignment Blocked:\n' + err.message);
        }
      });
    }

    document.body.appendChild(modalBackdrop);
    renderModalContent();
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

  loadInitialData().then(() => {
    render();
  });
}
