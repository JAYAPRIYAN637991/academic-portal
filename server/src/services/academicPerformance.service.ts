/**
 * Academic Performance Calculation Engine
 * 
 * Single source of truth for all academic evaluation calculations on the backend.
 * Provides pure, reusable calculation functions and database querying helpers.
 */

import { prisma } from '../db';

export type PerformanceLevel = 'Excellent' | 'Very Good' | 'Good' | 'Average' | 'Needs Attention';
export type ComparisonStatus = 'IMPROVED' | 'DECLINED' | 'NO_CHANGE' | 'MISSING_DATA';

export interface ImprovementResult {
  improvement: number | null;
  decline: number | null;
  status: ComparisonStatus;
  difference: number | null;
  reason?: string;
}

export interface MarkItem {
  id?: string;
  studentId?: string;
  subjectId: string;
  subjectCode?: string;
  subjectName?: string;
  assessmentId?: string;
  assessmentCode?: string; // e.g., 'IA-1', 'IA-2', 'IA-3', 'MODEL', 'SEMESTER'
  assessmentName?: string;
  marksObtained: number;
  maximumMarks: number;
}

export interface AssessmentScore {
  obtained: number | null;
  maximum: number | null;
  percentage: number | null;
  level: PerformanceLevel | null;
}

export interface SubjectPerformance {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  ia1: AssessmentScore;
  ia2: AssessmentScore;
  difference: number | null;
  improvement: number | null;
  decline: number | null;
  status: ComparisonStatus;
  totalObtained: number;
  totalMaximum: number;
  overallPercentage: number;
  overallLevel: PerformanceLevel;
  otherAssessments: Array<{
    assessmentCode: string;
    assessmentName: string;
    obtained: number;
    maximum: number;
    percentage: number;
    level: PerformanceLevel;
  }>;
}

export interface StudentPerformanceReport {
  studentId?: string;
  registerNumber?: string;
  studentName?: string;
  studentTotal: number;
  maximumTotal: number;
  percentage: number;
  performanceStatus: PerformanceLevel;
  
  ia1Total: number | null;
  ia1MaxTotal: number | null;
  ia1Percentage: number | null;
  ia1Level: PerformanceLevel | null;

  ia2Total: number | null;
  ia2MaxTotal: number | null;
  ia2Percentage: number | null;
  ia2Level: PerformanceLevel | null;

  improvement: number | null;
  decline: number | null;
  progressionStatus: ComparisonStatus;

  subjectBreakdown: SubjectPerformance[];

  // Edge case diagnostic flags
  isMissingIA1: boolean;
  isMissingIA2: boolean;
  hasMarks: boolean;
  hasPartialMarks: boolean;
  evaluatedSubjectsCount: number;
  totalSubjectsCount: number;

  // Placement & Timeline metadata
  departmentCode?: string;
  departmentName?: string;
  yearName?: string;
  sectionName?: string;
  academicYearName?: string;
  assessmentTimeline?: Array<{
    assessmentId: string;
    code: string;
    name: string;
    obtained: number;
    maximum: number;
    percentage: number;
    level: PerformanceLevel;
  }>;
}

export interface ClassPerformanceSummary {
  sectionId?: string;
  sectionName?: string;
  totalStudents: number;
  assessedStudents: number;
  unassessedStudents: number;
  classAveragePercentage: number;
  ia1AveragePercentage: number | null;
  ia2AveragePercentage: number | null;
  classImprovement: number | null;
  classProgressionStatus: ComparisonStatus;
  levelDistribution: {
    excellent: { count: number; percentage: number };
    veryGood: { count: number; percentage: number };
    good: { count: number; percentage: number };
    average: { count: number; percentage: number };
    needsAttention: { count: number; percentage: number };
  };
  progressionDistribution: {
    improved: { count: number; percentage: number };
    declined: { count: number; percentage: number };
    noChange: { count: number; percentage: number };
    missingData: { count: number; percentage: number };
  };
  subjectSummary: Array<{
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    averagePercentage: number;
    ia1AveragePercentage: number | null;
    ia2AveragePercentage: number | null;
    improvement: number | null;
    status: ComparisonStatus;
  }>;
  studentReports: StudentPerformanceReport[];
}

