import { Auth } from '../auth.js';

export function renderAdminLogin(container, router) {
  container.innerHTML = `
    <div class="ambient-glow">
      <div class="glow-orb" style="background: #f43f5e; width: 450px; height: 450px; top: -100px; left: 25%; opacity: 0.25;"></div>
      <div class="glow-orb" style="background: #6366f1; width: 350px; height: 350px; bottom: -80px; right: 20%; opacity: 0.3;"></div>
    </div>

    <div class="auth-page">
      <div class="auth-panel" style="border-top: 3px solid #f43f5e;">
        <div class="auth-brand">
          <div class="institution-badge" style="background: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.3); color: #fb7185;">
            <span>🛡️</span> Institutional Administration
          </div>
          <h1 style="color: #ffffff; margin-bottom: 6px;">Admin Login</h1>
          <p style="color: var(--text-muted);">Central Administrative Control & Governance Portal</p>
        </div>

        <form id="admin-login-form">
          <div class="form-group">
            <div class="form-label-row">
              <label class="form-label" for="admin-email">Administrator Email</label>
            </div>
            <div class="input-container">
              <span class="input-icon">👤</span>
              <input 
                type="email" 
                id="admin-email" 
                class="form-input" 
                placeholder="admin@college.edu" 
                value="admin@college.edu"
                required 
                autocomplete="username"
              />
            </div>
          </div>

          <div class="form-group">
            <div class="form-label-row">
              <label class="form-label" for="admin-password">Administrator Password</label>
            </div>
            <div class="input-container">
              <span class="input-icon">🔑</span>
              <input 
                type="password" 
                id="admin-password" 
                class="form-input" 
                placeholder="••••••••" 
                value="admin123"
                required 
                autocomplete="current-password"
              />
            </div>
          </div>

          <button type="submit" id="btn-admin-submit" class="btn-submit" style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); box-shadow: 0 6px 20px rgba(225, 29, 72, 0.4);">
            <span>Authenticate as Administrator</span>
            <span>→</span>
          </button>
        </form>

        <div class="quick-fill-bar">
          <div class="quick-fill-label">⚡ Rapid Testing</div>
          <button class="quick-chip" id="chip-admin-fill" style="width: 100%; border-color: rgba(244, 63, 94, 0.3);">
            <strong style="color: #fb7185;">Fill Chief Administrator Credentials</strong>
            <span>admin@college.edu • admin123</span>
          </button>
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 13px; color: var(--text-dim); border-top: 1px solid var(--border-subtle); padding-top: 16px;">
          Are you a teaching faculty member?
          <a href="/staff/login" data-link style="color: #34d399; font-weight: 600; margin-left: 6px;">Switch to Staff Login →</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('chip-admin-fill').addEventListener('click', () => {
    document.getElementById('admin-email').value = 'admin@college.edu';
    document.getElementById('admin-password').value = 'admin123';
  });

  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    const btn = document.getElementById('btn-admin-submit');

    btn.disabled = true;
    btn.innerHTML = '<span>Verifying Credentials...</span>';

    try {
      const res = await Auth.login(email, password);
      if (res.role !== 'ADMIN') {
        // Logged in user is not an Admin!
        Auth.clearSession();
        throw new Error('Access Denied: You do not have Administrator clearance.');
      }
      window.dispatchEvent(new CustomEvent('toast-notify', {
        detail: { message: 'Administrator authenticated successfully! Redirecting to /admin/dashboard', type: 'success' }
      }));
      router.navigate('/admin/dashboard');
    } catch (err) {
      window.dispatchEvent(new CustomEvent('toast-notify', {
        detail: { message: err.message, type: 'error' }
      }));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Authenticate as Administrator</span><span>→</span>';
      }
    }
  });
}
