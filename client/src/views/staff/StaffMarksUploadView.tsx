import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { UploadCloud, Download, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface AssignedItem {
  id: number;
  label: string;
}

export const StaffMarksUploadView: React.FC = () => {
  const { success, error } = useToast();
  const [classes, setClasses] = useState<AssignedItem[]>([]);
  const [subjects, setSubjects] = useState<AssignedItem[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<number>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(1);
  const [assessmentName, setAssessmentName] = useState('IA-1');
  const [maxMarks, setMaxMarks] = useState<number>(50);

  const [csvContent, setCsvContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ total?: number; success?: number; errors?: string[] } | null>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [clsRes, sbRes]: any = await Promise.all([
          api.get('/staff/classes'),
          api.get('/staff/subjects'),
        ]);

        const rawClasses = Array.isArray(clsRes) ? clsRes : clsRes?.classes || [];
        const rawSubjects = Array.isArray(sbRes) ? sbRes : sbRes?.subjects || [];

        const mappedClasses = rawClasses.map((c: any) => ({
          id: c.id,
          label: `${c.department} - Year ${c.year} (${c.section})`,
        }));
        const mappedSubjects = rawSubjects.map((s: any) => ({
          id: s.id,
          label: `${s.code} - ${s.name}`,
        }));

        setClasses(mappedClasses);
        setSubjects(mappedSubjects);

        if (mappedClasses.length > 0) setSelectedClassId(mappedClasses[0].id);
        if (mappedSubjects.length > 0) setSelectedSubjectId(mappedSubjects[0].id);
      } catch (err: any) {
        error('Metadata Load Error', err.message);
      }
    };
    fetchMetadata();
  }, []);

  const handleDownloadTemplate = () => {
    const sample = 'register_number,marks_obtained\n922521104001,45\n922521104002,38\n922521104003,48';
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faculty_template_${assessmentName}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    success('Template Downloaded', 'CSV template downloaded.');
  };

  const handleUpload = async () => {
    if (!csvContent.trim()) {
      error('Input Missing', 'Please paste CSV data or choose a file.');
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const res: any = await api.post('/staff/marks/upload', {
        class_section_id: selectedClassId,
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
      success('Upload Succeeded', 'Assessment marks recorded successfully.');
    } catch (err: any) {
      error('Upload Failed', err.message || 'Error uploading marks');
      setUploadResult({
        errors: [err.message || 'Server rejected marks submission'],
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Faculty Marks Upload</h2>
          <p className="text-xs text-slate-400">
            Submit assessment scores for your assigned teaching subjects and batches
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
        <div className="lg:col-span-1 space-y-4">
          <Card title="Target Class &amp; Subject" subtitle="Restricted to assigned curriculum">
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  My Assigned Class *
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  My Assigned Subject *
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
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
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="IA-1">IA-1</option>
                    <option value="IA-2">IA-2</option>
                    <option value="MODEL">Model Exam</option>
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
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <HelpCircle className="w-3.5 h-3.5" /> Instructions:
                </div>
                <div>&bull; Headers: <code className="text-white">register_number,marks_obtained</code></div>
                <div>&bull; Only students in the selected class section will be accepted</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card title="Marks Spreadsheet Data" subtitle="Paste CSV records below">
            <div className="space-y-4">
              <textarea
                rows={8}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="register_number,marks_obtained&#10;922521104001,45&#10;922521104002,38"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="success"
                  size="md"
                  onClick={handleUpload}
                  isLoading={isUploading}
                  leftIcon={<UploadCloud className="w-4 h-4" />}
                >
                  Submit Assessment Marks
                </Button>
              </div>
            </div>
          </Card>

          {uploadResult && (
            <div
              className={`p-4 rounded-xl border ${
                uploadResult.errors && uploadResult.errors.length > 0
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm mb-1">
                {uploadResult.errors && uploadResult.errors.length > 0 ? (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
                <span>Submission Summary</span>
              </div>
              {uploadResult.success !== undefined && (
                <p className="text-xs">Successfully recorded {uploadResult.success} student scores.</p>
              )}
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="mt-2 text-xs space-y-1">
                  <span className="font-semibold">Errors Encountered:</span>
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
