import { Auth } from '../auth.js';

export function renderMarksUploadView(container) {
  let assignedClasses = [];
  let availableAssessments = [];

  let selectedClass = null; // { id, sectionId, subjectId, academicYearId, subject, section, ... }
  let selectedAssessment = null; // { id, code, name, maximumMarks }

  let activeMethod = 'file'; // 'file' | 'manual'

  let previewData = null;
  let manualEntries = []; // [{ studentId, registerNumber, name, existingMark, newMark }]

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

  async function loadAssignedClasses() {
    try {
      const endpoint = Auth.isAdmin() ? '/api/staff/assigned-classes' : '/api/staff/assigned-classes';
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to load class allocations');
      const data = await res.json();
      assignedClasses = data.assignedClasses || [];
    } catch (err) {
      console.error('Error loading assigned classes:', err);
    }
  }

  async function loadAssessmentsForClass(secId, subId, ayId) {
    try {
      const res = await fetch(`/api/staff/assessments?sectionId=${secId}&subjectId=${subId}&academicYearId=${ayId}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to load assessments');
      const data = await res.json();
      availableAssessments = data.assessments || [];
    } catch (err) {
      console.error('Error loading assessments:', err);
      availableAssessments = [];
    }
  }

  async function loadManualRoster(secId, subId, ayId, asmId) {
    try {
      const res = await fetch(`/api/staff/marks?sectionId=${secId}&subjectId=${subId}&academicYearId=${ayId}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to load class roster');
      const data = await res.json();
      const students = data.students || [];

      manualEntries = students.map(s => {
        const markObj = (s.marks || []).find(m => m.assessmentId === asmId);
        return {
          studentId: s.id,
          registerNumber: s.registerNumber,
          name: s.name,
          existingMark: markObj ? markObj.marksObtained : null,
          newMark: markObj ? String(markObj.marksObtained) : ''
        };
      });
    } catch (err) {
      console.error('Error loading manual roster:', err);
      manualEntries = [];
    }
  }

  function renderLayout() {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">

        <!-- Header Card -->
        <div class="card-box" style="border-left: 4px solid #10b981;">
          <div class="card-box-header">
            <div>
              <div class="card-box-title">Marks Entry & Evaluation Console</div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                Upload marks via Excel (.xlsx/.xls), CSV (.csv), or manual classroom roster entry. Strictly verified against your assigned classes.
              </div>
            </div>
            <span class="badge badge-success">Zero-Trust Protected</span>
          </div>

          <div class="card-box-body">

            <!-- Selection Bar -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; background: rgba(255,255,255,0.02); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin-bottom: 24px;">
              
              <!-- Assigned Class & Subject -->
              <div>
                <label class="form-label">1. Select Assigned Class & Subject *</label>
                <select id="class-allocation-select" class="form-select" style="height: 42px;">
                  <option value="">-- Choose Class Allocation --</option>
                  ${assignedClasses.map(a => `
                    <option value="${a.id}" data-sec="${a.sectionId}" data-sub="${a.subjectId}" data-ay="${a.academicYearId}">
                      [${escapeHtml(a.subject?.code || a.subjectCode)}] ${escapeHtml(a.subject?.name || a.subjectName)} - ${escapeHtml(a.section?.department?.code || a.department)} Yr${a.section?.year?.yearNumber || a.yearNumber} Sec ${escapeHtml(a.section?.name || a.section)} (${a.studentCount || 0} Students)
                    </option>
                  `).join('')}
                </select>
                <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">
                  Backend checks teacher allocation for academic year, dept, year, section & subject.
                </div>
              </div>

              <!-- Assessment -->
              <div>
                <label class="form-label">2. Select Dynamic Assessment *</label>
                <select id="assessment-select" class="form-select" style="height: 42px;" disabled>
                  <option value="">Choose a class first...</option>
                </select>
                <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;" id="assessment-meta-hint">
                  Available tests: IA-1, IA-2, IA-3, MODEL, SEMESTER.
                </div>
              </div>

            </div>

            <!-- Workflow Container (Visible only when both class & assessment selected) -->
            <div id="workflow-container" style="display: none;">
              
              <!-- Method Navigation Tabs -->
              <div style="display: flex; gap: 10px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 20px;">
                <button id="tab-file-upload" class="btn ${activeMethod === 'file' ? 'btn-primary' : 'btn-secondary'} btn-sm">
                  <span>📊</span> Excel & CSV Bulk Upload
                </button>
                <button id="tab-manual-entry" class="btn ${activeMethod === 'manual' ? 'btn-primary' : 'btn-secondary'} btn-sm">
                  <span>📝</span> Manual Classroom Roster Entry
                </button>
              </div>

              <!-- Content for Active Method -->
              <div id="method-content-area"></div>

            </div>

            <!-- Placeholder State when not selected -->
            <div id="selection-placeholder" style="text-align: center; padding: 48px; color: var(--text-muted); border: 1px dashed var(--border-subtle); border-radius: var(--radius-sm);">
              <div style="font-size: 36px; margin-bottom: 10px;">📋</div>
              <div style="font-size: 15px; font-weight: 600; color: #ffffff;">Select an Allocated Class & Assessment Above</div>
              <div style="font-size: 13px; margin-top: 4px; color: var(--text-dim);">
                Only classes where an active Administrator assignment exists can be graded.
              </div>
            </div>

          </div>
        </div>

      </div>
    `;

    const classSel = container.querySelector('#class-allocation-select');
    const asmSel = container.querySelector('#assessment-select');
    const workflowBox = container.querySelector('#workflow-container');
    const placeholderBox = container.querySelector('#selection-placeholder');

    classSel.addEventListener('change', async () => {
      const selectedOption = classSel.options[classSel.selectedIndex];
      const allocId = selectedOption.value;

      if (!allocId) {
        selectedClass = null;
        selectedAssessment = null;
        asmSel.disabled = true;
        asmSel.innerHTML = `<option value="">Choose a class first...</option>`;
        workflowBox.style.display = 'none';
        placeholderBox.style.display = 'block';
        return;
      }

      selectedClass = assignedClasses.find(a => a.id === allocId);
      const secId = selectedOption.getAttribute('data-sec');
      const subId = selectedOption.getAttribute('data-sub');
      const ayId = selectedOption.getAttribute('data-ay');

      asmSel.disabled = true;
      asmSel.innerHTML = `<option value="">Loading applicable assessments...</option>`;

      await loadAssessmentsForClass(secId, subId, ayId);

      if (availableAssessments.length === 0) {
        asmSel.innerHTML = `<option value="">No active assessments found for this class</option>`;
        workflowBox.style.display = 'none';
        placeholderBox.style.display = 'block';
        return;
      }

      asmSel.disabled = false;
      asmSel.innerHTML = `<option value="">-- Choose Assessment (IA-1, IA-2, IA-3...) --</option>` +
        availableAssessments.map(a => `
          <option value="${a.id}">
            [${escapeHtml(a.code)}] ${escapeHtml(a.name)} (Max: ${a.maximumMarks} pts)
          </option>
        `).join('');

      workflowBox.style.display = 'none';
      placeholderBox.style.display = 'block';
    });

    asmSel.addEventListener('change', async () => {
      const asmId = asmSel.value;
      if (!asmId) {
        selectedAssessment = null;
        workflowBox.style.display = 'none';
        placeholderBox.style.display = 'block';
        return;
      }

      selectedAssessment = availableAssessments.find(a => a.id === asmId);
      placeholderBox.style.display = 'none';
      workflowBox.style.display = 'block';

      renderActiveMethodContent();
    });

    // Tab buttons
    container.querySelector('#tab-file-upload').addEventListener('click', () => {
      activeMethod = 'file';
      container.querySelector('#tab-file-upload').className = 'btn btn-primary btn-sm';
      container.querySelector('#tab-manual-entry').className = 'btn btn-secondary btn-sm';
      renderActiveMethodContent();
    });

    container.querySelector('#tab-manual-entry').addEventListener('click', () => {
      activeMethod = 'manual';
      container.querySelector('#tab-manual-entry').className = 'btn btn-primary btn-sm';
      container.querySelector('#tab-file-upload').className = 'btn btn-secondary btn-sm';
      renderActiveMethodContent();
    });
  }

  function renderActiveMethodContent() {
    const area = container.querySelector('#method-content-area');
    if (!area) return;

    if (activeMethod === 'file') {
      renderFileUploadView(area);
    } else {
      renderManualEntryView(area);
    }
  }

  function renderFileUploadView(area) {
    const maxMarks = selectedAssessment?.maximumMarks || 100;

    area.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Action Toolbar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-weight: 600; color: #ffffff;">
              Upload Marks Spreadsheet for [${escapeHtml(selectedAssessment?.code)}] ${escapeHtml(selectedAssessment?.name)}
            </div>
            <div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">
              Maximum Allowable Score: <strong>${maxMarks} points</strong>. Accepted formats: <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>.
            </div>
          </div>

          <!-- Download Template Button -->
          <button id="download-marks-template-btn" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px;">
            <span>📥</span> Download Class Template (.xlsx)
          </button>
        </div>

        <!-- Drag & Drop Zone -->
        <div id="drop-zone" style="border: 2px dashed rgba(16, 185, 129, 0.4); border-radius: var(--radius-sm); padding: 32px 20px; text-align: center; background: rgba(16, 185, 129, 0.03); cursor: pointer; transition: all 0.2s;">
          <input type="file" id="file-input" accept=".xlsx, .xls, .csv" style="display: none;">
          <div style="font-size: 36px; margin-bottom: 8px;">📂</div>
          <div style="font-weight: 600; color: #ffffff; font-size: 15px;">
            Click to Browse or Drag & Drop Marks Spreadsheet
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Expected columns: <code>Register Number</code> | <code>Marks</code>
          </div>
          <div id="selected-file-info" style="display: none; margin-top: 14px; display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.06); padding: 6px 14px; border-radius: 20px; font-size: 13px; color: #34d399;">
            <span id="file-name-txt"></span>
          </div>
        </div>

        <!-- Preview Results Container -->
        <div id="upload-preview-container"></div>

      </div>
    `;

    // Download template
    area.querySelector('#download-marks-template-btn').addEventListener('click', () => {
      if (!selectedClass || !selectedAssessment) return;
      const url = `/api/staff/marks/template?sectionId=${selectedClass.sectionId}&subjectId=${selectedClass.subjectId}&assessmentId=${selectedAssessment.id}&academicYearId=${selectedClass.academicYearId}`;
      window.open(url, '_blank');
      showToast('Downloading student marks template...', 'info');
    });

    const dropZone = area.querySelector('#drop-zone');
    const fileInput = area.querySelector('#file-input');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#34d399';
      dropZone.style.background = 'rgba(16, 185, 129, 0.08)';
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      dropZone.style.background = 'rgba(16, 185, 129, 0.03)';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      dropZone.style.background = 'rgba(16, 185, 129, 0.03)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processUploadedFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        processUploadedFile(fileInput.files[0]);
      }
    });
  }

  async function processUploadedFile(file) {
    const previewContainer = container.querySelector('#upload-preview-container');
    const infoBox = container.querySelector('#selected-file-info');
    const nameTxt = container.querySelector('#file-name-txt');

    if (infoBox && nameTxt) {
      nameTxt.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      infoBox.style.display = 'inline-flex';
    }

    if (previewContainer) {
      previewContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          Parsing spreadsheet and validating records against class enrollment...
        </div>
      `;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sectionId', selectedClass.sectionId);
    formData.append('subjectId', selectedClass.subjectId);
    formData.append('assessmentId', selectedAssessment.id);
    formData.append('academicYearId', selectedClass.academicYearId);

    try {
      const res = await fetch('/api/staff/marks/upload-preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to validate spreadsheet');
      }

      previewData = data;
      renderPreviewResults(data);
    } catch (err) {
      console.error('File process error:', err);
      if (previewContainer) {
        previewContainer.innerHTML = `
          <div style="padding: 18px; background: rgba(244,63,94,0.15); border: 1px solid #f43f5e; border-radius: var(--radius-sm); color: #fb7185;">
            <strong>❌ Upload Rejected:</strong> ${err.message}
          </div>
        `;
      }
    }
  }

  function renderPreviewResults(data) {
    const previewContainer = container.querySelector('#upload-preview-container');
    if (!previewContainer) return;

    const { totalRows, validRows, invalidRows, duplicateRows, rows } = data;

    previewContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 10px;">
        
        <!-- Summary Cards -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-title">TOTAL ROWS</div>
            <div class="metric-value">${totalRows}</div>
            <div class="metric-sub">Found in uploaded file</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">VALID MARKS</div>
            <div class="metric-value" style="color: #34d399;">${validRows}</div>
            <div class="metric-sub">Ready to save into database</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">INVALID ROWS</div>
            <div class="metric-value" style="color: ${invalidRows > 0 ? '#fb7185' : 'var(--text-muted)'};">${invalidRows}</div>
            <div class="metric-sub">Out of range, non-numeric, or cross-class</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">DUPLICATES</div>
            <div class="metric-value" style="color: ${duplicateRows > 0 ? '#fbbf24' : 'var(--text-muted)'};">${duplicateRows}</div>
            <div class="metric-sub">Repeated in file</div>
          </div>
        </div>

        <!-- Review Table -->
        <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); overflow: hidden;">
          <div style="padding: 12px 16px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; color: #ffffff;">Row-by-Row Validation Review</span>
            <span style="font-size: 12px; color: var(--text-dim);">Assessment: [${escapeHtml(selectedAssessment?.code)}] Max: ${selectedAssessment?.maximumMarks} pts</span>
          </div>

          <div style="max-height: 380px; overflow-y: auto;">
            <table class="data-table" style="margin: 0;">
              <thead>
                <tr>
                  <th style="width: 60px;">Row</th>
                  <th>Register Number</th>
                  <th>Student Name</th>
                  <th>Marks Entered</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Validation Message</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr style="${r.status === 'INVALID' ? 'background: rgba(244,63,94,0.05);' : r.status === 'DUPLICATE' ? 'background: rgba(245,158,11,0.05);' : ''}">
                    <td style="color: var(--text-dim); font-size: 12px;">#${r.rowNumber}</td>
                    <td>
                      <strong style="color: #ffffff;">${escapeHtml(r.registerNumber || '—')}</strong>
                    </td>
                    <td>
                      <span style="color: ${r.studentName ? '#ffffff' : 'var(--text-dim)'};">
                        ${escapeHtml(r.studentName || '—')}
                      </span>
                    </td>
                    <td>
                      <strong style="color: #ffffff;">${escapeHtml(String(r.rawMarks))}</strong>
                      ${r.status === 'VALID' ? `<span style="font-size: 11px; color: var(--text-dim);"> / ${r.maximumMarks}</span>` : ''}
                    </td>
                    <td>
                      ${r.action === 'UPDATE' ? `<span class="role-pill" style="background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.35);">Revision (Prev: ${r.previousMarks})</span>` : r.action === 'INSERT' ? `<span class="role-pill" style="background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.35);">New Entry</span>` : `<span style="color: var(--text-dim);">—</span>`}
                    </td>
                    <td>
                      <span class="role-pill ${r.status === 'VALID' ? 'badge-staff' : r.status === 'DUPLICATE' ? 'badge-neutral' : 'badge-admin'}" style="${r.status === 'VALID' ? 'background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.35);' : r.status === 'DUPLICATE' ? 'background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.35);' : 'background: rgba(244,63,94,0.15); color: #fb7185; border: 1px solid rgba(244,63,94,0.35);'}">
                        ${r.status === 'VALID' ? '✓ Valid' : r.status === 'DUPLICATE' ? '⚠ Duplicate' : '✕ Invalid'}
                      </span>
                    </td>
                    <td>
                      ${r.error ? `<span style="color: #fb7185; font-size: 12px;">${escapeHtml(r.error)}</span>` : `<span style="color: #34d399; font-size: 12px;">Verified against class roster</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Confirm Toolbar -->
        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 8px;">
          ${invalidRows > 0 || duplicateRows > 0 ? `
            <span style="font-size: 12px; color: var(--text-dim);">
              Only the <strong>${validRows} valid rows</strong> will be saved into the database.
            </span>
          ` : ''}

          <button id="confirm-upload-btn" class="btn btn-primary" ${validRows === 0 ? 'disabled' : ''} style="min-width: 180px;">
            <span>💾</span> Confirm & Save ${validRows} Marks
          </button>
        </div>

      </div>
    `;

    const confirmBtn = previewContainer.querySelector('#confirm-upload-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Saving marks...';

        const validRowsToCommit = rows.filter(r => r.status === 'VALID');

        try {
          const res = await fetch('/api/staff/marks/upload-confirm', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
              sectionId: selectedClass.sectionId,
              subjectId: selectedClass.subjectId,
              assessmentId: selectedAssessment.id,
              academicYearId: selectedClass.academicYearId,
              reason: 'Faculty bulk upload',
              validRows: validRowsToCommit
            })
          });

          const result = await res.json();

          if (!res.ok) {
            throw new Error(result.error || 'Failed to commit marks');
          }

          showToast(result.message || 'Marks saved successfully!', 'success');
          previewContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; background: rgba(16,185,129,0.08); border: 1px solid #10b981; border-radius: var(--radius-sm);">
              <div style="font-size: 36px; margin-bottom: 8px;">🎉</div>
              <div style="font-size: 16px; font-weight: 700; color: #ffffff;">Marks Upload Completed Successfully!</div>
              <div style="font-size: 13px; color: #34d399; margin-top: 4px;">
                ${result.message}
              </div>
              <button id="upload-another-btn" class="btn btn-secondary btn-sm" style="margin-top: 16px;">
                Upload Another File
              </button>
            </div>
          `;

          previewContainer.querySelector('#upload-another-btn')?.addEventListener('click', () => {
            renderActiveMethodContent();
          });
        } catch (err) {
          showToast(err.message, 'error');
          confirmBtn.disabled = false;
          confirmBtn.textContent = `Confirm & Save ${validRows} Marks`;
        }
      });
    }
  }

  async function renderManualEntryView(area) {
    area.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        Loading active students for manual grading roster...
      </div>
    `;

    await loadManualRoster(
      selectedClass.sectionId,
      selectedClass.subjectId,
      selectedClass.academicYearId,
      selectedAssessment.id
    );

    const maxMarks = selectedAssessment?.maximumMarks || 100;

    area.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-weight: 600; color: #ffffff;">
              Classroom Roster Grading: [${escapeHtml(selectedAssessment?.code)}] ${escapeHtml(selectedAssessment?.name)}
            </div>
            <div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">
              Enter marks out of <strong>${maxMarks}</strong> for each enrolled student.
            </div>
          </div>
          <button id="save-manual-roster-btn" class="btn btn-primary btn-sm">
            <span>💾</span> Save All Roster Marks
          </button>
        </div>

        <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); overflow: hidden;">
          <table class="data-table" style="margin: 0;">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Register Number</th>
                <th>Student Name</th>
                <th>Previous Mark</th>
                <th style="width: 160px;">Marks Obtained (Max: ${maxMarks})</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${manualEntries.map((e, idx) => `
                <tr>
                  <td style="color: var(--text-dim);">${idx + 1}</td>
                  <td>
                    <strong style="color: #ffffff;">${escapeHtml(e.registerNumber)}</strong>
                  </td>
                  <td>
                    <span style="color: #ffffff;">${escapeHtml(e.name)}</span>
                  </td>
                  <td>
                    ${e.existingMark !== null ? `<span style="color: #a5b4fc; font-weight: 600;">${e.existingMark} / ${maxMarks}</span>` : `<span style="color: var(--text-dim);">Not graded</span>`}
                  </td>
                  <td>
                    <input type="number" class="form-input manual-mark-inp" data-student-id="${e.studentId}" value="${escapeHtml(e.newMark)}" min="0" max="${maxMarks}" step="0.5" placeholder="0 - ${maxMarks}" style="height: 36px; padding: 4px 10px; font-weight: 600;">
                  </td>
                  <td>
                    <span class="role-pill ${e.existingMark !== null ? 'badge-staff' : 'badge-neutral'}" id="status-pill-${e.studentId}">
                      ${e.existingMark !== null ? 'Graded' : 'Pending'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

      </div>
    `;

    const saveBtn = area.querySelector('#save-manual-roster-btn');
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving roster...';

      const inputs = area.querySelectorAll('.manual-mark-inp');
      const entriesToSave = [];

      for (const inp of inputs) {
        const studentId = inp.getAttribute('data-student-id');
        const val = inp.value.trim();
        if (val !== '') {
          entriesToSave.push({
            studentId,
            marksObtained: parseFloat(val)
          });
        }
      }

      if (entriesToSave.length === 0) {
        showToast('Please enter marks for at least one student.', 'info');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save All Roster Marks';
        return;
      }

      try {
        const res = await fetch('/api/staff/marks/batch', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            sectionId: selectedClass.sectionId,
            subjectId: selectedClass.subjectId,
            assessmentId: selectedAssessment.id,
            academicYearId: selectedClass.academicYearId,
            entries: entriesToSave,
            reason: 'Manual classroom grading'
          })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to save marks');

        showToast(result.message || 'Marks saved successfully!', 'success');
        renderActiveMethodContent();
      } catch (err) {
        showToast(err.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save All Roster Marks';
      }
    });
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

  // Initialize
  loadAssignedClasses().then(() => {
    renderLayout();
  });
}
