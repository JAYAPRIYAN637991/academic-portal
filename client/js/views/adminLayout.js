import { Auth } from '../auth.js';
import { renderAcademicStructureView } from './academicStructureView.js';
import { renderStudentManagementView } from './studentManagementView.js';
import { renderStaffManagementView } from './staffManagementView.js';
import { renderSubjectManagementView } from './subjectManagementView.js';
import { renderAssessmentManagementView } from './assessmentManagementView.js';
import { renderAdminPerformanceDashboardView } from './adminPerformanceDashboardView.js';
import { renderAdminAnalyticsView } from './adminAnalyticsView.js';
import { renderNoticeManagementView } from './noticeManagementView.js';
import { renderNotificationHistoryView } from './notificationHistoryView.js';
import { renderAuditLogsView } from './auditLogsView.js';
import { renderReportsView } from './reportsView.js';
import { renderAdminDashboardView } from './adminDashboardView.js';

export function renderAdminLayout(container, router) {
  const user = Auth.getUser();

  container.innerHTML = `
    <div id="layout-wrapper">
      
      <!-- Admin Sidebar (Complete System) -->
      <aside class="sidebar" style="border-right: 1px solid rgba(244, 63, 94, 0.2);">
        <div class="sidebar-brand">
          <div class="sidebar-logo-icon" style="background: linear-gradient(135deg, #e11d48, #be123c);">🛡️</div>
          <div>
            <div class="sidebar-brand-title">Admin Console</div>
            <div class="sidebar-brand-sub" style="color: #fb7185;">Central Administration</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section-title">Core Management</div>
          <div class="nav-link active" data-admin-tab="dashboard">
            <span>📊</span> Dashboard Overview
          </div>
          <div class="nav-link" data-admin-tab="structure">
            <span>🏛️</span> Academic Structure
          </div>
          <div class="nav-link" data-admin-tab="subjects">
            <span>📚</span> Subjects & Syllabus
          </div>
          <div class="nav-link" data-admin-tab="assessments">
            <span>📝</span> Assessments & Tests
          </div>
          <div class="nav-link" data-admin-tab="teachers">
            <span>👨‍🏫</span> Teachers & Staff
          </div>
          <div class="nav-link" data-admin-tab="students">
            <span>🎓</span> Students & Parents
          </div>

          <div class="nav-section-title">Academics & Evaluations</div>
          <div class="nav-link" data-admin-tab="performance">
            <span>📊</span> Student Performance
          </div>
          <div class="nav-link" data-admin-tab="marks">
            <span>📝</span> Marks Management
          </div>
          <div class="nav-link" data-admin-tab="analytics">
            <span>📈</span> College Analytics
          </div>
          <div class="nav-link" data-admin-tab="reports">
            <span>📑</span> Academic Reports
          </div>

          <div class="nav-section-title">Communication & Governance</div>
          <div class="nav-link" data-admin-tab="notices">
            <span>📢</span> College Notices
          </div>
          <div class="nav-link" data-admin-tab="notifications">
            <span>📱</span> Parent Notifications
          </div>
          <div class="nav-link" data-admin-tab="audit">
            <span>🛡️</span> Audit Logs
          </div>
          <div class="nav-link" data-admin-tab="settings">
            <span>⚙️</span> System Settings
          </div>
        </nav>

        <div class="sidebar-footer">
          <div class="user-profile-badge">
            <div class="avatar" style="background: #e11d48;">${user?.name ? user.name[0] : 'A'}</div>
            <div class="user-info">
              <div class="user-name">${user?.name || 'Administrator'}</div>
              <span class="role-pill badge-admin">${user?.role || 'ADMIN'}</span>
            </div>
          </div>
          <button id="admin-logout-btn" class="btn btn-secondary btn-block btn-sm" style="margin-top: 10px;">
            Sign Out
          </button>
        </div>
      </aside>

      <!-- Admin Main Content -->
      <div class="main-wrapper">
        <header class="topbar" style="border-bottom: 1px solid rgba(244, 63, 94, 0.2);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="topbar-title" id="admin-page-title">Institutional Overview</div>
            <span class="role-pill badge-admin">Full System Clearance</span>
          </div>
          <div class="topbar-actions">
            <span style="font-size: 13px; color: var(--text-muted);">${user?.email}</span>
            <button id="topbar-admin-logout" class="btn btn-secondary btn-sm">Sign Out</button>
          </div>
        </header>

        <main class="content-container" id="admin-content-area">
          <!-- Content dynamically rendered here based on active tab -->
        </main>
      </div>

    </div>
  `;

  const switchTab = (tabName, action) => {
    const targetLink = container.querySelector(`.nav-link[data-admin-tab="${tabName}"]`);
    if (targetLink) {
      targetLink.click();
      if (action) {
        setTimeout(() => {
          if (action === 'add-student') {
            const addBtn = document.getElementById('btn-add-student') || document.querySelector('[data-action="add-student"]');
            if (addBtn) addBtn.click();
          } else if (action === 'import-students') {
            const impBtn = document.getElementById('btn-import-students') || document.querySelector('[data-action="import-students"]');
            if (impBtn) impBtn.click();
          } else if (action === 'add-staff') {
            const addBtn = document.getElementById('btn-add-staff') || document.querySelector('[data-action="add-staff"]');
            if (addBtn) addBtn.click();
          } else if (action === 'assign-staff') {
            const assignBtn = document.getElementById('btn-assign-staff') || document.querySelector('[data-action="assign-staff"]');
            if (assignBtn) assignBtn.click();
          } else if (action === 'create-notice') {
            const createBtn = document.getElementById('btn-create-notice') || document.querySelector('[data-action="create-notice"]');
            if (createBtn) createBtn.click();
          }
        }, 150);
      }
    }
  };

  function renderDashboardOverview() {
    const contentArea = document.getElementById('admin-content-area');
    renderAdminDashboardView(contentArea, switchTab, router);
  }

  const handleLogout = () => {
    Auth.logout();
    window.dispatchEvent(new CustomEvent('toast-notify', {
      detail: { message: 'Administrator signed out successfully.', type: 'info' }
    }));
    router.navigate('/admin/login');
  };

  document.getElementById('admin-logout-btn').addEventListener('click', handleLogout);
  document.getElementById('topbar-admin-logout').addEventListener('click', handleLogout);

  // Tab navigation switching
  container.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      container.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      const activeLink = e.currentTarget;
      activeLink.classList.add('active');
      const tabName = activeLink.getAttribute('data-admin-tab');
      document.getElementById('admin-page-title').textContent = activeLink.textContent.trim();

      const contentArea = document.getElementById('admin-content-area');
      if (tabName === 'structure') {
        renderAcademicStructureView(contentArea);
      } else if (tabName === 'subjects') {
        renderSubjectManagementView(contentArea);
      } else if (tabName === 'assessments') {
        renderAssessmentManagementView(contentArea);
      } else if (tabName === 'teachers') {
        renderStaffManagementView(contentArea);
      } else if (tabName === 'students') {
        renderStudentManagementView(contentArea);
      } else if (tabName === 'performance') {
        renderAdminPerformanceDashboardView(contentArea);
      } else if (tabName === 'analytics') {
        renderAdminAnalyticsView(contentArea);
      } else if (tabName === 'notices') {
        renderNoticeManagementView(contentArea);
      } else if (tabName === 'notifications') {
        renderNotificationHistoryView(contentArea);
      } else if (tabName === 'audit') {
        renderAuditLogsView(contentArea);
      } else if (tabName === 'reports') {
        renderReportsView(contentArea);
      } else if (tabName === 'dashboard') {
        renderDashboardOverview();
      } else {
        contentArea.innerHTML = `
          <div class="card-box">
            <div class="card-box-header">
              <div class="card-box-title">${activeLink.textContent.trim()}</div>
            </div>
            <div class="card-box-body" style="color: var(--text-muted);">
              Module interface for <strong>${activeLink.textContent.trim()}</strong>. 
              Only authenticated Administrators can access this area.
            </div>
          </div>
        `;
      }
    });
  });

  // Initial render is Dashboard Overview
  renderDashboardOverview();
}

