import React, { useState } from 'react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileCode,
  CheckCircle,
  Filter,
  Eye,
  ShieldCheck,
  Presentation,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { success, error } = useToast();

  const [reportType, setReportType] = useState<string>('student-performance');
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv' | 'pptx'>('pdf');
  const [department, setDepartment] = useState<string>('ALL');
  const [year, setYear] = useState<string>('ALL');
  const [section, setSection] = useState<string>('ALL');
  const [isGenerating, setIsGenerating] = useState(false);

  const reportOptions = [
    { id: 'student-performance', label: '1. Student Performance Report', desc: 'Detailed individual student scores, IA-1, IA-2, improvement delta & pass %' },
    { id: 'section-performance', label: '2. Section Performance Report', desc: 'Class-section comparative evaluation, averages, and ranking breakdown' },
    { id: 'year-performance', label: '3. Year Performance Report', desc: 'Cohort analytics across 1st, 2nd, 3rd, and 4th year engineering batches' },
    { id: 'department-performance', label: '4. Department Performance Report', desc: 'Departmental faculty performance, pass rates, and academic outcomes' },
    { id: 'overall-college-result', label: '5. Overall College Result Report', desc: 'Institutional consolidated result, Anna University accreditation metrics' },
    { id: 'notification-report', label: '6. Notification Delivery Report', desc: 'Broadcast logs: Recipient counts, SMS count, WhatsApp count, Delivered & Failed' },
    { id: 'college-notice-report', label: '7. College Notice Circulation Report', desc: 'Status of institutional circulars, target audiences, and dispatch logs' },
  ];

  const handleDownload = async (chosenFormat?: 'pdf' | 'excel' | 'csv' | 'pptx') => {
    const fmt = chosenFormat || format;
    setIsGenerating(true);
    try {
      const ext = fmt === 'excel' ? 'xlsx' : fmt;
      const filename = `VSB_${reportType}_${new Date().toISOString().split('T')[0]}.${ext}`;
      await api.download(
        `/reports/generate?type=${reportType}&format=${fmt}&dept=${department}&year=${year}&section=${section}`,
        filename
      );
      success('Report Generated', `Downloaded ${filename} successfully.`);
    } catch (err: any) {
      error('Generation Failed', err.message || 'Error compiling institutional report.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-white">Institutional Reports Generator</h2>
            <Badge variant="primary" size="sm" className="font-bold">
              <ShieldCheck className="w-3 h-3 inline mr-1" /> ADMIN UNRESTRICTED
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Export academic evaluations and parent notification analytics in MS PowerPoint (.pptx), PDF, Excel, and CSV formats
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Report Selector */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Select Report Category" subtitle="Choose from 7 institutional reports">
            <div className="space-y-2">
              {reportOptions.map((opt) => {
                const isSelected = reportType === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setReportType(opt.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">{opt.label}</div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Parameters, Format & Download */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Report Parameters &amp; Format" subtitle="Filter cohort scope and format">
            <div className="space-y-4 text-xs">
              {/* Filter Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Departments</option>
                    <option value="CSE">CSE (Computer Science)</option>
                    <option value="ECE">ECE (Electronics &amp; Comm)</option>
                    <option value="EEE">EEE (Electrical)</option>
                    <option value="MECH">MECH (Mechanical)</option>
                    <option value="IT">IT (Information Tech)</option>
                    <option value="CIVIL">CIVIL (Civil Engg)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">
                    Year Level
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Academic Years</option>
                    <option value="1">Year 1 (Freshman)</option>
                    <option value="2">Year 2 (Sophomore)</option>
                    <option value="3">Year 3 (Junior)</option>
                    <option value="4">Year 4 (Senior)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">
                    Section
                  </label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>
                </div>
              </div>

              {/* Format Buttons */}
              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-2">
                  Select Output File Format
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat('pdf')}
                    className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all ${
                      format === 'pdf'
                        ? 'bg-rose-950/40 border-rose-500 text-rose-200 font-bold shadow-md shadow-rose-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FileText className="w-6 h-6 text-rose-400 mb-1" />
                    <span className="text-xs font-semibold">Adobe PDF</span>
                    <span className="text-[10px] text-slate-500">.pdf Document</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat('excel')}
                    className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all ${
                      format === 'excel'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 font-bold shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FileSpreadsheet className="w-6 h-6 text-emerald-400 mb-1" />
                    <span className="text-xs font-semibold">MS Excel</span>
                    <span className="text-[10px] text-slate-500">.xlsx Spreadsheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat('csv')}
                    className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all ${
                      format === 'csv'
                        ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200 font-bold shadow-md shadow-indigo-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FileCode className="w-6 h-6 text-indigo-400 mb-1" />
                    <span className="text-xs font-semibold">RFC CSV</span>
                    <span className="text-[10px] text-slate-500">.csv Data Table</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat('pptx')}
                    className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all relative overflow-hidden ${
                      format === 'pptx'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200 font-bold shadow-lg shadow-amber-500/15'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="relative mb-1">
                      <Presentation className="w-6 h-6 text-amber-400" />
                      <span className="absolute -top-1.5 -right-3.5 px-1 py-0.2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[8px] font-black rounded-full uppercase tracking-tighter">
                        NEW
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-white">MS PowerPoint</span>
                    <span className="text-[10px] text-amber-400/90 font-medium">.pptx Slide Deck</span>
                  </button>
                </div>
              </div>

              {/* Specification Box */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                <div className="font-bold text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Report Structure &amp; Analysis Output:</span>
                  {format === 'pptx' && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                      16:9 Widescreen Presentation
                    </span>
                  )}
                </div>
                {format === 'pptx' ? (
                  <div className="space-y-1 text-slate-300">
                    <p className="text-amber-200 font-semibold">
                      &bull; Executive Academic Analysis Slide Deck:
                    </p>
                    <p>
                      Slide 1: Institutional Accreditation &amp; Governance Title &bull; Slide 2: Executive KPI Metrics &amp; Analytical Insights &bull; Slide 3+: Paginated Data Breakdown Tables (with status highlights) &bull; Slide 4: Strategic Recommendations &amp; Remedial Action Plan
                    </p>
                  </div>
                ) : reportType === 'notification-report' ? (
                  <p>
                    Notice &bull; Notification category &bull; Recipient count &bull; SMS count &bull; WhatsApp count &bull; Sent &bull; Delivered &bull; Failed
                  </p>
                ) : (
                  <p>
                    College &bull; Academic Year &bull; Department &bull; Year &bull; Section &bull; Student &bull; Register Number &bull; IA-1 &bull; IA-2 &bull; Improvement &bull; Status &bull; Pass percentage
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => handleDownload()}
                  isLoading={isGenerating}
                  leftIcon={<Download className="w-4 h-4" />}
                  className={format === 'pptx' ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20' : undefined}
                >
                  {format === 'pptx'
                    ? 'Export PowerPoint (.pptx) Deck'
                    : `Download ${format.toUpperCase()} Report`}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
