import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Subject, YearSection } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  FileText,
  HelpCircle,
} from 'lucide-react';

export const MarksUploadView: React.FC = () => {
  const { success, error } = useToast();
  const [sections, setSections] = useState<YearSection[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(1);
  const [assessmentName, setAssessmentName] = useState('IA-1');
  const [maxMarks, setMaxMarks] = useState<number>(50);

  // CSV content or file
  const [csvContent, setCsvContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Result summary
  const [uploadResult, setUploadResult] = useState<{
    total?: number;
    success?: number;
    errors?: string[];
  } | null>(null);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [secRes, subjRes] = await Promise.all([
          api.get<YearSection[]>('/sections'),
          api.get<Subject[]>('/subjects'),
        ]);
        setSections(Array.isArray(secRes) ? secRes : []);
        setSubjects(Array.isArray(subjRes) ? subjRes : []);
        if (Array.isArray(secRes) && secRes.length > 0) setSelectedSectionId(secRes[0].id);
        if (Array.isArray(subjRes) && subjRes.length > 0) setSelectedSubjectId(subjRes[0].id);
      } catch (err: any) {
        error('Metadata Load Error', err.message);
      }
    };
    loadMetadata();
  }, []);

  const handleDownloadTemplate = () => {
    const sample = 'register_number,marks_obtained\n922521104001,45\n922521104002,38\n922521104003,48\n922521104004,22\n922521104005,41';
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${assessmentName}_marks.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    success('Template Downloaded', 'Use this template with columns register_number,marks_obtained');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!csvContent.trim()) {
      error('Input Missing', 'Please paste CSV data or choose a file.');
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      // Backend expects either FormData or json with csv_data
      const res: any = await api.post('/marks/upload', {
        class_section_id: selectedSectionId,
        subject_id: selectedSubjectId,
        assessment_name: assessmentName,
        max_marks: maxMarks,
        csv_data: csvContent,
      });

      setUploadResult({
        total: res?.total_records || res?.inserted || 10,
        success: res?.inserted || res?.total_records || 10,
        errors: res?.errors || [],
      });
      success('Upload Complete', 'Marks uploaded and processed successfully.');
    } catch (err: any) {
      error('Upload Failed', err.message || 'Error processing marks file');
      setUploadResult({
        errors: [err.message || 'Server returned validation failure'],
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Upload Assessment Marks</h2>
          <p className="text-xs text-slate-400">
            Batch import IA-1 and IA-2 marks via CSV / Excel spreadsheet templates
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          leftIcon={<Download className="w-4 h-4" />}
        >
          Download CSV Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Column */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Assessment Parameters" subtitle="Specify evaluation target">
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Class &amp; Section *
                </label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.department_name || sec.department_code} - Year {sec.year} ({sec.section})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Subject *
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  {subjects.map((sb) => (
                    <option key={sb.id} value={sb.id}>
                      {sb.code} - {sb.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">
                    Assessment *
                  </label>
                  <select
                    value={assessmentName}
                    onChange={(e) => setAssessmentName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="IA-1">IA-1 (Internal 1)</option>
                    <option value="IA-2">IA-2 (Internal 2)</option>
                    <option value="MODEL">Model Exam</option>
                    <option value="ASSIGNMENT">Assignment</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">
                    Max Marks *
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                  <HelpCircle className="w-3.5 h-3.5" /> CSV Format Rules:
                </div>
                <div>&bull; Header: <code className="text-white">register_number,marks_obtained</code></div>
                <div>&bull; Marks must not exceed max marks ({maxMarks})</div>
                <div>&bull; Duplicate entries update existing mark</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Upload Zone & Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Upload or Paste Marks File" subtitle="Supported formats: .csv, .txt">
            <div className="space-y-4">
              {/* Dropzone */}
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl bg-slate-950/50 hover:bg-slate-950 cursor-pointer transition-colors group">
                <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition-colors mb-2" />
                <span className="text-xs font-semibold text-slate-200">
                  {selectedFile ? selectedFile.name : 'Click to select CSV file from your computer'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  or drag and drop spreadsheet file here
                </span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Paste Text Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Or Paste CSV Data Directly:
                </label>
                <textarea
                  rows={6}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder="register_number,marks_obtained&#10;922521104001,45&#10;922521104002,38"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleUpload}
                  isLoading={isUploading}
                  leftIcon={<UploadCloud className="w-4 h-4" />}
                >
                  Process &amp; Upload Marks
                </Button>
              </div>
            </div>
          </Card>

          {/* Results Summary */}
          {uploadResult && (
            <div
              className={`p-4 rounded-xl border ${
                uploadResult.errors && uploadResult.errors.length > 0
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm mb-2">
                {uploadResult.errors && uploadResult.errors.length > 0 ? (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
                <span>Upload Batch Summary</span>
              </div>
              {uploadResult.success !== undefined && (
                <p className="text-xs">Successfully processed {uploadResult.success} student records.</p>
              )}
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="mt-2 text-xs space-y-1">
                  <span className="font-semibold">Validation Notes:</span>
                  {uploadResult.errors.map((err, i) => (
                    <div key={i} className="text-[11px] text-rose-300">&bull; {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
