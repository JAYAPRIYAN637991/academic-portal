import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import {
  School,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  Shield,
  BookOpen
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const { error, success } = useToast();

  // Role Tab State: ADMIN vs STAFF
  const [activeRole, setActiveRole] = useState<'ADMIN' | 'STAFF'>(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.includes('/staff') || hash.includes('staff')) {
      return 'STAFF';
    }
    return 'ADMIN';
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleChange = (role: 'ADMIN' | 'STAFF') => {
    setActiveRole(role);
    setUsername('');
    setPassword('');
    if (role === 'ADMIN') {
      window.history.replaceState(null, '', '/admin/login');
    } else {
      window.history.replaceState(null, '', '/staff/login');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      error('Authentication Error', 'Please enter both username/email and password');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(username, password);

      // Strict Role-to-Portal Enforcement
      if (activeRole === 'ADMIN' && user.role !== 'ADMIN') {
        // Clear unauthorized session
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        error(
          'Admin Portal Restricted',
          'This sign-in is reserved strictly for Institutional Administrators. Please switch to the "Staff Login" tab to access your faculty dashboard.'
        );
        return;
      }

      if (activeRole === 'STAFF' && user.role !== 'STAFF') {
        // Clear unauthorized session
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        error(
          'Staff Portal Restricted',
          'This sign-in is reserved strictly for Teaching Faculty & Staff. Please switch to the "Admin Login" tab for administrative governance.'
        );
        return;
      }

      success(
        'Authentication Successful',
        activeRole === 'ADMIN'
          ? `Welcome Administrator ${user.name || user.username}! Redirecting to Admin Dashboard...`
          : `Welcome Faculty Member ${user.name || user.username}! Redirecting to Staff Dashboard...`
      );

      if (user.role === 'ADMIN') {
        window.location.hash = 'dashboard';
      } else {
        window.location.hash = 'staff-dashboard';
      }

      onLoginSuccess();
    } catch (err: any) {
      error('Login Failed', err.message || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      {/* College Institutional Container */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl p-6 sm:p-8">
        
        {/* College Header */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl border transition-all duration-300 mb-3 shadow-lg ${
            activeRole === 'ADMIN'
              ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400 shadow-indigo-500/10'
              : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400 shadow-emerald-500/10'
          }`}>
            {activeRole === 'ADMIN' ? (
              <School className="w-8 h-8" />
            ) : (
              <GraduationCap className="w-8 h-8" />
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            VSB ENGINEERING COLLEGE
          </h1>
          <p className="text-xs text-indigo-300 font-medium tracking-wide uppercase mt-1">
            Academic Performance & Parent Notification Platform
          </p>
        </div>

        {/* Role Selector Tabs (Admin vs Staff) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-5">
          <button
            type="button"
            id="tab-admin-login"
            onClick={() => handleRoleChange('ADMIN')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeRole === 'ADMIN'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Login
          </button>

          <button
            type="button"
            id="tab-staff-login"
            onClick={() => handleRoleChange('STAFF')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeRole === 'STAFF'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Staff Login
          </button>
        </div>

        {/* Active Role Announcement Card */}
        <div className={`p-3 rounded-xl border mb-5 transition-colors ${
          activeRole === 'ADMIN'
            ? 'bg-indigo-950/40 border-indigo-800/50 text-indigo-200'
            : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {activeRole === 'ADMIN' ? (
              <Shield className="w-4 h-4 text-indigo-400" />
            ) : (
              <BookOpen className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider">
              {activeRole === 'ADMIN' ? 'Administrator Sign-In' : 'Faculty & Staff Sign-In'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {activeRole === 'ADMIN'
              ? 'Access institutional governance, department administration, faculty allocation & master analytics.'
              : 'Access assigned teaching classes, internal marks evaluation, student roster & performance.'}
          </p>
          <div className="mt-2 text-[10px] font-semibold text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Redirects to: <span className="font-mono text-white">{activeRole === 'ADMIN' ? '/admin/dashboard' : '/staff/dashboard'}</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              {activeRole === 'ADMIN' ? 'Administrator Username or Email' : 'Faculty Username or Email'}
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={activeRole === 'ADMIN' ? 'Enter admin username or email' : 'Enter faculty username or email'}
                autoComplete="off"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={activeRole === 'ADMIN' ? 'Enter administrator password' : 'Enter faculty password'}
                autoComplete="new-password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            id="login-submit-button"
            type="submit"
            variant={activeRole === 'ADMIN' ? 'primary' : 'secondary'}
            size="lg"
            className={`w-full mt-2 font-bold flex items-center justify-center gap-2 ${
              activeRole === 'STAFF' ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-lg shadow-emerald-600/20' : ''
            }`}
            isLoading={isLoading}
          >
            <span>{activeRole === 'ADMIN' ? 'Sign In to Admin Dashboard' : 'Sign In to Staff Portal'}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </div>

      <div className="mt-4 text-center text-xs text-slate-400">
        Strict Role-Based Access Control Enforced &bull; Institutional Portal v2.0
      </div>
    </div>
  );
};
