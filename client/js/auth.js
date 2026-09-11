// Client Authentication & Session Management with JWT Expiration Handling

export const Auth = {
  TOKEN_KEY: 'academic_portal_token',
  USER_KEY: 'academic_portal_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  getUser() {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  isTokenExpired() {
    const token = this.getToken();
    if (!token) return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false;
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      return true;
    }
  },

  isAuthenticated() {
    if (this.isTokenExpired()) {
      this.clearSession();
      return false;
    }
    return !!this.getToken() && !!this.getUser();
  },

  isAdmin() {
    if (!this.isAuthenticated()) return false;
    const user = this.getUser();
    return user && user.role === 'ADMIN';
  },

  isStaff() {
    if (!this.isAuthenticated()) return false;
    const user = this.getUser();
    return user && user.role === 'STAFF';
  },

  async login(email, password) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    this.setSession(data.token, data.user);
    return data;
  },

  logout() {
    this.clearSession();
  }
};
