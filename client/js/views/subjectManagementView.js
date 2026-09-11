import { Auth } from '../auth.js';

export function renderSubjectManagementView(container) {
  let subjects = [];
  let departments = [];
  let years = [];

  let searchTerm = '';
  let selectedDept = 'all';
  let selectedYear = 'all';
  let selectedSemester = 'all';
  let selectedStatus = 'all';

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

  async function loadMetadata() {
    try {
      const [deptRes, yearRes] = await Promise.all([
        fetch('/api/admin/departments', { headers: getHeaders() }),
        fetch('/api/admin/years', { headers: getHeaders() })
      ]);
      if (deptRes.ok) {
        const dData = await deptRes.json();
        departments = dData.departments || [];
      }
      if (yearRes.ok) {
        const yData = await yearRes.json();
        years = yData.years || [];
      }
    } catch (err) {
      console.error('Failed to load subject metadata:', err);
    }
  }

  async function loadSubjects() {
    const tableBox = container.querySelector('#subject-table-container');
    if (tableBox) {
      tableBox.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          Loading subjects and curriculum...
        </div>
      `;
    }

    try {
      let url = `/api/admin/subjects?search=${encodeURIComponent(searchTerm)}`;
      if (selectedDept !== 'all') url += `&departmentId=${selectedDept}`;
      if (selectedYear !== 'all') url += `&yearId=${selectedYear}`;
      if (selectedSemester !== 'all') url += `&semester=${selectedSemester}`;
      if (selectedStatus !== 'all') url += `&status=${selectedStatus}`;

      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch subjects');
      const data = await res.json();
      subjects = data.subjects || [];

      updateMetrics();
      renderTable();
    } catch (err) {
      console.error('Load subjects error:', err);
      if (tableBox) {
        tableBox.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #f43f5e;">
            Failed to load subjects. Please refresh or check connection.
          </div>
        `;
      }
    }
  }

  function updateMetrics() {
    const totalEl = container.querySelector('#val-total-subjects');
    const activeEl = container.querySelector('#val-active-subjects');
    const deptsEl = container.querySelector('#val-covered-depts');

    if (totalEl) totalEl.textContent = subjects.length;
    if (activeEl) activeEl.textContent = subjects.filter(s => s.isActive).length;
    if (deptsEl) {
      const uniqueDepts = new Set(subjects.map(s => s.departmentId));
      deptsEl.textContent = uniqueDepts.size;
    }
  }

  function renderTable() {
    const tableBox = container.querySelector('#subject-table-container');
    if (!tableBox) return;

    if (subjects.length === 0) {
      tableBox.innerHTML = `
        <div style="text-align: center; padding: 48px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">📚</div>
          <div style="font-weight: 600; color: #ffffff;">No Subjects Found</div>
          <div style="font-size: 13px; margin-top: 4px;">Adjust your filters or add a new subject to the curriculum.</div>
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
            <th>Year Level</th>
            <th>Semester</th>
            <th>Max Marks</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
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
                <div style="font-weight: 600; color: #ffffff;">${escapeHtml(s.name)}</div>
                <div style="font-size: 11px; color: var(--text-dim);">
                  ${s._count?.teacherAssignments || 0} Faculty Allocated • ${s._count?.marks || 0} Marks Entered
                </div>
              </td>
              <td>
                <span class="role-pill badge-neutral">
                  ${escapeHtml(s.department?.code || '—')}
                </span>
                <span style="font-size: 12px; color: var(--text-muted); margin-left: 4px;">
                  ${escapeHtml(s.department?.name || '')}
                </span>
              </td>
              <td>
                <span style="color: #ffffff; font-weight: 500;">
                  ${escapeHtml(s.year?.name || `Year ${s.year?.yearNumber}`)}
                </span>
              </td>
              <td>
                <span class="role-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);">
                  Sem ${s.semester}
                </span>
              </td>
              <td>
                <strong style="color: #ffffff;">${s.maximumMarks || 100}</strong>
              </td>
              <td>
                <span class="role-pill ${s.isActive ? 'badge-staff' : 'badge-neutral'}" style="${s.isActive ? 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);' : 'opacity: 0.7;'}">
                  ${s.isActive ? '● Active' : '○ Inactive'}
                </span>
              </td>
              <td style="text-align: right;">
                <div style="display: flex; gap: 6px; justify-content: flex-end;">
                  <button class="btn btn-secondary btn-xs edit-subject-btn" data-id="${s.id}" title="Edit Subject">
                    ✏️ Edit
                  </button>
                  <button class="btn btn-secondary btn-xs toggle-status-btn" data-id="${s.id}" data-active="${s.isActive}" title="${s.isActive ? 'Deactivate' : 'Activate'}">
                    ${s.isActive ? '⏸️' : '▶️'}
                  </button>
                  <button class="btn btn-danger btn-xs delete-subject-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}" title="Delete Subject">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Bind action listeners
    tableBox.querySelectorAll('.edit-subject-btn').forEach(b => {
      b.addEventListener('click', () => openEditSubjectModal(b.getAttribute('data-id')));
    });

    tableBox.querySelectorAll('.toggle-status-btn').forEach(b => {
      b.addEventListener('click', () => toggleSubjectStatus(b.getAttribute('data-id'), b.getAttribute('data-active') === 'true'));
    });

    tableBox.querySelectorAll('.delete-subject-btn').forEach(b => {
      b.addEventListener('click', () => deleteSubject(b.getAttribute('data-id'), b.getAttribute('data-name')));
    });
  }

  function renderLayout() {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Header Banner -->
        <div class="card-box" style="border-left: 4px solid #6366f1;">
          <div class="card-box-header">
            <div>
              <div class="card-box-title">Subject & Curriculum Management</div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                Centrally manage subjects, course codes, departments, year levels, semesters, and maximum marks.
              </div>
            </div>
            <button id="add-subject-btn" class="btn btn-primary btn-sm">
              <span>➕</span> Add New Subject
            </button>
          </div>

          <div class="card-box-body">
            <!-- Metrics Row -->
            <div class="metrics-grid" style="margin-bottom: 24px;">
              <div class="metric-card">
                <div class="metric-title">TOTAL SUBJECTS</div>
                <div class="metric-value" id="val-total-subjects" style="color: #a5b4fc;">—</div>
                <div class="metric-sub">In academic curriculum</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">ACTIVE SUBJECTS</div>
                <div class="metric-value" id="val-active-subjects" style="color: #34d399;">—</div>
                <div class="metric-sub">Open for teaching & grading</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">DEPARTMENTS COVERED</div>
                <div class="metric-value" id="val-covered-depts" style="color: #38bdf8;">—</div>
                <div class="metric-sub">Distinct engineering faculties</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">CLEARANCE LEVEL</div>
                <div class="metric-value" style="font-size: 20px; color: #fb7185;">Admin Only</div>
                <div class="metric-sub">Staff receive 403 Forbidden</div>
              </div>
            </div>

            <!-- Filters Bar -->
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; background: rgba(255,255,255,0.02); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              
              <!-- Search -->
              <div style="flex: 1; min-width: 220px;">
                <input type="text" id="subject-search-input" class="form-input" placeholder="🔍 Search by name or code (e.g. CS8501)..." value="${escapeHtml(searchTerm)}" style="height: 38px;">
              </div>

              <!-- Department Filter -->
              <div style="min-width: 150px;">
                <select id="subject-filter-dept" class="form-select" style="height: 38px;">
                  <option value="all">All Departments</option>
                  ${departments.map(d => `<option value="${d.id}" ${selectedDept === d.id ? 'selected' : ''}>${d.code} - ${d.name}</option>`).join('')}
                </select>
              </div>

              <!-- Year Filter -->
              <div style="min-width: 130px;">
                <select id="subject-filter-year" class="form-select" style="height: 38px;">
                  <option value="all">All Years</option>
                  ${years.map(y => `<option value="${y.id}" ${selectedYear === y.id ? 'selected' : ''}>${y.name}</option>`).join('')}
                </select>
              </div>

              <!-- Semester Filter -->
              <div style="min-width: 120px;">
                <select id="subject-filter-sem" class="form-select" style="height: 38px;">
                  <option value="all">All Semesters</option>
                  ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}" ${selectedSemester === String(s) ? 'selected' : ''}>Semester ${s}</option>`).join('')}
                </select>
              </div>

              <!-- Status Filter -->
              <div style="min-width: 120px;">
                <select id="subject-filter-status" class="form-select" style="height: 38px;">
                  <option value="all" ${selectedStatus === 'all' ? 'selected' : ''}>All Status</option>
                  <option value="active" ${selectedStatus === 'active' ? 'selected' : ''}>Active Only</option>
                  <option value="inactive" ${selectedStatus === 'inactive' ? 'selected' : ''}>Inactive Only</option>
                </select>
              </div>

              <button id="reset-subject-filters-btn" class="btn btn-secondary btn-sm" style="height: 38px;">
                Reset
              </button>
            </div>

            <!-- Subject Data Table -->
            <div id="subject-table-container" style="margin-top: 16px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); overflow-x: auto;">
              <!-- Table rendered here -->
            </div>

          </div>
        </div>

      </div>

      <!-- Modal Container -->
      <div id="subject-modal-root"></div>
    `;

    // Filter events
    const searchInp = container.querySelector('#subject-search-input');
    let debounceTimer;
    searchInp.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchTerm = e.target.value;
        loadSubjects();
      }, 250);
    });

    container.querySelector('#subject-filter-dept').addEventListener('change', (e) => {
      selectedDept = e.target.value;
      loadSubjects();
    });

    container.querySelector('#subject-filter-year').addEventListener('change', (e) => {
      selectedYear = e.target.value;
      loadSubjects();
    });

    container.querySelector('#subject-filter-sem').addEventListener('change', (e) => {
      selectedSemester = e.target.value;
      loadSubjects();
    });

    container.querySelector('#subject-filter-status').addEventListener('change', (e) => {
      selectedStatus = e.target.value;
      loadSubjects();
    });

    container.querySelector('#reset-subject-filters-btn').addEventListener('click', () => {
      searchTerm = '';
      selectedDept = 'all';
      selectedYear = 'all';
      selectedSemester = 'all';
      selectedStatus = 'all';
      renderLayout();
      loadSubjects();
    });

    container.querySelector('#add-subject-btn').addEventListener('click', openAddSubjectModal);
  }

  function openAddSubjectModal() {
    const modalRoot = container.querySelector('#subject-modal-root');
    modalRoot.innerHTML = `
      <div class="modal-overlay" id="subject-modal">
        <div class="modal-card" style="max-width: 520px;">
          <div class="modal-header">
            <div class="modal-title">➕ Add New Subject</div>
            <button class="modal-close-btn" id="close-modal-btn">&times;</button>
          </div>
          <form id="create-subject-form">
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              
              <div>
                <label class="form-label">Subject Name *</label>
                <input type="text" id="new-sub-name" class="form-input" placeholder="e.g. Distributed Systems and Cloud" required>
              </div>

              <div>
                <label class="form-label">Subject Code * (Unique)</label>
                <input type="text" id="new-sub-code" class="form-input" placeholder="e.g. CS8501" style="text-transform: uppercase;" required>
                <div style="font-size: 11px; color: var(--text-dim); margin-top: 3px;">Subject codes are automatically normalized to uppercase.</div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label">Department *</label>
                  <select id="new-sub-dept" class="form-select" required>
                    <option value="">Select Dept</option>
                    ${departments.map(d => `<option value="${d.id}">${d.code} - ${d.name}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label class="form-label">Year Level *</label>
                  <select id="new-sub-year" class="form-select" required>
                    <option value="">Select Year</option>
                    ${years.map(y => `<option value="${y.id}" data-year-num="${y.yearNumber}">${y.name}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label">Semester (1-8) *</label>
                  <select id="new-sub-sem" class="form-select" required>
                    <option value="">Select Semester</option>
                    ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}">Semester ${s}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label class="form-label">Maximum Marks *</label>
                  <input type="number" id="new-sub-maxmarks" class="form-input" value="100" min="1" max="1000" required>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                <input type="checkbox" id="new-sub-active" checked style="width: 16px; height: 16px;">
                <label for="new-sub-active" style="font-size: 13px; color: #ffffff; cursor: pointer;">
                  Mark Subject as Active (Available for teaching & marks entry)
                </label>
              </div>

              <div id="modal-error-box" style="display: none; padding: 10px; background: rgba(244,63,94,0.15); border: 1px solid #f43f5e; border-radius: var(--radius-sm); color: #fb7185; font-size: 12px;"></div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" id="cancel-modal-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" id="submit-sub-btn">Create Subject</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Dynamic semester recommendation on year change
    const yrSelect = modalRoot.querySelector('#new-sub-year');
    const semSelect = modalRoot.querySelector('#new-sub-sem');
    yrSelect.addEventListener('change', () => {
      const selectedOption = yrSelect.options[yrSelect.selectedIndex];
      const yrNum = parseInt(selectedOption.getAttribute('data-year-num'), 10);
      if (!isNaN(yrNum)) {
        const expectedMin = (yrNum - 1) * 2 + 1;
        semSelect.value = String(expectedMin);
      }
    });

    const closeModal = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#close-modal-btn').addEventListener('click', closeModal);
    modalRoot.querySelector('#cancel-modal-btn').addEventListener('click', closeModal);

    modalRoot.querySelector('#create-subject-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = modalRoot.querySelector('#modal-error-box');
      const submitBtn = modalRoot.querySelector('#submit-sub-btn');

      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      const payload = {
        name: modalRoot.querySelector('#new-sub-name').value.trim(),
        code: modalRoot.querySelector('#new-sub-code').value.trim(),
        departmentId: modalRoot.querySelector('#new-sub-dept').value,
        yearId: modalRoot.querySelector('#new-sub-year').value,
        semester: parseInt(modalRoot.querySelector('#new-sub-sem').value, 10),
        maximumMarks: parseFloat(modalRoot.querySelector('#new-sub-maxmarks').value),
        isActive: modalRoot.querySelector('#new-sub-active').checked
      };

      try {
        const res = await fetch('/api/admin/subjects', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to create subject');
        }

        showToast(`Subject [${data.subject.code}] ${data.subject.name} created successfully!`, 'success');
        closeModal();
        loadSubjects();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Subject';
      }
    });
  }

  function openEditSubjectModal(subjectId) {
    const sub = subjects.find(s => s.id === subjectId);
    if (!sub) return;

    const modalRoot = container.querySelector('#subject-modal-root');
    modalRoot.innerHTML = `
      <div class="modal-overlay" id="subject-modal">
        <div class="modal-card" style="max-width: 520px;">
          <div class="modal-header">
            <div class="modal-title">✏️ Edit Subject: ${escapeHtml(sub.code)}</div>
            <button class="modal-close-btn" id="close-modal-btn">&times;</button>
          </div>
          <form id="edit-subject-form">
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              
              <div>
                <label class="form-label">Subject Name *</label>
                <input type="text" id="edit-sub-name" class="form-input" value="${escapeHtml(sub.name)}" required>
              </div>

              <div>
                <label class="form-label">Subject Code * (Unique)</label>
                <input type="text" id="edit-sub-code" class="form-input" value="${escapeHtml(sub.code)}" style="text-transform: uppercase;" required>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label">Department *</label>
                  <select id="edit-sub-dept" class="form-select" required>
                    ${departments.map(d => `<option value="${d.id}" ${sub.departmentId === d.id ? 'selected' : ''}>${d.code} - ${d.name}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label class="form-label">Year Level *</label>
                  <select id="edit-sub-year" class="form-select" required>
                    ${years.map(y => `<option value="${y.id}" data-year-num="${y.yearNumber}" ${sub.yearId === y.id ? 'selected' : ''}>${y.name}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label">Semester (1-8) *</label>
                  <select id="edit-sub-sem" class="form-select" required>
                    ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}" ${sub.semester === s ? 'selected' : ''}>Semester ${s}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label class="form-label">Maximum Marks *</label>
                  <input type="number" id="edit-sub-maxmarks" class="form-input" value="${sub.maximumMarks || 100}" min="1" max="1000" required>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                <input type="checkbox" id="edit-sub-active" ${sub.isActive ? 'checked' : ''} style="width: 16px; height: 16px;">
                <label for="edit-sub-active" style="font-size: 13px; color: #ffffff; cursor: pointer;">
                  Subject is Active
                </label>
              </div>

              <div id="modal-error-box" style="display: none; padding: 10px; background: rgba(244,63,94,0.15); border: 1px solid #f43f5e; border-radius: var(--radius-sm); color: #fb7185; font-size: 12px;"></div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" id="cancel-modal-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" id="submit-edit-btn">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeModal = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#close-modal-btn').addEventListener('click', closeModal);
    modalRoot.querySelector('#cancel-modal-btn').addEventListener('click', closeModal);

    modalRoot.querySelector('#edit-subject-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = modalRoot.querySelector('#modal-error-box');
      const submitBtn = modalRoot.querySelector('#submit-edit-btn');

      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';

      const payload = {
        name: modalRoot.querySelector('#edit-sub-name').value.trim(),
        code: modalRoot.querySelector('#edit-sub-code').value.trim(),
        departmentId: modalRoot.querySelector('#edit-sub-dept').value,
        yearId: modalRoot.querySelector('#edit-sub-year').value,
        semester: parseInt(modalRoot.querySelector('#edit-sub-sem').value, 10),
        maximumMarks: parseFloat(modalRoot.querySelector('#edit-sub-maxmarks').value),
        isActive: modalRoot.querySelector('#edit-sub-active').checked
      };

      try {
        const res = await fetch(`/api/admin/subjects/${subjectId}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to update subject');
        }

        showToast(`Subject [${data.subject.code}] updated successfully!`, 'success');
        closeModal();
        loadSubjects();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
  }

  async function toggleSubjectStatus(id, currentActive) {
    try {
      const res = await fetch(`/api/admin/subjects/${id}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ isActive: !currentActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle status');

      showToast(data.message || 'Status updated', 'success');
      loadSubjects();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteSubject(id, name) {
    const confirmed = confirm(`Are you sure you want to permanently delete subject "${name}"?\n\nNote: If this subject is referenced by teacher assignments or student marks, deletion will be blocked.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/subjects/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`❌ Deletion Blocked:\n\n${data.error}`);
        return;
      }

      showToast(data.message || 'Subject deleted safely.', 'info');
      loadSubjects();
    } catch (err) {
      showToast(err.message, 'error');
    }
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

  // Initialize view
  loadMetadata().then(() => {
    renderLayout();
    loadSubjects();
  });
}
