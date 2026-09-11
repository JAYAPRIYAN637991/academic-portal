import { Auth } from '../auth.js';

export function renderAcademicStructureView(container) {
  let currentTab = 'sections'; // default to sections to showcase dependent dropdowns
  let overviewData = { academicYears: [], departments: [], years: [], stats: {} };
  
  // Dependent dropdown filter state
  let selectedAcademicYearId = '';
  let selectedDepartmentId = '';
  let selectedYearId = '';
  let sectionSearchTerm = '';
  let sectionStatusFilter = 'all';

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Auth.getToken()}`
    };
  }

  async function loadOverview() {
    try {
      const res = await fetch('/api/admin/academic-structure/overview', { headers: getHeaders() });
      if (res.ok) {
        overviewData = await res.json();
        // Set default dropdown values
        if (!selectedAcademicYearId && overviewData.academicYears?.length > 0) {
          const curr = overviewData.academicYears.find(y => y.isCurrent) || overviewData.academicYears[0];
          selectedAcademicYearId = curr.id;
        }
        if (!selectedDepartmentId && overviewData.departments?.length > 0) {
          selectedDepartmentId = overviewData.departments[0].id;
        }
        if (!selectedYearId && overviewData.years?.length > 0) {
          selectedYearId = overviewData.years[0].id;
        }
      }
    } catch (e) {
      console.error('Failed to load overview:', e);
    }
  }

  function showNotification(message, type = 'info') {
    window.dispatchEvent(new CustomEvent('toast-notify', {
      detail: { message, type }
    }));
  }

  async function render() {
    await loadOverview();

    container.innerHTML = `
      <div class="academic-structure-container">
        <!-- Hierarchy Visualizer Banner -->
        <div class="hierarchy-banner">
          <div class="hierarchy-step">
            <span class="step-num">1</span>
            <div>
              <div class="step-title">Academic Year</div>
              <div class="step-sub">e.g. 2026-2027</div>
            </div>
          </div>
          <div class="hierarchy-arrow">→</div>
          <div class="hierarchy-step">
            <span class="step-num">2</span>
            <div>
              <div class="step-title">Department</div>
              <div class="step-sub">e.g. Computer Science</div>
            </div>
          </div>
          <div class="hierarchy-arrow">→</div>
          <div class="hierarchy-step">
            <span class="step-num">3</span>
            <div>
              <div class="step-title">Study Year</div>
              <div class="step-sub">e.g. 3rd Year</div>
            </div>
          </div>
          <div class="hierarchy-arrow">→</div>
          <div class="hierarchy-step active">
            <span class="step-num">4</span>
            <div>
              <div class="step-title">Section</div>
              <div class="step-sub">e.g. Section A</div>
            </div>
          </div>
        </div>

        <!-- Academic Structure Tabs -->
        <div class="structure-tab-bar">
          <button class="structure-tab-btn ${currentTab === 'sections' ? 'active' : ''}" data-tab="sections">
            🏫 Sections & Hierarchy
          </button>
          <button class="structure-tab-btn ${currentTab === 'years' ? 'active' : ''}" data-tab="years">
            🎓 Study Years
          </button>
          <button class="structure-tab-btn ${currentTab === 'departments' ? 'active' : ''}" data-tab="departments">
            🏛️ Departments
          </button>
          <button class="structure-tab-btn ${currentTab === 'academicYears' ? 'active' : ''}" data-tab="academicYears">
            📅 Academic Years
          </button>
        </div>

        <!-- Tab Content Area -->
        <div id="structure-tab-content"></div>
      </div>

      <!-- Modal Container -->
      <div id="structure-modal-backdrop" class="modal-backdrop" style="display: none;"></div>
    `;

    // Tab buttons event listeners
    container.querySelectorAll('.structure-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentTab = e.currentTarget.getAttribute('data-tab');
        container.querySelectorAll('.structure-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        renderTabContent();
      });
    });

    renderTabContent();
  }

  function renderTabContent() {
    const content = container.querySelector('#structure-tab-content');
    if (!content) return;

    if (currentTab === 'sections') renderSectionsTab(content);
    else if (currentTab === 'years') renderYearsTab(content);
    else if (currentTab === 'departments') renderDepartmentsTab(content);
    else if (currentTab === 'academicYears') renderAcademicYearsTab(content);
  }

  // ==========================================================
  // TAB 1: SECTIONS WITH DEPENDENT CASCADING DROPDOWNS
  // ==========================================================
  async function renderSectionsTab(tabContainer) {
    tabContainer.innerHTML = `
      <div class="card-box">
        <div class="card-box-header" style="flex-wrap: wrap; gap: 16px;">
          <div>
            <div class="card-box-title">Sections Directory</div>
            <div style="font-size: 13px; color: var(--text-muted);">
              Use cascading filters to view and manage class sections allocated under each hierarchy level
            </div>
          </div>
          <button id="btn-add-section" class="btn btn-primary btn-sm">
            <span>➕</span> Add New Section
          </button>
        </div>

        <!-- Dependent Cascading Filter Bar -->
        <div class="cascade-filter-bar">
          <div class="filter-col">
            <label class="filter-label">1. Academic Year</label>
            <select id="filter-academic-year" class="form-input form-select">
              <option value="all">All Academic Years</option>
              ${overviewData.academicYears.map(y => `
                <option value="${y.id}" ${y.id === selectedAcademicYearId ? 'selected' : ''}>
                  ${y.yearName} ${y.isCurrent ? '★ (Current)' : ''}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="filter-col">
            <label class="filter-label">2. Department</label>
            <select id="filter-department" class="form-input form-select">
              <option value="all">All Departments</option>
              ${overviewData.departments.map(d => `
                <option value="${d.id}" ${d.id === selectedDepartmentId ? 'selected' : ''}>
                  [${d.code}] ${d.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="filter-col">
            <label class="filter-label">3. Study Year</label>
            <select id="filter-year" class="form-input form-select">
              <option value="all">All Years</option>
              ${overviewData.years.map(y => `
                <option value="${y.id}" ${y.id === selectedYearId ? 'selected' : ''}>
                  ${y.name} (Year ${y.yearNumber})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="filter-col">
            <label class="filter-label">Status Filter</label>
            <select id="filter-section-status" class="form-input form-select">
              <option value="all" ${sectionStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="active" ${sectionStatusFilter === 'active' ? 'selected' : ''}>Active Only</option>
              <option value="inactive" ${sectionStatusFilter === 'inactive' ? 'selected' : ''}>Inactive Only</option>
            </select>
          </div>

          <div class="filter-col" style="flex: 1.5; min-width: 160px;">
            <label class="filter-label">Search Section</label>
            <input 
              type="text" 
              id="filter-section-search" 
              class="form-input" 
              placeholder="Search section name..." 
              value="${sectionSearchTerm}"
            />
          </div>
        </div>

        <div id="sections-table-container" style="margin-top: 16px;">
          <div style="text-align: center; padding: 40px; color: var(--text-dim);">Loading Sections...</div>
        </div>
      </div>
    `;

    // Dropdown change handlers
    const acadSelect = tabContainer.querySelector('#filter-academic-year');
    const deptSelect = tabContainer.querySelector('#filter-department');
    const yearSelect = tabContainer.querySelector('#filter-year');
    const statusSelect = tabContainer.querySelector('#filter-section-status');
    const searchInput = tabContainer.querySelector('#filter-section-search');

    acadSelect.addEventListener('change', (e) => {
      selectedAcademicYearId = e.target.value;
      loadSectionsList();
    });
    deptSelect.addEventListener('change', (e) => {
      selectedDepartmentId = e.target.value;
      loadSectionsList();
    });
    yearSelect.addEventListener('change', (e) => {
      selectedYearId = e.target.value;
      loadSectionsList();
    });
    statusSelect.addEventListener('change', (e) => {
      sectionStatusFilter = e.target.value;
      loadSectionsList();
    });
    searchInput.addEventListener('input', (e) => {
      sectionSearchTerm = e.target.value;
      loadSectionsList();
    });

    tabContainer.querySelector('#btn-add-section').addEventListener('click', () => {
      openSectionModal();
    });

    loadSectionsList();
  }

  async function loadSectionsList() {
    const tableDiv = container.querySelector('#sections-table-container');
    if (!tableDiv) return;

    let url = `/api/admin/sections?status=${sectionStatusFilter}&search=${encodeURIComponent(sectionSearchTerm)}`;
    if (selectedAcademicYearId && selectedAcademicYearId !== 'all') url += `&academicYearId=${selectedAcademicYearId}`;
    if (selectedDepartmentId && selectedDepartmentId !== 'all') url += `&departmentId=${selectedDepartmentId}`;
    if (selectedYearId && selectedYearId !== 'all') url += `&yearId=${selectedYearId}`;

    try {
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      const sections = data.sections || [];

      if (sections.length === 0) {
        tableDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
            <div style="font-size: 32px; margin-bottom: 8px;">🏫</div>
            <div style="font-weight: 600; color: var(--text-main);">No Sections Found</div>
            <div style="font-size: 13px; color: var(--text-dim); margin-top: 4px;">
              No sections match the current dependent filter selection. Click "Add New Section" to create one.
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
                <th>Section</th>
                <th>Academic Year</th>
                <th>Department</th>
                <th>Year</th>
                <th>Students Enrolled</th>
                <th>Staff Assigned</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sections.map(s => `
                <tr>
                  <td>
                    <strong style="color: #ffffff; font-size: 15px;">${s.name.startsWith('Section') ? s.name : `Section ${s.name}`}</strong>
                  </td>
                  <td>
                    <span class="badge ${s.academicYear.isCurrent ? 'badge-admin' : 'badge-neutral'}">
                      ${s.academicYear.yearName} ${s.academicYear.isCurrent ? '★' : ''}
                    </span>
                  </td>
                  <td>
                    <span class="role-pill badge-staff" style="font-size: 11px;">${s.department.code}</span>
                    <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">${s.department.name}</span>
                  </td>
                  <td>${s.year.name}</td>
                  <td>
                    <span style="font-weight: 600; color: #38bdf8;">${s._count.students}</span> students
                  </td>
                  <td>
                    <span style="font-weight: 600; color: #34d399;">${s._count.teacherAssignments}</span> staff
                  </td>
                  <td>
                    <button class="status-toggle-pill ${s.isActive ? 'active' : 'inactive'}" data-section-id="${s.id}" data-current="${s.isActive}">
                      ${s.isActive ? '● Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-xs btn-edit-sec" data-id="${s.id}" data-json='${JSON.stringify(s).replace(/'/g, "&apos;")}'>Edit</button>
                    <button class="btn btn-danger btn-xs btn-del-sec" data-id="${s.id}" data-name="${s.name}" data-students="${s._count.students}">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Event handlers for action buttons
      tableDiv.querySelectorAll('.status-toggle-pill').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-section-id');
          const current = e.currentTarget.getAttribute('data-current') === 'true';
          await toggleSectionStatus(id, !current);
        });
      });

      tableDiv.querySelectorAll('.btn-edit-sec').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const raw = e.currentTarget.getAttribute('data-json');
          const sec = JSON.parse(raw);
          openSectionModal(sec);
        });
      });

      tableDiv.querySelectorAll('.btn-del-sec').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const name = e.currentTarget.getAttribute('data-name');
          deleteSectionWithSafety(id, name);
        });
      });

    } catch (e) {
      console.error('Failed to load sections:', e);
      tableDiv.innerHTML = `<div style="color: #f43f5e; padding: 20px;">Failed to load sections.</div>`;
    }
  }

  async function toggleSectionStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/admin/sections/${id}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ isActive: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update section status');
      showNotification(data.message, 'success');
      loadSectionsList();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  }

  async function deleteSectionWithSafety(id, name) {
    if (!confirm(`Are you sure you want to delete Section "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/sections/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();

      if (res.status === 409) {
        // Protected deletion with reference warning!
        showSafeDeactivationModal('Section', name, data.error, data.recommendation, async () => {
          await toggleSectionStatus(id, false);
        });
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Failed to delete section');
      showNotification(data.message, 'success');
      loadSectionsList();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  }

  function openSectionModal(section = null) {
    const isEdit = !!section;
    const modalBackdrop = container.querySelector('#structure-modal-backdrop');
    if (!modalBackdrop) return;

    modalBackdrop.style.display = 'flex';
    modalBackdrop.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? 'Edit Section' : 'Create New Section'}</div>
          <button class="btn-close-modal" id="modal-close-btn">&times;</button>
        </div>
        <form id="section-form">
          <div class="form-group">
            <label class="form-label">Section Name</label>
            <input 
              type="text" 
              id="sec-input-name" 
              class="form-input" 
              placeholder="e.g. A, B, Section C" 
              value="${section ? section.name : ''}" 
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Academic Year</label>
            <select id="sec-select-acad" class="form-input form-select" required>
              ${overviewData.academicYears.map(y => `
                <option value="${y.id}" ${(section ? section.academicYearId === y.id : y.id === selectedAcademicYearId) ? 'selected' : ''}>
                  ${y.yearName} ${y.isCurrent ? '★ (Current)' : ''}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Department</label>
            <select id="sec-select-dept" class="form-input form-select" required>
              ${overviewData.departments.map(d => `
                <option value="${d.id}" ${(section ? section.departmentId === d.id : d.id === selectedDepartmentId) ? 'selected' : ''}>
                  [${d.code}] ${d.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Study Year</label>
            <select id="sec-select-year" class="form-input form-select" required>
              ${overviewData.years.map(y => `
                <option value="${y.id}" ${(section ? section.yearId === y.id : y.id === selectedYearId) ? 'selected' : ''}>
                  ${y.name} (Year ${y.yearNumber})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="sec-checkbox-active" ${section ? (section.isActive ? 'checked' : '') : 'checked'} />
            <label for="sec-checkbox-active" style="cursor: pointer; font-size: 14px;">Active Section</label>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
            <button type="button" class="btn btn-secondary btn-sm" id="modal-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">${isEdit ? 'Save Changes' : 'Create Section'}</button>
          </div>
        </form>
      </div>
    `;

    const closeModal = () => { modalBackdrop.style.display = 'none'; };
    modalBackdrop.querySelector('#modal-close-btn').addEventListener('click', closeModal);
    modalBackdrop.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);

    modalBackdrop.querySelector('#section-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modalBackdrop.querySelector('#sec-input-name').value.trim();
      const academicYearId = modalBackdrop.querySelector('#sec-select-acad').value;
      const departmentId = modalBackdrop.querySelector('#sec-select-dept').value;
      const yearId = modalBackdrop.querySelector('#sec-select-year').value;
      const isActive = modalBackdrop.querySelector('#sec-checkbox-active').checked;

      try {
        const url = isEdit ? `/api/admin/sections/${section.id}` : '/api/admin/sections';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: getHeaders(),
          body: JSON.stringify({ name, academicYearId, departmentId, yearId, isActive })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Operation failed');

        showNotification(data.message, 'success');
        closeModal();
        loadSectionsList();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    });
  }

  // ==========================================================
  // TAB 2: DEPARTMENTS
  // ==========================================================
  async function renderDepartmentsTab(tabContainer) {
    tabContainer.innerHTML = `
      <div class="card-box">
        <div class="card-box-header">
          <div>
            <div class="card-box-title">Academic Departments</div>
            <div style="font-size: 13px; color: var(--text-muted);">
              Manage engineering and science academic branches
            </div>
          </div>
          <button id="btn-add-dept" class="btn btn-primary btn-sm">
            <span>➕</span> Add Department
          </button>
        </div>

        <div style="display: flex; gap: 12px; margin: 16px 0;">
          <input type="text" id="dept-search-input" class="form-input" placeholder="Search by code or name..." style="max-width: 320px;" />
          <select id="dept-status-filter" class="form-input form-select" style="max-width: 180px;">
            <option value="all">All Departments</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div id="dept-table-container">Loading...</div>
      </div>
    `;

    tabContainer.querySelector('#btn-add-dept').addEventListener('click', () => openDepartmentModal());
    const searchInp = tabContainer.querySelector('#dept-search-input');
    const statusSel = tabContainer.querySelector('#dept-status-filter');

    searchInp.addEventListener('input', () => loadDeptList());
    statusSel.addEventListener('change', () => loadDeptList());

    async function loadDeptList() {
      const tableDiv = tabContainer.querySelector('#dept-table-container');
      const search = searchInp.value.trim();
      const status = statusSel.value;

      try {
        const res = await fetch(`/api/admin/departments?search=${encodeURIComponent(search)}&status=${status}`, { headers: getHeaders() });
        const data = await res.json();
        const depts = data.departments || [];

        tableDiv.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Department Name</th>
                <th>Sections</th>
                <th>Subjects</th>
                <th>Students</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${depts.map(d => `
                <tr>
                  <td><span class="role-pill badge-staff" style="font-size: 12px; font-weight: 700;">${d.code}</span></td>
                  <td><strong style="color: #ffffff;">${d.name}</strong></td>
                  <td>${d._count.sections}</td>
                  <td>${d._count.subjects}</td>
                  <td>${d._count.students}</td>
                  <td>
                    <button class="status-toggle-pill ${d.isActive ? 'active' : 'inactive'}" data-dept-id="${d.id}" data-current="${d.isActive}">
                      ${d.isActive ? '● Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-xs btn-edit-dept" data-json='${JSON.stringify(d).replace(/'/g, "&apos;")}'>Edit</button>
                    <button class="btn btn-danger btn-xs btn-del-dept" data-id="${d.id}" data-code="${d.code}">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        tableDiv.querySelectorAll('.status-toggle-pill').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-dept-id');
            const current = e.currentTarget.getAttribute('data-current') === 'true';
            await toggleDeptStatus(id, !current);
          });
        });

        tableDiv.querySelectorAll('.btn-edit-dept').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const d = JSON.parse(e.currentTarget.getAttribute('data-json'));
            openDepartmentModal(d);
          });
        });

        tableDiv.querySelectorAll('.btn-del-dept').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const code = e.currentTarget.getAttribute('data-code');
            deleteDeptWithSafety(id, code);
          });
        });

      } catch (e) {
        tableDiv.innerHTML = `<div style="color: #f43f5e;">Failed to load departments.</div>`;
      }
    }

    async function toggleDeptStatus(id, newStatus) {
      try {
        const res = await fetch(`/api/admin/departments/${id}/status`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ isActive: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showNotification(data.message, 'success');
        loadDeptList();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    }

    async function deleteDeptWithSafety(id, code) {
      if (!confirm(`Delete Department "${code}"?`)) return;
      try {
        const res = await fetch(`/api/admin/departments/${id}`, { method: 'DELETE', headers: getHeaders() });
        const data = await res.json();
        if (res.status === 409) {
          showSafeDeactivationModal('Department', code, data.error, data.recommendation, async () => {
            await toggleDeptStatus(id, false);
          });
          return;
        }
        if (!res.ok) throw new Error(data.error);
        showNotification(data.message, 'success');
        loadDeptList();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    }

    function openDepartmentModal(dept = null) {
      const isEdit = !!dept;
      const modalBackdrop = container.querySelector('#structure-modal-backdrop');
      modalBackdrop.style.display = 'flex';
      modalBackdrop.innerHTML = `
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">${isEdit ? 'Edit Department' : 'Create Department'}</div>
            <button class="btn-close-modal" id="modal-close-btn">&times;</button>
          </div>
          <form id="dept-form">
            <div class="form-group">
              <label class="form-label">Department Code (Uppercase)</label>
              <input type="text" id="dept-code-inp" class="form-input" placeholder="e.g. CSE, ECE, MECH" value="${dept ? dept.code : ''}" required style="text-transform: uppercase;" />
            </div>
            <div class="form-group">
              <label class="form-label">Department Full Name</label>
              <input type="text" id="dept-name-inp" class="form-input" placeholder="e.g. Computer Science and Engineering" value="${dept ? dept.name : ''}" required />
            </div>
            <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="dept-active-chk" ${dept ? (dept.isActive ? 'checked' : '') : 'checked'} />
              <label for="dept-active-chk" style="cursor: pointer; font-size: 14px;">Active Department</label>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
              <button type="button" class="btn btn-secondary btn-sm" id="modal-cancel-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">${isEdit ? 'Save Changes' : 'Create Department'}</button>
            </div>
          </form>
        </div>
      `;

      const closeModal = () => { modalBackdrop.style.display = 'none'; };
      modalBackdrop.querySelector('#modal-close-btn').addEventListener('click', closeModal);
      modalBackdrop.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);

      modalBackdrop.querySelector('#dept-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = modalBackdrop.querySelector('#dept-code-inp').value.trim();
        const name = modalBackdrop.querySelector('#dept-name-inp').value.trim();
        const isActive = modalBackdrop.querySelector('#dept-active-chk').checked;

        try {
          const url = isEdit ? `/api/admin/departments/${dept.id}` : '/api/admin/departments';
          const method = isEdit ? 'PUT' : 'POST';
          const res = await fetch(url, {
            method,
            headers: getHeaders(),
            body: JSON.stringify({ code, name, isActive })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          showNotification(data.message, 'success');
          closeModal();
          loadDeptList();
        } catch (err) {
          showNotification(err.message, 'error');
        }
      });
    }

    loadDeptList();
  }

  // ==========================================================
  // TAB 3: YEARS
  // ==========================================================
  async function renderYearsTab(tabContainer) {
    tabContainer.innerHTML = `
      <div class="card-box">
        <div class="card-box-header">
          <div>
            <div class="card-box-title">Study Years</div>
            <div style="font-size: 13px; color: var(--text-muted);">
              Manage 1st Year through 4th Year degree cohorts
            </div>
          </div>
          <button id="btn-add-yr" class="btn btn-primary btn-sm">
            <span>➕</span> Add Study Year
          </button>
        </div>
        <div id="years-table-container" style="margin-top: 16px;">Loading...</div>
      </div>
    `;

    tabContainer.querySelector('#btn-add-yr').addEventListener('click', () => openYearModal());

    async function loadYearsList() {
      const tableDiv = tabContainer.querySelector('#years-table-container');
      try {
        const res = await fetch('/api/admin/years', { headers: getHeaders() });
        const data = await res.json();
        const yrs = data.years || [];

        tableDiv.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Year Number</th>
                <th>Display Name</th>
                <th>Sections</th>
                <th>Subjects</th>
                <th>Students</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${yrs.map(y => `
                <tr>
                  <td><span class="badge badge-admin">Year ${y.yearNumber}</span></td>
                  <td><strong style="color: #ffffff;">${y.name}</strong></td>
                  <td>${y._count.sections}</td>
                  <td>${y._count.subjects}</td>
                  <td>${y._count.students}</td>
                  <td>
                    <button class="status-toggle-pill ${y.isActive ? 'active' : 'inactive'}" data-yr-id="${y.id}" data-current="${y.isActive}">
                      ${y.isActive ? '● Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-xs btn-edit-yr" data-json='${JSON.stringify(y).replace(/'/g, "&apos;")}'>Edit</button>
                    <button class="btn btn-danger btn-xs btn-del-yr" data-id="${y.id}" data-name="${y.name}">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        tableDiv.querySelectorAll('.status-toggle-pill').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-yr-id');
            const current = e.currentTarget.getAttribute('data-current') === 'true';
            await toggleYearStatus(id, !current);
          });
        });

        tableDiv.querySelectorAll('.btn-edit-yr').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const y = JSON.parse(e.currentTarget.getAttribute('data-json'));
            openYearModal(y);
          });
        });

        tableDiv.querySelectorAll('.btn-del-yr').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const name = e.currentTarget.getAttribute('data-name');
            deleteYearWithSafety(id, name);
          });
        });

      } catch (e) {
        tableDiv.innerHTML = `<div style="color: #f43f5e;">Failed to load years.</div>`;
      }
    }

    async function toggleYearStatus(id, newStatus) {
      try {
        const res = await fetch(`/api/admin/years/${id}/status`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ isActive: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showNotification(data.message, 'success');
        loadYearsList();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    }

    async function deleteYearWithSafety(id, name) {
      if (!confirm(`Delete Year "${name}"?`)) return;
      try {
        const res = await fetch(`/api/admin/years/${id}`, { method: 'DELETE', headers: getHeaders() });
        const data = await res.json();
        if (res.status === 409) {
          showSafeDeactivationModal('Year', name, data.error, data.recommendation, async () => {
            await toggleYearStatus(id, false);
          });
          return;
        }
        if (!res.ok) throw new Error(data.error);
        showNotification(data.message, 'success');
        loadYearsList();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    }

    function openYearModal(yearObj = null) {
      const isEdit = !!yearObj;
      const modalBackdrop = container.querySelector('#structure-modal-backdrop');
      modalBackdrop.style.display = 'flex';
      modalBackdrop.innerHTML = `
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">${isEdit ? 'Edit Year' : 'Create Study Year'}</div>
            <button class="btn-close-modal" id="modal-close-btn">&times;</button>
          </div>
          <form id="year-form">
            <div class="form-group">
              <label class="form-label">Year Number (1-10)</label>
              <input type="number" id="yr-num-inp" class="form-input" min="1" max="10" value="${yearObj ? yearObj.yearNumber : ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input type="text" id="yr-name-inp" class="form-input" placeholder="e.g. 1st Year, 2nd Year" value="${yearObj ? yearObj.name : ''}" required />
            </div>
            <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="yr-active-chk" ${yearObj ? (yearObj.isActive ? 'checked' : '') : 'checked'} />
              <label for="yr-active-chk" style="cursor: pointer; font-size: 14px;">Active Year</label>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
              <button type="button" class="btn btn-secondary btn-sm" id="modal-cancel-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">${isEdit ? 'Save Changes' : 'Create Year'}</button>
            </div>
          </form>
        </div>
      `;

      const closeModal = () => { modalBackdrop.style.display = 'none'; };
      modalBackdrop.querySelector('#modal-close-btn').addEventListener('click', closeModal);
      modalBackdrop.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);

      modalBackdrop.querySelector('#year-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const yearNumber = modalBackdrop.querySelector('#yr-num-inp').value;
        const name = modalBackdrop.querySelector('#yr-name-inp').value.trim();
        const isActive = modalBackdrop.querySelector('#yr-active-chk').checked;

        try {
          const url = isEdit ? `/api/admin/years/${yearObj.id}` : '/api/admin/years';
          const method = isEdit ? 'PUT' : 'POST';
          const res = await fetch(url, {
            method,
            headers: getHeaders(),
            body: JSON.stringify({ yearNumber, name, isActive })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          showNotification(data.message, 'success');
          closeModal();
          loadYearsList();
        } catch (err) {
          showNotification(err.message, 'error');
        }
      });
    }

    loadYearsList();
  }

  // ==========================================================
  // TAB 4: ACADEMIC YEARS
  // ==========================================================
  async function renderAcademicYearsTab(tabContainer) {
    tabContainer.innerHTML = `
      <div class="card-box">
        <div class="card-box-header">
          <div>
            <div class="card-box-title">Academic Years</div>
            <div style="font-size: 13px; color: var(--text-muted);">
              Define college academic sessions (e.g. 2025-2026, 2026-2027)
            </div>
          </div>
          <button id="btn-add-acad" class="btn btn-primary btn-sm">
            <span>➕</span> Add Academic Year
          </button>
        </div>

        <div style="display: flex; gap: 12px; margin: 16px 0;">
          <input type="text" id="acad-search-input" class="form-input" placeholder="Search academic year..." style="max-width: 320px;" />
          <select id="acad-status-filter" class="form-input form-select" style="max-width: 180px;">
            <option value="all">All Academic Years</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div id="acad-table-container">Loading...</div>
      </div>
    `;

    tabContainer.querySelector('#btn-add-acad').addEventListener('click', () => openAcademicYearModal());
    const searchInp = tabContainer.querySelector('#acad-search-input');
    const statusSel = tabContainer.querySelector('#acad-status-filter');

    searchInp.addEventListener('input', () => loadAcadList());
    statusSel.addEventListener('change', () => loadAcadList());

    async function loadAcadList() {
      const tableDiv = tabContainer.querySelector('#acad-table-container');
      const search = searchInp.value.trim();
      const status = statusSel.value;

      try {
        const res = await fetch(`/api/admin/academic-years?search=${encodeURIComponent(search)}&status=${status}`, { headers: getHeaders() });
        const data = await res.json();
        const years = data.academicYears || [];

        tableDiv.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Academic Session</th>
                <th>Active Session Flag</th>
                <th>Sections</th>
                <th>Enrolled Students</th>
                <th>Assignments</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${years.map(y => `
                <tr>
                  <td><strong style="color: #ffffff; font-size: 15px;">${y.yearName}</strong></td>
                  <td>
                    ${y.isCurrent 
                      ? `<span class="badge badge-success">★ Current Active Session</span>` 
                      : `<button class="btn btn-secondary btn-xs btn-set-current" data-id="${y.id}">Set as Current</button>`
                    }
                  </td>
                  <td>${y._count.sections}</td>
                  <td>${y._count.students}</td>
                  <td>${y._count.teacherAssignments}</td>
                  <td>
                    <button class="status-toggle-pill ${y.isActive ? 'active' : 'inactive'}" data-acad-id="${y.id}" data-current="${y.isActive}">
                      ${y.isActive ? '● Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-xs btn-edit-acad" data-json='${JSON.stringify(y).replace(/'/g, "&apos;")}'>Edit</button>
                    <button class="btn btn-danger btn-xs btn-del-acad" data-id="${y.id}" data-name="${y.yearName}">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        tableDiv.querySelectorAll('.btn-set-current').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            await setAcademicYearCurrent(id);
          });
        });

        tableDiv.querySelectorAll('.status-toggle-pill').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-acad-id');
            const current = e.currentTarget.getAttribute('data-current') === 'true';
            await toggleAcadStatus(id, !current);
          });
        });

        tableDiv.querySelectorAll('.btn-edit-acad').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const y = JSON.parse(e.currentTarget.getAttribute('data-json'));
            openAcademicYearModal(y);
          });
        });

        tableDiv.querySelectorAll('.btn-del-acad').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const name = e.currentTarget.getAttribute('data-name');
            deleteAcadWithSafety(id, name);
          });
        });

      } catch (e) {
        tableDiv.innerHTML = `<div style="color: #f43f5e;">Failed to load academic years.</div>`;
      }
    }

    async function setAcademicYearCurrent(id) {
      try {
        const res = await fetch(`/api/admin/academic-years/${id}/status`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ isCurrent: true, isActive: true })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showNotification('Academic year set as current session!', 'success');
        loadAcadList();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    }

    async function toggleAcadStatus(id, newStatus) {
      try {
        const res = await fetch(`/api/admin/academic-years/${id}/status`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ isActive: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showNotification(data.message, 'success');
        loadAcadList();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    }

    async function deleteAcadWithSafety(id, name) {
      if (!confirm(`Delete Academic Year "${name}"?`)) return;
      try {
        const res = await fetch(`/api/admin/academic-years/${id}`, { method: 'DELETE', headers: getHeaders() });
        const data = await res.json();
        if (res.status === 409) {
          showSafeDeactivationModal('Academic Year', name, data.error, data.recommendation, async () => {
            await toggleAcadStatus(id, false);
          });
          return;
        }
        if (!res.ok) throw new Error(data.error);
        showNotification(data.message, 'success');
        loadAcadList();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    }

    function openAcademicYearModal(yearObj = null) {
      const isEdit = !!yearObj;
      const modalBackdrop = container.querySelector('#structure-modal-backdrop');
      modalBackdrop.style.display = 'flex';
      modalBackdrop.innerHTML = `
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">${isEdit ? 'Edit Academic Year' : 'Create Academic Year'}</div>
            <button class="btn-close-modal" id="modal-close-btn">&times;</button>
          </div>
          <form id="acad-form">
            <div class="form-group">
              <label class="form-label">Academic Year Name (e.g. 2026-2027)</label>
              <input type="text" id="acad-name-inp" class="form-input" placeholder="2026-2027" value="${yearObj ? yearObj.yearName : ''}" required />
            </div>
            <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="acad-current-chk" ${yearObj ? (yearObj.isCurrent ? 'checked' : '') : ''} />
              <label for="acad-current-chk" style="cursor: pointer; font-size: 14px;">Set as Current Academic Session</label>
            </div>
            <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="acad-active-chk" ${yearObj ? (yearObj.isActive ? 'checked' : '') : 'checked'} />
              <label for="acad-active-chk" style="cursor: pointer; font-size: 14px;">Active Session</label>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
              <button type="button" class="btn btn-secondary btn-sm" id="modal-cancel-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">${isEdit ? 'Save Changes' : 'Create Academic Year'}</button>
            </div>
          </form>
        </div>
      `;

      const closeModal = () => { modalBackdrop.style.display = 'none'; };
      modalBackdrop.querySelector('#modal-close-btn').addEventListener('click', closeModal);
      modalBackdrop.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);

      modalBackdrop.querySelector('#acad-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const yearName = modalBackdrop.querySelector('#acad-name-inp').value.trim();
        const isCurrent = modalBackdrop.querySelector('#acad-current-chk').checked;
        const isActive = modalBackdrop.querySelector('#acad-active-chk').checked;

        try {
          const url = isEdit ? `/api/admin/academic-years/${yearObj.id}` : '/api/admin/academic-years';
          const method = isEdit ? 'PUT' : 'POST';
          const res = await fetch(url, {
            method,
            headers: getHeaders(),
            body: JSON.stringify({ yearName, isCurrent, isActive })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          showNotification(data.message, 'success');
          closeModal();
          loadAcadList();
        } catch (err) {
          showNotification(err.message, 'error');
        }
      });
    }

    loadAcadList();
  }

  // ==========================================================
  // MODAL: SAFE DEACTIVATION DIALOG
  // ==========================================================
  function showSafeDeactivationModal(entityType, entityName, errorMessage, recommendation, onDeactivateCallback) {
    const modalBackdrop = container.querySelector('#structure-modal-backdrop');
    modalBackdrop.style.display = 'flex';
    modalBackdrop.innerHTML = `
      <div class="modal-card" style="border-top: 3px solid #f59e0b;">
        <div class="modal-header">
          <div class="modal-title" style="color: #f59e0b;">⚠️ Deletion Blocked by Data Integrity Guard</div>
          <button class="btn-close-modal" id="deact-modal-close">&times;</button>
        </div>
        <div style="margin: 16px 0;">
          <p style="color: #ffffff; font-weight: 600; margin-bottom: 8px;">
            Cannot delete ${entityType} "${entityName}".
          </p>
          <p style="color: var(--text-muted); font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
            ${errorMessage}
          </p>
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); padding: 12px; font-size: 13px; color: #fbbf24;">
            <strong>🛡️ Recommended Action:</strong> ${recommendation}
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
          <button class="btn btn-secondary btn-sm" id="deact-cancel-btn">Cancel</button>
          <button class="btn btn-warning btn-sm" id="deact-confirm-btn" style="background: #f59e0b; color: #000; font-weight: 700;">
            Safely Deactivate ${entityType} Instead
          </button>
        </div>
      </div>
    `;

    const close = () => { modalBackdrop.style.display = 'none'; };
    modalBackdrop.querySelector('#deact-modal-close').addEventListener('click', close);
    modalBackdrop.querySelector('#deact-cancel-btn').addEventListener('click', close);
    modalBackdrop.querySelector('#deact-confirm-btn').addEventListener('click', async () => {
      close();
      await onDeactivateCallback();
    });
  }

  // Initial call
  render();
}
