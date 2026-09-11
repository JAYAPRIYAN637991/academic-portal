import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { BookOpen, UploadCloud, GraduationCap } from 'lucide-react';

interface AssignedSubject {
  id: number;
  code: string;
  name: string;
  department: string;
  year: number;
  semester: number;
}

interface MySubjectsViewProps {
  onNavigateToUpload: () => void;
}

export const MySubjectsView: React.FC<MySubjectsViewProps> = ({ onNavigateToUpload }) => {
  const [subjects, setSubjects] = useState<AssignedSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubjects = async () => {
      setIsLoading(true);
      try {
        const res: any = await api.get('/staff/subjects');
        setSubjects(Array.isArray(res) ? res : res?.subjects || []);
      } catch (err) {
        console.error('Failed to load assigned subjects', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">My Assigned Subjects</h2>
          <p className="text-xs text-slate-400">
            Curriculum syllabi assigned to your academic profile for evaluation and mark submission
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((sb) => (
          <Card key={sb.id} className="relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-indigo-950/80 text-indigo-400 border border-indigo-800/50">
                <BookOpen className="w-5 h-5" />
              </div>
              <Badge variant="primary">Sem {sb.semester}</Badge>
            </div>

            <span className="font-mono text-xs font-bold text-indigo-300 block mb-1">
              {sb.code}
            </span>
            <h3 className="font-bold text-base text-white mb-2 line-clamp-2">
              {sb.name}
            </h3>

            <div className="text-xs text-slate-400 mb-4">
              {sb.department} &bull; Year {sb.year} (Regulation 2021)
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Anna University Core</span>
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToUpload}
                leftIcon={<UploadCloud className="w-3.5 h-3.5 text-emerald-400" />}
              >
                Upload Marks
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
