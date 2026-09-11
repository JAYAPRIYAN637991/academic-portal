import { Auth } from '../auth.js';

export function renderAdminPerformanceDashboardView(container) {
  // Filter state
  let selectedAcademicYearId = 'all';
  let selectedDepartmentId = 'all';
  let selectedYearId = 'all';
  let selectedSectionId = 'all';
  let selectedStudentId = 'all';
  let selectedAssessmentId = 'all';
  let searchStudentText = '';

  // Data cache
  let academicStructure = { academicYears: [], departments: [], years: [] };
  let allSections = [];
  let allAssessments = [];
  let overviewData = { students: [], summary: null, subjects: [] };
  let activeStudentDetail = null;

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

  async function loadMetadata() {
    try {
      const [structRes, secRes, assessRes] = await Promise.all([
        fetch('/api/admin/academic-structure/overview', { headers: getHeaders() }),
        fetch('/api/admin/sections', { headers: getHeaders() }),
        fetch('/api/admin/assessments', { headers: getHeaders() })
      ]);

      if (structRes.ok) academicStructure = await structRes.json();
      if (secRes.ok) {
        const d = await secRes.json();
        allSections = d.sections || [];
      }
      if (assessRes.ok) {
        const a = await assessRes.json();
        allAssessments = a.assessments || [];
      }
    } catch (err) {
      console.error('Failed to load performance dashboard metadata:', err);
    }
  }

  async function fetchPerformanceData() {
    try {
      const params = new URLSearchParams();
      if (selectedAcademicYearId !== 'all') params.append('academicYearId', selectedAcademicYearId);
      if (selectedDepartmentId !== 'all') params.append('departmentId', selectedDepartmentId);
      if (selectedYearId !== 'all') params.append('yearId', selectedYearId);
      if (selectedSectionId !== 'all') params.append('sectionId', selectedSectionId);
      if (selectedStudentId !== 'all') params.append('studentId', selectedStudentId);
      if (selectedAssessmentId !== 'all') params.append('assessmentId', selectedAssessmentId);
      if (searchStudentText.trim()) params.append('search', searchStudentText.trim());

      const res = await fetch(`/api/admin/analytics/performance/overview?${params.toString()}`, {
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      overviewData = await res.json();
      updateMetricCards();
      renderCharts();
      renderStudentsTable();
    } catch (err) {
      console.error('Failed to fetch performance data:', err);
      showNotification('Failed to load performance analytics', 'error');
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

  function getStatusBadge(status) {
    if (status === 'IMPROVED') {
      return `<span class="badge badge-success" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">📈 IMPROVED</span>`;
    }
    if (status === 'DECLINED') {
      return `<span class="badge badge-danger" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); font-weight: 700;">📉 DECLINED</span>`;
    }
    if (status === 'NO_CHANGE') {
      return `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); font-weight: 700;">⚖️ NO CHANGE</span>`;
    }
    return `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 600;">⏳ INCOMPLETE</span>`;
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

  function updateMetricCards() {
    const summary = overviewData.summary;
    if (!summary) return;

    const totalEl = document.getElementById('perf-total-students');
    const ia1El = document.getElementById('perf-ia1-avg');
    const ia2El = document.getElementById('perf-ia2-avg');
    const impEl = document.getElementById('perf-class-imp');
    const distEl = document.getElementById('perf-level-dist');

    if (totalEl) {
      totalEl.textContent = summary.totalStudents;
      const subEl = document.getElementById('perf-total-sub');
      if (subEl) subEl.textContent = `${summary.assessedStudents} Assessed (${summary.unassessedStudents} Pending)`;
    }

    if (ia1El) {
      ia1El.textContent = summary.ia1AveragePercentage !== null ? `${summary.ia1AveragePercentage}%` : 'N/A';
    }

    if (ia2El) {
      ia2El.textContent = summary.ia2AveragePercentage !== null ? `${summary.ia2AveragePercentage}%` : 'N/A';
    }

    if (impEl) {
      const imp = summary.classImprovement;
      if (imp !== null) {
        const sign = imp > 0 ? '+' : '';
        impEl.innerHTML = `<span>${sign}${imp}%</span> <div style="font-size: 11px; margin-top: 4px;">${getStatusBadge(summary.classProgressionStatus)}</div>`;
      } else {
        impEl.innerHTML = `<span style="color: var(--text-muted);">N/A</span>`;
      }
    }

    if (distEl) {
      const ld = summary.levelDistribution;
      distEl.innerHTML = `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399;" title="90-100%">Excellent: <strong>${ld.excellent.count}</strong> (${ld.excellent.percentage}%)</span>
          <span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;" title="80-89%">Very Good: <strong>${ld.veryGood.count}</strong> (${ld.veryGood.percentage}%)</span>
          <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8;" title="70-79%">Good: <strong>${ld.good.count}</strong> (${ld.good.percentage}%)</span>
          <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;" title="60-69%">Average: <strong>${ld.average.count}</strong> (${ld.average.percentage}%)</span>
          <span class="badge" style="background: rgba(244, 63, 94, 0.2); color: #fb7185;" title="<60%">Needs Attn: <strong>${ld.needsAttention.count}</strong> (${ld.needsAttention.percentage}%)</span>
        </div>
      `;
    }
  }

  // ---------------------------------------------------------------------------
  // RECHARTS VISUALIZATION ENGINE (with interactive SVG fallback)
  // ---------------------------------------------------------------------------
  function renderCharts() {
    renderIA1vsIA2Chart();
    renderSubjectComparisonChart();
    renderPerformanceTrendChart();
  }

  function renderIA1vsIA2Chart() {
    const chartContainer = document.getElementById('chart-ia1-vs-ia2');
    if (!chartContainer) return;
    chartContainer.innerHTML = '';

    const students = overviewData.students || [];
    // Pick top 8 students for clean bar chart representation
    const chartData = students
      .filter(s => s.ia1Percentage !== null || s.ia2Percentage !== null)
      .slice(0, 10)
      .map(s => ({
        name: s.studentName.split(' ')[0] || s.registerNumber,
        registerNumber: s.registerNumber,
        IA1: s.ia1Percentage || 0,
        IA2: s.ia2Percentage || 0,
        difference: s.improvement || 0
      }));

    if (chartData.length === 0) {
      chartContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">No IA-1 / IA-2 evaluation marks recorded for this selection.</div>`;
      return;
    }

    // Check if Recharts is available on window
    if (window.React && window.ReactDOM && window.Recharts) {
      try {
        const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } = window.Recharts;
        const root = window.ReactDOM.createRoot ? window.ReactDOM.createRoot(chartContainer) : null;

        const element = window.React.createElement(
          ResponsiveContainer,
          { width: '100%', height: 280 },
          window.React.createElement(
            BarChart,
            { data: chartData, margin: { top: 15, right: 20, left: 0, bottom: 25 } },
            window.React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.08)' }),
            window.React.createElement(XAxis, { dataKey: 'name', stroke: '#94a3b8', tick: { fill: '#94a3b8', fontSize: 11 } }),
            window.React.createElement(YAxis, { stroke: '#94a3b8', domain: [0, 100], tick: { fill: '#94a3b8', fontSize: 11 }, unit: '%' }),
            window.React.createElement(Tooltip, {
              contentStyle: { background: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }
            }),
            window.React.createElement(Legend, { wrapperStyle: { paddingTop: 10 } }),
            window.React.createElement(Bar, { dataKey: 'IA1', name: 'IA-1 (%)', fill: '#6366f1', radius: [4, 4, 0, 0] }),
            window.React.createElement(Bar, { dataKey: 'IA2', name: 'IA-2 (%)', fill: '#10b981', radius: [4, 4, 0, 0] })
          )
        );

        if (root) {
          root.render(element);
          return;
        } else if (window.ReactDOM.render) {
          window.ReactDOM.render(element, chartContainer);
          return;
        }
      } catch (err) {
        console.warn('Recharts render fallback active:', err);
      }
    }

    // Interactive SVG Fallback
    renderSvgBarChart(chartContainer, chartData, ['IA1', 'IA2'], ['#6366f1', '#10b981'], ['IA-1 (%)', 'IA-2 (%)']);
  }

  function renderSubjectComparisonChart() {
    const chartContainer = document.getElementById('chart-subject-comparison');
    if (!chartContainer) return;
    chartContainer.innerHTML = '';

    const subjects = overviewData.subjects || [];
    const chartData = subjects.map(s => ({
      name: s.subjectCode,
      fullName: s.subjectName,
      IA1: s.ia1AveragePercentage || 0,
      IA2: s.ia2AveragePercentage || 0,
      improvement: s.improvement || 0
    }));

    if (chartData.length === 0) {
      chartContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">No subject comparison data available for current selection.</div>`;
      return;
    }

    if (window.React && window.ReactDOM && window.Recharts) {
      try {
        const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } = window.Recharts;
        const root = window.ReactDOM.createRoot ? window.ReactDOM.createRoot(chartContainer) : null;

        const element = window.React.createElement(
          ResponsiveContainer,
          { width: '100%', height: 280 },
          window.React.createElement(
            BarChart,
            { data: chartData, margin: { top: 15, right: 20, left: 0, bottom: 25 } },
            window.React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.08)' }),
            window.React.createElement(XAxis, { dataKey: 'name', stroke: '#94a3b8', tick: { fill: '#94a3b8', fontSize: 11 } }),
            window.React.createElement(YAxis, { stroke: '#94a3b8', domain: [0, 100], tick: { fill: '#94a3b8', fontSize: 11 }, unit: '%' }),
            window.React.createElement(Tooltip, {
              contentStyle: { background: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }
            }),
            window.React.createElement(Legend, { wrapperStyle: { paddingTop: 10 } }),
            window.React.createElement(Bar, { dataKey: 'IA1', name: 'IA-1 Average (%)', fill: '#38bdf8', radius: [4, 4, 0, 0] }),
            window.React.createElement(Bar, { dataKey: 'IA2', name: 'IA-2 Average (%)', fill: '#f43f5e', radius: [4, 4, 0, 0] })
          )
        );

        if (root) {
          root.render(element);
          return;
        } else if (window.ReactDOM.render) {
          window.ReactDOM.render(element, chartContainer);
          return;
        }
      } catch (err) {
        console.warn('Subject Recharts render fallback active:', err);
      }
    }

    renderSvgBarChart(chartContainer, chartData, ['IA1', 'IA2'], ['#38bdf8', '#f43f5e'], ['IA-1 Avg (%)', 'IA-2 Avg (%)']);
  }

  function renderPerformanceTrendChart() {
    const chartContainer = document.getElementById('chart-performance-trend');
    if (!chartContainer) return;
    chartContainer.innerHTML = '';

    const summary = overviewData.summary;
    const ia1 = summary?.ia1AveragePercentage || 0;
    const ia2 = summary?.ia2AveragePercentage || 0;
    const overall = summary?.classAveragePercentage || 0;

    const chartData = [
      { assessment: 'IA-1 (Midterm 1)', percentage: ia1, benchmark: 70 },
      { assessment: 'IA-2 (Midterm 2)', percentage: ia2, benchmark: 70 },
      { assessment: 'Overall Standing', percentage: overall, benchmark: 70 }
    ];

    if (window.React && window.ReactDOM && window.Recharts) {
      try {
        const { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } = window.Recharts;
        const root = window.ReactDOM.createRoot ? window.ReactDOM.createRoot(chartContainer) : null;

        const element = window.React.createElement(
          ResponsiveContainer,
          { width: '100%', height: 280 },
          window.React.createElement(
            AreaChart,
            { data: chartData, margin: { top: 15, right: 20, left: 0, bottom: 25 } },
            window.React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.08)' }),
            window.React.createElement(XAxis, { dataKey: 'assessment', stroke: '#94a3b8', tick: { fill: '#94a3b8', fontSize: 11 } }),
            window.React.createElement(YAxis, { stroke: '#94a3b8', domain: [0, 100], tick: { fill: '#94a3b8', fontSize: 11 }, unit: '%' }),
            window.React.createElement(Tooltip, {
              contentStyle: { background: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }
            }),
            window.React.createElement(Legend, { wrapperStyle: { paddingTop: 10 } }),
            window.React.createElement(Area, {
              type: 'monotone',
              dataKey: 'percentage',
              name: 'Cohort Progress (%)',
              stroke: '#8b5cf6',
              fill: 'rgba(139, 92, 246, 0.25)',
              strokeWidth: 3
            })
          )
        );

        if (root) {
          root.render(element);
          return;
        } else if (window.ReactDOM.render) {
          window.ReactDOM.render(element, chartContainer);
          return;
        }
      } catch (err) {
        console.warn('Trend Recharts fallback active:', err);
      }
    }

    renderSvgTrendChart(chartContainer, chartData);
  }

  // Pure SVG Fallback Visualizers (if offline or CDN delayed)
  function renderSvgBarChart(container, data, keys, colors, labels) {
    const width = 500;
    const height = 240;
    const padX = 40;
    const padY = 30;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;
    const groupW = chartW / data.length;
    const barW = Math.min(16, (groupW - 12) / keys.length);

    let barsSvg = '';
    data.forEach((d, i) => {
      const gX = padX + i * groupW + (groupW - keys.length * barW) / 2;
      keys.forEach((k, ki) => {
        const val = d[k] || 0;
        const bH = (val / 100) * chartH;
        const bY = padY + chartH - bH;
        const bX = gX + ki * barW;
        barsSvg += `
          <rect x="${bX}" y="${bY}" width="${barW - 2}" height="${bH}" fill="${colors[ki]}" rx="3">
            <title>${labels[ki]}: ${val}% (${d.name})</title>
          </rect>
        `;
      });
      barsSvg += `
        <text x="${padX + i * groupW + groupW / 2}" y="${height - 8}" fill="#94a3b8" font-size="10" text-anchor="middle">
          ${d.name}
        </text>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 260px; overflow: visible;">
        <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="rgba(255,255,255,0.1)"/>
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="rgba(255,255,255,0.1)"/>
        <text x="${padX - 8}" y="${padY + 4}" fill="#64748b" font-size="10" text-anchor="end">100%</text>
        <text x="${padX - 8}" y="${padY + chartH / 2}" fill="#64748b" font-size="10" text-anchor="end">50%</text>
        <text x="${padX - 8}" y="${height - padY}" fill="#64748b" font-size="10" text-anchor="end">0%</text>
        ${barsSvg}
      </svg>
      <div style="display: flex; justify-content: center; gap: 16px; font-size: 11px; margin-top: 6px;">
        ${labels.map((l, i) => `<span style="display: flex; align-items: center; gap: 6px;"><span style="display:inline-block;width:10px;height:10px;background:${colors[i]};border-radius:2px;"></span>${l}</span>`).join('')}
      </div>
    `;
  }

  function renderSvgTrendChart(container, data) {
    const width = 500;
    const height = 240;
    const padX = 50;
    const padY = 30;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const points = data.map((d, i) => {
      const x = padX + (i / (data.length - 1 || 1)) * chartW;
      const y = padY + chartH - ((d.percentage || 0) / 100) * chartH;
      return { x, y, ...d };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 260px; overflow: visible;">
        <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="rgba(255,255,255,0.1)"/>
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="rgba(255,255,255,0.1)"/>
        <path d="${areaD}" fill="rgba(139, 92, 246, 0.2)" />
        <path d="${pathD}" fill="none" stroke="#8b5cf6" stroke-width="3" />
        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="5" fill="#a78bfa" stroke="#1e1e2d" stroke-width="2">
            <title>${p.assessment}: ${p.percentage}%</title>
          </circle>
          <text x="${p.x}" y="${p.y - 10}" fill="#c4b5fd" font-size="11" font-weight="bold" text-anchor="middle">${p.percentage}%</text>
          <text x="${p.x}" y="${height - 10}" fill="#94a3b8" font-size="10" text-anchor="middle">${p.assessment.split(' ')[0]}</text>
        `).join('')}
      </svg>
      <div style="display: flex; justify-content: center; gap: 16px; font-size: 11px; margin-top: 6px;">
        <span style="display: flex; align-items: center; gap: 6px;"><span style="display:inline-block;width:10px;height:10px;background:#8b5cf6;border-radius:2px;"></span>Cohort Trajectory Trend</span>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // STUDENT PERFORMANCE TABLE & SUBJECT BREAKDOWN
  // ---------------------------------------------------------------------------
  function renderStudentsTable() {
    const tbody = document.getElementById('perf-students-tbody');
    const countEl = document.getElementById('perf-table-count');
    if (!tbody) return;

    const students = overviewData.students || [];
    if (countEl) countEl.textContent = `Showing ${students.length} students`;

    if (students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No students found matching the selected filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = students.map((s) => {
      const ia1Display = s.ia1Percentage !== null
        ? `<strong>${s.ia1Total}</strong> <span style="color: var(--text-muted); font-size: 12px;">(${s.ia1Percentage}%)</span>`
        : `<span style="color: var(--text-muted);">N/A</span>`;

      const ia2Display = s.ia2Percentage !== null
        ? `<strong>${s.ia2Total}</strong> <span style="color: var(--text-muted); font-size: 12px;">(${s.ia2Percentage}%)</span>`
        : `<span style="color: var(--text-muted);">N/A</span>`;

      const diffDisplay = s.improvement !== null
        ? `<div style="display: flex; align-items: center; gap: 8px;">
             <span style="font-weight: 700; color: ${s.improvement > 0 ? '#10b981' : s.improvement < 0 ? '#f43f5e' : '#94a3b8'};">
               ${s.improvement > 0 ? '+' : ''}${s.improvement}%
             </span>
             ${getStatusBadge(s.progressionStatus)}
           </div>`
        : getStatusBadge('MISSING_DATA');

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #ffffff;">${s.studentName}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${s.registerNumber}</div>
          </td>
          <td>
            <span class="role-pill badge-staff" style="font-size: 11px;">${s.departmentCode || '-'}</span>
          </td>
          <td style="font-size: 13px;">${s.yearName || '-'}</td>
          <td>
            <span class="badge" style="background: rgba(255,255,255,0.08);">${s.sectionName || '-'}</span>
          </td>
          <td>${ia1Display}</td>
          <td>${ia2Display}</td>
          <td>${diffDisplay}</td>
          <td>${getLevelBadge(s.performanceStatus)}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm view-student-subjects-btn" data-student-id="${s.studentId}">
              Subject Breakdown
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners to view subject breakdown modal
    tbody.querySelectorAll('.view-student-subjects-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const studentId = e.currentTarget.getAttribute('data-student-id');
        openSubjectComparisonModal(studentId);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // SUBJECT COMPARISON MODAL: Subject | IA-1 | IA-2 | Difference | Status
  // ---------------------------------------------------------------------------
  async function openSubjectComparisonModal(studentId) {
    const modal = document.getElementById('perf-subject-modal');
    const content = document.getElementById('perf-subject-modal-content');
    if (!modal || !content) return;

    modal.style.display = 'flex';
    content.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="spinner" style="margin: 0 auto 12px auto;"></div>
        Loading verified subject performance calculations from backend...
      </div>
    `;

    try {
      const res = await fetch(`/api/admin/analytics/performance/student/${studentId}`, {
        headers: getHeaders()
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const report = data.report;
      activeStudentDetail = report;

      const subjectRows = report.subjectBreakdown && report.subjectBreakdown.length > 0
        ? report.subjectBreakdown.map(sub => {
            const ia1Str = sub.ia1.percentage !== null
              ? `<strong>${sub.ia1.obtained}/${sub.ia1.maximum}</strong> <span style="color: var(--text-muted);">(${sub.ia1.percentage}%)</span>`
              : `<span style="color: var(--text-muted);">Pending</span>`;

            const ia2Str = sub.ia2.percentage !== null
              ? `<strong>${sub.ia2.obtained}/${sub.ia2.maximum}</strong> <span style="color: var(--text-muted);">(${sub.ia2.percentage}%)</span>`
              : `<span style="color: var(--text-muted);">Pending</span>`;

            const diffStr = sub.difference !== null
              ? `<span style="font-weight: 700; color: ${sub.difference > 0 ? '#10b981' : sub.difference < 0 ? '#f43f5e' : '#94a3b8'};">
                   ${sub.difference > 0 ? '+' : ''}${sub.difference}%
                 </span>`
              : `<span style="color: var(--text-muted);">-</span>`;

            return `
              <tr>
                <td>
                  <div style="font-weight: 600; color: #ffffff;">${sub.subjectName}</div>
                  <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${sub.subjectCode}</div>
                </td>
                <td>${ia1Str}</td>
                <td>${ia2Str}</td>
                <td>${diffStr}</td>
                <td>${getStatusBadge(sub.status)}</td>
              </tr>
            `;
          }).join('')
        : `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">No subject marks recorded for this student.</td></tr>`;

      content.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
          <div>
            <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${report.studentName}</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
              Register Number: <code style="color: #38bdf8;">${report.registerNumber}</code> | 
              ${report.departmentCode || ''} - ${report.yearName || ''} (${report.sectionName || ''})
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${getLevelBadge(report.performanceStatus)}
            <button id="btn-preview-parent-msg" class="btn btn-sm btn-secondary" style="font-size: 11px;">
              📱 Preview Parent SMS/WA
            </button>
          </div>
        </div>

        <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 24px;">
          <div class="metric-card" style="padding: 12px 16px;">
            <div class="metric-title" style="font-size: 10px;">IA-1 TOTAL / PCT</div>
            <div style="font-size: 18px; font-weight: 700; color: #6366f1;">
              ${report.ia1Total !== null ? `${report.ia1Total} / ${report.ia1MaxTotal} (${report.ia1Percentage}%)` : 'N/A'}
            </div>
          </div>
          <div class="metric-card" style="padding: 12px 16px;">
            <div class="metric-title" style="font-size: 10px;">IA-2 TOTAL / PCT</div>
            <div style="font-size: 18px; font-weight: 700; color: #10b981;">
              ${report.ia2Total !== null ? `${report.ia2Total} / ${report.ia2MaxTotal} (${report.ia2Percentage}%)` : 'N/A'}
            </div>
          </div>
          <div class="metric-card" style="padding: 12px 16px;">
            <div class="metric-title" style="font-size: 10px;">PROGRESSION STATUS</div>
            <div style="font-size: 16px; font-weight: 700; margin-top: 4px;">
              ${getStatusBadge(report.progressionStatus)}
              <span style="font-size: 13px; margin-left: 6px; color: ${report.improvement > 0 ? '#10b981' : report.improvement < 0 ? '#f43f5e' : '#94a3b8'};">
                ${report.improvement !== null ? `${report.improvement > 0 ? '+' : ''}${report.improvement}%` : ''}
              </span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 12px; font-weight: 700; font-size: 14px; color: #ffffff;">
          Subject-Wise Evaluation & Comparison
        </div>

        <div class="table-responsive" style="max-height: 350px; overflow-y: auto;">
          <table class="data-table" style="width: 100%;">
            <thead>
              <tr>
                <th>Subject</th>
                <th>IA-1</th>
                <th>IA-2</th>
                <th>Difference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${subjectRows}
            </tbody>
          </table>
        </div>
      `;

      const prevBtn = document.getElementById('btn-preview-parent-msg');
      if (prevBtn) {
        prevBtn.addEventListener('click', async () => {
          try {
            const res = await fetch(`/api/admin/notifications/preview-student-performance/${studentId}`, {
              headers: getHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            let modal = document.getElementById('parent-msg-preview-modal');
            if (!modal) {
              modal = document.createElement('div');
              modal.id = 'parent-msg-preview-modal';
              document.body.appendChild(modal);
            }

            modal.innerHTML = `
              <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div class="card-box" style="width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; border-top: 4px solid #38bdf8;">
                  <div class="card-box-header" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <div>
                      <div class="card-box-title" style="font-size: 16px; color: #fff;">📱 Parent Performance Message & Notification Dispatch</div>
                      <span style="font-size: 12px; color: var(--text-muted);">${data.studentName} (${data.registerNumber}) • Parent: ${data.parentMobile || 'Not registered'}</span>
                    </div>
                    <button id="btn-close-parent-msg-modal" class="btn btn-secondary btn-sm">✕</button>
                  </div>
                  <div class="card-box-body">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                      Generated by <code>NotificationTemplateService</code> (Mock Provider Architecture):
                    </div>
                    <div style="background: #0f172a; border: 1px solid #1e293b; padding: 14px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #38bdf8; white-space: pre-wrap; line-height: 1.5; margin-bottom: 16px;">
${data.message}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                      <span>Length: <strong>${data.characterCount} chars</strong> (~${data.estimatedSmsSegments} SMS segments)</span>
                      <span class="role-pill badge-admin" style="font-size: 10px;">MOCK MODE ACTIVE</span>
                    </div>

                    <!-- Dispatch Controls -->
                    <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 14px;">
                      <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #e2e8f0;">Select Delivery Channel:</div>
                      <div style="display: flex; gap: 14px; margin-bottom: 10px;">
                        <label style="font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                          <input type="radio" name="dispatch-channel" value="BOTH" checked> Both (SMS + WhatsApp)
                        </label>
                        <label style="font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                          <input type="radio" name="dispatch-channel" value="SMS"> SMS Only
                        </label>
                        <label style="font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                          <input type="radio" name="dispatch-channel" value="WHATSAPP"> WhatsApp Only
                        </label>
                      </div>
                      <div id="dispatch-result-box" style="display: none; margin-top: 10px; padding: 10px; border-radius: 6px; font-size: 12px;"></div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                      <button id="btn-done-parent-msg-modal" class="btn btn-secondary btn-sm">Close</button>
                      <button id="btn-dispatch-mock-msg" class="btn btn-primary btn-sm" style="background: #0284c7;">🚀 Dispatch Notification (Mock)</button>
                    </div>
                  </div>
                </div>
              </div>
            `;

            document.getElementById('btn-close-parent-msg-modal').addEventListener('click', () => {
              modal.innerHTML = '';
            });
            document.getElementById('btn-done-parent-msg-modal').addEventListener('click', () => {
              modal.innerHTML = '';
            });

            document.getElementById('btn-dispatch-mock-msg').addEventListener('click', async () => {
              const dispatchBtn = document.getElementById('btn-dispatch-mock-msg');
              const resultBox = document.getElementById('dispatch-result-box');
              const selectedChannel = document.querySelector('input[name="dispatch-channel"]:checked')?.value || 'BOTH';

              dispatchBtn.disabled = true;
              dispatchBtn.textContent = '⏳ Dispatching...';
              resultBox.style.display = 'block';
              resultBox.style.background = '#1e293b';
              resultBox.style.color = '#94a3b8';
              resultBox.innerHTML = 'Dispatched to provider engine (status: PROCESSING)...';

              try {
                const sendRes = await fetch('/api/admin/notifications/send-performance', {
                  method: 'POST',
                  headers: getHeaders(),
                  body: JSON.stringify({
                    studentId,
                    channel: selectedChannel
                  })
                });

                const sendData = await sendRes.json();
                if (!sendRes.ok) throw new Error(sendData.error || `HTTP ${sendRes.status}`);

                resultBox.style.background = 'rgba(16, 185, 129, 0.15)';
                resultBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
                resultBox.style.color = '#10b981';

                const notifLines = sendData.notifications.map(n => 
                  `<div>• [${n.type}] Status: <strong>${n.status}</strong> | ID: <code>${n.providerMessageId}</code></div>`
                ).join('');

                resultBox.innerHTML = `
                  <div style="font-weight: 600; margin-bottom: 4px;">✅ Notifications Successfully Simulated!</div>
                  ${notifLines}
                `;
                dispatchBtn.textContent = '✅ Sent';
                showNotification('Performance notification dispatched via mock provider!', 'success');
              } catch (sendErr) {
                resultBox.style.background = 'rgba(244, 63, 94, 0.15)';
                resultBox.style.border = '1px solid rgba(244, 63, 94, 0.4)';
                resultBox.style.color = '#f43f5e';
                resultBox.innerHTML = `❌ Failed: ${sendErr.message}`;
                dispatchBtn.disabled = false;
                dispatchBtn.textContent = 'Retry Dispatch';
                showNotification(sendErr.message || 'Dispatch failed', 'error');
              }
            });

          } catch (err) {
            showNotification('Failed to generate parent message preview', 'error');
          }
        });
      }
    } catch (err) {
      console.error('Failed to load student breakdown:', err);
      content.innerHTML = `<div style="padding: 30px; text-align: center; color: #f43f5e;">Failed to load subject details for student.</div>`;
    }
  }

  // ---------------------------------------------------------------------------
  // MAIN VIEW RENDER
  // ---------------------------------------------------------------------------
  async function render() {
    await loadMetadata();

    container.innerHTML = `
      <div class="performance-dashboard-container">
        
        <!-- Header Banner -->
        <div class="card-box" style="border-left: 4px solid #8b5cf6; margin-bottom: 20px;">
          <div class="card-box-header" style="flex-wrap: wrap; gap: 12px;">
            <div>
              <div class="card-box-title" style="display: flex; align-items: center; gap: 10px;">
                <span>📊</span> Student Academic Performance Dashboard
                <span class="role-pill badge-admin" style="font-size: 11px;">Institutional Source of Truth</span>
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                Evaluate IA-1 vs IA-2 scores, improvement and decline trajectories, subject-wise comparisons, and cohort trends.
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button id="perf-refresh-btn" class="btn btn-secondary btn-sm">
                🔄 Refresh Analytics
              </button>
            </div>
          </div>

          <!-- Multi-Parameter Filters Bar -->
          <div style="padding: 16px 20px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.06); display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end;">
            
            <div style="flex: 1; min-width: 150px;">
              <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Academic Year</label>
              <select id="perf-filter-ay" class="form-control form-control-sm">
                <option value="all">All Academic Years</option>
                ${(academicStructure.academicYears || []).map(a => `<option value="${a.id}">${a.yearName} ${a.isCurrent ? '(Current)' : ''}</option>`).join('')}
              </select>
            </div>

            <div style="flex: 1; min-width: 150px;">
              <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Department</label>
              <select id="perf-filter-dept" class="form-control form-control-sm">
                <option value="all">All Departments</option>
                ${(academicStructure.departments || []).map(d => `<option value="${d.id}">${d.code} - ${d.name}</option>`).join('')}
              </select>
            </div>

            <div style="flex: 1; min-width: 130px;">
              <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Year</label>
              <select id="perf-filter-year" class="form-control form-control-sm">
                <option value="all">All Years</option>
                ${(academicStructure.years || []).map(y => `<option value="${y.id}">${y.name}</option>`).join('')}
              </select>
            </div>

            <div style="flex: 1; min-width: 130px;">
              <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Section</label>
              <select id="perf-filter-sec" class="form-control form-control-sm">
                <option value="all">All Sections</option>
              </select>
            </div>

            <div style="flex: 1; min-width: 150px;">
              <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Assessment</label>
              <select id="perf-filter-assess" class="form-control form-control-sm">
                <option value="all">All Assessments</option>
                ${allAssessments.map(a => `<option value="${a.id}">${a.name} (${a.code})</option>`).join('')}
              </select>
            </div>

            <div style="flex: 1.2; min-width: 180px;">
              <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Student Name / Reg No</label>
              <input type="text" id="perf-filter-search" class="form-control form-control-sm" placeholder="Search student..." />
            </div>

            <div style="display: flex; gap: 8px;">
              <button id="perf-reset-filters-btn" class="btn btn-secondary btn-sm" style="height: 36px;">
                Reset
              </button>
            </div>
          </div>
        </div>

        <!-- Metric Summary Cards -->
        <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 20px;">
          <div class="metric-card">
            <div class="metric-title">EVALUATED STUDENTS</div>
            <div class="metric-value" id="perf-total-students" style="color: #38bdf8;">0</div>
            <div class="metric-sub" id="perf-total-sub">Cohort population</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">IA-1 COHORT AVERAGE</div>
            <div class="metric-value" id="perf-ia1-avg" style="color: #6366f1;">-</div>
            <div class="metric-sub">Midterm 1 Percentage</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">IA-2 COHORT AVERAGE</div>
            <div class="metric-value" id="perf-ia2-avg" style="color: #10b981;">-</div>
            <div class="metric-sub">Midterm 2 Percentage</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">OVERALL PROGRESSION</div>
            <div class="metric-value" id="perf-class-imp">-</div>
            <div class="metric-sub">IA-2 vs IA-1 Delta</div>
          </div>
        </div>

        <!-- Performance Level Distribution Bar -->
        <div class="card-box" style="margin-bottom: 20px; padding: 14px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <span style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">
              Institutional Performance Distribution:
            </span>
            <div id="perf-level-dist"></div>
          </div>
        </div>

        <!-- Recharts Visualizations Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin-bottom: 20px;">
          
          <!-- Chart 1: IA-1 vs IA-2 -->
          <div class="card-box" style="margin-bottom: 0;">
            <div class="card-box-header">
              <div class="card-box-title" style="font-size: 14px;">📊 IA-1 vs IA-2 Student Comparison</div>
              <span class="badge badge-primary" style="font-size: 10px;">Side-by-side</span>
            </div>
            <div class="card-box-body" id="chart-ia1-vs-ia2" style="min-height: 280px; display: flex; flex-direction: column; justify-content: center;">
              <div class="spinner" style="margin: auto;"></div>
            </div>
          </div>

          <!-- Chart 2: Subject-wise Comparison -->
          <div class="card-box" style="margin-bottom: 0;">
            <div class="card-box-header">
              <div class="card-box-title" style="font-size: 14px;">📚 Subject Performance Comparison</div>
              <span class="badge badge-success" style="font-size: 10px;">Subject Averages</span>
            </div>
            <div class="card-box-body" id="chart-subject-comparison" style="min-height: 280px; display: flex; flex-direction: column; justify-content: center;">
              <div class="spinner" style="margin: auto;"></div>
            </div>
          </div>

          <!-- Chart 3: Performance Progression Trend -->
          <div class="card-box" style="margin-bottom: 0;">
            <div class="card-box-header">
              <div class="card-box-title" style="font-size: 14px;">📈 Cohort Progression Trend</div>
              <span class="badge" style="background: rgba(139,92,246,0.2); color: #a78bfa; font-size: 10px;">Timeline Trajectory</span>
            </div>
            <div class="card-box-body" id="chart-performance-trend" style="min-height: 280px; display: flex; flex-direction: column; justify-content: center;">
              <div class="spinner" style="margin: auto;"></div>
            </div>
          </div>

        </div>

        <!-- Student Roster Table -->
        <div class="card-box">
          <div class="card-box-header">
            <div>
              <div class="card-box-title">Student Performance Roster</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;" id="perf-table-count">
                Loading students...
              </div>
            </div>
          </div>
          <div class="card-box-body" style="padding: 0;">
            <div class="table-responsive">
              <table class="data-table" style="width: 100%;">
                <thead>
                  <tr>
                    <th>Student Name & Reg No</th>
                    <th>Department</th>
                    <th>Year</th>
                    <th>Section</th>
                    <th>IA-1 Total & %</th>
                    <th>IA-2 Total & %</th>
                    <th>Comparison (Imp/Dec)</th>
                    <th>Performance Status</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody id="perf-students-tbody">
                  <tr>
                    <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">
                      Loading student performance data...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Subject Comparison Modal -->
        <div id="perf-subject-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; padding: 20px;">
          <div class="modal-card" style="background: #1e1e2d; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);">
              <div style="font-weight: 700; font-size: 16px; color: #ffffff; display: flex; align-items: center; gap: 8px;">
                <span>📋</span> Student Subject Comparison
              </div>
              <button id="perf-close-modal-btn" class="btn btn-secondary btn-sm" style="padding: 4px 10px;">✕</button>
            </div>
            <div id="perf-subject-modal-content" style="padding: 24px;"></div>
          </div>
        </div>

      </div>
    `;

    // Filter DOM elements
    const aySelect = document.getElementById('perf-filter-ay');
    const deptSelect = document.getElementById('perf-filter-dept');
    const yearSelect = document.getElementById('perf-filter-year');
    const secSelect = document.getElementById('perf-filter-sec');
    const assessSelect = document.getElementById('perf-filter-assess');
    const searchInput = document.getElementById('perf-filter-search');
    const resetBtn = document.getElementById('perf-reset-filters-btn');
    const refreshBtn = document.getElementById('perf-refresh-btn');
    const closeModalBtn = document.getElementById('perf-close-modal-btn');
    const modal = document.getElementById('perf-subject-modal');

    function updateSectionOptions() {
      const filtered = getFilteredSections();
      secSelect.innerHTML = `<option value="all">All Sections</option>` +
        filtered.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    // Attach filter event handlers
    aySelect.addEventListener('change', (e) => {
      selectedAcademicYearId = e.target.value;
      updateSectionOptions();
      fetchPerformanceData();
    });

    deptSelect.addEventListener('change', (e) => {
      selectedDepartmentId = e.target.value;
      updateSectionOptions();
      fetchPerformanceData();
    });

    yearSelect.addEventListener('change', (e) => {
      selectedYearId = e.target.value;
      updateSectionOptions();
      fetchPerformanceData();
    });

    secSelect.addEventListener('change', (e) => {
      selectedSectionId = e.target.value;
      fetchPerformanceData();
    });

    assessSelect.addEventListener('change', (e) => {
      selectedAssessmentId = e.target.value;
      fetchPerformanceData();
    });

    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchStudentText = e.target.value;
        fetchPerformanceData();
      }, 350);
    });

    resetBtn.addEventListener('click', () => {
      selectedAcademicYearId = 'all';
      selectedDepartmentId = 'all';
      selectedYearId = 'all';
      selectedSectionId = 'all';
      selectedStudentId = 'all';
      selectedAssessmentId = 'all';
      searchStudentText = '';

      aySelect.value = 'all';
      deptSelect.value = 'all';
      yearSelect.value = 'all';
      secSelect.value = 'all';
      assessSelect.value = 'all';
      searchInput.value = '';

      updateSectionOptions();
      fetchPerformanceData();
    });

    refreshBtn.addEventListener('click', () => {
      fetchPerformanceData();
      showNotification('Performance metrics refreshed', 'info');
    });

    closeModalBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    updateSectionOptions();
    await fetchPerformanceData();
  }

  render();
}
