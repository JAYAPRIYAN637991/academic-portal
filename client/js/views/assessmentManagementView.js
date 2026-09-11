import { Auth } from '../auth.js';

export function renderAssessmentManagementView(container) {
  let assessments = [];
  let departments = [];
  let academicYears = [];

  let searchTerm = '';
  let selectedStatus = 'all';
  let selectedDept = 'all';

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
      const [deptRes, ayRes] = await Promise.all([
        fetch('/api/admin/departments', { headers: getHeaders() }),
        fetch('/api/admin/academic-years', { headers: getHeaders() })
      ]);
      if (deptRes.ok) {
        const dData = await deptRes.json();
        departments = dData.departments || [];
      }
      if (ayRes.ok) {
        const ayData = await ayRes.json();
        academicYears = ayData.academicYears || [];
      }
    } catch (err) {
      console.error('Failed to load assessment metadata:', err);
    }
  }

  async function loadAssessments() {
    const tableBox = container.querySelector('#assessment-table-container');
    if (tableBox) {
      tableBox.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          Loading assessment specifications...
        </div>
      `;
    }

    try {
      let url = `/api/admin/assessments?search=${encodeURIComponent(searchTerm)}`;
      if (selectedStatus !== 'all') url += `&status=${selectedStatus}`;
      if (selectedDept !== 'all') url += `&departmentId=${selectedDept}`;

      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch assessments');
      const data = await res.json();
      assessments = data.assessments || [];

      updateMetrics();
      renderTable();
    } catch (err) {
      console.error('Load assessments error:', err);
      if (tableBox) {
        tableBox.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #f43f5e;">
            Failed to load assessments. Please refresh.
          </div>
        `;
      }
    }
  }

  function updateMetrics() {
    const totalEl = container.querySelector('#val-total-assessments');
    const activeEl = container.querySelector('#val-active-assessments');
    const globalEl = container.querySelector('#val-global-assessments');

    if (totalEl) totalEl.textContent = assessments.length;
    if (activeEl) activeEl.textContent = assessments.filter(a => a.isActive).length;
    if (globalEl) {
      const count = assessments.filter(a => !a.departmentId && !a.subjectId).length;
      globalEl.textContent = count;
    }
  }

  function renderTable() {
    const tableBox = container.querySelector('#assessment-table-container');
    if (!tableBox) return;

    if (assessments.length === 0) {
      tableBox.innerHTML = `
        <div style="text-align: center; padding: 48px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">📝</div>
          <div style="font-weight: 600; color: #ffffff;">No Assessments Configured</div>
          <div style="font-size: 13px; margin-top: 4px;">Click the quick-preset buttons above to create IA-1, IA-2, IA-3, MODEL, or SEMESTER.</div>
        </div>
      `;
      return;
    }

    tableBox.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Assessment Name & Description</th>
            <th>Applicable Scope</th>
            <th>Max Marks</th>
            <th>Weightage</th>
            <th>Grading Activity</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${assessments.map(a => {
            let scopeBadge = `<span class="role-pill badge-neutral">All College</span>`;
            if (a.department) {
              scopeBadge = `<span class="role-pill" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35);">${escapeHtml(a.department.code)} Dept</span>`;
            } else if (a.subject) {
              scopeBadge = `<span class="role-pill" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35);">${escapeHtml(a.subject.code)}</span>`;
            }

            return `
              <tr>
                <td>
                  <span class="role-pill" style="background: rgba(236, 72, 153, 0.15); color: #f472b6; font-weight: 700; border: 1px solid rgba(236, 72, 153, 0.35);">
                    ${escapeHtml(a.code)}
                  </span>
                </td>
                <td>
                  <div style="font-weight: 600; color: #ffffff;">${escapeHtml(a.name)}</div>
                  <div style="font-size: 11px; color: var(--text-dim);">
                    ${escapeHtml(a.description || 'No description provided')}
                  </div>
                </td>
                <td>${scopeBadge}</td>
                <td>
                  <strong style="color: #ffffff;">${a.maximumMarks || 100}</strong> pts
                </td>
                <td>
                  ${a.weightage ? `<span style="color: #34d399; font-weight: 600;">${a.weightage}%</span>` : `<span style="color: var(--text-dim);">—</span>`}
                </td>
                <td>
                  <span style="font-size: 12px; color: var(--text-muted);">
                    📊 ${a._count?.marks || 0} student marks recorded
                  </span>
                </td>
                <td>
                  <span class="role-pill ${a.isActive ? 'badge-staff' : 'badge-neutral'}" style="${a.isActive ? 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);' : 'opacity: 0.7;'}">
                    ${a.isActive ? '● Active' : '○ Inactive'}
                  </span>
                </td>
                <td style="text-align: right;">
                  <div style="display: flex; gap: 6px; justify-content: flex-end;">
                    <button class="btn btn-secondary btn-xs edit-assessment-btn" data-id="${a.id}" title="Edit Assessment">
                      ✏️ Edit
                    </button>
                    <button class="btn btn-secondary btn-xs toggle-assessment-btn" data-id="${a.id}" data-active="${a.isActive}" title="${a.isActive ? 'Deactivate' : 'Activate'}">
                      ${a.isActive ? '⏸️' : '▶️'}
                    </button>
                    <button class="btn btn-danger btn-xs delete-assessment-btn" data-id="${a.id}" data-name="${escapeHtml(a.name)}" title="Delete Assessment">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    tableBox.querySelectorAll('.edit-assessment-btn').forEach(b => {
      b.addEventListener('click', () => openEditAssessmentModal(b.getAttribute('data-id')));
    });

    tableBox.querySelectorAll('.toggle-assessment-btn').forEach(b => {
      b.addEventListener('click', () => toggleAssessmentStatus(b.getAttribute('data-id'), b.getAttribute('data-active') === 'true'));
    });

    tableBox.querySelectorAll('.delete-assessment-btn').forEach(b => {
      b.addEventListener('click', () => deleteAssessment(b.getAttribute('data-id'), b.getAttribute('data-name')));
    });
  }

  function renderLayout() {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Header Banner -->
        <div class="card-box" style="border-left: 4px solid #ec4899;">
          <div class="card-box-header">
            <div>
              <div class="card-box-title">Assessment & Examination Configuration</div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                Create and manage institutional assessment types (IA-1, IA-2, IA-3, MODEL, SEMESTER). Fully dynamic and non-hardcoded.
              </div>
            </div>
            <button id="add-custom-assessment-btn" class="btn btn-primary btn-sm">
              <span>➕</span> Add Custom Assessment
            </button>
          </div>

          <div class="card-box-body">
            
            <!-- Quick Preset Chips -->
            <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(236, 72, 153, 0.4); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 20px;">
              <div style="font-size: 12px; font-weight: 700; color: #f472b6; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                ⚡ Quick Presets (Click to autofill & configure)
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <button class="btn btn-secondary btn-xs preset-chip-btn" data-code="IA-1" data-name="Internal Assessment 1" data-marks="50" data-weight="20" data-desc="Continuous Internal Assessment 1 (Units 1 & 2)">
                  + IA-1 (Units 1 & 2)
                </button>
                <button class="btn btn-secondary btn-xs preset-chip-btn" data-code="IA-2" data-name="Internal Assessment 2" data-marks="50" data-weight="20" data-desc="Continuous Internal Assessment 2 (Units 3 & 4)">
                  + IA-2 (Units 3 & 4)
                </button>
                <button class="btn btn-secondary btn-xs preset-chip-btn" data-code="IA-3" data-name="Internal Assessment 3" data-marks="100" data-weight="20" data-desc="Continuous Internal Assessment 3 (Full Syllabus)">
                  + IA-3 (Full Syllabus)
                </button>
                <button class="btn btn-secondary btn-xs preset-chip-btn" data-code="MODEL" data-name="Model Examination" data-marks="100" data-weight="25" data-desc="Pre-University Simulation Model Examination">
                  + MODEL Examination
                </button>
                <button class="btn btn-secondary btn-xs preset-chip-btn" data-code="SEMESTER" data-name="End Semester Exam" data-marks="100" data-weight="50" data-desc="University Final End Semester Examination">
                  + SEMESTER University Exam
                </button>
              </div>
            </div>

            <!-- Metrics Grid -->
            <div class="metrics-grid" style="margin-bottom: 20px;">
              <div class="metric-card">
                <div class="metric-title">TOTAL ASSESSMENTS</div>
                <div class="metric-value" id="val-total-assessments" style="color: #f472b6;">—</div>
                <div class="metric-sub">Dynamic grading evaluations</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">ACTIVE ASSESSMENTS</div>
                <div class="metric-value" id="val-active-assessments" style="color: #34d399;">—</div>
                <div class="metric-sub">Visible to faculty for marks entry</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">COLLEGE-WIDE TESTS</div>
                <div class="metric-value" id="val-global-assessments" style="color: #38bdf8;">—</div>
                <div class="metric-sub">Universal institutional exams</div>
              </div>
              <div class="metric-card">
                <div class="metric-title">STAFF PERMISSION</div>
                <div class="metric-value" style="font-size: 20px; color: #fb7185;">Read-Only</div>
                <div class="metric-sub">Cannot create or delete assessments</div>
              </div>
            </div>

            <!-- Filters Bar -->
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; background: rgba(255,255,255,0.02); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              
              <div style="flex: 1; min-width: 220px;">
                <input type="text" id="assessment-search-input" class="form-input" placeholder="🔍 Search assessments by name, code or description..." value="${escapeHtml(searchTerm)}" style="height: 38px;">
              </div>

              <div style="min-width: 160px;">
                <select id="assessment-filter-dept" class="form-select" style="height: 38px;">
                  <option value="all">All Departments / Global</option>
                  ${departments.map(d => `<option value="${d.id}" ${selectedDept === d.id ? 'selected' : ''}>${d.code} - ${d.name}</option>`).join('')}
                </select>
              </div>

              <div style="min-width: 130px;">
                <select id="assessment-filter-status" class="form-select" style="height: 38px;">
                  <option value="all" ${selectedStatus === 'all' ? 'selected' : ''}>All Status</option>
                  <option value="active" ${selectedStatus === 'active' ? 'selected' : ''}>Active Only</option>
                  <option value="inactive" ${selectedStatus === 'inactive' ? 'selected' : ''}>Inactive Only</option>
                </select>
              </div>

              <button id="reset-assessment-filters-btn" class="btn btn-secondary btn-sm" style="height: 38px;">
                Reset
              </button>
            </div>

            <!-- Assessment Table -->
            <div id="assessment-table-container" style="margin-top: 16px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); overflow-x: auto;">
              <!-- Rendered here -->
            </div>

          </div>
        </div>

      </div>

      <!-- Modal Root -->
      <div id="assessment-modal-root"></div>
    `;

    // Filter listeners
    const searchInp = container.querySelector('#assessment-search-input');
    let debounceTimer;
    searchInp.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchTerm = e.target.value;
        loadAssessments();
      }, 250);
    });

    container.querySelector('#assessment-filter-dept').addEventListener('change', (e) => {
      selectedDept = e.target.value;
      loadAssessments();
    });

    container.querySelector('#assessment-filter-status').addEventListener('change', (e) => {
      selectedStatus = e.target.value;
      loadAssessments();
    });

    container.querySelector('#reset-assessment-filters-btn').addEventListener('click', () => {
      searchTerm = '';
      selectedStatus = 'all';
      selectedDept = 'all';
      renderLayout();
      loadAssessments();
    });

    container.querySelector('#add-custom-assessment-btn').addEventListener('click', () => {
      openAssessmentModal({});
    });

    container.querySelectorAll('.preset-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openAssessmentModal({
          code: btn.getAttribute('data-code'),
          name: btn.getAttribute('data-name'),
          maximumMarks: btn.getAttribute('data-marks'),
          weightage: btn.getAttribute('data-weight'),
          description: btn.getAttribute('data-desc')
        });
      });
    });
  }

  function openAssessmentModal(defaults = {}) {
    const modalRoot = container.querySelector('#assessment-modal-root');
    modalRoot.innerHTML = `
      <div class="modal-overlay" id="assessment-modal">
        <div class="modal-card" style="max-width: 520px;">
          <div class="modal-header">
            <div class="modal-title">➕ ${defaults.code ? `Configure Assessment: ${defaults.code}` : 'Create Dynamic Assessment'}</div>
            <button class="modal-close-btn" id="close-modal-btn">&times;</button>
          </div>
          <form id="create-assessment-form">
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              
              <div>
                <label class="form-label">Assessment Name *</label>
                <input type="text" id="new-asm-name" class="form-input" placeholder="e.g. Internal Assessment 1" value="${escapeHtml(defaults.name || '')}" required>
              </div>

              <div>
                <label class="form-label">Assessment Code * (Unique, e.g. IA-1, IA-2, IA-3, MODEL, SEMESTER)</label>
                <input type="text" id="new-asm-code" class="form-input" placeholder="e.g. IA-1" value="${escapeHtml(defaults.code || '')}" style="text-transform: uppercase;" required>
              </div>

              <div>
                <label class="form-label">Description / Syllabus Scope</label>
                <textarea id="new-asm-desc" class="form-input" rows="2" placeholder="e.g. Unit 1 and Unit 2 evaluation">${escapeHtml(defaults.description || '')}</textarea>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label">Maximum Marks *</label>
                  <input type="number" id="new-asm-maxmarks" class="form-input" value="${defaults.maximumMarks || '100'}" min="1" max="1000" required>
                </div>

                <div>
                  <label class="form-label">Weightage (%)</label>
                  <input type="number" id="new-asm-weight" class="form-input" value="${defaults.weightage || ''}" min="0" max="100" step="0.5" placeholder="e.g. 20">
                </div>
              </div>

              <div>
                <label class="form-label">Department Scope (Optional)</label>
                <select id="new-asm-dept" class="form-select">
                  <option value="">All Departments (College-Wide Assessment)</option>
                  ${departments.map(d => `<option value="${d.id}">${d.code} - ${d.name}</option>`).join('')}
                </select>
                <div style="font-size: 11px; color: var(--text-dim); margin-top: 3px;">
                  Leave as "All Departments" for universal tests like IA-1, IA-2, IA-3, MODEL, SEMESTER.
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                <input type="checkbox" id="new-asm-active" checked style="width: 16px; height: 16px;">
                <label for="new-asm-active" style="font-size: 13px; color: #ffffff; cursor: pointer;">
                  Active (Staff can select this assessment during marks entry)
                </label>
              </div>

              <div id="modal-error-box" style="display: none; padding: 10px; background: rgba(244,63,94,0.15); border: 1px solid #f43f5e; border-radius: var(--radius-sm); color: #fb7185; font-size: 12px;"></div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" id="cancel-modal-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" id="submit-asm-btn">Save Assessment</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeModal = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#close-modal-btn').addEventListener('click', closeModal);
    modalRoot.querySelector('#cancel-modal-btn').addEventListener('click', closeModal);

    modalRoot.querySelector('#create-assessment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = modalRoot.querySelector('#modal-error-box');
      const submitBtn = modalRoot.querySelector('#submit-asm-btn');

      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      const payload = {
        name: modalRoot.querySelector('#new-asm-name').value.trim(),
        code: modalRoot.querySelector('#new-asm-code').value.trim(),
        description: modalRoot.querySelector('#new-asm-desc').value.trim() || null,
        maximumMarks: parseFloat(modalRoot.querySelector('#new-asm-maxmarks').value),
        weightage: modalRoot.querySelector('#new-asm-weight').value ? parseFloat(modalRoot.querySelector('#new-asm-weight').value) : null,
        departmentId: modalRoot.querySelector('#new-asm-dept').value || null,
        isActive: modalRoot.querySelector('#new-asm-active').checked
      };

      try {
        const res = await fetch('/api/admin/assessments', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to create assessment');
        }

        showToast(`Assessment [${data.assessment.code}] created successfully!`, 'success');
        closeModal();
        loadAssessments();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Assessment';
      }
    });
  }

  function openEditAssessmentModal(assessmentId) {
    const asm = assessments.find(a => a.id === assessmentId);
    if (!asm) return;

    const modalRoot = container.querySelector('#assessment-modal-root');
    modalRoot.innerHTML = `
      <div class="modal-overlay" id="assessment-modal">
        <div class="modal-card" style="max-width: 520px;">
          <div class="modal-header">
            <div class="modal-title">✏️ Edit Assessment: ${escapeHtml(asm.code)}</div>
            <button class="modal-close-btn" id="close-modal-btn">&times;</button>
          </div>
          <form id="edit-assessment-form">
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
              
              <div>
                <label class="form-label">Assessment Name *</label>
                <input type="text" id="edit-asm-name" class="form-input" value="${escapeHtml(asm.name)}" required>
              </div>

              <div>
                <label class="form-label">Assessment Code * (Unique)</label>
                <input type="text" id="edit-asm-code" class="form-input" value="${escapeHtml(asm.code)}" style="text-transform: uppercase;" required>
              </div>

              <div>
                <label class="form-label">Description / Syllabus Scope</label>
                <textarea id="edit-asm-desc" class="form-input" rows="2">${escapeHtml(asm.description || '')}</textarea>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label class="form-label">Maximum Marks *</label>
                  <input type="number" id="edit-asm-maxmarks" class="form-input" value="${asm.maximumMarks || 100}" min="1" max="1000" required>
                </div>

                <div>
                  <label class="form-label">Weightage (%)</label>
                  <input type="number" id="edit-asm-weight" class="form-input" value="${asm.weightage || ''}" min="0" max="100" step="0.5">
                </div>
              </div>

              <div>
                <label class="form-label">Department Scope</label>
                <select id="edit-asm-dept" class="form-select">
                  <option value="">All Departments (College-Wide Assessment)</option>
                  ${departments.map(d => `<option value="${d.id}" ${asm.departmentId === d.id ? 'selected' : ''}>${d.code} - ${d.name}</option>`).join('')}
                </select>
              </div>

              <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                <input type="checkbox" id="edit-asm-active" ${asm.isActive ? 'checked' : ''} style="width: 16px; height: 16px;">
                <label for="edit-asm-active" style="font-size: 13px; color: #ffffff; cursor: pointer;">
                  Active
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

    modalRoot.querySelector('#edit-assessment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = modalRoot.querySelector('#modal-error-box');
      const submitBtn = modalRoot.querySelector('#submit-edit-btn');

      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';

      const payload = {
        name: modalRoot.querySelector('#edit-asm-name').value.trim(),
        code: modalRoot.querySelector('#edit-asm-code').value.trim(),
        description: modalRoot.querySelector('#edit-asm-desc').value.trim() || null,
        maximumMarks: parseFloat(modalRoot.querySelector('#edit-asm-maxmarks').value),
        weightage: modalRoot.querySelector('#edit-asm-weight').value ? parseFloat(modalRoot.querySelector('#edit-asm-weight').value) : null,
        departmentId: modalRoot.querySelector('#edit-asm-dept').value || null,
        isActive: modalRoot.querySelector('#edit-asm-active').checked
      };

      try {
        const res = await fetch(`/api/admin/assessments/${assessmentId}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to update assessment');
        }

        showToast(`Assessment [${data.assessment.code}] updated successfully!`, 'success');
        closeModal();
        loadAssessments();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
  }

  async function toggleAssessmentStatus(id, currentActive) {
    try {
      const res = await fetch(`/api/admin/assessments/${id}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ isActive: !currentActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle status');

      showToast(data.message || 'Status updated', 'success');
      loadAssessments();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteAssessment(id, name) {
    const confirmed = confirm(`Are you sure you want to permanently delete assessment "${name}"?\n\nNote: If this assessment is already linked to student marks, deletion will be blocked.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/assessments/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`❌ Deletion Blocked:\n\n${data.error}`);
        return;
      }

      showToast(data.message || 'Assessment deleted safely.', 'info');
      loadAssessments();
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
    loadAssessments();
  });
}
