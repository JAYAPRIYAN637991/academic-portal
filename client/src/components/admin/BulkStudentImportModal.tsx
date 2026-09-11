import React, { useState, useRef } from 'react';
import { api } from '../../services/api';
import {
  DuplicateResolutionMode,
  StudentImportPreviewResponse,
  StudentImportPreviewRow
} from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useToast } from '../../context/ToastContext';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Info,
  ShieldCheck,
  Search,
  Filter,
  Layers
} from 'lucide-react';

interface BulkStudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  academicYears: Array<{ id: string; year: string; isCurrent: boolean }>;
}

type Step = 'upload' | 'preview' | 'importing' | 'completed';

export const BulkStudentImportModal: React.FC<BulkStudentImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  academicYears,
}) => {
  const { success, error: toastError, warning } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>(() => {
    const current = academicYears.find((ay) => ay.isCurrent);
    return current ? current.id : (academicYears[0]?.id || '');
  });
  const [duplicateMode, setDuplicateMode] = useState<DuplicateResolutionMode>('SKIP');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Preview Data
  const [previewData, setPreviewData] = useState<StudentImportPreviewResponse | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'VALID' | 'DUPLICATE' | 'INVALID'>('ALL');
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewPage, setPreviewPage] = useState(1);
  const previewPageSize = 10;

  // Import Result State
  const [importResult, setImportResult] = useState<{
    totalRows: number;
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    duplicateCount: number;
    duplicateMode: DuplicateResolutionMode;
    processingTimeMs: number;
    importHistoryId: string;
  } | null>(null);

  // Reset modal state
  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewData(null);
    setPreviewFilter('ALL');
    setPreviewSearch('');
    setPreviewPage(1);
    setImportResult(null);
    setIsAnalyzing(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Download official template
  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    setIsDownloading(true);
    try {
      await api.download(
        `/admin/students/import/template?format=${format}`,
        `student_import_template.${format}`
      );
      success('Template Downloaded', `Official ${format.toUpperCase()} template downloaded.`);
    } catch (err: any) {
      toastError('Download Failed', err.message || 'Could not download template');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle file drop / selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toastError('Invalid File Format', 'Only .xlsx, .xls, and .csv files are supported.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toastError('File Too Large', 'Maximum allowed upload size is 25 MB.');
      return;
    }
    setSelectedFile(file);
  };

  // Run Dry-run Preview
  const handlePreviewUpload = async () => {
    if (!selectedFile) {
      warning('File Required', 'Please select a spreadsheet file first.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedAcademicYearId) {
        formData.append('academicYearId', selectedAcademicYearId);
      }
      formData.append('duplicateMode', duplicateMode);

      const res = await api.post<StudentImportPreviewResponse>(
        '/admin/students/import/preview',
        formData
      );
      setPreviewData(res);
      setStep('preview');
      success(
        'File Analyzed',
        `Validated ${res.totalRows} rows (${res.validCount} valid, ${res.duplicateCount} duplicates, ${res.invalidCount} invalid).`
      );
    } catch (err: any) {
      toastError('Preview Analysis Failed', err.message || 'Failed to parse file.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Confirm and Execute Import
  const handleConfirmImport = async () => {
    if (!previewData) return;

    if (duplicateMode === 'STOP' && previewData.duplicateCount > 0) {
      toastError(
        'STOP Mode Active',
        `Cannot proceed: ${previewData.duplicateCount} duplicate register numbers detected in STOP mode. Switch to SKIP or UPDATE to continue.`
      );
      return;
    }

    if (previewData.validCount === 0 && (duplicateMode !== 'UPDATE' || previewData.duplicateCount === 0)) {
      toastError('No Valid Records', 'There are no valid records to import.');
      return;
    }

    setStep('importing');
    try {
      const payload = {
        fileName: previewData.fileName,
        fileSize: previewData.fileSize,
        academicYearId: selectedAcademicYearId || undefined,
        duplicateMode,
        students: previewData.previewRows,
        duplicatePayloads: previewData.duplicatePayloads,
        validPayloads: previewData.validPayloads,
      };

      const res = await api.post<{
        message: string;
        summary: {
          totalRows: number;
          importedCount: number;
          updatedCount: number;
          skippedCount: number;
          failedCount: number;
          duplicateCount: number;
          duplicateMode: DuplicateResolutionMode;
          processingTimeMs: number;
          importHistoryId: string;
        };
      }>('/admin/students/import/confirm', payload);

      setImportResult(res.summary);
      setStep('completed');
      success('Import Complete', res.message);
      onSuccess();
    } catch (err: any) {
      toastError('Import Failed', err.message || 'Server error during batch import execution.');
      setStep('preview');
    }
  };

  // Filter & Search Preview Rows
  const filteredPreviewRows = (previewData?.previewRows || []).filter((row) => {
    const matchesFilter =
      previewFilter === 'ALL' ||
      (previewFilter === 'VALID' && row.status === 'VALID') ||
      (previewFilter === 'DUPLICATE' && row.status === 'DUPLICATE') ||
      (previewFilter === 'INVALID' && row.status === 'INVALID');

    const matchesSearch =
      !previewSearch ||
      row.name.toLowerCase().includes(previewSearch.toLowerCase()) ||
      row.registerNumber.toLowerCase().includes(previewSearch.toLowerCase()) ||
      row.parentPhone.includes(previewSearch) ||
      row.departmentCode.toLowerCase().includes(previewSearch.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const totalPreviewPages = Math.ceil(filteredPreviewRows.length / previewPageSize) || 1;
  const paginatedPreviewRows = filteredPreviewRows.slice(
    (previewPage - 1) * previewPageSize,
    previewPage * previewPageSize
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Student Import Engine"
      subtitle="High-performance batch student onboarding with 14-point validation, duplicate resolution & audit logging"
      maxWidth="6xl"
    >
      <div className="space-y-6">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                step === 'upload'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              1
            </span>
            <span className={`text-xs font-semibold ${step === 'upload' ? 'text-white' : 'text-slate-400'}`}>
              File &amp; Configuration
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />

            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                step === 'preview'
                  ? 'bg-indigo-600 text-white'
                  : step === 'importing' || step === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              2
            </span>
            <span className={`text-xs font-semibold ${step === 'preview' ? 'text-white' : 'text-slate-400'}`}>
              Dry-Run Validation
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />

            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                step === 'importing'
                  ? 'bg-indigo-600 text-white animate-pulse'
                  : step === 'completed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              3
            </span>
            <span className={`text-xs font-semibold ${step === 'completed' ? 'text-white' : 'text-slate-400'}`}>
              Execution &amp; Audit
            </span>
          </div>

          {/* Quick Template Download Actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Templates:</span>
            <button
              onClick={() => handleDownloadTemplate('xlsx')}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/50 transition-colors"
              title="Download official Excel template with column formatting"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>.XLSX</span>
            </button>
            <button
              onClick={() => handleDownloadTemplate('csv')}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
              title="Download CSV format template"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.CSV</span>
            </button>
          </div>
        </div>

        {/* STEP 1: UPLOAD & CONFIGURATION */}
        {step === 'upload' && (
          <div className="space-y-5">
            {/* Configuration Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Academic Year *
                </label>
                <select
                  value={selectedAcademicYearId}
                  onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.year} {ay.isCurrent ? '(Current Active Year)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Students will be linked to this academic batch. If left empty, the active academic year is used.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Duplicate Register Number Strategy *
                </label>
                <select
                  value={duplicateMode}
                  onChange={(e) => setDuplicateMode(e.target.value as DuplicateResolutionMode)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="SKIP">SKIP Existing (Safe Default - preserves existing data)</option>
                  <option value="UPDATE">UPDATE Existing (Overwrites student info &amp; parent phone)</option>
                  <option value="STOP">STOP / ABORT (Rejects entire import if duplicates found)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {duplicateMode === 'SKIP' && 'Existing register numbers are safely skipped and reported.'}
                  {duplicateMode === 'UPDATE' && 'Existing student records will be refreshed with newly uploaded details.'}
                  {duplicateMode === 'STOP' && 'Strict verification mode: any duplicate stops the upload.'}
                </p>
              </div>
            </div>

            {/* Dropzone Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                selectedFile
                  ? 'border-indigo-500 bg-indigo-950/20'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-3">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    selectedFile ? 'bg-indigo-600/30 text-indigo-400' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <UploadCloud className="w-7 h-7" />
                </div>
                {selectedFile ? (
                  <div>
                    <h4 className="text-base font-semibold text-white">{selectedFile.name}</h4>
                    <p className="text-xs text-indigo-300 mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop a different file to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Drop Excel (.xlsx, .xls) or CSV spreadsheet here, or{' '}
                      <span className="text-indigo-400 underline">browse</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Up to 25 MB per upload • Automatic header detection • Batch optimized up to 500 rows/batch
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 14-Point Validation Check Rules Guide */}
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>14-Point Pre-Commit Validation Engine Specs</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-slate-400 text-[11px] pt-1">
                <div>✓ 1. Register Number: 3-30 chars, alphanumeric</div>
                <div>✓ 2. Student Full Name: 2-100 characters</div>
                <div>✓ 3. Parent Phone: Valid 10-digit Indian mobile</div>
                <div>✓ 4. Department: Matches CSE, ECE, EEE, MECH, etc.</div>
                <div>✓ 5. Academic Year: Year 1 to 4</div>
                <div>✓ 6. Section: Exists in Target Year &amp; Dept</div>
                <div>✓ 7. Duplicate Prevention: Pre-loaded index scan</div>
                <div>✓ 8. Roll Number uniqueness if supplied</div>
                <div>✓ 9. Gender: MALE, FEMALE, OTHER (Optional)</div>
                <div>✓ 10. Parent Email: RFC 5322 format if provided</div>
                <div>✓ 11. Empty/Blank row filtration</div>
                <div>✓ 12. Transactional atomicity in chunk blocks</div>
                <div>✓ 13. Audit Ledger logging with diagnostics</div>
                <div>✓ 14. Zero UI freeze via stream dry-run</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePreviewUpload}
                disabled={!selectedFile || isAnalyzing}
                isLoading={isAnalyzing}
                leftIcon={<ArrowRight className="w-4 h-4" />}
              >
                Analyze &amp; Dry-Run Preview
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: DRY-RUN PREVIEW TABLE */}
        {step === 'preview' && previewData && (
          <div className="space-y-4">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Total Rows</div>
                <div className="text-xl font-bold text-white mt-0.5">{previewData.totalRows}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Spreadsheet size: {(previewData.fileSize / 1024).toFixed(1)} KB</div>
              </div>

              <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-800/40">
                <div className="text-[11px] font-semibold text-emerald-400 uppercase">Valid Rows</div>
                <div className="text-xl font-bold text-emerald-300 mt-0.5">{previewData.validCount}</div>
                <div className="text-[10px] text-emerald-500/80 mt-0.5">Ready for insertion</div>
              </div>

              <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-800/40">
                <div className="text-[11px] font-semibold text-amber-400 uppercase">Duplicates</div>
                <div className="text-xl font-bold text-amber-300 mt-0.5">{previewData.duplicateCount}</div>
                <div className="text-[10px] text-amber-500/80 mt-0.5">Action: {duplicateMode}</div>
              </div>

              <div className="p-3 bg-rose-950/30 rounded-xl border border-rose-800/40">
                <div className="text-[11px] font-semibold text-rose-400 uppercase">Invalid / Errors</div>
                <div className="text-xl font-bold text-rose-300 mt-0.5">{previewData.invalidCount}</div>
                <div className="text-[10px] text-rose-500/80 mt-0.5">Requires correction</div>
              </div>

              <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-800/40 col-span-2 sm:col-span-1">
                <div className="text-[11px] font-semibold text-indigo-400 uppercase">Validation Speed</div>
                <div className="text-xl font-bold text-indigo-300 mt-0.5">{previewData.processingTimeMs}ms</div>
                <div className="text-[10px] text-indigo-400/80 mt-0.5">In-memory index lookup</div>
              </div>
            </div>

            {/* Warning Alert if duplicates in STOP mode */}
            {duplicateMode === 'STOP' && previewData.duplicateCount > 0 && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-200">
                  <span className="font-bold block">STOP Mode Blocking Commit:</span>
                  There are {previewData.duplicateCount} duplicate register numbers already existing in the database.
                  Because your Duplicate Resolution Mode is set to <strong>STOP</strong>, this import will be aborted.
                  Change the mode to <strong>SKIP</strong> (to omit duplicates) or <strong>UPDATE</strong> (to overwrite).
                </div>
              </div>
            )}

            {/* Filter and Search Bar for Preview */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => {
                    setPreviewFilter('ALL');
                    setPreviewPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    previewFilter === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  All ({previewData.previewRows.length})
                </button>
                <button
                  onClick={() => {
                    setPreviewFilter('VALID');
                    setPreviewPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    previewFilter === 'VALID'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Valid ({previewData.validCount})
                </button>
                <button
                  onClick={() => {
                    setPreviewFilter('DUPLICATE');
                    setPreviewPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    previewFilter === 'DUPLICATE'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Duplicates ({previewData.duplicateCount})
                </button>
                <button
                  onClick={() => {
                    setPreviewFilter('INVALID');
                    setPreviewPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    previewFilter === 'INVALID'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-rose-400 hover:bg-slate-700'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Invalid ({previewData.invalidCount})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={previewSearch}
                  onChange={(e) => {
                    setPreviewSearch(e.target.value);
                    setPreviewPage(1);
                  }}
                  placeholder="Filter preview rows..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Preview Data Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 sticky top-0 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Row #</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Reg. Number</th>
                    <th className="px-3 py-2.5">Student Name</th>
                    <th className="px-3 py-2.5">Class / Section</th>
                    <th className="px-3 py-2.5">Parent Mobile</th>
                    <th className="px-3 py-2.5">Issues &amp; Diagnostics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {paginatedPreviewRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                        No rows match your current search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedPreviewRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`hover:bg-slate-900/50 transition-colors ${
                          row.status === 'INVALID'
                            ? 'bg-rose-950/10'
                            : row.status === 'DUPLICATE'
                            ? 'bg-amber-950/10'
                            : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-400 font-sans font-medium">#{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          {row.status === 'VALID' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                            </span>
                          )}
                          {row.status === 'DUPLICATE' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5" /> Duplicate
                            </span>
                          )}
                          {row.status === 'INVALID' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                              <XCircle className="w-3.5 h-3.5" /> Invalid
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-indigo-300 font-bold">{row.registerNumber || '-'}</td>
                        <td className="px-3 py-2 text-white font-sans font-medium">{row.name || '-'}</td>
                        <td className="px-3 py-2 text-slate-300 font-sans">
                          {row.departmentCode} - Yr {row.yearNumber} ({row.sectionName})
                        </td>
                        <td className="px-3 py-2 text-slate-300">{row.parentPhone || '-'}</td>
                        <td className="px-3 py-2 font-sans">
                          {row.errors && row.errors.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.errors.map((err, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/60 rounded px-1.5 py-0.5 mr-1"
                                >
                                  {err}
                                </span>
                              ))}
                            </div>
                          ) : row.warnings && row.warnings.length > 0 ? (
                            <div className="space-y-0.5">
                              {row.warnings.map((warn, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded px-1.5 py-0.5 mr-1"
                                >
                                  {warn}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-emerald-400/80">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for preview */}
            {totalPreviewPages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>
                  Showing {(previewPage - 1) * previewPageSize + 1} to{' '}
                  {Math.min(previewPage * previewPageSize, filteredPreviewRows.length)} of{' '}
                  {filteredPreviewRows.length} preview rows
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    disabled={previewPage === 1}
                    className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="px-2 py-1 text-slate-300">
                    {previewPage} / {totalPreviewPages}
                  </span>
                  <button
                    onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                    disabled={previewPage === totalPreviewPages}
                    className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back to File Upload
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Mode: <strong className="text-white">{duplicateMode}</strong>
                </span>
                <Button
                  variant="primary"
                  onClick={handleConfirmImport}
                  disabled={duplicateMode === 'STOP' && previewData.duplicateCount > 0}
                  leftIcon={<Layers className="w-4 h-4" />}
                >
                  Commit &amp; Import Now ({previewData.validCount} valid)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: EXECUTING PROGRESS */}
        {step === 'importing' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center animate-spin">
              <RefreshCw className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Importing Batch Records...</h3>
              <p className="text-xs text-slate-400 mt-1">
                Executing batched operations with transaction boundaries (Batch size: 500)...
              </p>
            </div>
            <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {/* STEP 4: COMPLETED SCORECARD */}
        {step === 'completed' && importResult && (
          <div className="space-y-5">
            <div className="p-6 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Bulk Student Import Complete</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Processed {importResult.totalRows} student entries in {importResult.processingTimeMs}ms with{' '}
                  {importResult.duplicateMode} duplicate handling mode.
                </p>
              </div>
            </div>

            {/* Execution Scorecard Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <div className="text-[11px] font-semibold text-emerald-400 uppercase">Newly Created</div>
                <div className="text-2xl font-bold text-white mt-1">{importResult.importedCount}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Added to database</div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <div className="text-[11px] font-semibold text-indigo-400 uppercase">Updated</div>
                <div className="text-2xl font-bold text-white mt-1">{importResult.updatedCount}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Refreshed details</div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <div className="text-[11px] font-semibold text-amber-400 uppercase">Skipped</div>
                <div className="text-2xl font-bold text-white mt-1">{importResult.skippedCount}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Preserved original</div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <div className="text-[11px] font-semibold text-rose-400 uppercase">Failed / Errors</div>
                <div className="text-2xl font-bold text-white mt-1">{importResult.failedCount}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Logged in audit ledger</div>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>
                  Audit Reference ID: <span className="font-mono text-indigo-300">{importResult.importHistoryId}</span>
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 font-medium">Logged to Audit Trail</span>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={handleClose}>
                Finish &amp; View Directory
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
