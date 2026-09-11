import { Auth } from '../auth.js';

export function renderAdminDashboardView(container, switchTab, router) {
  const user = Auth.getUser();
  let dashboardData = null;
  let selectedAcademicYear = '';

  container.innerHTML = `
    <div class="admin-dashboard-container" style="max-width: 1400px; margin: 0 auto;">
      
      <!-- Command Header Banner -->
      <div class="card-box" style="border-left: 4px solid var(--accent-rose); background: linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(13, 18, 31, 0.95) 100%); margin-bottom: 20px;">
        <div class="card-box-header" style="flex-wrap: wrap; gap: 14px; padding: 20px 24px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px;">🏛️</span>
              <div>
                <div class="card-box-title" style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">
                  VSB Engineering College — Institutional Command Center
                </div>
                <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                  Welcome back, <strong>${user?.name || 'Administrator'}</strong> (${user?.email || 'admin@college.edu'}). 
                  Real-time institutional oversight, performance benchmarking, and communications status.
                </div>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="role-pill badge-admin" style="padding: 4px 12px; font-size: 11px;">🛡️ Full System Clearance</span>
            <button id="btn-refresh-dashboard" class="btn btn-secondary btn-sm" style="padding: 6px 12px;">
              <span>🔄</span> Refresh Data
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Actions Bar (8 Actions) -->
      <div class="card-box" style="margin-bottom: 24px; padding: 18px 22px; background: rgba(255, 255, 255, 0.02);">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span>⚡</span> Quick Administrative Actions
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;" id="quick-actions-bar">
          <button class="btn btn-secondary btn-sm quick-act-btn" data-target-tab="students" data-action="add-student" style="justify-content: flex-start; padding: 10px 14px; border: 1px solid rgba(255,255,255,0.08);">
            <span style="font-size: 16px;">➕</span> Add Student
          </button>
          <button class="btn btn-secondary btn-sm quick-act-btn" data-target-tab="students" data-action="import-students" style="justify-content: flex-start; padding: 10px 14px; border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8;">
            <span style="font-size: 16px;">📥</span> Import Students
          </button>
          <button class="btn btn-secondary btn-sm quick-act-btn" data-target-tab="teachers" data-action="add-staff" style="justify-content: flex-start; padding: 10px 14px; border: 1px solid rgba(255,255,255,0.08);">
            <span style="font-size: 16px;">👨‍🏫</span> Add Staff
          </button>
          <button class="btn btn-secondary btn-sm quick-act-btn" data-target-tab="teachers" data-action="assign-staff" style="justify-content: flex-start; padding: 10px 14px; border: 1px solid rgba(255,255,255,0.08);">
            <span style="font-size: 16px;">🔗</span> Assign Staff
          </button>
          <button class="btn btn-secondary btn-sm quick-act-btn" data-target-tab="marks" data-action="upload-marks" style="justify-content: flex-start; padding: 10px 14px; border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399;">
            <span style="font-size: 16px;">📝</span> Upload Marks
          </button>
          <button class="btn btn-secondary btn-sm quick-act-btn" data-target-tab="notices" data-action="create-notice" style="justify-content: flex-start; padding: 10px 14px; border: 1px solid rgba(244, 63, 94, 0.3); color: #fb7185;">
            <span style="font-size: 16px;">📢</span> Create Notice
          </button>
          <button class="btn btn-secondary btn-sm quick-act-btn" data-target-tab="analytics" data-action="view-analytics" style="justify-content: flex-start; padding: 10px 14px; border: 1px solid rgba(99, 102, 241, 0.3); color: #818cf8;">
            <span style="font-size: 16px;">📈</span> View Analytics
          </button>
          <button class="btn btn-secondary btn-sm quick-act-btn" data-target-tab="reports" data-action="generate-report" style="justify-content: flex-start; padding: 10px 14px; border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24;">
            <span style="font-size: 16px;">📑</span> Generate Report
          </button>
        </div>
      </div>

      <!-- 8 Core Dashboard Cards -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 8px;">
            <span>📊</span> Institutional Vital Metrics (8 Core KPIs)
          </span>
          <span id="dashboard-sync-time" style="font-size: 11px; color: var(--text-dim); font-weight: 500;">Syncing...</span>
        </div>

        <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin: 0;">
          <!-- 1. Total Students -->
          <div class="metric-card" style="border-left: 3px solid #38bdf8;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="metric-title">TOTAL STUDENTS</div>
              <span style="font-size: 18px;">👥</span>
            </div>
            <div class="metric-value" id="card-total-students" style="color: #38bdf8;">—</div>
            <div class="metric-sub">Active enrolled students</div>
          </div>

          <!-- 2. Total Staff -->
          <div class="metric-card" style="border-left: 3px solid #34d399;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="metric-title">TOTAL STAFF</div>
              <span style="font-size: 18px;">👨‍🏫</span>
            </div>
            <div class="metric-value" id="card-total-staff" style="color: #34d399;">—</div>
            <div class="metric-sub">Active faculty accounts</div>
          </div>

          <!-- 3. Departments -->
          <div class="metric-card" style="border-left: 3px solid #fb7185;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="metric-title">DEPARTMENTS</div>
              <span style="font-size: 18px;">🏛️</span>
            </div>
            <div class="metric-value" id="card-departments" style="color: #fb7185;">—</div>
            <div class="metric-sub">Undergraduate departments</div>
          </div>

          <!-- 4. Sections -->
          <div class="metric-card" style="border-left: 3px solid #818cf8;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="metric-title">SECTIONS</div>
              <span style="font-size: 18px;">🏫</span>
            </div>
            <div class="metric-value" id="card-sections" style="color: #818cf8;">—</div>
            <div class="metric-sub">Classroom cohorts</div>
          </div>

          <!-- 5. IA-1 Average -->
          <div class="metric-card" style="border-left: 3px solid #f59e0b;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="metric-title">IA-1 AVERAGE</div>
              <span style="font-size: 18px;">📝</span>
            </div>
            <div class="metric-value" id="card-ia1-avg" style="color: #fbbf24;">—</div>
            <div class="metric-sub">Assessment 1 benchmark</div>
          </div>

          <!-- 6. IA-2 Average -->
          <div class="metric-card" style="border-left: 3px solid #a855f7;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="metric-title">IA-2 AVERAGE</div>
              <span style="font-size: 18px;">📈</span>
            </div>
            <div class="metric-value" id="card-ia2-avg" style="color: #c084fc;">—</div>
            <div class="metric-sub">Assessment 2 benchmark</div>
          </div>

          <!-- 7. Overall Improvement -->
          <div class="metric-card" style="border-left: 3px solid #10b981;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="metric-title">OVERALL IMPROVEMENT</div>
              <span style="font-size: 18px;">🚀</span>
            </div>
            <div class="metric-value" id="card-improvement" style="color: #34d399;">—</div>
            <div class="metric-sub">IA-1 to IA-2 trajectory</div>
          </div>

          <!-- 8. Pass Percentage -->
          <div class="metric-card" style="border-left: 3px solid #06b6d4;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="metric-title">PASS PERCENTAGE</div>
              <span style="font-size: 18px;">🎯</span>
            </div>
            <div class="metric-value" id="card-pass-percentage" style="color: #22d3ee;">—</div>
            <div class="metric-sub">College threshold (≥50%)</div>
          </div>
        </div>
      </div>

      <!-- College Notices & Notifications Queue Status -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 20px; margin-bottom: 24px;">
        
        <!-- College Notices Status -->
        <div class="card-box" style="margin-bottom: 0;">
          <div class="card-box-header" style="padding: 16px 20px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">📢</span>
              <div class="card-box-title" style="font-size: 15px;">College Notices Register</div>
            </div>
            <button class="btn btn-sm btn-secondary quick-act-btn" data-target-tab="notices" data-action="create-notice" style="padding: 4px 10px; font-size: 11px;">
              + New Notice
            </button>
          </div>
          <div class="card-box-body" style="padding: 18px 20px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">DRAFT NOTICES</div>
                <div id="val-notices-draft" style="font-size: 22px; font-weight: 800; color: #fbbf24; margin-top: 4px;">0</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">In preparation</div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">SCHEDULED</div>
                <div id="val-notices-scheduled" style="font-size: 22px; font-weight: 800; color: #38bdf8; margin-top: 4px;">0</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Queued timing</div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">PUBLISHED</div>
                <div id="val-notices-published" style="font-size: 22px; font-weight: 800; color: #34d399; margin-top: 4px;">0</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Live broadcasts</div>
              </div>
            </div>

            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 8px;">
              Recent Official Broadcasts
            </div>
            <div id="recent-notices-list" style="display: flex; flex-direction: column; gap: 8px;">
              <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px;">Loading notices...</div>
            </div>
          </div>
        </div>

        <!-- Parent Notifications Status -->
        <div class="card-box" style="margin-bottom: 0;">
          <div class="card-box-header" style="padding: 16px 20px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">📱</span>
              <div class="card-box-title" style="font-size: 15px;">Parent Notifications Queue</div>
            </div>
            <button class="btn btn-sm btn-secondary quick-act-btn" data-target-tab="notifications" style="padding: 4px 10px; font-size: 11px;">
              View History
            </button>
          </div>
          <div class="card-box-body" style="padding: 18px 20px;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 8px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">PENDING</div>
                <div id="val-notif-pending" style="font-size: 20px; font-weight: 800; color: #fbbf24; margin-top: 4px;">0</div>
                <div style="font-size: 10px; color: var(--text-muted);">In worker queue</div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 8px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">SENT</div>
                <div id="val-notif-sent" style="font-size: 20px; font-weight: 800; color: #38bdf8; margin-top: 4px;">0</div>
                <div style="font-size: 10px; color: var(--text-muted);">Dispatched</div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 8px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">DELIVERED</div>
                <div id="val-notif-delivered" style="font-size: 20px; font-weight: 800; color: #34d399; margin-top: 4px;">0</div>
                <div style="font-size: 10px; color: var(--text-muted);">Confirmed</div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 8px; text-align: center;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">FAILED</div>
                <div id="val-notif-failed" style="font-size: 20px; font-weight: 800; color: #fb7185; margin-top: 4px;">0</div>
                <div style="font-size: 10px; color: var(--text-muted);">Errors logged</div>
              </div>
            </div>

            <div style="margin-top: 14px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
                <span style="color: var(--text-muted); font-weight: 600;">Delivery Success Rate</span>
                <span id="notif-success-rate" style="font-weight: 700; color: #34d399;">0%</span>
              </div>
              <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                <div id="notif-progress-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #10b981, #059669); transition: width 0.6s ease;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-dim); margin-top: 6px;">
                <span>SMS + WhatsApp Official Cloud API</span>
                <span id="notif-total-count">0 Total Transmissions</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Performance Overview Section -->
      <div class="card-box" style="margin-bottom: 24px;">
        <div class="card-box-header" style="padding: 16px 20px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">📈</span>
            <div class="card-box-title" style="font-size: 15px;">Academic Performance Overview</div>
          </div>
          <span class="badge badge-success" id="perf-benchmark-badge">Optimal</span>
        </div>
        <div class="card-box-body" style="padding: 20px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
            <div style="background: rgba(255,255,255,0.02); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">EVALUATED STUDENTS</div>
              <div id="overview-evaluated-students" style="font-size: 20px; font-weight: 800; color: #fff; margin-top: 4px;">—</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Assessed across IA-1 / IA-2</div>
            </div>
            <div style="background: rgba(255,255,255,0.02); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">TOTAL MARKS RECORDED</div>
              <div id="overview-total-marks" style="font-size: 20px; font-weight: 800; color: #fff; margin-top: 4px;">—</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Grades entered by faculty</div>
            </div>
            <div style="background: rgba(255,255,255,0.02); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">HIGHEST PERCENTAGE</div>
              <div id="overview-highest-score" style="font-size: 20px; font-weight: 800; color: #34d399; margin-top: 4px;">—</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Top academic mark</div>
            </div>
            <div style="background: rgba(255,255,255,0.02); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 11px; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">LOWEST PERCENTAGE</div>
              <div id="overview-lowest-score" style="font-size: 20px; font-weight: 800; color: #fb7185; margin-top: 4px;">—</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Minimum recorded score</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Department Performance & Year Performance Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 20px; margin-bottom: 24px;">
        
        <!-- Department Performance -->
        <div class="card-box" style="margin-bottom: 0;">
          <div class="card-box-header" style="padding: 16px 20px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🏛️</span>
              <div class="card-box-title" style="font-size: 15px;">Department Performance</div>
            </div>
            <button class="btn btn-sm btn-secondary quick-act-btn" data-target-tab="analytics" style="padding: 4px 10px; font-size: 11px;">
              Full Analytics
            </button>
          </div>
          <div class="card-box-body" style="padding: 0; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid var(--border-subtle);">
                <tr>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">RANK</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">DEPARTMENT</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">STUDENTS</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IA-1</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IA-2</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IMPROVEMENT</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">PASS %</th>
                </tr>
              </thead>
              <tbody id="table-dept-performance-body">
                <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading department rankings...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Year Performance -->
        <div class="card-box" style="margin-bottom: 0;">
          <div class="card-box-header" style="padding: 16px 20px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">📅</span>
              <div class="card-box-title" style="font-size: 15px;">Year-wise Cohort Performance</div>
            </div>
            <span class="badge" style="background: rgba(129, 140, 248, 0.2); color: #818cf8;">1st to 4th Year</span>
          </div>
          <div class="card-box-body" style="padding: 0; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid var(--border-subtle);">
                <tr>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">COHORT</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">SECTIONS</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">STUDENTS</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IA-1 AVG</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IA-2 AVG</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IMPROVEMENT</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">PASS %</th>
                </tr>
              </thead>
              <tbody id="table-year-performance-body">
                <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading year cohorts...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Section Performance Section -->
      <div class="card-box" style="margin-bottom: 24px;">
        <div class="card-box-header" style="padding: 16px 20px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🏫</span>
            <div class="card-box-title" style="font-size: 15px;">Class Section Performance</div>
          </div>
          <button class="btn btn-sm btn-secondary quick-act-btn" data-target-tab="reports" style="padding: 4px 10px; font-size: 11px;">
            Export Section Report
          </button>
        </div>
        <div class="card-box-body" style="padding: 0; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            <thead style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid var(--border-subtle);">
              <tr>
                <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">SECTION</th>
                <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">DEPARTMENT</th>
                <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">YEAR</th>
                <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">STUDENTS</th>
                <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IA-1 AVG</th>
                <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IA-2 AVG</th>
                <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IMPROVEMENT</th>
                <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">HIGHEST / LOWEST</th>
                <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">PASS %</th>
              </tr>
            </thead>
            <tbody id="table-section-performance-body">
              <tr><td colspan="9" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading sections...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Students & Students Needing Attention Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 20px; margin-bottom: 24px;">
        
        <!-- Top Students -->
        <div class="card-box" style="margin-bottom: 0;">
          <div class="card-box-header" style="padding: 16px 20px; background: rgba(16, 185, 129, 0.05);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🏆</span>
              <div class="card-box-title" style="font-size: 15px; color: #34d399;">Top Performing Students</div>
            </div>
            <span class="badge badge-success">Academic Distinction</span>
          </div>
          <div class="card-box-body" style="padding: 0; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid var(--border-subtle);">
                <tr>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">RANK</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">STUDENT</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">REGISTER NO</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">CLASS</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IA-1</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IA-2</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">OVERALL</th>
                </tr>
              </thead>
              <tbody id="table-top-students-body">
                <tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading top performers...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Students Needing Attention -->
        <div class="card-box" style="margin-bottom: 0;">
          <div class="card-box-header" style="padding: 16px 20px; background: rgba(244, 63, 94, 0.05);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">⚠️</span>
              <div class="card-box-title" style="font-size: 15px; color: #fb7185;">Students Needing Attention</div>
            </div>
            <span class="badge" style="background: rgba(244, 63, 94, 0.2); color: #fb7185;">Academic Intervention</span>
          </div>
          <div class="card-box-body" style="padding: 0; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid var(--border-subtle);">
                <tr>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">STUDENT</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">REGISTER NO</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700;">CLASS</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">CURRENT %</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">IMPROVEMENT</th>
                  <th style="padding: 10px 14px; color: var(--text-muted); font-weight: 700; text-align: center;">STATUS</th>
                </tr>
              </thead>
              <tbody id="table-attention-students-body">
                <tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">Loading students needing attention...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  `;

  // Fetch complete dashboard summary
  async function loadDashboardSummary() {
    try {
      const res = await fetch('/api/admin/dashboard-summary', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch admin dashboard summary`);
      }

      const data = await res.json();
      dashboardData = data;
      renderDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard summary:', err);
      window.dispatchEvent(new CustomEvent('toast-notify', {
        detail: { message: `Dashboard error: ${err.message}`, type: 'error' }
      }));
    }
  }

  function renderDashboardData(data) {
    // 1. Render 8 KPI Cards
    const cards = data.cards || data;
    const cStudents = document.getElementById('card-total-students');
    const cStaff = document.getElementById('card-total-staff');
    const cDepts = document.getElementById('card-departments');
    const cSections = document.getElementById('card-sections');
    const cIa1 = document.getElementById('card-ia1-avg');
    const cIa2 = document.getElementById('card-ia2-avg');
    const cImp = document.getElementById('card-improvement');
    const cPass = document.getElementById('card-pass-percentage');

    if (cStudents) cStudents.textContent = cards.totalStudents ?? '0';
    if (cStaff) cStaff.textContent = cards.totalStaff ?? '0';
    if (cDepts) cDepts.textContent = cards.departments ?? '0';
    if (cSections) cSections.textContent = cards.sections ?? '0';
    if (cIa1) cIa1.textContent = cards.ia1Average !== null && cards.ia1Average !== undefined ? `${cards.ia1Average.toFixed(1)}%` : 'N/A';
    if (cIa2) cIa2.textContent = cards.ia2Average !== null && cards.ia2Average !== undefined ? `${cards.ia2Average.toFixed(1)}%` : 'N/A';
    
    if (cImp) {
      const imp = cards.overallImprovement;
      if (imp !== null && imp !== undefined) {
        cImp.textContent = `${imp >= 0 ? '+' : ''}${imp.toFixed(1)}%`;
        cImp.style.color = imp >= 0 ? '#34d399' : '#fb7185';
      } else {
        cImp.textContent = 'N/A';
      }
    }

    if (cPass) {
      const pass = cards.passPercentage;
      cPass.textContent = pass !== null && pass !== undefined ? `${pass.toFixed(1)}%` : '0.0%';
    }

    const syncEl = document.getElementById('dashboard-sync-time');
    if (syncEl) syncEl.textContent = `Last synced: ${new Date().toLocaleTimeString('en-IN')}`;

    // 2. Render College Notices
    if (data.collegeNotices) {
      const dEl = document.getElementById('val-notices-draft');
      const sEl = document.getElementById('val-notices-scheduled');
      const pEl = document.getElementById('val-notices-published');
      if (dEl) dEl.textContent = data.collegeNotices.draft || 0;
      if (sEl) sEl.textContent = data.collegeNotices.scheduled || 0;
      if (pEl) pEl.textContent = data.collegeNotices.published || 0;

      const recentList = document.getElementById('recent-notices-list');
      if (recentList && data.collegeNotices.recent) {
        if (data.collegeNotices.recent.length === 0) {
          recentList.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px;">No notices published yet.</div>`;
        } else {
          recentList.innerHTML = data.collegeNotices.recent.map(n => `
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-subtle);">
              <div>
                <div style="font-weight: 600; font-size: 12px; color: #fff;">${escapeHtml(n.title)}</div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                  <span>Channel: ${n.deliveryChannel}</span> • <span>Scope: ${n.targetType}</span>
                </div>
              </div>
              <span class="badge ${n.status === 'PUBLISHED' ? 'badge-success' : (n.status === 'SCHEDULED' ? 'badge-info' : 'badge-warning')}" style="font-size: 10px;">
                ${n.status}
              </span>
            </div>
          `).join('');
        }
      }
    }

    // 3. Render Notifications Queue
    if (data.notifications) {
      const pEl = document.getElementById('val-notif-pending');
      const sEl = document.getElementById('val-notif-sent');
      const dEl = document.getElementById('val-notif-delivered');
      const fEl = document.getElementById('val-notif-failed');
      const rateEl = document.getElementById('notif-success-rate');
      const barEl = document.getElementById('notif-progress-bar');
      const totEl = document.getElementById('notif-total-count');

      if (pEl) pEl.textContent = data.notifications.pending || 0;
      if (sEl) sEl.textContent = data.notifications.sent || 0;
      if (dEl) dEl.textContent = data.notifications.delivered || 0;
      if (fEl) fEl.textContent = data.notifications.failed || 0;

      const rate = data.notifications.deliveryRate || 0;
      if (rateEl) rateEl.textContent = `${rate}%`;
      if (barEl) barEl.style.width = `${rate}%`;
      if (totEl) totEl.textContent = `${data.notifications.total || 0} Total Transmissions`;
    }

    // 4. Performance Overview
    if (data.performanceOverview) {
      const evalEl = document.getElementById('overview-evaluated-students');
      const marksEl = document.getElementById('overview-total-marks');
      const hiEl = document.getElementById('overview-highest-score');
      const loEl = document.getElementById('overview-lowest-score');
      const bEl = document.getElementById('perf-benchmark-badge');

      if (evalEl) evalEl.textContent = data.performanceOverview.evaluatedStudents ?? '0';
      if (marksEl) marksEl.textContent = data.performanceOverview.totalMarksEntered ?? '0';
      if (hiEl) hiEl.textContent = data.performanceOverview.highestPercentage ? `${data.performanceOverview.highestPercentage.toFixed(1)}%` : 'N/A';
      if (loEl) loEl.textContent = data.performanceOverview.lowestPercentage ? `${data.performanceOverview.lowestPercentage.toFixed(1)}%` : 'N/A';
      if (bEl && data.performanceOverview.benchmarkStatus) {
        bEl.textContent = data.performanceOverview.benchmarkStatus;
      }
    }

    // 5. Department Performance Table
    const deptTbody = document.getElementById('table-dept-performance-body');
    if (deptTbody && data.departmentPerformance) {
      if (data.departmentPerformance.length === 0) {
        deptTbody.innerHTML = `<tr><td colspan="7" style="padding: 16px; text-align: center; color: var(--text-muted);">No department data available.</td></tr>`;
      } else {
        deptTbody.innerHTML = data.departmentPerformance.map((d, i) => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
            <td style="padding: 10px 14px; font-weight: 700; color: #fb7185;">#${d.rank || i + 1}</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #fff;">${escapeHtml(d.name)} (${escapeHtml(d.code)})</td>
            <td style="padding: 10px 14px; text-align: center;">${d.totalStudents}</td>
            <td style="padding: 10px 14px; text-align: center;">${d.ia1Average !== null ? `${d.ia1Average.toFixed(1)}%` : '—'}</td>
            <td style="padding: 10px 14px; text-align: center;">${d.ia2Average !== null ? `${d.ia2Average.toFixed(1)}%` : '—'}</td>
            <td style="padding: 10px 14px; text-align: center; color: ${(d.improvement || 0) >= 0 ? '#34d399' : '#fb7185'}; font-weight: 600;">
              ${d.improvement !== null ? `${(d.improvement >= 0 ? '+' : '')}${d.improvement.toFixed(1)}%` : '—'}
            </td>
            <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #22d3ee;">
              ${d.passPercentage !== null ? `${d.passPercentage.toFixed(1)}%` : '—'}
            </td>
          </tr>
        `).join('');
      }
    }

    // 6. Year Performance Table
    const yearTbody = document.getElementById('table-year-performance-body');
    if (yearTbody && data.yearPerformance) {
      if (data.yearPerformance.length === 0) {
        yearTbody.innerHTML = `<tr><td colspan="7" style="padding: 16px; text-align: center; color: var(--text-muted);">No year cohort data available.</td></tr>`;
      } else {
        yearTbody.innerHTML = data.yearPerformance.map(y => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
            <td style="padding: 10px 14px; font-weight: 700; color: #818cf8;">${escapeHtml(y.name)}</td>
            <td style="padding: 10px 14px; text-align: center;">${y.totalSections || y.sectionCount || '—'}</td>
            <td style="padding: 10px 14px; text-align: center;">${y.totalStudents}</td>
            <td style="padding: 10px 14px; text-align: center;">${y.ia1Average !== null ? `${y.ia1Average.toFixed(1)}%` : '—'}</td>
            <td style="padding: 10px 14px; text-align: center;">${y.ia2Average !== null ? `${y.ia2Average.toFixed(1)}%` : '—'}</td>
            <td style="padding: 10px 14px; text-align: center; color: ${(y.improvement || 0) >= 0 ? '#34d399' : '#fb7185'}; font-weight: 600;">
              ${y.improvement !== null ? `${(y.improvement >= 0 ? '+' : '')}${y.improvement.toFixed(1)}%` : '—'}
            </td>
            <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #34d399;">
              ${y.passPercentage !== null ? `${y.passPercentage.toFixed(1)}%` : '—'}
            </td>
          </tr>
        `).join('');
      }
    }

    // 7. Section Performance Table
    const secTbody = document.getElementById('table-section-performance-body');
    if (secTbody && data.sectionPerformance) {
      if (data.sectionPerformance.length === 0) {
        secTbody.innerHTML = `<tr><td colspan="9" style="padding: 16px; text-align: center; color: var(--text-muted);">No section data available.</td></tr>`;
      } else {
        secTbody.innerHTML = data.sectionPerformance.map(s => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
            <td style="padding: 10px 14px; font-weight: 700; color: #fff;">Sec ${escapeHtml(s.sectionName)}</td>
            <td style="padding: 10px 14px;">${escapeHtml(s.departmentCode)}</td>
            <td style="padding: 10px 14px;">${escapeHtml(s.yearName)}</td>
            <td style="padding: 10px 14px; text-align: center;">${s.totalStudents}</td>
            <td style="padding: 10px 14px; text-align: center;">${s.ia1Average !== null ? `${s.ia1Average.toFixed(1)}%` : '—'}</td>
            <td style="padding: 10px 14px; text-align: center;">${s.ia2Average !== null ? `${s.ia2Average.toFixed(1)}%` : '—'}</td>
            <td style="padding: 10px 14px; text-align: center; color: ${(s.improvement || 0) >= 0 ? '#34d399' : '#fb7185'}; font-weight: 600;">
              ${s.improvement !== null ? `${(s.improvement >= 0 ? '+' : '')}${s.improvement.toFixed(1)}%` : '—'}
            </td>
            <td style="padding: 10px 14px; text-align: center; font-size: 11px;">
              <span style="color: #34d399;">${s.highest ? `${s.highest.toFixed(1)}%` : '—'}</span> / 
              <span style="color: #fb7185;">${s.lowest ? `${s.lowest.toFixed(1)}%` : '—'}</span>
            </td>
            <td style="padding: 10px 14px; text-align: center;">
              <span class="badge ${s.passPercentage >= 60 ? 'badge-success' : 'badge-warning'}">
                ${s.passPercentage !== null ? `${s.passPercentage.toFixed(1)}%` : '—'}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }

    // 8. Top Students Table
    const topTbody = document.getElementById('table-top-students-body');
    if (topTbody && data.topStudents) {
      if (data.topStudents.length === 0) {
        topTbody.innerHTML = `<tr><td colspan="7" style="padding: 16px; text-align: center; color: var(--text-muted);">No top student evaluations recorded.</td></tr>`;
      } else {
        topTbody.innerHTML = data.topStudents.map((st, idx) => {
          const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️'];
          return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
              <td style="padding: 10px 14px; font-weight: 800; font-size: 14px;">${medals[idx] || '#' + (idx + 1)}</td>
              <td style="padding: 10px 14px; font-weight: 700; color: #fff;">${escapeHtml(st.studentName)}</td>
              <td style="padding: 10px 14px; font-family: var(--font-mono); color: #38bdf8;">${escapeHtml(st.registerNumber)}</td>
              <td style="padding: 10px 14px; color: var(--text-muted);">${escapeHtml(st.departmentCode)} • ${escapeHtml(st.sectionName)}</td>
              <td style="padding: 10px 14px; text-align: center;">${st.ia1Percentage !== null ? `${st.ia1Percentage.toFixed(1)}%` : '—'}</td>
              <td style="padding: 10px 14px; text-align: center;">${st.ia2Percentage !== null ? `${st.ia2Percentage.toFixed(1)}%` : '—'}</td>
              <td style="padding: 10px 14px; text-align: center; font-weight: 800; color: #34d399;">
                ${st.percentage !== null ? `${st.percentage.toFixed(1)}%` : '—'}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 9. Students Needing Attention Table
    const attTbody = document.getElementById('table-attention-students-body');
    if (attTbody && data.studentsNeedingAttention) {
      if (data.studentsNeedingAttention.length === 0) {
        attTbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #34d399;">✓ All students are currently above academic warning thresholds!</td></tr>`;
      } else {
        attTbody.innerHTML = data.studentsNeedingAttention.slice(0, 5).map(st => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
            <td style="padding: 10px 14px; font-weight: 700; color: #fff;">${escapeHtml(st.studentName)}</td>
            <td style="padding: 10px 14px; font-family: var(--font-mono); color: #fb7185;">${escapeHtml(st.registerNumber)}</td>
            <td style="padding: 10px 14px; color: var(--text-muted);">${escapeHtml(st.departmentCode)} • ${escapeHtml(st.sectionName)}</td>
            <td style="padding: 10px 14px; text-align: center; font-weight: 700; color: #fb7185;">
              ${st.percentage !== null ? `${st.percentage.toFixed(1)}%` : '—'}
            </td>
            <td style="padding: 10px 14px; text-align: center; color: ${(st.improvement || 0) >= 0 ? '#34d399' : '#fb7185'};">
              ${st.improvement !== null ? `${(st.improvement >= 0 ? '+' : '')}${st.improvement.toFixed(1)}%` : '—'}
            </td>
            <td style="padding: 10px 14px; text-align: center;">
              <span class="badge" style="background: rgba(244, 63, 94, 0.2); color: #fb7185; font-size: 10px;">
                Needs Attention
              </span>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  // Helper escape function
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Wire Quick Actions click handlers
  container.querySelectorAll('.quick-act-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.getAttribute('data-target-tab');
      const action = e.currentTarget.getAttribute('data-action');
      if (typeof switchTab === 'function') {
        switchTab(targetTab, action);
      }
    });
  });

  // Wire Refresh button
  const refreshBtn = container.querySelector('#btn-refresh-dashboard');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = `<span>⏳</span> Refreshing...`;
      await loadDashboardSummary();
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = `<span>🔄</span> Refresh Data`;
      window.dispatchEvent(new CustomEvent('toast-notify', {
        detail: { message: 'Dashboard metrics refreshed.', type: 'info' }
      }));
    });
  }

  // Initial load
  loadDashboardSummary();
}
