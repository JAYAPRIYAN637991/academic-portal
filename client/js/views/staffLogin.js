import { Auth } from '../auth.js';

export function renderStaffLogin(container, router) {
  container.innerHTML = `
    <div class="ambient-glow">
      <div class="glow-orb" style="background: #10b981; width: 450px; height: 450px; top: -100px; right: 25%; opacity: 0.25;"></div>
      <div class="glow-orb" style="background: #06b6d4; width: 350px; height: 350px; bottom: -80px; left: 20%; opacity: 0.3;"></div>
    </div>

    <div class="auth-page">
      <div class="auth-panel" style="border-top: 3px solid #10b981;">
        <div class="auth-brand">
          <div class="institution-badge" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: #34d399;">
            <span>👨‍🏫</span> Faculty & Teaching Staff
          </div>
          <h1 style="color: #ffffff; margin-bottom: 6px;">Staff Login</h1>
          <p style="color: var(--text-muted);">Internal Assessment Grading & Student Performance Portal</p>
        </div>

        <form id="staff-login-form">
          <div class="form-group">
            <div class="form-label-row">
              <label class="form-label" for="staff-email">Faculty Email Address</label>
            </div>
            <div class="input-container">
              <span class="input-icon">✉️</span>
              <input 
                type="email" 
                id="staff-email" 
                class="form-input" 
                placeholder="faculty@college.edu" 
                value="sarah.cse@college.edu"
                required 
                autocomplete="username"
              />
            </div>
          </div>

          <div class="form-group">
            <div class="form-label-row">
              <label class="form-label" for="staff-password">Faculty Password</label>
            </div>
            <div class="input-container">
              <span class="input-icon">🔒</span>
              <input 
                type="password" 
                id="staff-password" 
                class="form-input" 
                placeholder="••••••••" 
                value="staff123"
                required 
                autocomplete="current-password"
              />
            </div>
          </div>

          <button type="submit" id="btn-staff-submit" class="btn-submit" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);">
            <span>Sign In to Faculty Console</span>
            <span>→</span>
          </button>
        </form>

        <div class="quick-fill-bar">
          <div class="quick-fill-label">⚡ Rapid Testing Profiles</div>
          <div class="quick-chips">
            <button class="quick-chip" id="chip-sarah" style="border-color: rgba(16, 185, 129, 0.3);">
              <strong style="color: #34d399;">Prof. Sarah (CSE)</strong>
              <span>sarah.cse@college.edu</span>
            </button>
            <button class="quick-chip" id="chip-michael" style="border-color: rgba(6, 182, 212, 0.3);">
              <strong style="color: #38bdf8;">Dr. Michael (ECE)</strong>
              <span>michael.ece@college.edu</span>
            </button>
          </div>
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 13px; color: var(--text-dim); border-top: 1px solid var(--border-subtle); padding-top: 16px;">
          Are you a college administrator?
          <a href="/admin/login" data-link style="color: #fb7185; font-weight: 600; margin-left: 6px;">Switch to Admin Login →</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('chip-sarah').addEventListener('click', () => {
    document.getElementById('staff-email').value = 'sarah.cse@college.edu';
    document.getElementById('staff-password').value = 'staff123';
  });

  document.getElementById('chip-michael').addEventListener('click', () => {
    document.getElementById('staff-email').value = 'michael.ece@college.edu';
    document.getElementById('staff-password').value = 'staff123';
  });

  document.getElementById('staff-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('staff-email').value.trim();
    const password = document.getElementById('staff-password').value.trim();
    const btn = document.getElementById('btn-staff-submit');

    btn.disabled = true;
    btn.innerHTML = '<span>Verifying Credentials...</span>';

    try {
      const res = await Auth.login(email, password);
      window.dispatchEvent(new CustomEvent('toast-notify', {
        detail: { message: `Welcome ${res.user.name}! Redirecting to /staff/dashboard`, type: 'success' }
      }));
      router.navigate('/staff/dashboard');
    } catch (err) {
      window.dispatchEvent(new CustomEvent('toast-notify', {
        detail: { message: err.message, type: 'error' }
      }));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In to Faculty Console</span><span>→</span>';
      }
    }
  });
}