export class AcademicPerformanceService {
  /**
   * Helper to round numbers cleanly to 2 decimal places.
   */
  static round2(val: number): number {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Formula: percentage = (obtained marks / maximum marks) * 100
   * Handles zero or negative maximum marks safely (division by zero protection).
   */
  static calculatePercentage(obtained: number, maximum: number): number {
    if (isNaN(obtained) || isNaN(maximum) || maximum <= 0) {
      return 0;
    }
    // Prevent negative obtained marks skewing percentage
    const validObtained = Math.max(0, obtained);
    const rawPct = (validObtained / maximum) * 100;
    return this.round2(rawPct);
  }

  /**
   * Evaluates score against the 5-tier institutional performance scale:
   * 90-100 -> Excellent
   * 80-89 -> Very Good
   * 70-79 -> Good
   * 60-69 -> Average
   * Below 60 -> Needs Attention
   */
  static getPerformanceLevel(percentage: number | null | undefined): PerformanceLevel {
    if (percentage === null || percentage === undefined || isNaN(percentage)) {
      return 'Needs Attention';
    }
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 80) return 'Very Good';
    if (percentage >= 70) return 'Good';
    if (percentage >= 60) return 'Average';
    return 'Needs Attention';
  }

  /**
   * Improvement: IA-2 percentage - IA-1 percentage
   * 
   * Status:
   * IA-2 > IA-1 -> IMPROVED
   * IA-2 < IA-1 -> DECLINED
   * IA-2 = IA-1 -> NO_CHANGE
   * 
   * Handles missing IA-1 and missing IA-2 gracefully.
   */
  static calculateImprovement(
    ia1Pct: number | null | undefined,
    ia2Pct: number | null | undefined
  ): ImprovementResult {
    const isIa1Missing = ia1Pct === null || ia1Pct === undefined || isNaN(ia1Pct);
    const isIa2Missing = ia2Pct === null || ia2Pct === undefined || isNaN(ia2Pct);

    if (isIa1Missing || isIa2Missing) {
      return {
        improvement: null,
        decline: null,
        status: 'MISSING_DATA',
        difference: null,
        reason: isIa1Missing && isIa2Missing
          ? 'Both IA-1 and IA-2 marks are missing'
          : isIa1Missing
            ? 'IA-1 marks are missing'
            : 'IA-2 marks are missing'
      };
    }

    const diff = this.round2(ia2Pct - ia1Pct);

    if (diff > 0) {
      return {
        improvement: diff,
        decline: 0,
        status: 'IMPROVED',
        difference: diff
      };
    } else if (diff < 0) {
      return {
        improvement: diff,
        decline: this.round2(Math.abs(diff)),
        status: 'DECLINED',
        difference: diff
      };
    } else {
      return {
        improvement: 0,
        decline: 0,
        status: 'NO_CHANGE',
        difference: 0
      };
    }
  }

  /**
   * Helper to normalize assessment code for comparison.
   * Matches "IA-1", "IA1", "Internal Assessment 1", etc.
   */
  static isAssessment(assessmentCodeOrName: string | undefined | null, target: 'IA-1' | 'IA-2'): boolean {
    if (!assessmentCodeOrName) return false;
    const clean = assessmentCodeOrName.toUpperCase().replace(/[\s\-_]/g, '');
    if (target === 'IA-1') {
      return clean === 'IA1' || clean === 'INTERNALASSESSMENT1' || clean.startsWith('IA1');
    }
    if (target === 'IA-2') {
      return clean === 'IA2' || clean === 'INTERNALASSESSMENT2' || clean.startsWith('IA2');
    }
    return false;
  }

