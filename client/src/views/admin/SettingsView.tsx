import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import {
  Settings,
  Save,
  CheckCircle2,
  Server,
  Smartphone,
  MessageSquare,
  ShieldCheck,
  Key,
  Lock,
  User,
  Eye,
  EyeOff,
  Check,
  AlertCircle
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  // Institutional Settings State
  const [collegeName, setCollegeName] = useState('VSB Engineering College');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [passThreshold, setPassThreshold] = useState<number>(50);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [whatsAppStatus, setWhatsAppStatus] = useState('ACTIVE');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Admin Credentials Management State
  const [currentAdminUsername, setCurrentAdminUsername] = useState(user?.username || 'Chief Administrator');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);

  useEffect(() => {
    const fetchSettingsAndProfile = async () => {
      try {
        const [settingsRes, profileRes]: [any, any] = await Promise.all([
          api.get('/admin/settings').catch(() => null),
          api.get('/admin/profile').catch(() => null)
        ]);

        if (settingsRes) {
          if (settingsRes.college_name) setCollegeName(settingsRes.college_name);
          if (settingsRes.academic_year) setAcademicYear(settingsRes.academic_year);
          if (settingsRes.pass_mark_threshold) setPassThreshold(settingsRes.pass_mark_threshold);
        }

        if (profileRes?.admin) {
          setCurrentAdminUsername(profileRes.admin.username || profileRes.admin.name);
        }
      } catch (err) {
        // Fallback to defaults
      }
    };
    fetchSettingsAndProfile();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await api.put('/admin/settings', {
        college_name: collegeName,
        academic_year: academicYear,
        pass_mark_threshold: passThreshold,
        sms_enabled: smsEnabled,
        whatsapp_status: whatsAppStatus,
      });
      success('Settings Saved', 'Institutional configuration updated successfully.');
    } catch (err: any) {
      error('Save Failed', err.message || 'Error updating settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const passRules = {
    minLength: newPassword.length >= 8,
    hasLetter: /[a-zA-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword),
    matchesConfirm: newPassword.length > 0 && newPassword === confirmPassword
  };

  const handleUpdateAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      error('Current Password Required', 'Please enter your current administrator password to authorize changes.');
      return;
    }

    if (!newAdminUsername.trim() && !newPassword) {
      error('No Changes Specified', 'Please provide a new username or a new password to update.');
      return;
    }

    if (newPassword) {
      if (!passRules.minLength || !passRules.hasLetter || !passRules.hasNumber || !passRules.hasSpecial) {
        error(
          'Password Policy Violation',
          'New password must be at least 8 characters, alphanumeric, and contain at least one special symbol (@, #, $, !).'
        );
        return;
      }

      if (newPassword !== confirmPassword) {
        error('Password Mismatch', 'New password and confirmation password do not match.');
        return;
      }
    }

    setIsUpdatingCredentials(true);
    try {
      const res: any = await api.put('/admin/profile/credentials', {
        currentPassword,
        newUsername: newAdminUsername.trim() || undefined,
        newPassword: newPassword || undefined
      });

      if (res?.token) {
        localStorage.setItem('token', res.token);
      }
      if (res?.admin?.username) {
        setCurrentAdminUsername(res.admin.username);
      }

      success(
        'Credentials Updated',
        res.message || 'Administrator username & password updated successfully.'
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNewAdminUsername('');
    } catch (err: any) {
      error('Update Failed', err.message || 'Failed to update administrator credentials.');
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">System &amp; Institutional Configuration</h2>
        <p className="text-xs text-slate-400">
          Administrator master credentials, global evaluation standards, and gateway integrations
        </p>
      </div>

      {/* Admin Master Credentials Management Card */}
      <Card
        title="Administrator Account &amp; Master Security Credentials"
        subtitle="Change your Administrator login username and password with security verification"
      >
        <form onSubmit={handleUpdateAdminCredentials} className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Current Admin Login Username</span>
                <span className="text-sm font-bold text-white font-mono">{currentAdminUsername}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="primary">Master Clearance</Badge>
              <Badge variant="success">Role: ADMIN</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">
                New Admin Username (Optional)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  placeholder="Enter new administrator username"
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Leave blank if you only wish to change your password.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">
                Current Admin Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password to authorize changes"
                  className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">
                New Admin Password (Alphanumeric + Special Symbol)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new administrator password"
                  className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Complexity Checklist */}
              {newPassword && (
                <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px]">
                  <span className={`flex items-center gap-1 ${passRules.minLength ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Min 8 characters
                  </span>
                  <span className={`flex items-center gap-1 ${passRules.hasLetter ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Letters (a-z, A-Z)
                  </span>
                  <span className={`flex items-center gap-1 ${passRules.hasNumber ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Numbers (0-9)
                  </span>
                  <span className={`flex items-center gap-1 ${passRules.hasSpecial ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Symbol (@, #, $, !)
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  disabled={!newPassword}
                />
              </div>
              {newPassword && confirmPassword && (
                <span className={`text-[11px] mt-1.5 flex items-center gap-1 ${passRules.matchesConfirm ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {passRules.matchesConfirm ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {passRules.matchesConfirm ? 'Passwords match' : 'Passwords do not match'}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isUpdatingCredentials}
              leftIcon={<Key className="w-4 h-4" />}
            >
              Update Admin Credentials
            </Button>
          </div>
        </form>
      </Card>

      {/* Institutional Parameters Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Institutional Info */}
          <Card title="Institutional Identity" subtitle="Institution branding and academic term">
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  College / University Name *
                </label>
                <input
                  type="text"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Active Academic Year *
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Pass Mark Threshold Percentage (%) *
                </label>
                <input
                  type="number"
                  min={35}
                  max={75}
                  value={passThreshold}
                  onChange={(e) => setPassThreshold(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Students below this mark in IA-1 or IA-2 will be flagged for Academic Attention.
                </span>
              </div>
            </div>
          </Card>

          {/* Carrier Gateway Integration */}
          <Card title="Parent Communication Gateways" subtitle="Status of telecommunications services">
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-950 border border-sky-800 text-sky-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">SMS Gateway (Fast2SMS / Twilio)</span>
                    <span className="text-[11px] text-slate-400">Transaction route for automated mark alerts</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsEnabled}
                    onChange={(e) => setSmsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">Meta WhatsApp Cloud Business API</span>
                    <span className="text-[11px] text-slate-400">Rich interactive circulars &amp; PDF scorecards</span>
                  </div>
                </div>
                <Badge variant="success">CONNECTED</Badge>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Server Host Environment</span>
                <div className="flex items-center gap-2 text-white font-mono text-xs">
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Node.js v24.19 / Express 5.x Engine</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <Button variant="primary" size="lg" type="submit" isLoading={isSavingSettings} leftIcon={<Save className="w-4 h-4" />}>
            Save Institutional Settings
          </Button>
        </div>
      </form>
    </div>
  );
};
