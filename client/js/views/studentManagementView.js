import { Auth } from '../auth.js';
import { openStudentImportModal } from './studentImportModal.js';

export function renderStudentManagementView(container) {
  let overviewData = { academicYears: [], departments: [], years: [] };
  let allSections = [];

  // Filter state
  let selectedAcademicYearId = 'all';
  let selectedDepartmentId = 'all';
  let selectedYearId = 'all';
  let selectedSectionId = 'all';
  let selectedStatus = 'all';
  let searchTerm = '';

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
      const [overviewRes, sectionsRes] = await Promise.all([
        fetch('/api/admin/academic-structure/overview', { headers: getHeaders() }),
        fetch('/api/admin/sections', { headers: getHeaders() })
      ]);

      if (overviewRes.ok) {
        overviewData = await overviewRes.json();
      }
      if (sectionsRes.ok) {
        const secData = await sectionsRes.json();
        allSections = secData.sections || [];
      }
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
  }

  function getFilteredSections() {
    return allSections.filter(s => {
      const matchAcad = selectedAcademicYearId === 'all' || s.academicYearId === selectedAcademicYearId;
      const matchDept = selectedDepartmentId === 'all' || s.departmentId === selectedDepartmentId;
      const matchYear = selectedYearId === 'all' || s.yearId === selectedYearId;
      return matchAcad && matchDept && matchYear;
    });
  }

  async function render() {
    await loadInitialData();

    container.innerHTML = `
      <div class="student-management-container">
        <!-- Privacy Notice Banner -->
        <div class="privacy-banner">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="font-size: 28px;">🔒</div>
            <div>
              <div style="font-size: 14px; font-weight: 700; color: #ffffff;">Parent Contact Privacy Protection Enforced</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                Parents do not have login accounts. Parent phone numbers are strictly protected and hidden from Teaching Staff. 
                Only Administrators can manage parent records.
              </div>
            </div>
          </div>
          <div class="role-pill badge-admin" style="font-size: 11px;">Admin Clearance Required</div>
        </div>

        <div class="card-box" style="margin-top: 20px;">
          <div class="card-box-header" style="flex-wrap: wrap; gap: 16px;">
            <div>
              <div class="card-box-title">Student & Parent Directory</div>
              <div style="font-size: 13px; color: var(--text-muted);">
                Complete enrollment roster, parent guardian records, and class allocations
              </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <button id="btn-bulk-import" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px;">
                <span>📂</span> Bulk Import (Excel/CSV)
              </button>
              <button id="btn-add-student" class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 6px;">
                <span>➕</span> Register Student
              </button>
            </div>
          </div>

          <!-- Dependent Cascading Filter Bar -->
          <div class="cascade-filter-bar">
            <div class="filter-col">
              <label class="filter-label">1. Academic Year</label>
              <select id="filter-stu-acad" class="form-input form-select">
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
              <select id="filter-stu-dept" class="form-input form-select">
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
              <select id="filter-stu-year" class="form-input form-select">
                <option value="all">All Years</option>
                ${overviewData.years.map(y => `
                  <option value="${y.id}" ${y.id === selectedYearId ? 'selected' : ''}>
                    ${y.name} (Year ${y.yearNumber})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="filter-col">
              <label class="filter-label">4. Section</label>
              <select id="filter-stu-sec" class="form-input form-select">
                <option value="all">All Sections</option>
                ${getFilteredSections().map(s => `
                  <option value="${s.id}" ${s.id === selectedSectionId ? 'selected' : ''}>
                    Section ${s.name} (${s.department.code})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="filter-col">
              <label class="filter-label">Status</label>
              <select id="filter-stu-status" class="form-input form-select">
                <option value="all" ${selectedStatus === 'all' ? 'selected' : ''}>All Statuses</option>
                <option value="ACTIVE" ${selectedStatus === 'ACTIVE' ? 'selected' : ''}>Active</option>
                <option value="INACTIVE" ${selectedStatus === 'INACTIVE' ? 'selected' : ''}>Inactive</option>
                <option value="DETAINED" ${selectedStatus === 'DETAINED' ? 'selected' : ''}>Detained</option>
                <option value="ALUMNI" ${selectedStatus === 'ALUMNI' ? 'selected' : ''}>Alumni</option>
              </select>
            </div>

            <div class="filter-col" style="flex: 1.5; min-width: 180px;">
              <label class="filter-label">Search Student / Parent</label>
              <input 
                type="text" 
                id="filter-stu-search" 
                class="form-input" 
                placeholder="Name, Reg No, or Mobile..." 
                value="${searchTerm}"
              />
            </div>
          </div>

          <!-- Students Table Container -->
          <div id="students-table-container" style="margin-top: 16px;">
            <div style="text-align: center; padding: 40px; color: var(--text-dim);">Loading Students...</div>
          </div>
        </div>
      </div>

      <!-- Modal Container -->
      <div id="student-modal-backdrop" class="modal-backdrop" style="display: none;"></div>
    `;

    // Hook filter event listeners
    const acadSel = container.querySelector('#filter-stu-acad');
    const deptSel = container.querySelector('#filter-stu-dept');
    const yearSel = container.querySelector('#filter-stu-year');
    const secSel = container.querySelector('#filter-stu-sec');
    const statusSel = container.querySelector('#filter-stu-status');
    const searchInp = container.querySelector('#filter-stu-search');

    const updateDependentSections = () => {
      const filtered = getFilteredSections();
      secSel.innerHTML = `
        <option value="all">All Sections</option>
        ${filtered.map(s => `
          <option value="${s.id}" ${s.id === selectedSectionId ? 'selected' : ''}>
            Section ${s.name} (${s.department.code})
          </option>
        `).join('')}
      `;
    };

    acadSel.addEventListener('change', (e) => {
      selectedAcademicYearId = e.target.value;
      updateDependentSections();
      loadStudentsList();
    });

    deptSel.addEventListener('change', (e) => {
      selectedDepartmentId = e.target.value;
      updateDependentSections();
      loadStudentsList();
    });

    yearSel.addEventListener('change', (e) => {
      selectedYearId = e.target.value;
      updateDependentSections();
      loadStudentsList();
    });

    secSel.addEventListener('change', (e) => {
      selectedSectionId = e.target.value;
      loadStudentsList();
    });

    statusSel.addEventListener('change', (e) => {
      selectedStatus = e.target.value;
      loadStudentsList();
    });

    searchInp.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      loadStudentsList();
    });

    const btnBulkImport = container.querySelector('#btn-bulk-import');
    if (btnBulkImport) {
      btnBulkImport.addEventListener('click', () => {
        openStudentImportModal({
          academicYears: overviewData.academicYears || [],
          currentAcademicYearId: selectedAcademicYearId !== 'all' ? selectedAcademicYearId : overviewData.academicYears.find(y => y.isCurrent)?.id,
          onSuccess: () => {
            loadStudentsList();
          }
        });
      });
    }

    container.querySelector('#btn-add-student').addEventListener('click', () => {
      openStudentModal();
    });

    loadStudentsList();
  }

  async function loadStudentsList() {
    const tableDiv = container.querySelector('#students-table-container');
    if (!tableDiv) return;

    let url = `/api/admin/students?search=${encodeURIComponent(searchTerm)}`;
    if (selectedAcademicYearId !== 'all') url += `&academicYearId=${selectedAcademicYearId}`;
    if (selectedDepartmentId !== 'all') url += `&departmentId=${selectedDepartmentId}`;
    if (selectedYearId !== 'all') url += `&yearId=${selectedYearId}`;
    if (selectedSectionId !== 'all') url += `&sectionId=${selectedSectionId}`;
    if (selectedStatus !== 'all') url += `&status=${selectedStatus}`;

    try {
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      const students = data.students || [];

      if (students.length === 0) {
        tableDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
            <div style="font-size: 32px; margin-bottom: 8px;">🎓</div>
            <div style="font-weight: 600; color: var(--text-main);">No Students Found</div>
            <div style="font-size: 13px; color: var(--text-dim); margin-top: 4px;">
              No student records match the active search and filter criteria.
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
                <th>Register No</th>
                <th>Student Name</th>
                <th>Academic Allocation</th>
                <th>Academic Session</th>
                <th>Parent Guardian</th>
                <th>Protected Mobile</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => `
                <tr>
                  <td>
                    <span class="role-pill badge-staff" style="font-family: var(--font-mono); font-weight: 700; font-size: 11px;">
                      ${s.registerNumber}
                    </span>
                  </td>
                  <td>
                    <strong style="color: #ffffff; font-size: 14px;">${s.name}</strong>
                  </td>
                  <td>
                    <div style="font-weight: 600; color: #38bdf8;">${s.department.code} • Year ${s.year.yearNumber}</div>
                    <div style="font-size: 11px; color: var(--text-dim);">${s.section.name.startsWith('Section') ? s.section.name : `Section ${s.section.name}`}</div>
                  </td>
                  <td>
                    <span class="badge ${s.academicYear.isCurrent ? 'badge-admin' : 'badge-neutral'}">
                      ${s.academicYear.yearName}
                    </span>
                  </td>
                  <td>
                    <div style="color: #ffffff; font-weight: 500;">👤 ${s.parentName}</div>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-family: var(--font-mono); color: #34d399; font-size: 12px; font-weight: 600;">
                        📞 ${s.parentMobile}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button class="status-toggle-pill ${s.status === 'ACTIVE' ? 'active' : 'inactive'}" data-stu-id="${s.id}" data-current="${s.status}">
                      ${s.status === 'ACTIVE' ? '● Active' : '○ ' + s.status}
                    </button>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-secondary btn-xs btn-view-stu" data-id="${s.id}">View</button>
                    <button class="btn btn-secondary btn-xs btn-edit-stu" data-json='${JSON.stringify(s).replace(/'/g, "&apos;")}'>Edit</button>
                    <button class="btn btn-danger btn-xs btn-del-stu" data-id="${s.id}" data-name="${s.name}" data-marks="${s._count.marks}">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Event handlers
      tableDiv.querySelectorAll('.status-toggle-pill').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-stu-id');
          const current = e.currentTarget.getAttribute('data-current');
          const next = current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          await toggleStatus(id, next);
        });
      });

      tableDiv.querySelectorAll('.btn-view-stu').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          openViewDetailsModal(id);
        });
      });

      tableDiv.querySelectorAll('.btn-edit-stu').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const s = JSON.parse(e.currentTarget.getAttribute('data-json'));
          openStudentModal(s);
        });
      });

      tableDiv.querySelectorAll('.btn-del-stu').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const name = e.currentTarget.getAttribute('data-name');
          deleteStudentWithSafety(id, name);
        });
      });

    } catch (e) {
      console.error('Failed to load students:', e);
      tableDiv.innerHTML = `<div style="color: #f43f5e; padding: 20px;">Failed to load students roster.</div>`;
    }
  }

  async function toggleStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/admin/students/${id}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle status');
      showNotification(data.message, 'success');
      loadStudentsList();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  }

  async function deleteStudentWithSafety(id, name) {
    if (!confirm(`Are you sure you want to delete student "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();

      if (res.status === 409) {
        showDeactivationPromptModal(name, data.error, data.recommendation, async () => {
          await toggleStatus(id, 'INACTIVE');
        });
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Failed to delete student');
      showNotification(data.message, 'success');
      loadStudentsList();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  }

  async function openViewDetailsModal(id) {
    const modalBackdrop = container.querySelector('#student-modal-backdrop');
    modalBackdrop.style.display = 'flex';
    modalBackdrop.innerHTML = `
      <div class="modal-card" style="max-width: 600px;">
        <div class="modal-header">
          <div class="modal-title">Student & Parent Profile</div>
          <button class="btn-close-modal" id="modal-close-btn">&times;</button>
        </div>
        <div id="view-details-body" style="padding: 20px 0; text-align: center; color: var(--text-dim);">
          Loading student details...
        </div>
      </div>
    `;

    modalBackdrop.querySelector('#modal-close-btn').addEventListener('click', () => {
      modalBackdrop.style.display = 'none';
    });

    try {
      const res = await fetch(`/api/admin/students/${id}`, { headers: getHeaders() });
      const data = await res.json();
      const s = data.student;

      const bodyDiv = modalBackdrop.querySelector('#view-details-body');
      bodyDiv.innerHTML = `
        <div style="text-align: left;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
            <div>
              <div style="font-size: 18px; font-weight: 700; color: #ffffff;">${s.name}</div>
              <div style="font-family: var(--font-mono); color: #38bdf8; font-size: 13px;">Reg No: ${s.registerNumber}</div>
            </div>
            <span class="status-toggle-pill ${s.status === 'ACTIVE' ? 'active' : 'inactive'}">
              ${s.status}
            </span>
          </div>

          <!-- Academic Structure Allocation -->
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px;">
              🏛️ Academic Hierarchy Placement
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px;">
              <div><strong>Academic Session:</strong> ${s.academicYear.yearName}</div>
              <div><strong>Department:</strong> ${s.department.name} (${s.department.code})</div>
              <div><strong>Study Year:</strong> ${s.year.name}</div>
              <div><strong>Section:</strong> ${s.section.name}</div>
            </div>
          </div>

          <!-- Protected Parent Guardian Details -->
          <div style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #34d399;">
                🛡️ Protected Parent / Guardian Contact
              </div>
              <span class="role-pill badge-admin" style="font-size: 10px;">Admin Verified</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px;">
              <div><strong>Parent Name:</strong> ${s.parentName}</div>
              <div><strong>Parent Mobile:</strong> <code style="color: #34d399; font-weight: 700;">${s.parentMobile}</code></div>
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 8px;">
              Parents receive automatic exam notifications via SMS & WhatsApp. No direct portal login is provided.
            </div>
          </div>

          <!-- Academic Marks Summary -->
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 14px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px;">
              📝 Internal Assessment Records (${s.marks ? s.marks.length : 0})
            </div>
            ${s.marks && s.marks.length > 0 ? `
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${s.marks.map(m => `
                  <span style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 4px; padding: 4px 8px; font-size: 12px; color: #c7d2fe;">
                    <strong>${m.assessment.name}</strong>: ${m.marksObtained}/${m.maximumMarks} (${m.subject.code})
                  </span>
                `).join('')}
              </div>
            ` : `
              <div style="font-size: 12px; color: var(--text-dim);">No internal assessment marks recorded yet.</div>
            `}
          </div>
        </div>
      `;
    } catch (err) {
      modalBackdrop.querySelector('#view-details-body').innerHTML = `
        <div style="color: #f43f5e;">Failed to load student details.</div>
      `;
    }
  }

  function openStudentModal(student = null) {
    const isEdit = !!student;
    const modalBackdrop = container.querySelector('#student-modal-backdrop');
    modalBackdrop.style.display = 'flex';

    // Filter available sections based on currently selected dept and year
    let formDeptId = student ? student.departmentId : (overviewData.departments[0]?.id || '');
    let formYearId = student ? student.yearId : (overviewData.years[0]?.id || '');
    let formAcadId = student ? student.academicYearId : (overviewData.academicYears.find(y => y.isCurrent)?.id || overviewData.academicYears[0]?.id || '');

    function getSectionsForForm(deptId, yrId, acadId) {
      return allSections.filter(s => s.departmentId === deptId && s.yearId === yrId && s.academicYearId === acadId);
    }

    let matchingSections = getSectionsForForm(formDeptId, formYearId, formAcadId);

    modalBackdrop.innerHTML = `
      <div class="modal-card" style="max-width: 580px;">
        <div class="modal-header">
          <div class="modal-title">${isEdit ? 'Edit Student & Parent Details' : 'Register New Student'}</div>
          <button class="btn-close-modal" id="modal-close-btn">&times;</button>
        </div>
        <form id="student-form">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Register Number</label>
              <input 
                type="text" 
                id="stu-regno-inp" 
                class="form-input" 
                placeholder="e.g. 2025CSE001" 
                value="${student ? student.registerNumber : ''}" 
                required 
                style="text-transform: uppercase;"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Student Full Name</label>
              <input 
                type="text" 
                id="stu-name-inp" 
                class="form-input" 
                placeholder="e.g. Aditya Kumar" 
                value="${student ? student.name : ''}" 
                required 
              />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Academic Session</label>
              <select id="stu-acad-select" class="form-input form-select" required>
                ${overviewData.academicYears.map(y => `
                  <option value="${y.id}" ${y.id === formAcadId ? 'selected' : ''}>
                    ${y.yearName} ${y.isCurrent ? '★ (Current)' : ''}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Department</label>
              <select id="stu-dept-select" class="form-input form-select" required>
                ${overviewData.departments.map(d => `
                  <option value="${d.id}" ${d.id === formDeptId ? 'selected' : ''}>
                    [${d.code}] ${d.name}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Study Year</label>
              <select id="stu-year-select" class="form-input form-select" required>
                ${overviewData.years.map(y => `
                  <option value="${y.id}" ${y.id === formYearId ? 'selected' : ''}>
                    ${y.name} (Year ${y.yearNumber})
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Class Section</label>
              <select id="stu-sec-select" class="form-input form-select" required>
                ${matchingSections.map(s => `
                  <option value="${s.id}" ${(student && student.sectionId === s.id) ? 'selected' : ''}>
                    Section ${s.name}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Parent Contact Section -->
          <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: var(--radius-sm); padding: 14px; margin: 12px 0;">
            <div style="font-size: 12px; font-weight: 700; color: #34d399; margin-bottom: 10px;">
              👨‍👩‍👦 Parent / Guardian Information (Protected)
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Parent Full Name</label>
                <input 
                  type="text" 
                  id="stu-parentname-inp" 
                  class="form-input" 
                  placeholder="e.g. Ramesh Kumar" 
                  value="${student ? student.parentName : ''}" 
                  required 
                />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Parent Mobile Number</label>
                <input 
                  type="tel" 
                  id="stu-parentmobile-inp" 
                  class="form-input" 
                  placeholder="e.g. 9876543210 or +91..." 
                  value="${student ? student.parentMobile : ''}" 
                  required 
                />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Enrollment Status</label>
            <select id="stu-status-select" class="form-input form-select">
              <option value="ACTIVE" ${(!student || student.status === 'ACTIVE') ? 'selected' : ''}>ACTIVE</option>
              <option value="INACTIVE" ${(student && student.status === 'INACTIVE') ? 'selected' : ''}>INACTIVE</option>
              <option value="DETAINED" ${(student && student.status === 'DETAINED') ? 'selected' : ''}>DETAINED</option>
              <option value="ALUMNI" ${(student && student.status === 'ALUMNI') ? 'selected' : ''}>ALUMNI</option>
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
            <button type="button" class="btn btn-secondary btn-sm" id="modal-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm">${isEdit ? 'Save Changes' : 'Register Student'}</button>
          </div>
        </form>
      </div>
    `;

    const closeModal = () => { modalBackdrop.style.display = 'none'; };
    modalBackdrop.querySelector('#modal-close-btn').addEventListener('click', closeModal);
    modalBackdrop.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);

    // Cascading dropdowns inside modal
    const modalAcad = modalBackdrop.querySelector('#stu-acad-select');
    const modalDept = modalBackdrop.querySelector('#stu-dept-select');
    const modalYear = modalBackdrop.querySelector('#stu-year-select');
    const modalSec = modalBackdrop.querySelector('#stu-sec-select');

    const refreshModalSections = () => {
      const aId = modalAcad.value;
      const dId = modalDept.value;
      const yId = modalYear.value;
      const secs = getSectionsForForm(dId, yId, aId);
      modalSec.innerHTML = secs.length > 0 
        ? secs.map(s => `<option value="${s.id}">Section ${s.name}</option>`).join('')
        : `<option value="">No sections found for this class</option>`;
    };

    modalAcad.addEventListener('change', refreshModalSections);
    modalDept.addEventListener('change', refreshModalSections);
    modalYear.addEventListener('change', refreshModalSections);

    modalBackdrop.querySelector('#student-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const registerNumber = modalBackdrop.querySelector('#stu-regno-inp').value.trim();
      const name = modalBackdrop.querySelector('#stu-name-inp').value.trim();
      const academicYearId = modalAcad.value;
      const departmentId = modalDept.value;
      const yearId = modalYear.value;
      const sectionId = modalSec.value;
      const parentName = modalBackdrop.querySelector('#stu-parentname-inp').value.trim();
      const parentMobile = modalBackdrop.querySelector('#stu-parentmobile-inp').value.trim();
      const status = modalBackdrop.querySelector('#stu-status-select').value;

      if (!sectionId) {
        showNotification('Please select a valid section for this student.', 'error');
        return;
      }

      try {
        const url = isEdit ? `/api/admin/students/${student.id}` : '/api/admin/students';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: getHeaders(),
          body: JSON.stringify({
            registerNumber,
            name,
            academicYearId,
            departmentId,
            yearId,
            sectionId,
            parentName,
            parentMobile,
            status
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Operation failed');

        showNotification(data.message, 'success');
        closeModal();
        loadStudentsList();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    });
  }

  function showDeactivationPromptModal(studentName, errorMessage, recommendation, onDeactivate) {
    const modalBackdrop = container.querySelector('#student-modal-backdrop');
    modalBackdrop.style.display = 'flex';
    modalBackdrop.innerHTML = `
      <div class="modal-card" style="border-top: 3px solid #f59e0b;">
        <div class="modal-header">
          <div class="modal-title" style="color: #f59e0b;">⚠️ Deletion Blocked: Historical Records Found</div>
          <button class="btn-close-modal" id="modal-close-prompt">&times;</button>
        </div>
        <div style="margin: 16px 0;">
          <p style="color: #ffffff; font-weight: 600; margin-bottom: 8px;">
            Cannot delete student "${studentName}".
          </p>
          <p style="color: var(--text-muted); font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
            ${errorMessage}
          </p>
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); padding: 12px; font-size: 13px; color: #fbbf24;">
            <strong>🛡️ Recommended Action:</strong> ${recommendation}
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
          <button class="btn btn-secondary btn-sm" id="prompt-cancel-btn">Cancel</button>
          <button class="btn btn-warning btn-sm" id="prompt-deactivate-btn" style="background: #f59e0b; color: #000; font-weight: 700;">
            Safely Deactivate Student Instead
          </button>
        </div>
      </div>
    `;

    const close = () => { modalBackdrop.style.display = 'none'; };
    modalBackdrop.querySelector('#modal-close-prompt').addEventListener('click', close);
    modalBackdrop.querySelector('#prompt-cancel-btn').addEventListener('click', close);
    modalBackdrop.querySelector('#prompt-deactivate-btn').addEventListener('click', async () => {
      close();
      await onDeactivate();
    });
  }

  // Initial render
  render();
}
