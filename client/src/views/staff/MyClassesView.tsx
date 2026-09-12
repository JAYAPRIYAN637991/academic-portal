import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { DataTable, Column } from '../../components/data/DataTable';
import { Layers, Users, Phone, Eye } from 'lucide-react';

interface AssignedClass {
  id: number;
  department: string;
  year: number;
  section: string;
  student_count: number;
}

interface StudentItem {
  id: number;
  register_number: string;
  roll_number: string;
  name: string;
  parent_name?: string;
  parent_phone?: string;
}

export const MyClassesView: React.FC = () => {
  const [classes, setClasses] = useState<AssignedClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Class Roster Modal
  const [selectedClass, setSelectedClass] = useState<AssignedClass | null>(null);
  const [roster, setRoster] = useState<StudentItem[]>([]);
  const [isRosterLoading, setIsRosterLoading] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      setIsLoading(true);
      try {
        const res: any = await api.get('/staff/classes');
        setClasses(Array.isArray(res) ? res : res?.classes || []);
      } catch (err) {
        console.error('Failed to load assigned classes', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClasses();
  }, []);

  const handleViewRoster = async (cls: AssignedClass) => {
    setSelectedClass(cls);
    setIsRosterLoading(true);
    try {
      const res: any = await api.get(`/staff/classes/${cls.id}/students`);
      setRoster(Array.isArray(res) ? res : res?.students || []);
    } catch (err) {
      console.warn('Roster fetch error', err);
      setRoster([]);
    } finally {
      setIsRosterLoading(false);
    }
  };

  const studentColumns: Column<StudentItem>[] = [
    {
      header: 'Register No.',
      accessor: (row) => <span className="font-mono text-xs font-bold text-indigo-400">{row.register_number}</span>,
    },
    {
      header: 'Student Name',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-white block">{row.name}</span>
          <span className="text-[11px] text-slate-400">Roll: {row.roll_number}</span>
        </div>
      ),
    },
    {
      header: 'Parent Contact',
      accessor: (row) => (
        <div className="text-xs">
          <span className="text-slate-200 block">{row.parent_name || 'Parent'}</span>
          {row.parent_phone && (
            <span className="text-emerald-400 text-[11px] font-mono flex items-center gap-1">
              <Phone className="w-3 h-3" /> {row.parent_phone}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">My Assigned Classes</h2>
        <p className="text-xs text-slate-400">
          Batches and class sections allocated for your subject evaluations this academic term
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => (
          <Card key={cls.id} className="relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                <Layers className="w-5 h-5" />
              </div>
              <Badge variant="success">Assigned</Badge>
            </div>

            <h3 className="font-bold text-lg text-white mb-0.5">
              {cls.department} - Year {cls.year}
            </h3>
            <div className="text-xs text-slate-300 font-medium mb-4">
              Section {cls.section} &bull; Academic Term 2026-2027
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>{cls.student_count || 60} Students</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewRoster(cls)}
                leftIcon={<Eye className="w-3.5 h-3.5" />}
              >
                View Roster
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Roster Modal */}
      <Modal
        isOpen={!!selectedClass}
        onClose={() => setSelectedClass(null)}
        title={`Class Roster: ${selectedClass?.department} - Year ${selectedClass?.year} (${selectedClass?.section})`}
        subtitle={`${roster.length} registered students in this section`}
        maxWidth="lg"
      >
        <DataTable
          columns={studentColumns}
          data={roster}
          isLoading={isRosterLoading}
          keyExtractor={(s) => s.id}
          emptyTitle="No Students"
          emptyDescription="No students enrolled in this section."
        />
      </Modal>
    </div>
  );
};
