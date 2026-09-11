import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { StaffMember, Department } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import {
  Plus,
  Users,
  Mail,
  Phone,
  Trash2,
  Edit2,
  Key,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  BookOpen,
  Lock,
  UserCheck,
  UserX,
  AlertTriangle,
  Share2,
  Check,
  ExternalLink,
  ShieldOff
} from 'lucide-react';

/**
 * Derives client-side preview of standard institutional password
 */
function computeFormulaPasswordPreview(fullName: string, dobString: string): string {
  if (!fullName) return 'Staff@DDMMYYYY';
  const clean = fullName.replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.|prof|dr|mr|mrs|ms)\s+/i, '').trim();
  const parts = clean.split(/\s+/);
  let first = parts[0].replace(/[^a-zA-Z]/g, '') || 'Staff';
  if (first.length <= 2 && parts.length > 1) {
    const candidate = parts[1].replace(/[^a-zA-Z]/g, '');
    if (candidate) first = candidate;
  }
  const capitalized = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();

  if (!dobString) return `${capitalized}@DDMMYYYY`;

  // Check YYYY-MM-DD
  const ymd = dobString.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${capitalized}@${d.padStart(2, '0')}${m.padStart(2, '0')}${y}`;
  }

  // Check DD-MM-YYYY
  const dmy = dobString.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${capitalized}@${d.padStart(2, '0')}${m.padStart(2, '0')}${y}`;
  }

  const digits = dobString.replace(/\D/g, '');
  if (digits.length === 8) return `${capitalized}@${digits}`;

  return `${capitalized}@DDMMYYYY`;
}

function deriveStaffUsername(name: string): string {
  if (!name) return 'staff.member';
  const clean = name.replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.|prof|dr|mr|mrs|ms)\s+/i, '').trim();
  return clean.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'staff.member';
}

/**
 * Checks institutional password complexity rules:
 * - Minimum 8 characters
 * - Letters
 * - Numbers
 * - Special symbol
 */
function checkPasswordRules(password: string) {
  return {
    minLength: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)
  };
}

