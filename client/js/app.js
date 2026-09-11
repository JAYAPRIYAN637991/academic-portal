import { Router } from './router.js';
import { renderPortalLanding } from './views/portalLanding.js';
import { renderAdminLogin } from './views/adminLogin.js';
import { renderStaffLogin } from './views/staffLogin.js';
import { renderAdminLayout } from './views/adminLayout.js';
import { renderStaffLayout } from './views/staffLayout.js';

class App {
  constructor() {
    this.container = document.getElementById('app');
    this.setupToastListener();
    this.initRouter();
  }

  setupToastListener() {
    window.addEventListener('toast-notify', (e) => {
      const { message, type } = e.detail || {};
      this.showToast(message, type);
    });
  }

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 350);
    }, 4000);
  }

  initRouter() {
    const routes = {
      '/': () => renderPortalLanding(this.container, this.router),
      '/admin/login': () => renderAdminLogin(this.container, this.router),
      '/staff/login': () => renderStaffLogin(this.container, this.router),
      '/admin/dashboard': () => renderAdminLayout(this.container, this.router),
      '/staff/dashboard': () => renderStaffLayout(this.container, this.router),
      '*': () => renderPortalLanding(this.container, this.router)
    };

    this.router = new Router(routes);
    window.appRouter = this.router;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
  });
} else {
  window.app = new App();
}
