import { Auth } from '../auth.js';

/**
 * Renders the Bulk Student Import Modal
 * Supports: .xlsx, .xls, .csv
 * Workflow: Upload -> Parse -> Validate -> Preview -> Show errors -> Admin confirms -> Database transaction -> Import completed
 */
export function openStudentImportModal({ academicYears, currentAcademicYearId, onSuccess }) {
  const existingModal = document.getElementById('student-import-modal');
  if (existingModal) existingModal.remove();

  const modalBackdrop = document.createElement('div');
  modalBackdrop.id = 'student-import-modal';
  modalBackdrop.className = 'modal-backdrop';

  // State
  let selectedAcademicYearId = currentAcademicYearId || (academicYears[0]?.id || '');
  let selectedFile = null;
  let previewData = null;
  let isAnalyzing = false;
  let isImporting = false;

  function renderModal() {
    modalBackdrop.innerHTML = `
      <div class="modal-card modal-card-lg">
        <!-- Header -->
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">📊</span>
            <div>
              <div class="modal-title">Bulk Student Enrollment Import</div>
              <div style="font-size: 12px; color: var(--text-muted);">
                Upload student rosters with parent guardian contact details (.xlsx, .xls, .csv)
              </div>
            </div>
          </div>
          <button id="btn-close-import-modal" class="btn-close-modal" aria-label="Close modal">&times;</button>
        </div>

        <div class="modal-body-scroll">
          <!-- Step 1: Context & Template Bar -->
          <div class="template-download-card">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff;">Need the official template format?</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                Includes exact column headers (Register Number, Student Name, Department, Year, Section, Parent Name, Parent Mobile).
              </div>
            </div>
            <button id="btn-download-template" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px;">
              <span>📥</span> Download Excel Template (.xlsx)
            </button>
          </div>

          <!-- Academic Year Selector for Import -->
          <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 14px; background: rgba(0,0,0,0.2); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <label style="font-size: 12px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; min-width: 140px;">
              Target Academic Year:
            </label>
            <select id="import-acad-year" class="form-input form-select" style="max-width: 320px;" ${previewData ? 'disabled' : ''}>
              ${academicYears.map(y => `
                <option value="${y.id}" ${y.id === selectedAcademicYearId ? 'selected' : ''}>
                  ${y.yearName} ${y.isCurrent ? '★ (Current)' : ''}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Upload Drop Zone (Visible when no preview active) -->
          ${!previewData ? `
            <div id="drop-zone" class="file-drop-zone">
              <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display: none;" />
              <div class="drop-icon">📁</div>
              <div style="font-size: 15px; font-weight: 700; color: #ffffff;">
                ${selectedFile ? selectedFile.name : 'Drag and drop your spreadsheet here or click to browse'}
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">
                Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
              </div>
              ${selectedFile ? `
                <div style="margin-top: 10px; font-size: 12px; color: var(--primary-accent); font-weight: 600;">
                  Size: ${(selectedFile.size / 1024).toFixed(1)} KB
                </div>
              ` : ''}
            </div>

            <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 12px;">
              <button id="btn-cancel-import" class="btn btn-secondary">Cancel</button>
              <button id="btn-analyze-file" class="btn btn-primary" ${!selectedFile || isAnalyzing ? 'disabled' : ''}>
                ${isAnalyzing ? 'Analyzing Spreadsheet...' : '⚡ Validate & Preview Spreadsheet'}
              </button>
            </div>
          ` : `
            <!-- Validation Metrics Grid -->
            <div class="import-summary-grid">
              <div class="import-stat-card">
                <span class="stat-label">Total Rows</span>
                <span class="stat-value" style="color: #ffffff;">${previewData.summary.totalRows}</span>
              </div>
              <div class="import-stat-card stat-valid">
                <span class="stat-label">Valid Rows</span>
                <span class="stat-value">${previewData.summary.validRows}</span>
              </div>
              <div class="import-stat-card stat-invalid">
                <span class="stat-label">Invalid Rows</span>
                <span class="stat-value">${previewData.summary.invalidRows}</span>
              </div>
              <div class="import-stat-card stat-duplicate">
                <span class="stat-label">Duplicate Rows</span>
                <span class="stat-value">${previewData.summary.duplicateRows}</span>
              </div>
            </div>

            <!-- Preview Notice -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="font-size: 13px; font-weight: 700; color: #ffffff;">
                Pre-Import Data Validation Review
              </div>
              <div style="font-size: 12px; color: var(--text-muted);">
                Academic Year: <strong style="color: #ffffff;">${previewData.academicYear.yearName}</strong>
              </div>
            </div>

            <!-- Detailed Row Table with Exact Errors -->
            <div class="preview-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="width: 50px;">Row</th>
                    <th style="width: 90px;">Status</th>
                    <th>Reg No</th>
                    <th>Student Name</th>
                    <th>Dept</th>
                    <th>Yr</th>
                    <th>Sec</th>
                    <th>Parent / Guardian</th>
                    <th>Parent Mobile</th>
                    <th>Validation Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  ${previewData.rows.map(r => `
                    <tr style="${r.status === 'INVALID' ? 'background: rgba(244, 63, 94, 0.04);' : r.status === 'DUPLICATE' ? 'background: rgba(245, 158, 11, 0.04);' : ''}">
                      <td style="font-weight: 700; color: var(--text-dim);">${r.rowNumber}</td>
                      <td>
                        ${r.status === 'VALID' ? `
                          <span class="role-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);">
                            VALID
                          </span>
                        ` : r.status === 'DUPLICATE' ? `
                          <span class="role-pill badge-warning">
                            DUPLICATE
                          </span>
                        ` : `
                          <span class="role-pill" style="background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.35);">
                            INVALID
                          </span>
                        `}
                      </td>
                      <td style="font-family: monospace; font-weight: 700; color: #ffffff;">
                        ${escapeHtml(r.data.registerNumber || '—')}
                      </td>
                      <td style="font-weight: 600;">
                        ${escapeHtml(r.data.name || '—')}
                      </td>
                      <td>${escapeHtml(r.data.department || '—')}</td>
                      <td>${escapeHtml(String(r.data.year || '—'))}</td>
                      <td>${escapeHtml(r.data.section || '—')}</td>
                      <td>${escapeHtml(r.data.parentName || '—')}</td>
                      <td style="font-family: monospace;">${escapeHtml(r.data.parentMobile || '—')}</td>
                      <td>
                        ${r.errors && r.errors.length > 0 ? `
                          <div>
                            ${r.errors.map(err => `<span class="error-pill">⚠️ ${escapeHtml(err)}</span>`).join('')}
                          </div>
                        ` : `
                          <span style="color: #34d399; font-size: 12px; font-weight: 600;">✓ Ready to import</span>
                        `}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Footer Action Bar -->
            <div style="margin-top: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <button id="btn-reupload" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px;">
                <span>↺</span> Upload Different File
              </button>

              <div style="display: flex; gap: 12px; align-items: center;">
                <button id="btn-cancel-preview" class="btn btn-secondary">Close</button>
                <button id="btn-confirm-import" class="btn btn-primary" ${previewData.summary.validRows === 0 || isImporting ? 'disabled' : ''}>
                  ${isImporting ? 'Importing Students...' : `✓ Commit Import (${previewData.summary.validRows} Valid Students)`}
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Close modal
    const btnClose = modalBackdrop.querySelector('#btn-close-import-modal');
    if (btnClose) {
      btnClose.addEventListener('click', () => modalBackdrop.remove());
    }

    const btnCancelImport = modalBackdrop.querySelector('#btn-cancel-import');
    if (btnCancelImport) {
      btnCancelImport.addEventListener('click', () => modalBackdrop.remove());
    }

    const btnCancelPreview = modalBackdrop.querySelector('#btn-cancel-preview');
    if (btnCancelPreview) {
      btnCancelPreview.addEventListener('click', () => modalBackdrop.remove());
    }

    // Target Academic Year Change
    const acadSelect = modalBackdrop.querySelector('#import-acad-year');
    if (acadSelect) {
      acadSelect.addEventListener('change', (e) => {
        selectedAcademicYearId = e.target.value;
      });
    }

    // Download Sample Template
    const btnDownload = modalBackdrop.querySelector('#btn-download-template');
    if (btnDownload) {
      btnDownload.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/admin/students/import/template', {
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
          });
          if (!res.ok) throw new Error('Failed to download template');
          
          const blob = await res.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = 'student_bulk_import_template.xlsx';
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
          alert('Template download failed: ' + err.message);
        }
      });
    }

    // File Drop Zone
    const dropZone = modalBackdrop.querySelector('#drop-zone');
    const fileInput = modalBackdrop.querySelector('#file-input');

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileSelected(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFileSelected(e.target.files[0]);
        }
      });
    }

    // Analyze Spreadsheet Button
    const btnAnalyze = modalBackdrop.querySelector('#btn-analyze-file');
    if (btnAnalyze) {
      btnAnalyze.addEventListener('click', analyzeSpreadsheet);
    }

    // Re-upload Button
    const btnReupload = modalBackdrop.querySelector('#btn-reupload');
    if (btnReupload) {
      btnReupload.addEventListener('click', () => {
        previewData = null;
        selectedFile = null;
        renderModal();
      });
    }

    // Confirm & Commit Import Button
    const btnConfirm = modalBackdrop.querySelector('#btn-confirm-import');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', commitImport);
    }
  }

  function handleFileSelected(file) {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => lowerName.endsWith(ext));

    if (!isValid) {
      alert('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }

    selectedFile = file;
    renderModal();
  }

  async function analyzeSpreadsheet() {
    if (!selectedFile) return;

    isAnalyzing = true;
    renderModal();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`/api/admin/students/import/preview?academicYearId=${selectedAcademicYearId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze spreadsheet');
      }

      previewData = data;
    } catch (err) {
      alert('Import Validation Error:\n' + err.message);
    } finally {
      isAnalyzing = false;
      renderModal();
    }
  }

  async function commitImport() {
    if (!previewData) return;

    const validRows = previewData.rows.filter(r => r.status === 'VALID' && r.resolved);
    if (validRows.length === 0) {
      alert('No valid student records are available to import.');
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to commit ${validRows.length} valid student records into the database?`
    );
    if (!confirmed) return;

    isImporting = true;
    renderModal();

    try {
      const res = await fetch('/api/admin/students/import/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          academicYearId: previewData.academicYear.id,
          students: validRows.map(r => r.resolved)
        })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Import commit failed');
      }

      // Success
      window.dispatchEvent(new CustomEvent('toast-notify', {
        detail: {
          message: `Success: ${result.importedCount} students enrolled into ${previewData.academicYear.yearName}!`,
          type: 'success'
        }
      }));

      modalBackdrop.remove();

      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (err) {
      alert('Transaction Error: ' + err.message);
      isImporting = false;
      renderModal();
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

  document.body.appendChild(modalBackdrop);
  renderModal();
}
