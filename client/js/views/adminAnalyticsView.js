import { Auth } from '../auth.js';

export function renderAdminAnalyticsView(container) {
  let currentSubTab = 'college'; // 'college' | 'departments' | 'years' | 'sections' | 'drilldown'
  let academicYearId = '';
  let academicYearsList = [];

  // Section Analytics state
  let selectedSectionId = '';
  let allSectionsList = [];

  // Drilldown state
  let drilldownState = {
    level: 'college',
    departmentId: '',
    yearId: '',
    sectionId: '',
    subjectId: '',
    studentId: ''
  };

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

  function round2(val) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Number(val).toFixed(2);
  }

  function getImprovementBadge(imp) {
    if (imp === null || imp === undefined) {
      return `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8;">—</span>`;
    }
    const num = Number(imp);
    if (num > 0) {
      return `<span class="badge badge-success" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">+${num.toFixed(2)}%</span>`;
    }
    if (num < 0) {
      return `<span class="badge badge-danger" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); font-weight: 700;">${num.toFixed(2)}%</span>`;
    }
    return `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); font-weight: 600;">0.00%</span>`;
  }

  function getLevelBadge(level) {
    switch (level) {
      case 'Excellent':
        return `<span class="badge" style="background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">🌟 Excellent</span>`;
      case 'Very Good':
        return `<span class="badge" style="background: rgba(56, 189, 248, 0.18); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 700;">✨ Very Good</span>`;
      case 'Good':
        return `<span class="badge" style="background: rgba(99, 102, 241, 0.18); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); font-weight: 600;">👍 Good</span>`;
      case 'Average':
        return `<span class="badge" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 600;">⚠️ Average</span>`;
      case 'Needs Attention':
      default:
        return `<span class="badge badge-danger" style="background: rgba(244, 63, 94, 0.18); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); font-weight: 700;">🚨 Needs Attention</span>`;
    }
  }

  // Load Initial Metadata (Academic Years, Sections)
  async function loadMetadata() {
    try {
      const [ayRes, secRes] = await Promise.all([
        fetch('/api/admin/academic-years', { headers: getHeaders() }),
        fetch('/api/admin/sections', { headers: getHeaders() })
      ]);

      if (ayRes.ok) {
        const ayData = await ayRes.json();
        academicYearsList = ayData.academicYears || [];
        const current = academicYearsList.find(y => y.isCurrent);
        if (current) academicYearId = current.id;
      }

      if (secRes.ok) {
        const secData = await secRes.json();
        allSectionsList = secData.sections || [];
        if (allSectionsList.length > 0 && !selectedSectionId) {
          selectedSectionId = allSectionsList[0].id;
        }
      }
    } catch (e) {
      console.error('Failed to load analytics metadata:', e);
    }
  }

  // Render Shell
  function renderShell() {
    container.innerHTML = `
      <div class="analytics-workspace-root">
        <!-- Top Controls Bar -->
        <div class="card-box" style="margin-bottom: 20px; border-left: 4px solid #6366f1;">
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <h2 style="font-size: 20px; font-weight: 800; color: #fff; margin: 0;">Institutional Analytics Engine</h2>
                <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); font-size: 11px;">Admin Clearance Required</span>
              </div>
              <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px; margin-bottom: 0;">
                Comprehensive college performance, cross-department benchmarks, year-wise trends, section audits, and hierarchical drilldown.
              </p>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <label style="font-size: 13px; color: var(--text-muted); font-weight: 600;">Academic Year:</label>
              <select id="analytics-academic-year-select" class="form-control" style="width: 170px; padding: 6px 12px; font-size: 13px;">
                <option value="">All Academic Years</option>
                ${academicYearsList.map(ay => `
                  <option value="${ay.id}" ${ay.id === academicYearId ? 'selected' : ''}>
                    ${ay.yearName} ${ay.isCurrent ? '★ (Current)' : ''}
                  </option>
                `).join('')}
              </select>
              <button id="btn-refresh-analytics" class="btn btn-secondary btn-sm" title="Refresh data">
                🔄 Refresh
              </button>
            </div>
          </div>

          <!-- Secondary Sub-Tab Navigation -->
          <div class="analytics-subtabs" style="display: flex; gap: 8px; margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; overflow-x: auto;">
            <button class="btn btn-sm subtab-btn ${currentSubTab === 'college' ? 'btn-primary' : 'btn-secondary'}" data-subtab="college">
              🏛️ College Overview
            </button>
            <button class="btn btn-sm subtab-btn ${currentSubTab === 'departments' ? 'btn-primary' : 'btn-secondary'}" data-subtab="departments">
              🏢 Department Analytics
            </button>
            <button class="btn btn-sm subtab-btn ${currentSubTab === 'years' ? 'btn-primary' : 'btn-secondary'}" data-subtab="years">
              🎓 Year-wise Analytics
            </button>
            <button class="btn btn-sm subtab-btn ${currentSubTab === 'sections' ? 'btn-primary' : 'btn-secondary'}" data-subtab="sections">
              🏫 Section Analytics
            </button>
            <button class="btn btn-sm subtab-btn ${currentSubTab === 'drilldown' ? 'btn-primary' : 'btn-secondary'}" data-subtab="drilldown">
              🔍 Hierarchical Drilldown
            </button>
          </div>
        </div>

        <!-- Dynamic Content Body -->
        <div id="analytics-tab-body">
          <div style="padding: 40px; text-align: center; color: var(--text-muted);">
            <div class="spinner" style="margin: 0 auto 12px auto;"></div>
            Loading analytics engine metrics...
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const aySelect = document.getElementById('analytics-academic-year-select');
    if (aySelect) {
      aySelect.addEventListener('change', (e) => {
        academicYearId = e.target.value;
        loadActiveSubTab();
      });
    }

    const refreshBtn = document.getElementById('btn-refresh-analytics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadActiveSubTab();
      });
    }

    container.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-subtab');
        currentSubTab = target;
        container.querySelectorAll('.subtab-btn').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        e.currentTarget.classList.add('btn-primary');
        e.currentTarget.classList.remove('btn-secondary');
        loadActiveSubTab();
      });
    });

    loadActiveSubTab();
  }

  function loadActiveSubTab() {
    const body = document.getElementById('analytics-tab-body');
    if (!body) return;

    body.innerHTML = `
      <div style="padding: 50px; text-align: center; color: var(--text-muted);">
        <div class="spinner" style="margin: 0 auto 12px auto;"></div>
        Loading ${currentSubTab} analytics...
      </div>
    `;

    if (currentSubTab === 'college') {
      renderCollegeOverview(body);
    } else if (currentSubTab === 'departments') {
      renderDepartmentAnalytics(body);
    } else if (currentSubTab === 'years') {
      renderYearWiseAnalytics(body);
    } else if (currentSubTab === 'sections') {
      renderSectionAnalytics(body);
    } else if (currentSubTab === 'drilldown') {
      renderDrilldownExplorer(body);
    }
  }

  /**
   * -------------------------------------------------------------------------
   * SUBTAB 1: COLLEGE OVERVIEW
   * -------------------------------------------------------------------------
   */
  async function renderCollegeOverview(containerEl) {
    try {
      const url = `/api/admin/analytics/overall${academicYearId ? `?academicYearId=${academicYearId}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      containerEl.innerHTML = `
        <!-- High Level Summary Metric Cards -->
        <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
          <div class="metric-card">
            <div class="metric-title">TOTAL STUDENTS</div>
            <div class="metric-value" style="color: #38bdf8;">${data.totalStudents}</div>
            <div class="metric-sub">${data.totalDepartments} Departments, ${data.totalYears} Years</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">COLLEGE PASS RATE</div>
            <div class="metric-value" style="color: ${data.overallPassPercentage >= 75 ? '#34d399' : '#fbbf24'};">
              ${round2(data.overallPassPercentage)}%
            </div>
            <div class="metric-sub">${data.totalSections} Total Active Sections</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">IA-1 COLLEGE AVG</div>
            <div class="metric-value" style="color: #818cf8;">
              ${data.ia1Average !== null ? `${round2(data.ia1Average)}%` : '—'}
            </div>
            <div class="metric-sub">Internal Assessment 1</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">IA-2 COLLEGE AVG</div>
            <div class="metric-value" style="color: #34d399;">
              ${data.ia2Average !== null ? `${round2(data.ia2Average)}%` : '—'}
            </div>
            <div class="metric-sub">Internal Assessment 2</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">COLLEGE IMPROVEMENT</div>
            <div class="metric-value">
              ${getImprovementBadge(data.overallImprovement)}
            </div>
            <div class="metric-sub">IA-2 vs IA-1 Progression</div>
          </div>
        </div>

        <!-- 2 Column Layout: Department Rankings & Year Rankings -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 24px;">
          <!-- Department Rankings -->
          <div class="card-box">
            <div class="card-box-header">
              <div class="card-box-title">🏆 Department Performance Rankings</div>
              <span class="badge badge-primary">Comparative</span>
            </div>
            <div class="card-box-body" style="padding: 0;">
              <div class="table-container" style="max-height: 320px; overflow-y: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="width: 50px;">Rank</th>
                      <th>Department</th>
                      <th>Students</th>
                      <th>IA-1</th>
                      <th>IA-2</th>
                      <th>Overall Avg</th>
                      <th>Pass %</th>
                      <th>Improvement</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(data.departmentRankings || []).map(d => `
                      <tr>
                        <td><span class="badge ${d.rank === 1 ? 'badge-success' : 'badge-secondary'}">#${d.rank}</span></td>
                        <td><strong>${d.code}</strong> <span style="font-size: 11px; color: var(--text-muted); display: block;">${d.name}</span></td>
                        <td>${d.assessedStudents}/${d.totalStudents}</td>
                        <td>${d.ia1Average !== null ? `${round2(d.ia1Average)}%` : '—'}</td>
                        <td>${d.ia2Average !== null ? `${round2(d.ia2Average)}%` : '—'}</td>
                        <td><strong style="color: #38bdf8;">${round2(d.overallAverage)}%</strong></td>
                        <td><span style="color: ${d.passPercentage >= 60 ? '#34d399' : '#fb7185'}; font-weight: 600;">${round2(d.passPercentage)}%</span></td>
                        <td>${getImprovementBadge(d.improvement)}</td>
                      </tr>
                    `).join('')}
                    ${(!data.departmentRankings || data.departmentRankings.length === 0) ? '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">No department rankings available.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Year-wise Benchmarking -->
          <div class="card-box">
            <div class="card-box-header">
              <div class="card-box-title">🎓 Year-wise Benchmark (1st to 4th Year)</div>
              <span class="badge badge-info">Cohort Comparison</span>
            </div>
            <div class="card-box-body" style="padding: 0;">
              <div class="table-container" style="max-height: 320px; overflow-y: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="width: 50px;">Rank</th>
                      <th>Year</th>
                      <th>Students</th>
                      <th>IA-1 Avg</th>
                      <th>IA-2 Avg</th>
                      <th>Overall Avg</th>
                      <th>Pass %</th>
                      <th>Improvement</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(data.yearRankings || []).map(y => `
                      <tr>
                        <td><span class="badge ${y.rank === 1 ? 'badge-success' : 'badge-secondary'}">#${y.rank}</span></td>
                        <td><strong>${y.name}</strong> (Yr ${y.yearNumber})</td>
                        <td>${y.assessedStudents}/${y.totalStudents}</td>
                        <td>${y.ia1Average !== null ? `${round2(y.ia1Average)}%` : '—'}</td>
                        <td>${y.ia2Average !== null ? `${round2(y.ia2Average)}%` : '—'}</td>
                        <td><strong style="color: #38bdf8;">${round2(y.overallAverage)}%</strong></td>
                        <td><span style="color: ${y.passPercentage >= 60 ? '#34d399' : '#fb7185'}; font-weight: 600;">${round2(y.passPercentage)}%</span></td>
                        <td>${getImprovementBadge(y.improvement)}</td>
                      </tr>
                    `).join('')}
                    ${(!data.yearRankings || data.yearRankings.length === 0) ? '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">No year ranking data available.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Rankings & Subject Performance -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 24px;">
          <!-- Section Rankings -->
          <div class="card-box">
            <div class="card-box-header">
              <div class="card-box-title">🏫 Section Performance Rankings</div>
              <span class="badge badge-secondary">All Active Classes</span>
            </div>
            <div class="card-box-body" style="padding: 0;">
              <div class="table-container" style="max-height: 320px; overflow-y: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="width: 50px;">Rank</th>
                      <th>Section</th>
                      <th>Students</th>
                      <th>Overall Avg</th>
                      <th>Pass %</th>
                      <th>Improvement</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(data.sectionRankings || []).map(s => `
                      <tr>
                        <td><span class="badge ${s.rank === 1 ? 'badge-success' : 'badge-secondary'}">#${s.rank}</span></td>
                        <td><strong>${s.departmentCode} - ${s.yearName} (${s.sectionName})</strong></td>
                        <td>${s.assessedStudents}/${s.totalStudents}</td>
                        <td><strong style="color: #38bdf8;">${round2(s.overallAverage)}%</strong></td>
                        <td><span style="color: ${s.passPercentage >= 60 ? '#34d399' : '#fb7185'};">${round2(s.passPercentage)}%</span></td>
                        <td>${getImprovementBadge(s.improvement)}</td>
                      </tr>
                    `).join('')}
                    ${(!data.sectionRankings || data.sectionRankings.length === 0) ? '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No section data available.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Subject Performance -->
          <div class="card-box">
            <div class="card-box-header">
              <div class="card-box-title">📚 Subject Performance Matrix</div>
              <span class="badge badge-info">College-wide</span>
            </div>
            <div class="card-box-body" style="padding: 0;">
              <div class="table-container" style="max-height: 320px; overflow-y: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Subject Name</th>
                      <th>Dept</th>
                      <th>Avg %</th>
                      <th>Pass %</th>
                      <th>Progression</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(data.subjectPerformance || []).map(sb => `
                      <tr>
                        <td><code>${sb.code}</code></td>
                        <td><strong>${sb.name}</strong></td>
                        <td><span class="badge badge-secondary">${sb.departmentCode}</span></td>
                        <td><strong style="color: #38bdf8;">${round2(sb.averagePercentage)}%</strong></td>
                        <td><span style="color: ${sb.passPercentage >= 60 ? '#34d399' : '#fb7185'};">${round2(sb.passPercentage)}%</span></td>
                        <td>${getImprovementBadge(sb.improvement)}</td>
                      </tr>
                    `).join('')}
                    ${(!data.subjectPerformance || data.subjectPerformance.length === 0) ? '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No subject data found.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Hall of Fame & Focus Lists (Top 10, Most Improved, Attention) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px;">
          <!-- Top 10 Students -->
          <div class="card-box">
            <div class="card-box-header" style="border-bottom: 2px solid #34d399;">
              <div class="card-box-title" style="color: #34d399;">🌟 Top 10 Academic Performers</div>
              <span class="badge badge-success">High Distinction</span>
            </div>
            <div class="card-box-body" style="padding: 0;">
              <div class="table-container" style="max-height: 280px; overflow-y: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Score</th>
                      <th>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(data.top10Students || []).map((s, idx) => `
                      <tr>
                        <td><strong>#${idx + 1}</strong></td>
                        <td>
                          <strong>${s.studentName || '—'}</strong>
                          <span style="font-size: 11px; color: var(--text-muted); display: block;">${s.registerNumber || ''}</span>
                        </td>
                        <td>${s.departmentCode || ''} ${s.sectionName ? `(${s.sectionName})` : ''}</td>
                        <td><strong style="color: #34d399;">${round2(s.percentage)}%</strong></td>
                        <td>${getLevelBadge(s.performanceStatus)}</td>
                      </tr>
                    `).join('')}
                    ${(!data.top10Students || data.top10Students.length === 0) ? '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">No assessed students.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Most Improved Students -->
          <div class="card-box">
            <div class="card-box-header" style="border-bottom: 2px solid #38bdf8;">
              <div class="card-box-title" style="color: #38bdf8;">📈 Most Improved Students</div>
              <span class="badge badge-info">IA-1 → IA-2 Gains</span>
            </div>
            <div class="card-box-body" style="padding: 0;">
              <div class="table-container" style="max-height: 280px; overflow-y: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>IA-1</th>
                      <th>IA-2</th>
                      <th>Gain</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(data.mostImprovedStudents || []).map(s => `
                      <tr>
                        <td>
                          <strong>${s.studentName || '—'}</strong>
                          <span style="font-size: 11px; color: var(--text-muted); display: block;">${s.registerNumber || ''}</span>
                        </td>
                        <td>${s.departmentCode || ''} ${s.sectionName ? `(${s.sectionName})` : ''}</td>
                        <td>${s.ia1Percentage !== null ? `${round2(s.ia1Percentage)}%` : '—'}</td>
                        <td>${s.ia2Percentage !== null ? `${round2(s.ia2Percentage)}%` : '—'}</td>
                        <td>${getImprovementBadge(s.improvement)}</td>
                      </tr>
                    `).join('')}
                    ${(!data.mostImprovedStudents || data.mostImprovedStudents.length === 0) ? '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">No students with positive gains recorded.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Students Needing Attention -->
          <div class="card-box">
            <div class="card-box-header" style="border-bottom: 2px solid #fb7185;">
              <div class="card-box-title" style="color: #fb7185;">🚨 Students Needing Attention</div>
              <span class="badge badge-danger">Below 60% or Declining</span>
            </div>
            <div class="card-box-body" style="padding: 0;">
              <div class="table-container" style="max-height: 280px; overflow-y: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(data.studentsNeedingAttention || []).map(s => `
                      <tr>
                        <td>
                          <strong>${s.studentName || '—'}</strong>
                          <span style="font-size: 11px; color: var(--text-muted); display: block;">${s.registerNumber || ''}</span>
                        </td>
                        <td>${s.departmentCode || ''} ${s.sectionName ? `(${s.sectionName})` : ''}</td>
                        <td><strong style="color: #fb7185;">${round2(s.percentage)}%</strong></td>
                        <td>${getLevelBadge(s.performanceStatus)}</td>
                      </tr>
                    `).join('')}
                    ${(!data.studentsNeedingAttention || data.studentsNeedingAttention.length === 0) ? '<tr><td colspan="4" style="text-align: center; color: #34d399; padding: 16px;">All assessed students currently meet passing thresholds!</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Error rendering College Overview:', err);
      containerEl.innerHTML = `<div class="card-box" style="color: #fb7185; padding: 20px;">Failed to load College Overview: ${err.message}</div>`;
    }
  }

  /**
   * -------------------------------------------------------------------------
   * SUBTAB 2: DEPARTMENT ANALYTICS
   * -------------------------------------------------------------------------
   */
  async function renderDepartmentAnalytics(containerEl) {
    try {
      const url = `/api/admin/analytics/departments${academicYearId ? `?academicYearId=${academicYearId}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const departments = data.departmentAnalytics || [];

      containerEl.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 4px;">Department-Wise Benchmarking</h3>
          <p style="color: var(--text-muted); font-size: 13px; margin: 0;">Comparative evaluation across departments with IA averages, pass percentages, and level breakdowns.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
          ${departments.map(d => `
            <div class="card-box" style="border-top: 4px solid #6366f1;">
              <div class="card-box-header">
                <div>
                  <div class="card-box-title">${d.code} - ${d.name}</div>
                  <span style="font-size: 12px; color: var(--text-muted);">${d.sectionCount} Sections, ${d.subjectCount} Subjects</span>
                </div>
                <span class="badge ${d.passPercentage >= 70 ? 'badge-success' : 'badge-secondary'}" style="font-size: 13px; font-weight: 700;">
                  ${round2(d.overallAverage)}% Avg
                </span>
              </div>
              <div class="card-box-body">
                <!-- Mini Metric Grid -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
                  <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-muted);">ENROLLED</div>
                    <div style="font-weight: 700; font-size: 16px; color: #fff;">${d.totalStudents}</div>
                    <div style="font-size: 10px; color: #94a3b8;">${d.assessedStudents} Assessed</div>
                  </div>
                  <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-muted);">PASS RATE</div>
                    <div style="font-weight: 700; font-size: 16px; color: ${d.passPercentage >= 60 ? '#34d399' : '#fb7185'};">
                      ${round2(d.passPercentage)}%
                    </div>
                    <div style="font-size: 10px; color: #94a3b8;">Threshold ≥50%</div>
                  </div>
                  <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-muted);">PROGRESSION</div>
                    <div style="font-weight: 700; font-size: 15px;">
                      ${getImprovementBadge(d.improvement)}
                    </div>
                    <div style="font-size: 10px; color: #94a3b8;">IA-2 vs IA-1</div>
                  </div>
                </div>

                <!-- Assessments Comparison -->
                <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; margin-bottom: 12px;">
                  <span>IA-1 Average: <strong>${d.ia1Average !== null ? `${round2(d.ia1Average)}%` : '—'}</strong></span>
                  <span>IA-2 Average: <strong>${d.ia2Average !== null ? `${round2(d.ia2Average)}%` : '—'}</strong></span>
                </div>

                <!-- Level Distribution Pill Row -->
                <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">PERFORMANCE LEVEL DISTRIBUTION:</div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px;">
                  <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">🌟 Exc: ${d.levelDistribution?.excellent || 0}</span>
                  <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">✨ V.Good: ${d.levelDistribution?.veryGood || 0}</span>
                  <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">👍 Good: ${d.levelDistribution?.good || 0}</span>
                  <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">⚠️ Avg: ${d.levelDistribution?.average || 0}</span>
                  <span class="badge" style="background: rgba(244, 63, 94, 0.15); color: #fb7185;">🚨 Attn: ${d.levelDistribution?.needsAttention || 0}</span>
                </div>

                <!-- Year breakdown inside department -->
                ${d.yearBreakdown && d.yearBreakdown.length > 0 ? `
                  <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">COHORTS (YEARS):</div>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${d.yearBreakdown.map(y => `
                      <span class="badge badge-secondary" style="font-size: 11px;">
                        ${y.yearName}: <strong>${round2(y.averagePercentage)}%</strong> (${y.assessedCount} stud)
                      </span>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      console.error('Error rendering Department Analytics:', err);
      containerEl.innerHTML = `<div class="card-box" style="color: #fb7185; padding: 20px;">Failed to load Department Analytics: ${err.message}</div>`;
    }
  }

  /**
   * -------------------------------------------------------------------------
   * SUBTAB 3: YEAR-WISE ANALYTICS
   * -------------------------------------------------------------------------
   */
  async function renderYearWiseAnalytics(containerEl) {
    try {
      const url = `/api/admin/analytics/years${academicYearId ? `?academicYearId=${academicYearId}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const years = data.yearAnalytics || [];

      containerEl.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 4px;">Year-Wise Cohort Analytics</h3>
          <p style="color: var(--text-muted); font-size: 13px; margin: 0;">Compare 1st Year, 2nd Year, 3rd Year, and 4th Year performance metrics across all engineering streams.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${years.map(y => `
            <div class="card-box" style="border-top: 4px solid #38bdf8;">
              <div class="card-box-header">
                <div>
                  <div class="card-box-title">${y.name}</div>
                  <span style="font-size: 12px; color: var(--text-muted);">${y.departmentCount} Depts, ${y.sectionCount} Sections</span>
                </div>
                <span class="badge ${y.passPercentage >= 70 ? 'badge-success' : 'badge-secondary'}" style="font-size: 13px; font-weight: 700;">
                  ${round2(y.overallAverage)}%
                </span>
              </div>
              <div class="card-box-body">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px;">
                  <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-muted);">STUDENTS</div>
                    <div style="font-weight: 700; font-size: 15px; color: #fff;">${y.totalStudents} (${y.assessedStudents} assd)</div>
                  </div>
                  <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-muted);">PASS RATE</div>
                    <div style="font-weight: 700; font-size: 15px; color: ${y.passPercentage >= 60 ? '#34d399' : '#fb7185'};">${round2(y.passPercentage)}%</div>
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; color: var(--text-muted);">
                  <span>IA-1: <strong>${y.ia1Average !== null ? `${round2(y.ia1Average)}%` : '—'}</strong></span>
                  <span>IA-2: <strong>${y.ia2Average !== null ? `${round2(y.ia2Average)}%` : '—'}</strong></span>
                  <span>Imp: ${getImprovementBadge(y.improvement)}</span>
                </div>

                <!-- Department Breakdown -->
                ${y.departmentBreakdown && y.departmentBreakdown.length > 0 ? `
                  <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">STREAM BREAKDOWN:</div>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${y.departmentBreakdown.map(d => `
                      <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 8px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                        <span><strong>${d.departmentCode}</strong> (${d.assessedCount} stud)</span>
                        <strong style="color: #38bdf8;">${round2(d.averagePercentage)}%</strong>
                      </div>
                    `).join('')}
                  </div>
                ` : '<div style="font-size: 12px; color: var(--text-muted);">No student evaluations recorded for this year.</div>'}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      console.error('Error rendering Year Analytics:', err);
      containerEl.innerHTML = `<div class="card-box" style="color: #fb7185; padding: 20px;">Failed to load Year-wise Analytics: ${err.message}</div>`;
    }
  }

  /**
   * -------------------------------------------------------------------------
   * SUBTAB 4: SECTION ANALYTICS
   * -------------------------------------------------------------------------
   */
  async function renderSectionAnalytics(containerEl) {
    try {
      const url = `/api/admin/analytics/sections?sectionId=${selectedSectionId}${academicYearId ? `&academicYearId=${academicYearId}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const sec = await res.json();

      containerEl.innerHTML = `
        <!-- Section Picker Bar -->
        <div class="card-box" style="margin-bottom: 20px;">
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <label style="font-weight: 700; color: #fff; font-size: 14px;">Select Class Section:</label>
              <select id="section-analytics-picker" class="form-control" style="width: 260px; padding: 8px 12px;">
                ${allSectionsList.map(s => `
                  <option value="${s.id}" ${s.id === selectedSectionId ? 'selected' : ''}>
                    ${s.department?.code || ''} - ${s.year?.name || ''} (Sec ${s.name})
                  </option>
                `).join('')}
              </select>
            </div>
            <div style="display: flex; gap: 8px;">
              <span class="badge badge-primary" style="font-size: 13px;">${sec.displayName || sec.sectionName}</span>
            </div>
          </div>
        </div>

        <!-- Section Metrics Overview -->
        <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 20px;">
          <div class="metric-card">
            <div class="metric-title">TOTAL STUDENTS</div>
            <div class="metric-value" style="color: #38bdf8;">${sec.totalStudents}</div>
            <div class="metric-sub">${sec.assessedStudents} Assessed, ${sec.unassessedStudents} Unassessed</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">PASS RATE</div>
            <div class="metric-value" style="color: ${sec.passPercentage >= 60 ? '#34d399' : '#fb7185'};">
              ${round2(sec.passPercentage)}%
            </div>
            <div class="metric-sub">Highest: ${round2(sec.highest)}% | Lowest: ${round2(sec.lowest)}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">IA-1 AVERAGE</div>
            <div class="metric-value" style="color: #818cf8;">
              ${sec.ia1Average !== null ? `${round2(sec.ia1Average)}%` : '—'}
            </div>
            <div class="metric-sub">Class Internal 1</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">IA-2 AVERAGE</div>
            <div class="metric-value" style="color: #34d399;">
              ${sec.ia2Average !== null ? `${round2(sec.ia2Average)}%` : '—'}
            </div>
            <div class="metric-sub">Class Internal 2</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">SECTION IMPROVEMENT</div>
            <div class="metric-value">
              ${getImprovementBadge(sec.improvement)}
            </div>
            <div class="metric-sub">IA-2 vs IA-1 Delta</div>
          </div>
        </div>

        <!-- Subject Averages Table in Section -->
        <div class="card-box" style="margin-bottom: 20px;">
          <div class="card-box-header">
            <div class="card-box-title">📚 Subject-Wise Evaluation in Section</div>
            <span class="badge badge-secondary">${(sec.subjectAverages || []).length} Subjects Configured</span>
          </div>
          <div class="card-box-body" style="padding: 0;">
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Subject Name</th>
                    <th>Students Assessed</th>
                    <th>IA-1 Avg</th>
                    <th>IA-2 Avg</th>
                    <th>Overall Avg</th>
                    <th>Pass %</th>
                    <th>Progression</th>
                  </tr>
                </thead>
                <tbody>
                  ${(sec.subjectAverages || []).map(sb => `
                    <tr>
                      <td><code>${sb.subjectCode}</code></td>
                      <td><strong>${sb.subjectName}</strong></td>
                      <td>${sb.assessedCount}</td>
                      <td>${sb.ia1Average !== null ? `${round2(sb.ia1Average)}%` : '—'}</td>
                      <td>${sb.ia2Average !== null ? `${round2(sb.ia2Average)}%` : '—'}</td>
                      <td><strong style="color: #38bdf8;">${round2(sb.averagePercentage)}%</strong></td>
                      <td><span style="color: ${sb.passPercentage >= 60 ? '#34d399' : '#fb7185'}; font-weight: 600;">${round2(sb.passPercentage)}%</span></td>
                      <td>${getImprovementBadge(sb.improvement)}</td>
                    </tr>
                  `).join('')}
                  ${(!sec.subjectAverages || sec.subjectAverages.length === 0) ? '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">No subjects found for this section.</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Top Performers & Students Needing Attention (2 Columns) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 20px;">
          <!-- Top Performers -->
          <div class="card-box">
            <div class="card-box-header" style="border-bottom: 2px solid #34d399;">
              <div class="card-box-title" style="color: #34d399;">🌟 Top Performers in Section</div>
            </div>
            <div class="card-box-body" style="padding: 0;">
              <div class="table-container" style="max-height: 240px; overflow-y: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Register No</th>
                      <th>Name</th>
                      <th>Overall %</th>
                      <th>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(sec.topPerformers || []).map(s => `
                      <tr>
                        <td><code>${s.registerNumber || ''}</code></td>
                        <td><strong>${s.studentName || '—'}</strong></td>
                        <td><strong style="color: #34d399;">${round2(s.percentage)}%</strong></td>
                        <td>${getLevelBadge(s.performanceStatus)}</td>
                      </tr>
                    `).join('')}
                    ${(!sec.topPerformers || sec.topPerformers.length === 0) ? '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">No assessed students.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Students Needing Attention -->
          <div class="card-box">
            <div class="card-box-header" style="border-bottom: 2px solid #fb7185;">
              <div class="card-box-title" style="color: #fb7185;">🚨 Students Needing Attention (<60% or Declining)</div>
            </div>
            <div class="card-box-body" style="padding: 0;">
              <div class="table-container" style="max-height: 240px; overflow-y: auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Register No</th>
                      <th>Name</th>
                      <th>Overall %</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(sec.studentsNeedingAttention || []).map(s => `
                      <tr>
                        <td><code>${s.registerNumber || ''}</code></td>
                        <td><strong>${s.studentName || '—'}</strong></td>
                        <td><strong style="color: #fb7185;">${round2(s.percentage)}%</strong></td>
                        <td>${getLevelBadge(s.performanceStatus)}</td>
                      </tr>
                    `).join('')}
                    ${(!sec.studentsNeedingAttention || sec.studentsNeedingAttention.length === 0) ? '<tr><td colspan="4" style="text-align: center; color: #34d399; padding: 16px;">All students in section are performing above threshold!</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Complete Student Roster with Marks -->
        <div class="card-box">
          <div class="card-box-header">
            <div class="card-box-title">📋 Complete Section Student Roster</div>
            <span class="badge badge-secondary">${(sec.studentRoster || []).length} Students</span>
          </div>
          <div class="card-box-body" style="padding: 0;">
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Register Number</th>
                    <th>Student Name</th>
                    <th>IA-1 %</th>
                    <th>IA-2 %</th>
                    <th>Overall %</th>
                    <th>Improvement</th>
                    <th>Level</th>
                  </tr>
                </thead>
                <tbody>
                  ${(sec.studentRoster || []).map(r => `
                    <tr>
                      <td><code>${r.registerNumber}</code></td>
                      <td><strong>${r.studentName}</strong></td>
                      <td>${r.ia1Percentage !== null ? `${round2(r.ia1Percentage)}%` : '—'}</td>
                      <td>${r.ia2Percentage !== null ? `${round2(r.ia2Percentage)}%` : '—'}</td>
                      <td><strong style="color: #38bdf8;">${round2(r.percentage)}%</strong></td>
                      <td>${getImprovementBadge(r.improvement)}</td>
                      <td>${getLevelBadge(r.performanceStatus)}</td>
                    </tr>
                  `).join('')}
                  ${(!sec.studentRoster || sec.studentRoster.length === 0) ? '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">No students enrolled in this section.</td></tr>' : ''}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Wire picker change
      const picker = document.getElementById('section-analytics-picker');
      if (picker) {
        picker.addEventListener('change', (e) => {
          selectedSectionId = e.target.value;
          renderSectionAnalytics(containerEl);
        });
      }
    } catch (err) {
      console.error('Error rendering Section Analytics:', err);
      containerEl.innerHTML = `<div class="card-box" style="color: #fb7185; padding: 20px;">Failed to load Section Analytics: ${err.message}</div>`;
    }
  }

  /**
   * -------------------------------------------------------------------------
   * SUBTAB 5: HIERARCHICAL DRILLDOWN EXPLORER
   * College -> Department -> Year -> Section -> Subject -> Student
   * -------------------------------------------------------------------------
   */
  async function renderDrilldownExplorer(containerEl) {
    try {
      const params = new URLSearchParams();
      params.append('level', drilldownState.level);
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (drilldownState.departmentId) params.append('departmentId', drilldownState.departmentId);
      if (drilldownState.yearId) params.append('yearId', drilldownState.yearId);
      if (drilldownState.sectionId) params.append('sectionId', drilldownState.sectionId);
      if (drilldownState.subjectId) params.append('subjectId', drilldownState.subjectId);
      if (drilldownState.studentId) params.append('studentId', drilldownState.studentId);

      const res = await fetch(`/api/admin/analytics/drilldown?${params.toString()}`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const node = await res.json();

      containerEl.innerHTML = `
        <!-- Breadcrumb Navigation Bar -->
        <div class="card-box" style="margin-bottom: 20px; border-left: 4px solid #f59e0b;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;" id="drilldown-breadcrumbs">
              ${(node.breadcrumbs || []).map((b, idx) => `
                <button class="btn btn-sm ${idx === node.breadcrumbs.length - 1 ? 'btn-primary' : 'btn-secondary'} breadcrumb-btn" 
                  data-level="${b.level}" data-id="${b.id || ''}" style="padding: 4px 10px; font-size: 12px;">
                  ${idx === 0 ? '🏛️ ' : ''}${b.name}
                </button>
                ${idx < node.breadcrumbs.length - 1 ? '<span style="color: var(--text-muted); font-size: 14px;">➔</span>' : ''}
              `).join('')}
            </div>
            <div>
              <span class="badge badge-info" style="font-size: 12px; text-transform: uppercase;">Current Level: ${node.currentLevel}</span>
            </div>
          </div>
        </div>

        <!-- Node Summary Details -->
        ${renderDrilldownNodeContent(node)}
      `;

      // Wire Breadcrumb buttons
      containerEl.querySelectorAll('.breadcrumb-btn').forEach(b => {
        b.addEventListener('click', (e) => {
          const lvl = e.currentTarget.getAttribute('data-level');
          const id = e.currentTarget.getAttribute('data-id');
          navigateToDrilldownLevel(lvl, id);
        });
      });

      // Wire Child Drill buttons
      containerEl.querySelectorAll('.drill-child-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const nextLevel = e.currentTarget.getAttribute('data-next-level');
          const nextId = e.currentTarget.getAttribute('data-next-id');
          handleDrillChildClick(nextLevel, nextId, e.currentTarget);
        });
      });

    } catch (err) {
      console.error('Error rendering Drilldown:', err);
      containerEl.innerHTML = `<div class="card-box" style="color: #fb7185; padding: 20px;">Failed to load Hierarchical Drilldown: ${err.message}</div>`;
    }
  }

  function renderDrilldownNodeContent(node) {
    if (node.currentLevel === 'student') {
      const rep = node.report || {};
      return `
        <div class="card-box">
          <div class="card-box-header" style="border-bottom: 2px solid #38bdf8;">
            <div>
              <div class="card-box-title" style="font-size: 20px; color: #fff;">🎓 Student Report: ${rep.studentName || 'Student'}</div>
              <span style="color: var(--text-muted); font-size: 13px;">Register Number: <code>${rep.registerNumber}</code> | ${rep.departmentCode} - ${rep.yearName} (${rep.sectionName})</span>
            </div>
            <div>${getLevelBadge(rep.performanceStatus)}</div>
          </div>
          <div class="card-box-body">
            <!-- Student Score Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 20px;">
              <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted);">OVERALL PERCENTAGE</div>
                <div style="font-size: 22px; font-weight: 800; color: #38bdf8;">${round2(rep.percentage)}%</div>
                <div style="font-size: 11px; color: #94a3b8;">${rep.studentTotal}/${rep.maximumTotal} Marks</div>
              </div>
              <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted);">IA-1 PERCENTAGE</div>
                <div style="font-size: 22px; font-weight: 800; color: #818cf8;">${rep.ia1Percentage !== null ? `${round2(rep.ia1Percentage)}%` : '—'}</div>
                <div style="font-size: 11px; color: #94a3b8;">${rep.ia1Total !== null ? `${rep.ia1Total}/${rep.ia1MaxTotal}` : 'Not entered'}</div>
              </div>
              <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted);">IA-2 PERCENTAGE</div>
                <div style="font-size: 22px; font-weight: 800; color: #34d399;">${rep.ia2Percentage !== null ? `${round2(rep.ia2Percentage)}%` : '—'}</div>
                <div style="font-size: 11px; color: #94a3b8;">${rep.ia2Total !== null ? `${rep.ia2Total}/${rep.ia2MaxTotal}` : 'Not entered'}</div>
              </div>
              <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted);">IMPROVEMENT</div>
                <div style="font-size: 20px; font-weight: 800; margin-top: 4px;">${getImprovementBadge(rep.improvement)}</div>
                <div style="font-size: 11px; color: #94a3b8;">Status: ${rep.progressionStatus}</div>
              </div>
            </div>

            <!-- Subject Breakdown Table -->
            <h4 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 12px;">Subject-by-Subject Evaluation</h4>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject Name</th>
                    <th>IA-1 Score</th>
                    <th>IA-2 Score</th>
                    <th>Total Obtained</th>
                    <th>Overall %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${(rep.subjectBreakdown || []).map(sb => `
                    <tr>
                      <td><code>${sb.subjectCode}</code></td>
                      <td><strong>${sb.subjectName}</strong></td>
                      <td>${sb.ia1.percentage !== null ? `${round2(sb.ia1.percentage)}% (${sb.ia1.obtained}/${sb.ia1.maximum})` : '—'}</td>
                      <td>${sb.ia2.percentage !== null ? `${round2(sb.ia2.percentage)}% (${sb.ia2.obtained}/${sb.ia2.maximum})` : '—'}</td>
                      <td><strong>${sb.totalObtained}/${sb.totalMaximum}</strong></td>
                      <td><strong style="color: #38bdf8;">${round2(sb.overallPercentage)}%</strong></td>
                      <td>${getLevelBadge(sb.overallLevel)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    // List of children to drill into
    const children = node.children || [];
    return `
      <div class="card-box" style="margin-bottom: 20px;">
        <div class="card-box-header">
          <div>
            <div class="card-box-title">
              ${node.currentLevel === 'college' ? 'Departments in College' : ''}
              ${node.currentLevel === 'department' ? `Academic Cohorts in ${node.department?.name || 'Department'}` : ''}
              ${node.currentLevel === 'year' ? `Class Sections in ${node.department?.code} - ${node.year?.name}` : ''}
              ${node.currentLevel === 'section' ? `Subjects & Students in ${node.department?.code} - ${node.year?.name} (Sec ${node.section?.name})` : ''}
              ${node.currentLevel === 'subject' ? `Student Scorecard for ${node.subject?.code} - ${node.subject?.name}` : ''}
            </div>
            <span style="font-size: 12px; color: var(--text-muted);">
              Click any item below to drill deeper down the academic hierarchy.
            </span>
          </div>
          <span class="badge badge-secondary">${children.length} Items</span>
        </div>

        <div class="card-box-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
            ${children.map(c => `
              <div class="card-box drill-child-btn" 
                data-next-level="${c.level}" 
                data-next-id="${c.id}"
                data-dept-id="${c.departmentId || ''}"
                data-year-id="${c.yearId || ''}"
                data-sec-id="${c.sectionId || ''}"
                style="cursor: pointer; border: 1px solid rgba(255,255,255,0.08); transition: transform 0.2s, border-color 0.2s; padding: 16px; margin: 0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <div>
                    <strong style="font-size: 15px; color: #fff;">${c.code || c.sectionName || c.name || c.registerNumber}</strong>
                    <span style="font-size: 12px; color: var(--text-muted); display: block;">${c.name || c.studentName || ''}</span>
                  </div>
                  <span class="badge badge-primary" style="font-size: 11px;">➔ Drill In</span>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 8px;">
                  <span>Avg: <strong style="color: #38bdf8;">${c.overallAverage !== undefined ? `${round2(c.overallAverage)}%` : (c.averagePercentage !== undefined ? `${round2(c.averagePercentage)}%` : `${round2(c.percentage)}%`)}</strong></span>
                  ${c.passPercentage !== undefined ? `<span>Pass: <strong style="color: #34d399;">${round2(c.passPercentage)}%</strong></span>` : ''}
                  ${c.improvement !== undefined ? `<span>Imp: ${getImprovementBadge(c.improvement)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- If at Section level, also show direct student roster drill link -->
          ${(node.currentLevel === 'section' && node.students && node.students.length > 0) ? `
            <div style="margin-top: 24px;">
              <h4 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 12px;">Individual Students in this Section</h4>
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Register Number</th>
                      <th>Student Name</th>
                      <th>Overall %</th>
                      <th>IA-1 %</th>
                      <th>IA-2 %</th>
                      <th>Improvement</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${node.students.map(s => `
                      <tr>
                        <td><code>${s.registerNumber}</code></td>
                        <td><strong>${s.name}</strong></td>
                        <td><strong style="color: #38bdf8;">${round2(s.percentage)}%</strong></td>
                        <td>${s.ia1Percentage !== null ? `${round2(s.ia1Percentage)}%` : '—'}</td>
                        <td>${s.ia2Percentage !== null ? `${round2(s.ia2Percentage)}%` : '—'}</td>
                        <td>${getImprovementBadge(s.improvement)}</td>
                        <td>
                          <button class="btn btn-sm btn-primary drill-child-btn" data-next-level="student" data-next-id="${s.id}" style="padding: 2px 8px; font-size: 11px;">
                            View Report ➔
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function handleDrillChildClick(nextLevel, nextId, el) {
    if (nextLevel === 'department') {
      drilldownState.level = 'department';
      drilldownState.departmentId = nextId;
    } else if (nextLevel === 'year') {
      drilldownState.level = 'year';
      drilldownState.yearId = nextId;
      const deptId = el.getAttribute('data-dept-id');
      if (deptId) drilldownState.departmentId = deptId;
    } else if (nextLevel === 'section') {
      drilldownState.level = 'section';
      drilldownState.sectionId = nextId;
    } else if (nextLevel === 'subject') {
      drilldownState.level = 'subject';
      drilldownState.subjectId = nextId;
      const secId = el.getAttribute('data-sec-id');
      if (secId) drilldownState.sectionId = secId;
    } else if (nextLevel === 'student') {
      drilldownState.level = 'student';
      drilldownState.studentId = nextId;
    }

    const body = document.getElementById('analytics-tab-body');
    if (body) renderDrilldownExplorer(body);
  }

  function navigateToDrilldownLevel(targetLevel, id) {
    if (targetLevel === 'college') {
      drilldownState = {
        level: 'college',
        departmentId: '',
        yearId: '',
        sectionId: '',
        subjectId: '',
        studentId: ''
      };
    } else if (targetLevel === 'department') {
      drilldownState.level = 'department';
      drilldownState.yearId = '';
      drilldownState.sectionId = '';
      drilldownState.subjectId = '';
      drilldownState.studentId = '';
      if (id) drilldownState.departmentId = id;
    } else if (targetLevel === 'year') {
      drilldownState.level = 'year';
      drilldownState.sectionId = '';
      drilldownState.subjectId = '';
      drilldownState.studentId = '';
      if (id) drilldownState.yearId = id;
    } else if (targetLevel === 'section') {
      drilldownState.level = 'section';
      drilldownState.subjectId = '';
      drilldownState.studentId = '';
      if (id) drilldownState.sectionId = id;
    } else if (targetLevel === 'subject') {
      drilldownState.level = 'subject';
      drilldownState.studentId = '';
      if (id) drilldownState.subjectId = id;
    }

    const body = document.getElementById('analytics-tab-body');
    if (body) renderDrilldownExplorer(body);
  }

  // Kickoff
  loadMetadata().then(() => {
    renderShell();
  });
}
