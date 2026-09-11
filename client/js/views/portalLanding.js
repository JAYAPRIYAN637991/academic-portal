import { Auth } from '../auth.js';

export function renderPortalLanding(container, router) {
  if (Auth.isAdmin()) {
    return router.navigate('/admin/dashboard', true);
  }
  if (Auth.isStaff()) {
    return router.navigate('/staff/dashboard', true);
  }

  container.innerHTML = `
    <div class="ambient-glow">
      <div class="glow-orb glow-orb-1"></div>
      <div class="glow-orb glow-orb-2"></div>
    </div>

    <div class="auth-page">
      <div class="auth-panel" style="max-width: 600px; text-align: center;">
        <div class="institution-badge">
          <span>🏛️</span> Higher Education Academic Platform
        </div>
        <h1 style="font-size: 28px; margin-bottom: 8px;">College Academic Portal</h1>
        <p style="color: var(--text-muted); margin-bottom: 32px;">
          Select your institutional role to access the dedicated login console
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 24px;">
          
          <!-- Admin Portal Card -->
          <a href="/admin/login" data-link style="text-decoration: none;">
            <div style="background: rgba(244, 63, 94, 0.05); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: var(--radius-md); padding: 24px; text-align: center; transition: var(--transition); cursor: pointer;" onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='#f43f5e';" onmouseout="this.style.transform='none'; this.style.borderColor='rgba(244, 63, 94, 0.3)';">
              <div style="font-size: 36px; margin-bottom: 12px;">🛡️</div>
              <h3 style="color: #fb7185; font-size: 16px; margin-bottom: 6px;">Administrator</h3>
              <p style="color: var(--text-dim); font-size: 12px; margin-bottom: 16px;">
                Complete system governance, academic structures, faculty allocations, and analytics.
              </p>
              <span class="role-pill badge-admin" style="font-size: 11px;">Admin Login →</span>
            </div>
          </a>

          <!-- Faculty Portal Card -->
          <a href="/staff/login" data-link style="text-decoration: none;">
            <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 24px; text-align: center; transition: var(--transition); cursor: pointer;" onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='#10b981';" onmouseout="this.style.transform='none'; this.style.borderColor='rgba(16, 185, 129, 0.3)';">
              <div style="font-size: 36px; margin-bottom: 12px;">👨‍🏫</div>
              <h3 style="color: #34d399; font-size: 16px; margin-bottom: 6px;">Teaching Faculty</h3>
              <p style="color: var(--text-dim); font-size: 12px; margin-bottom: 16px;">
                Assigned class rosters, IA-1/IA-2 mark entry, and student performance metrics.
              </p>
              <span class="role-pill badge-staff" style="font-size: 11px;">Staff Login →</span>
            </div>
          </a>

        </div>

        <div style="font-size: 12px; color: var(--text-dim); border-top: 1px solid var(--border-subtle); padding-top: 16px;">
          Note: Parents do not possess portal logins. Parental alerts are automatically dispatched via SMS & WhatsApp.
        </div>
      </div>
    </div>
  `;
}