  /**
   * Calculates detailed performance metrics for an individual student.
   * 
   * Handles:
   * - missing IA-1
   * - missing IA-2
   * - no marks
   * - partial marks
   * - different maximum marks
   * - zero maximum marks
   */
  static calculateStudentPerformance(
    marks: MarkItem[],
    options?: {
      studentId?: string;
      registerNumber?: string;
      studentName?: string;
      expectedSubjectIds?: string[];
      subjectsMap?: Map<string, { id: string; name: string; code: string; maximumMarks?: number }>;
    }
  ): StudentPerformanceReport {
    const studentId = options?.studentId;
    const registerNumber = options?.registerNumber;
    const studentName = options?.studentName;

    if (!marks || marks.length === 0) {
      return {
        studentId,
        registerNumber,
        studentName,
        studentTotal: 0,
        maximumTotal: 0,
        percentage: 0,
        performanceStatus: 'Needs Attention',
        ia1Total: null,
        ia1MaxTotal: null,
        ia1Percentage: null,
        ia1Level: null,
        ia2Total: null,
        ia2MaxTotal: null,
        ia2Percentage: null,
        ia2Level: null,
        improvement: null,
        decline: null,
        progressionStatus: 'MISSING_DATA',
        subjectBreakdown: [],
        isMissingIA1: true,
        isMissingIA2: true,
        hasMarks: false,
        hasPartialMarks: false,
        evaluatedSubjectsCount: 0,
        totalSubjectsCount: options?.expectedSubjectIds?.length || 0
      };
    }

    // Group marks by subject
    const subjectMarksMap = new Map<string, MarkItem[]>();
    for (const mark of marks) {
      const list = subjectMarksMap.get(mark.subjectId) || [];
      list.push(mark);
      subjectMarksMap.set(mark.subjectId, list);
    }

    // Totals accumulation across all subjects and assessments
    let studentTotal = 0;
    let maximumTotal = 0;

    let ia1Total = 0;
    let ia1MaxTotal = 0;
    let hasIa1Entries = false;

    let ia2Total = 0;
    let ia2MaxTotal = 0;
    let hasIa2Entries = false;

    // Process Subject-wise Breakdown
    const subjectBreakdown: SubjectPerformance[] = [];

    // Collect all subject IDs (from marks and from expected subjects if provided)
    const allSubjectIds = new Set<string>([
      ...Array.from(subjectMarksMap.keys()),
      ...(options?.expectedSubjectIds || [])
    ]);

    for (const subId of allSubjectIds) {
      const subMarks = subjectMarksMap.get(subId) || [];
      const meta = options?.subjectsMap?.get(subId);

      const firstMarkWithMeta = subMarks.find(m => m.subjectName || m.subjectCode);
      const subjectCode = meta?.code || firstMarkWithMeta?.subjectCode || subId;
      const subjectName = meta?.name || firstMarkWithMeta?.subjectName || `Subject ${subjectCode}`;

      let subTotalObtained = 0;
      let subTotalMax = 0;

      let subIa1Obtained: number | null = null;
      let subIa1Max: number | null = null;
      let subIa2Obtained: number | null = null;
      let subIa2Max: number | null = null;

      const otherAssessments: SubjectPerformance['otherAssessments'] = [];

      for (const m of subMarks) {
        const markVal = Math.max(0, m.marksObtained || 0);
        const maxVal = Math.max(0, m.maximumMarks || 0);

        subTotalObtained += markVal;
        subTotalMax += maxVal;

        studentTotal += markVal;
        maximumTotal += maxVal;

        const isIa1 = this.isAssessment(m.assessmentCode, 'IA-1') || this.isAssessment(m.assessmentName, 'IA-1');
        const isIa2 = this.isAssessment(m.assessmentCode, 'IA-2') || this.isAssessment(m.assessmentName, 'IA-2');

        if (isIa1) {
          subIa1Obtained = markVal;
          subIa1Max = maxVal;
          ia1Total += markVal;
          ia1MaxTotal += maxVal;
          hasIa1Entries = true;
        } else if (isIa2) {
          subIa2Obtained = markVal;
          subIa2Max = maxVal;
          ia2Total += markVal;
          ia2MaxTotal += maxVal;
          hasIa2Entries = true;
        } else {
          const pct = this.calculatePercentage(markVal, maxVal);
          otherAssessments.push({
            assessmentCode: m.assessmentCode || 'ASSESSMENT',
            assessmentName: m.assessmentName || m.assessmentCode || 'Assessment',
            obtained: markVal,
            maximum: maxVal,
            percentage: pct,
            level: this.getPerformanceLevel(pct)
          });
        }
      }

      // Subject IA-1 Score
      const ia1Pct = (subIa1Obtained !== null && subIa1Max !== null)
        ? this.calculatePercentage(subIa1Obtained, subIa1Max)
        : null;

      // Subject IA-2 Score
      const ia2Pct = (subIa2Obtained !== null && subIa2Max !== null)
        ? this.calculatePercentage(subIa2Obtained, subIa2Max)
        : null;

      // Subject Improvement / Decline / Status
      const subProgression = this.calculateImprovement(ia1Pct, ia2Pct);
      const subOverallPct = this.calculatePercentage(subTotalObtained, subTotalMax);

      subjectBreakdown.push({
        subjectId: subId,
        subjectCode,
        subjectName,
        ia1: {
          obtained: subIa1Obtained,
          maximum: subIa1Max,
          percentage: ia1Pct,
          level: ia1Pct !== null ? this.getPerformanceLevel(ia1Pct) : null
        },
        ia2: {
          obtained: subIa2Obtained,
          maximum: subIa2Max,
          percentage: ia2Pct,
          level: ia2Pct !== null ? this.getPerformanceLevel(ia2Pct) : null
        },
        difference: subProgression.difference,
        improvement: subProgression.improvement,
        decline: subProgression.decline,
        status: subProgression.status,
        totalObtained: this.round2(subTotalObtained),
        totalMaximum: this.round2(subTotalMax),
        overallPercentage: subOverallPct,
        overallLevel: this.getPerformanceLevel(subOverallPct),
        otherAssessments
      });
    }

    // Sort subjects by code for determinism
    subjectBreakdown.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));

    // Overall Percentage & Level
    const overallPercentage = this.calculatePercentage(studentTotal, maximumTotal);
    const performanceStatus = this.getPerformanceLevel(overallPercentage);

    // IA-1 Overall Percentage & Level
    const ia1Percentage = hasIa1Entries
      ? this.calculatePercentage(ia1Total, ia1MaxTotal)
      : null;
    const ia1Level = ia1Percentage !== null ? this.getPerformanceLevel(ia1Percentage) : null;

    // IA-2 Overall Percentage & Level
    const ia2Percentage = hasIa2Entries
      ? this.calculatePercentage(ia2Total, ia2MaxTotal)
      : null;
    const ia2Level = ia2Percentage !== null ? this.getPerformanceLevel(ia2Percentage) : null;

    // Overall Improvement & Progression Status
    const overallProgression = this.calculateImprovement(ia1Percentage, ia2Percentage);

    // Partial marks detection
    const evaluatedSubjectsCount = subjectMarksMap.size;
    const totalSubjectsCount = options?.expectedSubjectIds?.length || evaluatedSubjectsCount;
    const hasPartialMarks = evaluatedSubjectsCount < totalSubjectsCount;

    return {
      studentId,
      registerNumber,
      studentName,
      studentTotal: this.round2(studentTotal),
      maximumTotal: this.round2(maximumTotal),
      percentage: overallPercentage,
      performanceStatus,
      ia1Total: hasIa1Entries ? this.round2(ia1Total) : null,
      ia1MaxTotal: hasIa1Entries ? this.round2(ia1MaxTotal) : null,
      ia1Percentage,
      ia1Level,
      ia2Total: hasIa2Entries ? this.round2(ia2Total) : null,
      ia2MaxTotal: hasIa2Entries ? this.round2(ia2MaxTotal) : null,
      ia2Percentage,
      ia2Level,
      improvement: overallProgression.improvement,
      decline: overallProgression.decline,
      progressionStatus: overallProgression.status,
      subjectBreakdown,
      isMissingIA1: !hasIa1Entries,
      isMissingIA2: !hasIa2Entries,
      hasMarks: marks.length > 0,
      hasPartialMarks,
      evaluatedSubjectsCount,
      totalSubjectsCount
    };
  }

  /**
   * Aggregates and calculates academic performance across an entire class or section.
   */
  static calculateClassPerformance(
    studentsWithMarks: Array<{
      studentId: string;
      registerNumber: string;
      studentName: string;
      marks: MarkItem[];
    }>,
    options?: {
      sectionId?: string;
      sectionName?: string;
      expectedSubjectIds?: string[];
      subjectsMap?: Map<string, { id: string; name: string; code: string; maximumMarks?: number }>;
    }
  ): ClassPerformanceSummary {
    const totalStudents = studentsWithMarks.length;
    let assessedStudents = 0;
    let unassessedStudents = 0;

    let classTotalPct = 0;
    let classIa1TotalPct = 0;
    let ia1AssessedCount = 0;
    let classIa2TotalPct = 0;
    let ia2AssessedCount = 0;

    const levelCount = {
      excellent: 0,
      veryGood: 0,
      good: 0,
      average: 0,
      needsAttention: 0
    };

    const statusCount = {
      improved: 0,
      declined: 0,
      noChange: 0,
      missingData: 0
    };

    const studentReports: StudentPerformanceReport[] = [];
    const subjectStatsMap = new Map<string, {
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      totalPctSum: number;
      pctCount: number;
      ia1PctSum: number;
      ia1Count: number;
      ia2PctSum: number;
      ia2Count: number;
    }>();

    for (const item of studentsWithMarks) {
      const report = this.calculateStudentPerformance(item.marks, {
        studentId: item.studentId,
        registerNumber: item.registerNumber,
        studentName: item.studentName,
        expectedSubjectIds: options?.expectedSubjectIds,
        subjectsMap: options?.subjectsMap
      });
      studentReports.push(report);

      if (report.hasMarks) {
        assessedStudents++;
        classTotalPct += report.percentage;

        if (report.ia1Percentage !== null) {
          classIa1TotalPct += report.ia1Percentage;
          ia1AssessedCount++;
        }

        if (report.ia2Percentage !== null) {
          classIa2TotalPct += report.ia2Percentage;
          ia2AssessedCount++;
        }

        // Tally Level
        switch (report.performanceStatus) {
          case 'Excellent': levelCount.excellent++; break;
          case 'Very Good': levelCount.veryGood++; break;
          case 'Good': levelCount.good++; break;
          case 'Average': levelCount.average++; break;
          case 'Needs Attention': levelCount.needsAttention++; break;
        }

        // Tally Progression Status
        switch (report.progressionStatus) {
          case 'IMPROVED': statusCount.improved++; break;
          case 'DECLINED': statusCount.declined++; break;
          case 'NO_CHANGE': statusCount.noChange++; break;
          case 'MISSING_DATA': statusCount.missingData++; break;
        }

        // Tally Subject Breakdown
        for (const sub of report.subjectBreakdown) {
          let stat = subjectStatsMap.get(sub.subjectId);
          if (!stat) {
            stat = {
              subjectId: sub.subjectId,
              subjectCode: sub.subjectCode,
              subjectName: sub.subjectName,
              totalPctSum: 0,
              pctCount: 0,
              ia1PctSum: 0,
              ia1Count: 0,
              ia2PctSum: 0,
              ia2Count: 0
            };
            subjectStatsMap.set(sub.subjectId, stat);
          }
          if (sub.totalMaximum > 0) {
            stat.totalPctSum += sub.overallPercentage;
            stat.pctCount++;
          }
          if (sub.ia1.percentage !== null) {
            stat.ia1PctSum += sub.ia1.percentage;
            stat.ia1Count++;
          }
          if (sub.ia2.percentage !== null) {
            stat.ia2PctSum += sub.ia2.percentage;
            stat.ia2Count++;
          }
        }
      } else {
        unassessedStudents++;
        levelCount.needsAttention++;
        statusCount.missingData++;
      }
    }

    // Sort student reports descending by percentage
    studentReports.sort((a, b) => b.percentage - a.percentage);

    const classAveragePercentage = assessedStudents > 0
      ? this.round2(classTotalPct / assessedStudents)
      : 0;

    const ia1AveragePercentage = ia1AssessedCount > 0
      ? this.round2(classIa1TotalPct / ia1AssessedCount)
      : null;

    const ia2AveragePercentage = ia2AssessedCount > 0
      ? this.round2(classIa2TotalPct / ia2AssessedCount)
      : null;

    const classProgression = this.calculateImprovement(ia1AveragePercentage, ia2AveragePercentage);

    // Format Subject Summary
    const subjectSummary = Array.from(subjectStatsMap.values()).map(s => {
      const avgPct = s.pctCount > 0 ? this.round2(s.totalPctSum / s.pctCount) : 0;
      const ia1Avg = s.ia1Count > 0 ? this.round2(s.ia1PctSum / s.ia1Count) : null;
      const ia2Avg = s.ia2Count > 0 ? this.round2(s.ia2PctSum / s.ia2Count) : null;
      const imp = this.calculateImprovement(ia1Avg, ia2Avg);
      return {
        subjectId: s.subjectId,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        averagePercentage: avgPct,
        ia1AveragePercentage: ia1Avg,
        ia2AveragePercentage: ia2Avg,
        improvement: imp.improvement,
        status: imp.status
      };
    });

    const toPct = (count: number) => totalStudents > 0 ? this.round2((count / totalStudents) * 100) : 0;

    return {
      sectionId: options?.sectionId,
      sectionName: options?.sectionName,
      totalStudents,
      assessedStudents,
      unassessedStudents,
      classAveragePercentage,
      ia1AveragePercentage,
      ia2AveragePercentage,
      classImprovement: classProgression.improvement,
      classProgressionStatus: classProgression.status,
      levelDistribution: {
        excellent: { count: levelCount.excellent, percentage: toPct(levelCount.excellent) },
        veryGood: { count: levelCount.veryGood, percentage: toPct(levelCount.veryGood) },
        good: { count: levelCount.good, percentage: toPct(levelCount.good) },
        average: { count: levelCount.average, percentage: toPct(levelCount.average) },
        needsAttention: { count: levelCount.needsAttention, percentage: toPct(levelCount.needsAttention) }
      },
      progressionDistribution: {
        improved: { count: statusCount.improved, percentage: toPct(statusCount.improved) },
        declined: { count: statusCount.declined, percentage: toPct(statusCount.declined) },
        noChange: { count: statusCount.noChange, percentage: toPct(statusCount.noChange) },
        missingData: { count: statusCount.missingData, percentage: toPct(statusCount.missingData) }
      },
      subjectSummary,
      studentReports
    };
  }

  // ---------------------------------------------------------------------------
  // DATABASE INTEGRATION METHODS
  // ---------------------------------------------------------------------------

  /**
   * Fetches data from database and calculates performance report for a single student.
   */
  static async getStudentPerformanceFromDb(studentId: string): Promise<StudentPerformanceReport | null> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        academicYear: true,
        department: true,
        year: true,
        section: true,
        marks: {
          include: {
            subject: true,
            assessment: true
          }
        }
      }
    });

    if (!student) return null;

    // Fetch subjects for this student's year and department
    const subjects = await prisma.subject.findMany({
      where: {
        departmentId: student.departmentId,
        yearId: student.yearId,
        isActive: true
      }
    });

    const subjectsMap = new Map<string, { id: string; name: string; code: string; maximumMarks?: number }>();
    subjects.forEach(s => subjectsMap.set(s.id, s));

    const markItems: MarkItem[] = student.marks.map(m => ({
      id: m.id,
      studentId: m.studentId,
      subjectId: m.subjectId,
      subjectCode: m.subject.code,
      subjectName: m.subject.name,
      assessmentId: m.assessmentId,
      assessmentCode: m.assessment.code,
      assessmentName: m.assessment.name,
      marksObtained: m.marksObtained,
      maximumMarks: m.maximumMarks
    }));

    const report = this.calculateStudentPerformance(markItems, {
      studentId: student.id,
      registerNumber: student.registerNumber,
      studentName: student.name,
      expectedSubjectIds: subjects.map(s => s.id),
      subjectsMap
    });

    // Compute chronological assessment timeline for Recharts Performance Trend
    const assessmentMap = new Map<string, {
      assessmentId: string;
      code: string;
      name: string;
      obtained: number;
      maximum: number;
      createdAt: Date;
    }>();

    for (const m of student.marks) {
      const code = m.assessment.code;
      const existing = assessmentMap.get(code) || {
        assessmentId: m.assessmentId,
        code,
        name: m.assessment.name,
        obtained: 0,
        maximum: 0,
        createdAt: m.assessment.createdAt
      };
      existing.obtained += m.marksObtained;
      existing.maximum += m.maximumMarks;
      assessmentMap.set(code, existing);
    }

    const assessmentTimeline = Array.from(assessmentMap.values()).map(a => {
      const pct = this.calculatePercentage(a.obtained, a.maximum);
      return {
        assessmentId: a.assessmentId,
        code: a.code,
        name: a.name,
        obtained: this.round2(a.obtained),
        maximum: this.round2(a.maximum),
        percentage: pct,
        level: this.getPerformanceLevel(pct)
      };
    });

    const codeOrder = ['IA-1', 'IA-2', 'IA-3', 'MODEL', 'SEMESTER'];
    assessmentTimeline.sort((a, b) => {
      const idxA = codeOrder.indexOf(a.code.toUpperCase());
      const idxB = codeOrder.indexOf(b.code.toUpperCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.code.localeCompare(b.code);
    });

    return {
      ...report,
      departmentCode: student.department.code,
      departmentName: student.department.name,
      yearName: student.year.name,
      sectionName: student.section.name,
      academicYearName: student.academicYear.yearName,
      assessmentTimeline
    };
  }

  /**
   * Fetches data from database and calculates class performance summary for a section.
   */
  static async getSectionPerformanceFromDb(
    sectionId: string,
    subjectId?: string
  ): Promise<ClassPerformanceSummary | null> {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        department: true,
        year: true,
        academicYear: true
      }
    });

    if (!section) return null;

    // Fetch all active students in this section
    const students = await prisma.student.findMany({
      where: {
        sectionId,
        status: 'ACTIVE'
      },
      include: {
        marks: {
          where: subjectId ? { subjectId } : undefined,
          include: {
            subject: true,
            assessment: true
          }
        }
      },
      orderBy: { registerNumber: 'asc' }
    });

    // Fetch relevant subjects
    const subjects = await prisma.subject.findMany({
      where: {
        departmentId: section.departmentId,
        yearId: section.yearId,
        isActive: true,
        ...(subjectId ? { id: subjectId } : {})
      }
    });

    const subjectsMap = new Map<string, { id: string; name: string; code: string; maximumMarks?: number }>();
    subjects.forEach(s => subjectsMap.set(s.id, s));

    const studentsData = students.map(s => ({
      studentId: s.id,
      registerNumber: s.registerNumber,
      studentName: s.name,
      marks: s.marks.map(m => ({
        id: m.id,
        studentId: m.studentId,
        subjectId: m.subjectId,
        subjectCode: m.subject.code,
        subjectName: m.subject.name,
        assessmentId: m.assessmentId,
        assessmentCode: m.assessment.code,
        assessmentName: m.assessment.name,
        marksObtained: m.marksObtained,
        maximumMarks: m.maximumMarks
      }))
    }));

    return this.calculateClassPerformance(studentsData, {
      sectionId: section.id,
      sectionName: `${section.department.code} - ${section.year.name} (${section.name})`,
      expectedSubjectIds: subjects.map(s => s.id),
      subjectsMap
    });
  }

  /**
   * Generates and persists PerformanceSnapshots in the database for a specific assessment.
   */
  static async generateAndSaveAssessmentSnapshots(
    assessmentId: string,
    sectionId?: string
  ): Promise<{ createdCount: number; updatedCount: number }> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId }
    });

    if (!assessment) {
      throw new Error(`Assessment ${assessmentId} not found`);
    }

    // Determine target students
    const students = await prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        ...(sectionId ? { sectionId } : {})
      },
      include: {
        marks: {
          include: {
            assessment: true,
            subject: true
          }
        }
      }
    });

    let createdCount = 0;
    let updatedCount = 0;

    for (const student of students) {
      // Find marks for this specific assessment
      const currentAssessmentMarks = student.marks.filter(m => m.assessmentId === assessmentId);
      if (currentAssessmentMarks.length === 0) continue;

      let totalObtained = 0;
      let maximumTotal = 0;
      for (const m of currentAssessmentMarks) {
        totalObtained += m.marksObtained;
        maximumTotal += m.maximumMarks;
      }

      const percentage = this.calculatePercentage(totalObtained, maximumTotal);
      const performanceStatus = this.getPerformanceLevel(percentage);

      // Check if there was an earlier assessment (e.g. if current is IA-2, check IA-1)
      let previousPercentage: number | null = null;
      let improvementPercentage: number | null = null;

      if (this.isAssessment(assessment.code, 'IA-2')) {
        const ia1Marks = student.marks.filter(m => this.isAssessment(m.assessment.code, 'IA-1'));
        if (ia1Marks.length > 0) {
          let ia1Obtained = 0;
          let ia1Max = 0;
          ia1Marks.forEach(m => {
            ia1Obtained += m.marksObtained;
            ia1Max += m.maximumMarks;
          });
          previousPercentage = this.calculatePercentage(ia1Obtained, ia1Max);
          improvementPercentage = this.round2(percentage - previousPercentage);
        }
      }

      // Upsert snapshot
      const existing = await prisma.performanceSnapshot.findUnique({
        where: {
          studentId_assessmentId: {
            studentId: student.id,
            assessmentId
          }
        }
      });

      if (existing) {
        await prisma.performanceSnapshot.update({
          where: { id: existing.id },
          data: {
            total: this.round2(totalObtained),
            maximumTotal: this.round2(maximumTotal),
            percentage,
            previousPercentage,
            improvementPercentage,
            performanceStatus
          }
        });
        updatedCount++;
      } else {
        await prisma.performanceSnapshot.create({
          data: {
            studentId: student.id,
            assessmentId,
            total: this.round2(totalObtained),
            maximumTotal: this.round2(maximumTotal),
            percentage,
            previousPercentage,
            improvementPercentage,
            performanceStatus
          }
        });
        createdCount++;
      }
    }

    return { createdCount, updatedCount };
  }

  /**
   * Fetches and computes performance metrics for students matching dynamic filters:
   * Academic Year, Department, Year, Section, Student, Assessment, and Search.
   */
  static async getFilteredStudentsPerformance(filters: {
    academicYearId?: string;
    departmentId?: string;
    yearId?: string;
    sectionId?: string;
    studentId?: string;
    assessmentId?: string;
    search?: string;
  }) {
    const whereClause: any = {
      status: 'ACTIVE'
    };

    if (filters.academicYearId) whereClause.academicYearId = filters.academicYearId;
    if (filters.departmentId) whereClause.departmentId = filters.departmentId;
    if (filters.yearId) whereClause.yearId = filters.yearId;
    if (filters.sectionId) whereClause.sectionId = filters.sectionId;
    if (filters.studentId) whereClause.id = filters.studentId;

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { registerNumber: { contains: q, mode: 'insensitive' } }
      ];
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        academicYear: true,
        department: true,
        year: true,
        section: true,
        marks: {
          where: filters.assessmentId ? { assessmentId: filters.assessmentId } : undefined,
          include: {
            subject: true,
            assessment: true
          }
        }
      },
      orderBy: { registerNumber: 'asc' }
    });

    // Fetch relevant subjects
    const subjects = await prisma.subject.findMany({
      where: {
        isActive: true,
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.yearId ? { yearId: filters.yearId } : {})
      }
    });

    const subjectsMap = new Map<string, { id: string; name: string; code: string; maximumMarks?: number }>();
    subjects.forEach(s => subjectsMap.set(s.id, s));

    const studentsData = students.map(s => ({
      studentId: s.id,
      registerNumber: s.registerNumber,
      studentName: s.name,
      departmentCode: s.department.code,
      departmentName: s.department.name,
      yearName: s.year.name,
      sectionName: s.section.name,
      academicYearName: s.academicYear.yearName,
      marks: s.marks.map(m => ({
        id: m.id,
        studentId: m.studentId,
        subjectId: m.subjectId,
        subjectCode: m.subject.code,
        subjectName: m.subject.name,
        assessmentId: m.assessmentId,
        assessmentCode: m.assessment.code,
        assessmentName: m.assessment.name,
        marksObtained: m.marksObtained,
        maximumMarks: m.maximumMarks
      }))
    }));

    // Calculate class / cohort performance summary
    const summary = this.calculateClassPerformance(studentsData, {
      expectedSubjectIds: subjects.map(s => s.id),
      subjectsMap
    });

    // Enrich individual reports with placement details
    const enrichedReports = summary.studentReports.map(rep => {
      const orig = studentsData.find(s => s.studentId === rep.studentId);
      return {
        ...rep,
        departmentCode: orig?.departmentCode || '',
        departmentName: orig?.departmentName || '',
        yearName: orig?.yearName || '',
        sectionName: orig?.sectionName || '',
        academicYearName: orig?.academicYearName || ''
      };
    });

    return {
      summary: {
        ...summary,
        studentReports: enrichedReports
      },
      students: enrichedReports,
      subjects: summary.subjectSummary,
      totalCount: students.length
    };
  }
}
