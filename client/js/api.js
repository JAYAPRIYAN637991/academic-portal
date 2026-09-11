// API Client with automatic token injection and error handling

const API_BASE = '/api';

export const API = {
  getToken() {
    return localStorage.getItem('academic_token');
  },

  setToken(token) {
    localStorage.setItem('academic_token', token);
  },

  clearToken() {
    localStorage.removeItem('academic_token');
    localStorage.removeItem('academic_user');
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.dispatchEvent(new CustomEvent('auth-changed'));
        }
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err.message);
      throw err;
    }
  },

  // Auth endpoints
  async login(username, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) {
      this.setToken(res.token);
      localStorage.setItem('academic_user', JSON.stringify(res.user));
    }
    return res;
  },

  async getMe() {
    return await this.request('/auth/me');
  },

  async getHealth() {
    return await this.request('/health');
  },

  // Admin Endpoints
  async getAdminDashboard() {
    return await this.request('/admin/dashboard-summary');
  },

  async getAcademicStructure() {
    return await this.request('/admin/academic-structure');
  },

  async getStaffList() {
    return await this.request('/admin/staff');
  },

  async getStudents(sectionId = null) {
    const query = sectionId ? `?section_id=${sectionId}` : '';
    return await this.request(`/admin/students${query}`);
  },

  async getAuditLogs() {
    return await this.request('/admin/audit-logs');
  },

  async getNotificationLogs() {
    return await this.request('/admin/notification-logs');
  },

  // Staff Endpoints
  async getAssignedClasses() {
    return await this.request('/staff/assigned-classes');
  },

  async getStaffStudents(sectionId, subjectId) {
    return await this.request(`/staff/students?section_id=${sectionId}&subject_id=${subjectId}`);
  },

  async submitMarks(payload) {
    return await this.request('/staff/marks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getSubjectPerformance(sectionId, subjectId) {
    return await this.request(`/staff/subject-performance?section_id=${sectionId}&subject_id=${subjectId}`);
  },

  // Common
  async getNotices() {
    return await this.request('/notices');
  }
};