export const StaffView: React.FC = () => {
  const { success, error } = useToast();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [username, setUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [showCustomPass, setShowCustomPass] = useState(false);
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [deptId, setDeptId] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authorize & Reset Password Modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedStaffForAuth, setSelectedStaffForAuth] = useState<StaffMember | null>(null);
  const [authMode, setAuthMode] = useState<'DEFAULT_NAME_DOB' | 'CUSTOM' | 'REVOKE' | 'AUTHORIZE_ONLY'>('DEFAULT_NAME_DOB');
  const [authDob, setAuthDob] = useState('');
  const [authCustomPassword, setAuthCustomPassword] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Credential Handout Modal ("give credentials to faculty member")
  const [isHandoutModalOpen, setIsHandoutModalOpen] = useState(false);
  const [handoutCredentials, setHandoutCredentials] = useState<{
    name: string;
    username: string;
    email: string;
    department?: string;
    password: string;
    loginUrl: string;
  } | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Discontinue Staff
  const [staffToDiscontinue, setStaffToDiscontinue] = useState<StaffMember | null>(null);
  const [isDiscontinuing, setIsDiscontinuing] = useState(false);

  // Delete Staff
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [staffRes, deptRes] = await Promise.all([
        api.get<any>('/admin/staff'),
        api.get<any>('/admin/departments').catch(() => api.get<any>('/departments').catch(() => ({ departments: [] }))),
      ]);

      const rawStaff: StaffMember[] = Array.isArray(staffRes)
        ? staffRes
        : (staffRes?.staff || []);
      setStaffList(rawStaff);

      const rawDepts: Department[] = Array.isArray(deptRes)
        ? deptRes
        : (deptRes?.departments || []);
      setDepartments(rawDepts);
      if (rawDepts.length > 0 && !deptId) {
        setDeptId(rawDepts[0].id);
      }
    } catch (err: any) {
      error('Failed to load faculty directory', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setName('');
    setEmail('');
    setDateOfBirth('');
    setUsername('');
    setCustomPassword('');
    setShowCustomPass(false);
    setPhone('');
    setDesignation('Assistant Professor');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: StaffMember) => {
    setEditingStaff(s);
    setName(s.name);
    setEmail(s.email);
    setDateOfBirth(s.dateOfBirth || '');
    setUsername(s.username || deriveStaffUsername(s.name));
    setCustomPassword('');
    setShowCustomPass(false);
    setPhone(s.phone || '');
    setDesignation(s.designation || 'Assistant Professor');
    if (s.department_id) setDeptId(Number(s.department_id));
    setIsModalOpen(true);
  };

  const handleOpenAuthModal = (s: StaffMember) => {
    setSelectedStaffForAuth(s);
    setAuthMode('DEFAULT_NAME_DOB');
    setAuthDob(s.dateOfBirth || '');
    setAuthCustomPassword('');
    setIsAuthModalOpen(true);
  };

  const togglePasswordVisibility = (id: string | number) => {
    const key = String(id);
    setRevealedPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string, label = 'Information') => {
    navigator.clipboard.writeText(text);
    success('Copied to Clipboard', `${label} copied.`);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    // If custom password provided, check complexity
    if (customPassword) {
      const rules = checkPasswordRules(customPassword);
      if (!rules.minLength || !rules.hasLetter || !rules.hasNumber || !rules.hasSpecial) {
        error(
          'Password Policy Violation',
          'Password must be at least 8 characters, alphanumeric, and contain at least one special symbol (@, #, $, !).'
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingStaff) {
        const payload: any = {
          name: name.trim(),
          email: email.trim(),
          dateOfBirth: dateOfBirth ? dateOfBirth.trim() : null,
          username: username ? username.trim().toLowerCase() : undefined,
          phone: phone.trim() || undefined,
          designation,
          department_id: deptId,
        };
        await api.put(`/admin/staff/${editingStaff.id}`, payload);
        success('Staff Updated', `Profile for ${name} has been updated.`);
        setIsModalOpen(false);
      } else {
        const payload: any = {
          name: name.trim(),
          email: email.trim(),
          dateOfBirth: dateOfBirth ? dateOfBirth.trim() : null,
          username: username ? username.trim().toLowerCase() : undefined,
          password: customPassword ? customPassword.trim() : undefined,
          phone: phone.trim() || undefined,
          designation,
          department_id: deptId,
        };

        const res: any = await api.post('/admin/staff', payload);
        const credentialsObj = res?.credentials || {
          name: res?.staff?.name || name,
          username: res?.staff?.username || deriveStaffUsername(name),
          email: res?.staff?.email || email,
          password: res?.generatedPassword || computeFormulaPasswordPreview(name, dateOfBirth),
          loginUrl: window.location.origin + '/login'
        };

        setIsModalOpen(false);
        setHandoutCredentials({
          ...credentialsObj,
          loginUrl: window.location.origin + '/login'
        });
        setIsHandoutModalOpen(true);
        success('Faculty Registered', `${name} created. You can now issue credentials to the faculty member.`);
      }

      fetchData();
    } catch (err: any) {
      error('Operation Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthorizePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForAuth) return;

    if (authMode === 'CUSTOM') {
      const rules = checkPasswordRules(authCustomPassword);
      if (!rules.minLength || !rules.hasLetter || !rules.hasNumber || !rules.hasSpecial) {
        error(
          'Password Policy Violation',
          'Password must be at least 8 characters, alphanumeric, and contain at least one special symbol.'
        );
        return;
      }
    }

    setIsAuthorizing(true);
    try {
      const payload: any = {
        mode: authMode,
        dateOfBirth: authDob ? authDob.trim() : undefined,
        newPassword: authCustomPassword ? authCustomPassword.trim() : undefined,
      };

      const res: any = await api.post(
        `/admin/staff/${selectedStaffForAuth.id}/authorize-password`,
        payload
      );

      success(
        'Credentials Authorized',
        res.message || `Password authorization updated for ${selectedStaffForAuth.name}.`
      );
      setIsAuthModalOpen(false);
      fetchData();
    } catch (err: any) {
      error('Authorization Error', err.message);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleDiscontinueFaculty = async () => {
    if (!staffToDiscontinue) return;
    setIsDiscontinuing(true);
    try {
      await api.patch(`/admin/staff/${staffToDiscontinue.id}/discontinue`, {
        reason: 'Faculty member discontinued college service'
      });
      success(
        'Faculty Discontinued',
        `${staffToDiscontinue.name} has been discontinued. Portal login access revoked.`
      );
      setStaffToDiscontinue(null);
      fetchData();
    } catch (err: any) {
      error('Discontinue Failed', err.message);
    } finally {
      setIsDiscontinuing(false);
    }
  };

  const handleReactivateStaff = async (staff: StaffMember) => {
    try {
      await api.post(`/admin/staff/${staff.id}/reissue-credentials`, {
        dateOfBirth: staff.dateOfBirth
      });
      success('Faculty Re-activated', `${staff.name} re-activated with standard credentials.`);
      fetchData();
    } catch (err: any) {
      error('Reactivation Failed', err.message);
    }
  };

  const handleDelete = async () => {
    if (!staffToDelete) return;
    try {
      await api.delete(`/admin/staff/${staffToDelete.id}`);
      success('Staff Deleted', `${staffToDelete.name} has been removed.`);
      setStaffToDelete(null);
      fetchData();
    } catch (err: any) {
      error('Delete Failed', err.message);
    }
  };

  const copyHandoutText = () => {
    if (!handoutCredentials) return;
    const text = `================================================
VSB ENGINEERING COLLEGE - FACULTY CREDENTIALS
================================================
Faculty Name: ${handoutCredentials.name}
Login Username: ${handoutCredentials.username} (or full name "${handoutCredentials.name}")
Login Password: ${handoutCredentials.password}
Portal URL: ${handoutCredentials.loginUrl}
Email: ${handoutCredentials.email}
================================================
Note: Please sign in and protect your login credentials.`;
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    success('Credentials Copied', 'Official faculty login slip copied to clipboard!');
    setTimeout(() => setCopiedAll(false), 3000);
  };

  // Filter staff
  const filtered = staffList.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.username && s.username.toLowerCase().includes(q)) ||
      (s.employee_id && s.employee_id.toLowerCase().includes(q));

    const matchesDept = filterDept === 'ALL' || String(s.department_id) === filterDept;

    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && s.isActive !== false) ||
      (filterStatus === 'DISCONTINUED' && s.isActive === false) ||
      (filterStatus === 'AUTHORIZED' && s.passwordAuthorized !== false) ||
      (filterStatus === 'REVOKED' && s.passwordAuthorized === false);

    return matchesSearch && matchesDept && matchesStatus;
  });

  const totalStaff = staffList.length;
  const activeCount = staffList.filter((s) => s.isActive !== false).length;
  const discontinuedCount = staffList.filter((s) => s.isActive === false).length;
  const assignmentsCount = staffList.reduce((acc, s) => acc + (s.assignmentsCount || s.assignments?.length || 0), 0);

  const customPassRules = checkPasswordRules(customPassword);
  const authPassRules = checkPasswordRules(authCustomPassword);

  const columns: Column<StaffMember>[] = [
    {
      header: 'Faculty Member',
      accessor: (row) => {
        const isDiscontinued = row.isActive === false;
        return (
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border ${
              isDiscontinued
                ? 'bg-rose-950/60 border-rose-800/60 text-rose-300'
                : 'bg-gradient-to-tr from-indigo-950 to-indigo-800 border-indigo-700/60 text-indigo-300 shadow-inner'
            }`}>
              {row.name.replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.)\s+/i, '').charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold block leading-tight ${isDiscontinued ? 'text-slate-400 line-through' : 'text-white'}`}>
                  {row.name}
                </span>
                {isDiscontinued && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950 border border-rose-800 text-rose-300 uppercase">
                    Discontinued
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                <Mail className="w-3 h-3 text-slate-400" />
                <span>{row.email}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Login Username',
      accessor: (row) => (
        <div>
          <div className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-indigo-300">
            <span>{row.username || deriveStaffUsername(row.name)}</span>
            <button
              onClick={() => copyToClipboard(row.username || deriveStaffUsername(row.name), 'Username')}
              className="p-0.5 hover:text-white transition-colors"
              title="Copy login username"
            >
              <Copy className="w-2.5 h-2.5" />
            </button>
          </div>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            Or Name: "{row.name}"
          </span>
        </div>
      ),
    },
    {
      header: 'Department',
      accessor: (row) => {
        const deptCode = (row as any).departmentCode || (row as any).department?.code || (row.assignments?.[0]?.department) || 'CSE';
        const deptName = (row as any).departmentName || (row as any).department?.name || (row.assignments?.[0]?.departmentName) || 'Engineering';
        return (
          <div>
            <Badge variant="primary" className="font-semibold uppercase tracking-wider text-[11px]">
              {deptCode}
            </Badge>
            <span className="text-[10px] text-slate-400 block mt-0.5 max-w-[140px] truncate" title={deptName}>
              {deptName}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Date of Birth (DOB)',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono">{row.dateOfBirth || 'Not Set'}</span>
        </div>
      ),
    },
    {
      header: 'Institutional Password',
      accessor: (row) => {
        const staffPass = row.dateOfBirth
          ? computeFormulaPasswordPreview(row.name, row.dateOfBirth)
          : 'Pending DOB';
        const isRevealed = !!revealedPasswords[String(row.id)];

        return (
          <div className="flex items-center gap-2">
            <div className="font-mono text-xs px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-400 font-medium tracking-wide">
              {isRevealed ? staffPass : '••••••••••••'}
            </div>
            {row.dateOfBirth && (
              <>
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility(row.id)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  title={isRevealed ? 'Hide password' : 'Show password'}
                >
                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(staffPass, 'Password')}
                  className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
                  title="Copy password"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
    {
      header: 'Service & Auth Status',
      accessor: (row) => {
        const isDiscontinued = row.isActive === false;
        const isAuth = row.passwordAuthorized !== false;

        if (isDiscontinued) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 border border-rose-800 text-rose-300">
              <ShieldOff className="w-3 h-3" />
              Discontinued
            </span>
          );
        }

        return (
          <div className="flex items-center gap-1.5">
            {isAuth ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 border border-emerald-700/60 text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                Active &amp; Authorized
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/70 border border-amber-700/60 text-amber-400">
                <ShieldAlert className="w-3 h-3" />
                Revoked
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Classes Assigned',
      accessor: (row) => {
        const count = row.assignmentsCount || row.assignments?.length || 0;
        return (
          <Badge variant={count > 0 ? 'primary' : 'neutral'}>
            {count} {count === 1 ? 'Subject' : 'Subjects'}
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      accessor: (row) => {
        const isDiscontinued = row.isActive === false;
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => handleOpenAuthModal(row)}
              className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/60 border border-indigo-800/40"
              title="Authorize / Manage Password"
            >
              <Key className="w-4 h-4" />
            </button>

            {isDiscontinued ? (
              <button
                onClick={() => handleReactivateStaff(row)}
                className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 border border-emerald-800/40"
                title="Re-activate & Reissue Credentials"
              >
                <UserCheck className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setStaffToDiscontinue(row)}
                className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-950/60 border border-amber-800/40"
                title="Discontinue Faculty Member"
              >
                <UserX className="w-4 h-4" />
              </button>
            )}

            <a
              href="#staff-assignments"
              className="p-1.5 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-950/60 border border-purple-800/40 inline-flex items-center justify-center"
              title="Manage Course & Semester Assignments"
            >
              <BookOpen className="w-4 h-4" />
            </a>

            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Edit Staff Member"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setStaffToDelete(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
              title="Delete Staff Member"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Banner & Institutional Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Faculty &amp; Staff Directory</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 border border-indigo-700/60 text-indigo-300 uppercase">
              Admin Password Authorization Clearance
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Only Administrators can add faculty, issue login credentials, and discontinue departing faculty.
            Passwords must be <strong className="text-emerald-300">alphanumeric with at least one special symbol</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenAdd}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-indigo-500/20 shadow-lg"
          >
            Add Faculty
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Faculty</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{totalStaff}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Faculty</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-0.5">{activeCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-700/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Discontinued</p>
            <h3 className="text-2xl font-bold text-rose-400 mt-0.5">{discontinuedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-700/40 flex items-center justify-center text-rose-400">
            <ShieldOff className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Course Assignments</p>
            <h3 className="text-2xl font-bold text-purple-300 mt-0.5">{assignmentsCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-700/40 flex items-center justify-center text-purple-400">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search faculty by name, username, email..."
        onRefresh={fetchData}
        isRefreshing={isLoading}
        filters={
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Faculty</option>
              <option value="DISCONTINUED">Discontinued</option>
              <option value="AUTHORIZED">Authorized Logins</option>
              <option value="REVOKED">Revoked Logins</option>
            </select>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Faculty Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        keyExtractor={(item) => String(item.id)}
        emptyTitle="No Faculty Accounts Found"
        emptyDescription="Register teaching faculty members to assign subjects and generate automated Name+DOB credentials."
        emptyActionLabel="Add First Faculty"
        onEmptyAction={handleOpenAdd}
      />

      {/* Add / Edit Faculty Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStaff ? 'Edit Faculty Account' : 'Register New Faculty Account'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveStaff} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Full Name * (with title if applicable)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingStaff && !username) {
                    setUsername(deriveStaffUsername(e.target.value));
                  }
                }}
                placeholder="Enter faculty full name"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="faculty.email@college.edu"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Login Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={name ? deriveStaffUsername(name) : 'faculty.username'}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Staff sign in using their assigned Username or Email
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Date of Birth (DOB) *
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                required={!editingStaff && !customPassword}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Department *
              </label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Designation
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Professor">Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Head of Department">Head of Department (HOD)</option>
                <option value="Lecturer">Lecturer</option>
              </select>
            </div>
          </div>

          {/* Password Specification Card */}
          {!editingStaff && (
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Initial Password (Alphanumeric + Special Symbol)
                </label>
                <span className="text-[11px] text-indigo-400 font-medium">
                  {name && dateOfBirth ? 'Default: Institutional Auto-generated' : 'Default: Auto-generated'}
                </span>
              </div>

              <div className="relative">
                <input
                  type={showCustomPass ? 'text' : 'password'}
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Leave blank to use default institutional password, or enter custom password"
                  className="w-full px-3.5 py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCustomPass(!showCustomPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showCustomPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Real-time Password Complexity Indicators */}
              {customPassword && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
                  <span className={`flex items-center gap-1 ${customPassRules.minLength ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Min 8 chars
                  </span>
                  <span className={`flex items-center gap-1 ${customPassRules.hasLetter ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Letters (a-z)
                  </span>
                  <span className={`flex items-center gap-1 ${customPassRules.hasNumber ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Numbers (0-9)
                  </span>
                  <span className={`flex items-center gap-1 ${customPassRules.hasSpecial ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className="w-3 h-3" /> Symbol (@, #, $, !)
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              {editingStaff ? 'Update Staff Member' : 'Register & Authorize Staff'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Official Faculty Credentials Handout Modal */}
      <Modal
        isOpen={isHandoutModalOpen}
        onClose={() => setIsHandoutModalOpen(false)}
        title="Faculty Login Credentials Handout"
        maxWidth="md"
      >
        {handoutCredentials && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-emerald-900/60 border border-emerald-600/40 flex items-center justify-center mx-auto text-emerald-400 mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Faculty Account Registered &amp; Authorized</h3>
              <p className="text-xs text-slate-300">
                Please provide the following credentials to <strong>{handoutCredentials.name}</strong> to access their portal.
              </p>
            </div>

            {/* Credential Slip Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 font-sans uppercase text-[10px]">Faculty Member</span>
                <span className="font-bold text-white font-sans">{handoutCredentials.name}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 font-sans uppercase text-[10px]">Department</span>
                <span className="font-semibold text-purple-300 font-sans">
                  {handoutCredentials.department || departments.find(d => d.id === deptId)?.name || 'Computer Science and Engineering'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 font-sans uppercase text-[10px]">Login Username</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-indigo-300">{handoutCredentials.username}</span>
                  <button
                    onClick={() => copyToClipboard(handoutCredentials.username, 'Username')}
                    className="p-1 hover:text-white"
                    title="Copy username"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 font-sans uppercase text-[10px]">Alternate Username</span>
                <span className="text-slate-300 font-sans">Full Name: "{handoutCredentials.name}"</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 font-sans uppercase text-[10px]">Authorized Password</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-400">{handoutCredentials.password}</span>
                  <button
                    onClick={() => copyToClipboard(handoutCredentials.password, 'Password')}
                    className="p-1 hover:text-white"
                    title="Copy password"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans uppercase text-[10px]">Portal URL</span>
                <span className="text-indigo-400 truncate max-w-[200px]">{handoutCredentials.loginUrl}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                variant="primary"
                onClick={copyHandoutText}
                leftIcon={copiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                className="flex-1"
              >
                {copiedAll ? 'Credentials Slip Copied!' : 'Copy Complete Credentials'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsHandoutModalOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Discontinue Faculty Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!staffToDiscontinue}
        onClose={() => setStaffToDiscontinue(null)}
        onConfirm={handleDiscontinueFaculty}
        title="Discontinue Faculty Member"
        confirmText="Confirm Discontinuation"
        variant="danger"
        message={`Are you sure you want to discontinue ${staffToDiscontinue?.name}? This will immediately deactivate their account, revoke portal login credentials, and block access with HTTP 403. All existing marks and records are permanently preserved.`}
      />

      {/* Authorize & Manage Password Modal */}
      <Modal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Admin Password Authorization Clearance"
        maxWidth="md"
      >
        {selectedStaffForAuth && (
          <form onSubmit={handleAuthorizePassword} className="space-y-4">
            {/* Selected Faculty Profile Banner */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">{selectedStaffForAuth.name}</h4>
                <p className="text-xs text-slate-400">{selectedStaffForAuth.email}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-indigo-300">
                  <span>Username: {selectedStaffForAuth.username || deriveStaffUsername(selectedStaffForAuth.name)}</span>
                </div>
              </div>
              <div>
                {selectedStaffForAuth.isActive === false ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 border border-rose-800 text-rose-300">
                    <ShieldOff className="w-3 h-3" />
                    Discontinued
                  </span>
                ) : selectedStaffForAuth.passwordAuthorized !== false ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 border border-emerald-700 text-emerald-300">
                    <ShieldCheck className="w-3 h-3" />
                    Authorized
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 border border-rose-700 text-rose-300">
                    <ShieldAlert className="w-3 h-3" />
                    Revoked
                  </span>
                )}
              </div>
            </div>

            {/* Authorization Mode Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Authorization Action
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    authMode === 'DEFAULT_NAME_DOB'
                      ? 'bg-indigo-950/40 border-indigo-600'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="authMode"
                    value="DEFAULT_NAME_DOB"
                    checked={authMode === 'DEFAULT_NAME_DOB'}
                    onChange={() => setAuthMode('DEFAULT_NAME_DOB')}
                    className="mt-0.5 text-indigo-600 focus:ring-0"
                  />
                  <div>
                    <span className="text-sm font-semibold text-white block">
                      Authorize Standard Institutional Password
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Resets and authorizes login using institutional credentials.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    authMode === 'CUSTOM'
                      ? 'bg-indigo-950/40 border-indigo-600'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="authMode"
                    value="CUSTOM"
                    checked={authMode === 'CUSTOM'}
                    onChange={() => setAuthMode('CUSTOM')}
                    className="mt-0.5 text-indigo-600 focus:ring-0"
                  />
                  <div>
                    <span className="text-sm font-semibold text-white block">
                      Assign Custom Authorized Password
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Sets an alphanumeric password with special symbol (min 8 chars).
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    authMode === 'REVOKE'
                      ? 'bg-rose-950/40 border-rose-600'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="authMode"
                    value="REVOKE"
                    checked={authMode === 'REVOKE'}
                    onChange={() => setAuthMode('REVOKE')}
                    className="mt-0.5 text-rose-600 focus:ring-0"
                  />
                  <div>
                    <span className="text-sm font-semibold text-rose-300 block">
                      Revoke Login Authorization
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Immediately revokes this staff member's login access. Login will be blocked with HTTP 403.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Mode-specific Fields */}
            {authMode === 'DEFAULT_NAME_DOB' && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Staff Date of Birth (DOB)
                  </label>
                  <input
                    type="date"
                    value={authDob}
                    onChange={(e) => setAuthDob(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                {authDob && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs">
                    <span className="text-emerald-300 font-medium">Institutional Access:</span>
                    <span className="text-emerald-400 font-medium">
                      Standard password ready for authorization
                    </span>
                  </div>
                )}
              </div>
            )}

            {authMode === 'CUSTOM' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  New Custom Password (min. 8 characters, alphanumeric + special symbol) *
                </label>
                <input
                  type="password"
                  value={authCustomPassword}
                  onChange={(e) => setAuthCustomPassword(e.target.value)}
                  placeholder="Enter authorized custom password"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  minLength={8}
                  required
                />
                {authCustomPassword && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
                    <span className={`flex items-center gap-1 ${authPassRules.minLength ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" /> Min 8 chars
                    </span>
                    <span className={`flex items-center gap-1 ${authPassRules.hasLetter ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" /> Letters
                    </span>
                    <span className={`flex items-center gap-1 ${authPassRules.hasNumber ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" /> Numbers
                    </span>
                    <span className={`flex items-center gap-1 ${authPassRules.hasSpecial ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                      <Check className="w-3 h-3" /> Symbol
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button variant="outline" type="button" onClick={() => setIsAuthModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={authMode === 'REVOKE' ? 'danger' : 'primary'}
                type="submit"
                isLoading={isAuthorizing}
              >
                {authMode === 'REVOKE' ? 'Revoke Access' : 'Confirm Authorization'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Staff Confirmation */}
      <ConfirmDialog
        isOpen={!!staffToDelete}
        onClose={() => setStaffToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Faculty Account"
        message={`Are you sure you want to permanently delete ${staffToDelete?.name}? All subject assignments and marks records linked to this account will be preserved in audit logs.`}
      />
    </div>
  );
};
