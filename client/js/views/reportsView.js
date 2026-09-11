import { Auth } from '../auth.js';

export function renderReportsView(container) {
  let reportTypes = [];
  let departments = [];
  let currentSelectedType = 'student-performance';
  let activeFormat = 'pdf';
  let isGenerating = false;

  container.innerHTML = `
    <div class="reports-container" style="max-width: 1400px; margin: 0 auto;">
      
      <!-- Top Banner -->
      <div class="card-box" style="border-left: 4px solid var(--accent-primary); background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(13, 18, 31, 0.95) 100%);">
        <div class="card-box-header" style="flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📑</span>
              <div class="card-box-title" style="font-size: 19px; font-weight: 800;">Executive Academic & Institutional Reports</div>
            </div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
              Generate, preview, and download institutional reports in high-fidelity PDF, Excel (.xlsx), and CSV formats.
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge badge-admin">RBAC: Unrestricted Admin</span>
            <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4);">
              7 Report Engines
            </span>
          </div>
        </div>
      </div>

      <!-- Report Catalog Grid (7 Report Types) -->
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="font-size: 15px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
            <span>📁</span> Institutional Report Catalog
          </h3>
          <span style="font-size: 12px; color: var(--text-muted);">Select any card below to configure filters and export</span>
        </div>

        <div class="reports-grid" id="reports-catalog-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
          <div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: 1 / -1;">
            Loading report catalog...
          </div>
        </div>
      </div>

      <!-- Active Report Configuration & Export Workspace -->
      <div class="card-box" id="report-config-card" style="border: 1px solid rgba(99, 102, 241, 0.3);">
        <div class="card-box-header" style="background: rgba(99, 102, 241, 0.08); flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div id="active-report-icon" style="font-size: 22px;">📊</div>
            <div>
              <div class="card-box-title" id="active-report-title" style="font-size: 16px;">Student Performance Report</div>
              <div id="active-report-desc" style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                Detailed student-by-student mark breakdowns, assessment progress, and pass/fail indicators.
              </div>
            </div>
          </div>
          <div id="active-report-badge">
            <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">PERFORMANCE</span>
          </div>
        </div>

        <div class="card-box-body">
          <!-- Filter Controls -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 10px;">
              Scope & Parameter Filters
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;" id="filter-controls-grid">
              <div>
                <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Academic Year</label>
                <select id="filter-academic-year" class="form-input" style="width: 100%; background: var(--bg-input); color: #fff; border: 1px solid var(--border-subtle); padding: 8px 12px; border-radius: 6px;">
                  <option value="">All Academic Years</option>
                  <option value="2026-2027" selected>2026-2027</option>
                  <option value="2025-2026">2025-2026</option>
                </select>
              </div>

              <div id="filter-dept-container">
                <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Department</label>
                <select id="filter-department" class="form-input" style="width: 100%; background: var(--bg-input); color: #fff; border: 1px solid var(--border-subtle); padding: 8px 12px; border-radius: 6px;">
                  <option value="">All Departments</option>
                </select>
              </div>

              <div id="filter-year-container">
                <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Year of Study</label>
                <select id="filter-year" class="form-input" style="width: 100%; background: var(--bg-input); color: #fff; border: 1px solid var(--border-subtle); padding: 8px 12px; border-radius: 6px;">
                  <option value="">All Years</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              <div id="filter-section-container">
                <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Section</label>
                <select id="filter-section" class="form-input" style="width: 100%; background: var(--bg-input); color: #fff; border: 1px solid var(--border-subtle); padding: 8px 12px; border-radius: 6px;">
                  <option value="">All Sections</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Format Picker & Action Buttons -->
          <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 18px; margin-bottom: 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;">
            <div>
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 8px;">
                Export Format Selection
              </div>
              <div style="display: flex; gap: 10px;" id="format-selector-group">
                <button type="button" class="btn btn-sm format-btn active" data-format="pdf" style="background: rgba(244, 63, 94, 0.2); border: 1px solid rgba(244, 63, 94, 0.5); color: #fb7185;">
                  📄 PDF Document (.pdf)
                </button>
                <button type="button" class="btn btn-sm format-btn" data-format="excel" style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-subtle); color: var(--text-muted);">
                  📊 Excel Spreadsheet (.xlsx)
                </button>
                <button type="button" class="btn btn-sm format-btn" data-format="csv" style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-subtle); color: var(--text-muted);">
                  📁 CSV Delimited (.csv)
                </button>
              </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: center;">
              <button id="btn-preview-report" class="btn btn-secondary" style="padding: 10px 18px;">
                <span>👁️</span> Preview Live Data
              </button>
              <button id="btn-download-report" class="btn btn-primary" style="padding: 10px 22px; font-weight: 700; background: linear-gradient(135deg, #e11d48, #be123c);">
                <span>⬇️</span> Download <span id="download-format-label">PDF</span> Report
              </button>
            </div>
          </div>

          <!-- Preview Area Container -->
          <div id="report-preview-container" style="display: none; border-top: 1px solid var(--border-subtle); padding-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🔍</span>
                <span style="font-weight: 700; font-size: 14px; color: #fff;">Interactive Report Data Preview</span>
                <span class="badge badge-success" id="preview-record-count">0 Records</span>
              </div>
              <div id="preview-summary-strip" style="display: flex; gap: 12px; font-size: 12px;"></div>
            </div>

            <div style="overflow-x: auto; background: rgba(5, 7, 12, 0.6); border: 1px solid var(--border-subtle); border-radius: 8px;">
              <table id="preview-data-table" style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                <thead id="preview-table-head" style="background: rgba(255, 255, 255, 0.04); border-bottom: 1px solid var(--border-subtle);">
                </thead>
                <tbody id="preview-table-body">
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

    </div>
  `;

  // Predefined catalog metadata with icons, categories and badges
  const catalogMetadata = {
    'student-performance': {
      icon: '🎓',
      category: 'PERFORMANCE',
      color: '#38bdf8',
      desc: 'Individual student performance containing 12 columns: College, Academic Year, Department, Year, Section, Student, Reg No, IA-1, IA-2, Improvement, Status, Pass percentage.',
      tags: ['12 Mandatory Fields', 'Student IA-1 & IA-2', 'Improvement %', 'Pass/Fail']
    },
    'section-performance': {
      icon: '🏫',
      category: 'PERFORMANCE',
      color: '#34d399',
      desc: 'Class-level aggregated metrics across all sections: Enrolled, IA-1 Avg, IA-2 Avg, Improvement, Pass %, Highest Mark, Lowest Mark, and Pass Status.',
      tags: ['Section Aggregates', 'Class IA Trends', 'Highest/Lowest', 'Pass Rate']
    },
    'year-performance': {
      icon: '📅',
      category: 'COHORT',
      color: '#818cf8',
      desc: 'Cohort-level comparative analytics across 1st, 2nd, 3rd, and 4th year undergraduate engineering programs.',
      tags: ['1st to 4th Year', 'Multi-Year Benchmark', 'Cohort Trends']
    },
    'department-performance': {
      icon: '🏛️',
      category: 'INSTITUTIONAL',
      color: '#f59e0b',
      desc: 'Departmental benchmarking and ranking: Faculty strength, section count, student enrollment, IA-1/IA-2 averages, and pass percentages.',
      tags: ['Dept Rankings', 'Faculty Ratios', 'Institutional Rank']
    },
    'overall-college': {
      icon: '🌐',
      category: 'EXECUTIVE',
      color: '#fb7185',
      desc: 'High-level executive summary report for College Principal and Governing Board: Total departments, active faculty, enrolled students, overall IA progress, and pass rates.',
      tags: ['Board Summary', 'Principal Briefing', 'College Pass %']
    },
    'notifications': {
      icon: '📱',
      category: 'OPERATIONS',
      color: '#a855f7',
      desc: 'Parent communication analytics: Notice title, category, recipient count, SMS count, WhatsApp count, sent, delivered, failed, and delivery success rate.',
      tags: ['SMS vs WhatsApp', 'Parent Reach', 'Delivery Statuses']
    },
    'notices': {
      icon: '📢',
      category: 'GOVERNANCE',
      color: '#ec4899',
      desc: 'Official college notice publication register: Notice type, audience targeting, channels, publication status, author, and timestamp history.',
      tags: ['Notice Register', 'Target Audience', 'Publication Log']
    }
  };

  // Load catalog from backend
  async function loadCatalog() {
    try {
      const res = await fetch('/api/admin/reports/types', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to load report catalog');
      const data = await res.json();
      reportTypes = data.reports || [];
      renderCatalogCards();
      selectReport(currentSelectedType);
    } catch (err) {
      console.error('Error loading report catalog:', err);
      const grid = document.getElementById('reports-catalog-grid');
      if (grid) {
        grid.innerHTML = `
          <div style="color: #fb7185; padding: 20px; grid-column: 1 / -1; text-align: center;">
            Failed to load report catalog: ${err.message}
          </div>
        `;
      }
    }
  }

  // Load structure for filter dropdowns
  async function loadStructure() {
    try {
      const res = await fetch('/api/admin/academic-structure', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        departments = data.departments || [];
        populateDepartmentFilter();
      }
    } catch (err) {
      console.warn('Could not load departments for filters:', err);
    }
  }

  function populateDepartmentFilter() {
    const deptSelect = document.getElementById('filter-department');
    if (!deptSelect) return;
    deptSelect.innerHTML = '<option value="">All Departments</option>';
    departments.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept.code || dept.name;
      opt.textContent = `${dept.name} (${dept.code})`;
      deptSelect.appendChild(opt);
    });
  }

  function renderCatalogCards() {
    const grid = document.getElementById('reports-catalog-grid');
    if (!grid) return;

    grid.innerHTML = reportTypes.map(rep => {
      const meta = catalogMetadata[rep.id] || {
        icon: '📄',
        category: 'REPORT',
        color: '#94a3b8',
        desc: rep.description,
        tags: []
      };

      const isSelected = rep.id === currentSelectedType;

      return `
        <div class="card-box report-card ${isSelected ? 'active-report-card' : ''}" 
             data-report-id="${rep.id}" 
             style="margin-bottom: 0; cursor: pointer; transition: var(--transition); border: ${isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)'}; background: ${isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface)'};">
          <div class="card-box-header" style="padding: 14px 18px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">${meta.icon}</span>
              <div style="font-weight: 700; font-size: 14px; color: #fff;">${rep.name}</div>
            </div>
            <span class="badge" style="background: rgba(255, 255, 255, 0.06); color: ${meta.color}; border: 1px solid ${meta.color}40; font-size: 10px;">
              ${meta.category}
            </span>
          </div>
          <div class="card-box-body" style="padding: 16px 18px;">
            <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 14px; min-height: 48px;">
              ${meta.desc}
            </p>

            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;">
              ${meta.tags.map(t => `<span style="font-size: 10px; padding: 2px 8px; border-radius: 4px; background: rgba(255, 255, 255, 0.04); color: var(--text-muted);">${t}</span>`).join('')}
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
              <div style="display: flex; gap: 6px;">
                <span class="badge" style="background: rgba(244, 63, 94, 0.1); color: #fb7185; font-size: 10px;">PDF</span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #34d399; font-size: 10px;">XLSX</span>
                <span class="badge" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; font-size: 10px;">CSV</span>
              </div>
              <button class="btn btn-sm btn-secondary select-report-btn" data-report-id="${rep.id}" style="padding: 4px 10px; font-size: 11px;">
                ${isSelected ? 'Selected ✓' : 'Select'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Wire clicks
    grid.querySelectorAll('.report-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-report-id');
        selectReport(id);
      });
    });
  }

  function selectReport(reportId) {
    currentSelectedType = reportId;
    const found = reportTypes.find(r => r.id === reportId);
    const meta = catalogMetadata[reportId] || {};

    // Update active UI
    document.querySelectorAll('.report-card').forEach(c => {
      const isThis = c.getAttribute('data-report-id') === reportId;
      c.style.border = isThis ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)';
      c.style.background = isThis ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface)';
      const btn = c.querySelector('.select-report-btn');
      if (btn) btn.textContent = isThis ? 'Selected ✓' : 'Select';
    });

    // Update workspace banner
    const iconEl = document.getElementById('active-report-icon');
    const titleEl = document.getElementById('active-report-title');
    const descEl = document.getElementById('active-report-desc');
    const badgeEl = document.getElementById('active-report-badge');

    if (iconEl) iconEl.textContent = meta.icon || '📄';
    if (titleEl) titleEl.textContent = found ? found.name : 'Selected Report';
    if (descEl) descEl.textContent = meta.desc || (found ? found.description : '');
    if (badgeEl) {
      badgeEl.innerHTML = `<span class="badge" style="background: ${meta.color}20; color: ${meta.color}; border: 1px solid ${meta.color}40;">${meta.category || 'REPORT'}</span>`;
    }

    // Scroll workspace into view smoothly if needed
    const configCard = document.getElementById('report-config-card');
    if (configCard) {
      configCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Hide preview on new report selection
    const previewContainer = document.getElementById('report-preview-container');
    if (previewContainer) previewContainer.style.display = 'none';
  }

  // Format button selector handler
  const formatButtons = container.querySelectorAll('.format-btn');
  formatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formatButtons.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'rgba(255, 255, 255, 0.05)';
        b.style.borderColor = 'var(--border-subtle)';
        b.style.color = 'var(--text-muted)';
      });
      btn.classList.add('active');
      activeFormat = btn.getAttribute('data-format');

      if (activeFormat === 'pdf') {
        btn.style.background = 'rgba(244, 63, 94, 0.2)';
        btn.style.borderColor = 'rgba(244, 63, 94, 0.5)';
        btn.style.color = '#fb7185';
      } else if (activeFormat === 'excel') {
        btn.style.background = 'rgba(16, 185, 129, 0.2)';
        btn.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        btn.style.color = '#34d399';
      } else if (activeFormat === 'csv') {
        btn.style.background = 'rgba(56, 189, 248, 0.2)';
        btn.style.borderColor = 'rgba(56, 189, 248, 0.5)';
        btn.style.color = '#38bdf8';
      }

      const label = document.getElementById('download-format-label');
      if (label) label.textContent = activeFormat.toUpperCase();
    });
  });

  // Download Action
  const downloadBtn = container.querySelector('#btn-download-report');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      if (isGenerating) return;
      isGenerating = true;
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = `<span>⏳</span> Generating ${activeFormat.toUpperCase()}...`;

      try {
        const queryParams = buildQueryParams(activeFormat);
        const url = `/api/admin/reports/${currentSelectedType}?${queryParams.toString()}`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${Auth.getToken()}`
          }
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status}: Failed to generate report`);
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;

        // Try to get filename from Content-Disposition header
        let filename = `${currentSelectedType}_report.${activeFormat === 'excel' ? 'xlsx' : activeFormat}`;
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.includes('filename=')) {
          const match = disposition.match(/filename="?([^";]+)"?/);
          if (match && match[1]) filename = match[1];
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

        window.dispatchEvent(new CustomEvent('toast-notify', {
          detail: { message: `Successfully generated ${filename}`, type: 'success' }
        }));
      } catch (err) {
        console.error('Download error:', err);
        window.dispatchEvent(new CustomEvent('toast-notify', {
          detail: { message: err.message, type: 'error' }
        }));
      } finally {
        isGenerating = false;
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `<span>⬇️</span> Download <span id="download-format-label">${activeFormat.toUpperCase()}</span> Report`;
      }
    });
  }

  // Preview Action
  const previewBtn = container.querySelector('#btn-preview-report');
  if (previewBtn) {
    previewBtn.addEventListener('click', async () => {
      const previewContainer = document.getElementById('report-preview-container');
      const thead = document.getElementById('preview-table-head');
      const tbody = document.getElementById('preview-table-body');
      const countEl = document.getElementById('preview-record-count');
      const summaryStrip = document.getElementById('preview-summary-strip');

      previewBtn.disabled = true;
      previewBtn.innerHTML = `<span>⏳</span> Loading Preview...`;

      try {
        const queryParams = buildQueryParams('json');
        const url = `/api/admin/reports/${currentSelectedType}?${queryParams.toString()}`;

        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to fetch report preview');
        }

        const data = await res.json();
        const records = data.data || [];

        if (countEl) countEl.textContent = `${records.length} Records`;
        if (previewContainer) previewContainer.style.display = 'block';

        // Summary metrics pills
        if (summaryStrip && data.summary) {
          summaryStrip.innerHTML = Object.entries(data.summary)
            .filter(([k]) => !['sections', 'students'].includes(k))
            .slice(0, 4)
            .map(([k, v]) => `
              <span style="background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                <strong style="color: var(--text-dim); text-transform: uppercase;">${k.replace(/([A-Z])/g, ' $1')}:</strong> 
                <span style="color: #fff; font-weight: 700;">${typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) + '%' : v}</span>
              </span>
            `).join('');
        }

        if (records.length === 0) {
          thead.innerHTML = `<tr><th style="padding: 12px; color: var(--text-muted);">No records found</th></tr>`;
          tbody.innerHTML = `<tr><td style="padding: 24px; text-align: center; color: var(--text-muted);">No data available matching selected filter criteria.</td></tr>`;
          return;
        }

        // Generate columns dynamically
        const columns = Object.keys(records[0]);
        thead.innerHTML = `
          <tr>
            ${columns.map(col => `
              <th style="padding: 10px 14px; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border-subtle); white-space: nowrap;">
                ${col}
              </th>
            `).join('')}
          </tr>
        `;

        tbody.innerHTML = records.slice(0, 50).map((row, idx) => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); background: ${idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'};">
            ${columns.map(col => {
              const val = row[col];
              let renderedVal = val !== undefined && val !== null ? String(val) : '—';
              let style = 'padding: 10px 14px; white-space: nowrap;';

              if (col.toLowerCase().includes('status')) {
                if (renderedVal === 'PASS' || renderedVal === 'DELIVERED' || renderedVal === 'SENT' || renderedVal === 'PUBLISHED') {
                  renderedVal = `<span class="badge badge-success" style="font-size: 10px;">${renderedVal}</span>`;
                } else if (renderedVal === 'FAIL' || renderedVal === 'FAILED') {
                  renderedVal = `<span class="badge" style="background: rgba(244, 63, 94, 0.2); color: #fb7185; font-size: 10px;">${renderedVal}</span>`;
                }
              } else if (col.toLowerCase().includes('improvement')) {
                const num = parseFloat(renderedVal);
                if (!isNaN(num)) {
                  renderedVal = num >= 0 
                    ? `<span style="color: #34d399; font-weight: 600;">+${num.toFixed(1)}%</span>`
                    : `<span style="color: #fb7185; font-weight: 600;">${num.toFixed(1)}%</span>`;
                }
              }

              return `<td style="${style}">${renderedVal}</td>`;
            }).join('')}
          </tr>
        `).join('');

        // Notice if truncated
        if (records.length > 50) {
          tbody.innerHTML += `
            <tr>
              <td colspan="${columns.length}" style="padding: 12px; text-align: center; color: var(--text-muted); font-style: italic; background: rgba(0,0,0,0.2);">
                Showing first 50 records of ${records.length}. Download PDF or Excel to view complete records.
              </td>
            </tr>
          `;
        }

      } catch (err) {
        console.error('Preview error:', err);
        window.dispatchEvent(new CustomEvent('toast-notify', {
          detail: { message: err.message, type: 'error' }
        }));
      } finally {
        previewBtn.disabled = false;
        previewBtn.innerHTML = `<span>👁️</span> Preview Live Data`;
      }
    });
  }

  function buildQueryParams(format) {
    const params = new URLSearchParams();
    params.set('format', format);

    const ay = document.getElementById('filter-academic-year')?.value;
    const dept = document.getElementById('filter-department')?.value;
    const yr = document.getElementById('filter-year')?.value;
    const sec = document.getElementById('filter-section')?.value;

    if (ay) params.set('academicYear', ay);
    if (dept) params.set('department', dept);
    if (yr) params.set('year', yr);
    if (sec) params.set('section', sec);

    return params;
  }

  // Initialize view
  loadCatalog();
  loadStructure();
}
