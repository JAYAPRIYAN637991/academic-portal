import { Auth } from '../../../client/js/auth.js';
import jwt from 'jsonwebtoken';

describe('Frontend Routing & Session Guard Unit Tests', () => {

  // Mock localStorage for Node environment
  const store: Record<string, string> = {};
  beforeAll(() => {
    (global as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
  });

  beforeEach(() => {
    localStorage.clear();
  });

  test('1. Unauthenticated state detects no user or token', () => {
    expect(Auth.isAuthenticated()).toBe(false);
    expect(Auth.isAdmin()).toBe(false);
    expect(Auth.isStaff()).toBe(false);
  });

  test('2. Admin session storage and role verification', () => {
    const adminToken = jwt.sign(
      { sub: 'admin-1', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 },
      'dummy-secret'
    );
    Auth.setSession(adminToken, { id: 'admin-1', name: 'Admin', email: 'admin@college.edu', role: 'ADMIN', isActive: true });

    expect(Auth.isAuthenticated()).toBe(true);
    expect(Auth.isAdmin()).toBe(true);
    expect(Auth.isStaff()).toBe(false);
  });

  test('3. Staff session storage and role verification', () => {
    const staffToken = jwt.sign(
      { sub: 'staff-1', role: 'STAFF', exp: Math.floor(Date.now() / 1000) + 3600 },
      'dummy-secret'
    );
    Auth.setSession(staffToken, { id: 'staff-1', name: 'Sarah', email: 'sarah.cse@college.edu', role: 'STAFF', isActive: true });

    expect(Auth.isAuthenticated()).toBe(true);
    expect(Auth.isAdmin()).toBe(false);
    expect(Auth.isStaff()).toBe(true);
  });

  test('4. Session expiration detection (expired JWT)', () => {
    // Generate an expired token (expired 10 seconds ago)
    const expiredToken = jwt.sign(
      { sub: 'user-expired', role: 'STAFF', exp: Math.floor(Date.now() / 1000) - 10 },
      'dummy-secret'
    );
    Auth.setSession(expiredToken, { id: 'user-expired', name: 'Expired User', email: 'exp@college.edu', role: 'STAFF', isActive: true });

    // isTokenExpired should return true
    expect(Auth.isTokenExpired()).toBe(true);

    // isAuthenticated should automatically clear expired session and return false
    expect(Auth.isAuthenticated()).toBe(false);
    expect(Auth.getToken()).toBeNull();
  });

  test('5. Logout cleanly clears token and user profile', () => {
    const token = jwt.sign({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }, 'dummy-secret');
    Auth.setSession(token, { id: 'user-1', name: 'User', role: 'STAFF' });
    expect(Auth.isAuthenticated()).toBe(true);

    Auth.logout();
    expect(Auth.isAuthenticated()).toBe(false);
    expect(Auth.getToken()).toBeNull();
    expect(Auth.getUser()).toBeNull();
  });
});
