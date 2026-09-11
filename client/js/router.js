import { Auth } from './auth.js';

export class Router {
  constructor(routes, onRouteChanged) {
    this.routes = routes;
    this.onRouteChanged = onRouteChanged;
    this.init();
  }

  init() {
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });

    // Intercept standard anchor link clicks
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a[data-link]');
      if (target) {
        e.preventDefault();
        const href = target.getAttribute('href');
        if (href) {
          this.navigate(href);
        }
      }
    });

    // Initial route check
    this.handleRoute(window.location.pathname);
  }

  navigate(path, replace = false) {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    this.handleRoute(path);
  }

  handleRoute(path) {
    const normalizedPath = path.toLowerCase().replace(/\/$/, '') || '/';

    // 1. Session Expiration Guard
    if (Auth.getToken() && Auth.isTokenExpired()) {
      Auth.clearSession();
      window.dispatchEvent(new CustomEvent('toast-notify', {
        detail: { message: 'Your session has expired. Please sign in again.', type: 'warning' }
      }));
      const loginRedirect = normalizedPath.startsWith('/staff') ? '/staff/login' : '/admin/login';
      return this.navigate(loginRedirect, true);
    }

    // 2. Admin Route Protection:
    // If a Staff user manually enters /admin/dashboard (or any /admin/* route),
    // the frontend MUST redirect them to /staff/dashboard!
    if (normalizedPath.startsWith('/admin')) {
      if (normalizedPath === '/admin/login') {
        // If already authenticated as ADMIN, go straight to /admin/dashboard
        if (Auth.isAdmin()) {
          return this.navigate('/admin/dashboard', true);
        }
        // If logged in as STAFF, redirect to staff dashboard
        if (Auth.isStaff()) {
          return this.navigate('/staff/dashboard', true);
        }
      } else {
        // Protected Admin route (/admin/dashboard, etc.)
        if (!Auth.isAuthenticated()) {
          window.dispatchEvent(new CustomEvent('toast-notify', {
            detail: { message: 'Authentication required. Please sign in as Administrator.', type: 'error' }
          }));
          return this.navigate('/admin/login', true);
        }

        if (Auth.isStaff()) {
          window.dispatchEvent(new CustomEvent('toast-notify', {
            detail: { message: 'Access Denied: Staff accounts cannot access Administrator areas.', type: 'error' }
          }));
          // MANDATORY REQUIREMENT: Redirect Staff to /staff/dashboard!
          return this.navigate('/staff/dashboard', true);
        }
      }
    }

    // 3. Staff Route Protection:
    if (normalizedPath.startsWith('/staff')) {
      if (normalizedPath === '/staff/login') {
        // If already authenticated as STAFF, go straight to /staff/dashboard
        if (Auth.isStaff()) {
          return this.navigate('/staff/dashboard', true);
        }
        if (Auth.isAdmin()) {
          return this.navigate('/admin/dashboard', true);
        }
      } else {
        // Protected Staff route (/staff/dashboard, etc.)
        if (!Auth.isAuthenticated()) {
          window.dispatchEvent(new CustomEvent('toast-notify', {
            detail: { message: 'Authentication required. Please sign in with Faculty credentials.', type: 'error' }
          }));
          return this.navigate('/staff/login', true);
        }
      }
    }

    // 4. Match route handler
    const handler = this.routes[normalizedPath] || this.routes['*'];
    if (handler) {
      handler(normalizedPath);
    }
  }
}
