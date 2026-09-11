/**
 * Admin-Only Analytics Service
 * 
 * Provides institutional analytics across all four tiers:
 * 1. Section Analytics
 * 2. Year-wise Analytics
 * 3. Department Analytics
 * 4. Overall College Analytics
 * Plus 6-tier Hierarchical Drilldown:
 * College -> Department -> Year -> Section -> Subject -> Student
 * 
 * Strict access control: Backend is source of truth. ADMIN only.
 */

import { prisma } from '../db';
import { AcademicPerformanceService, StudentPerformanceReport, PerformanceLevel, ComparisonStatus } from './academicPerformance.service';

export interface DepartmentRankingItem {
  rank: number;
  departmentId: string;
  code: string;
  name: string;
  totalStudents: number;
  assessedStudents: number;
  ia1Average: number | null;
  ia2Average: number | null;
  overallAverage: number;
  improvement: number | null;
  passPercentage: number;
}

export interface YearRankingItem {
  rank: number;
  yearId: string;
  yearNumber: number;
  name: string;
  totalStudents: number;
  assessedStudents: number;
  ia1Average: number | null;
  ia2Average: number | null;
  overallAverage: number;
  improvement: number | null;
  passPercentage: number;
}

export interface SectionRankingItem {
  rank: number;
  sectionId: string;
  sectionName: string;
  departmentId: string;
  departmentCode: string;
  yearId: string;
  yearName: string;
  totalStudents: number;
  assessedStudents: number;
  ia1Average: number | null;
  ia2Average: number | null;
  overallAverage: number;
  improvement: number | null;
  passPercentage: number;
  highest: number;
  lowest: number;
}

export interface SubjectPerformanceItem {
  subjectId: string;
  code: string;
  name: string;
  departmentCode: string;
  assessedCount: number;
  averagePercentage: number;
  ia1Average: number | null;
  ia2Average: number | null;
  improvement: number | null;
  passPercentage: number;
}

export interface OverallCollegeAnalyticsResponse {
  scope: string;
  metrics: {
    totalDepartments: number;
    totalStaff: number;
    totalStudents: number;
    totalMarksEntered: number;
    averageScore: number;
    totalNotices: number;
  };
  totalStudents: number;
  totalDepartments: number;
  totalYears: number;
  totalSections: number;
  ia1Average: number | null;
  ia2Average: number | null;
  overallImprovement: number | null;
  overallPassPercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  departmentRankings: DepartmentRankingItem[];
  yearRankings: YearRankingItem[];
  sectionRankings: SectionRankingItem[];
  subjectPerformance: SubjectPerformanceItem[];
  top10Students: StudentPerformanceReport[];
  bottom10Students: StudentPerformanceReport[];
  mostImprovedStudents: StudentPerformanceReport[];
  studentsNeedingAttention: StudentPerformanceReport[];
}

export class AdminAnalyticsService {
  /**
   * Safe 2 decimal place rounding
   */
  static round2(val: number): number {
    return AcademicPerformanceService.round2(val);
  }

  /**
   * Helper to load all active students along with marks, subjects, assessments,
   * section, department, and year.
   */
  private static async getStudentsData(filters?: {
    academicYearId?: string;
    departmentId?: string;
    yearId?: string;
    sectionId?: string;
  }) {
    return prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        ...(filters?.academicYearId ? { academicYearId: filters.academicYearId } : {}),
        ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters?.yearId ? { yearId: filters.yearId } : {}),
        ...(filters?.sectionId ? { sectionId: filters.sectionId } : {})
      },
      include: {
        department: true,
        year: true,
        section: true,
        academicYear: true,
        marks: {
          include: {
            subject: true,
            assessment: true
          }
        }
      },
      orderBy: { registerNumber: 'asc' }
    });
  }

  /**
   * Calculates performance reports for an array of student Prisma records.
   */
  private static computeStudentReports(students: any[]): StudentPerformanceReport[] {
    return students.map(student => {
      const markItems = student.marks.map((m: any) => ({
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

      const report = AcademicPerformanceService.calculateStudentPerformance(markItems, {
        studentId: student.id,
        registerNumber: student.registerNumber,
        studentName: student.name
      });

      return {
        ...report,
        departmentCode: student.department?.code,
        departmentName: student.department?.name,
        yearName: student.year?.name,
        sectionName: student.section?.name,
        academicYearName: student.academicYear?.yearName
      };
    });
  }

  /**
   * ----------------------------------------------------
   * 1. OVERALL COLLEGE ANALYTICS
   * ----------------------------------------------------
   */
  static async getOverallCollegeAnalytics(academicYearId?: string): Promise<OverallCollegeAnalyticsResponse> {
    // 1. Core metric counts
    const [departments, years, sections, staffCount, studentCount, marksCount, noticesCount] = await Promise.all([
      prisma.department.findMany({ where: { isActive: true } }),
      prisma.year.findMany({ where: { isActive: true }, orderBy: { yearNumber: 'asc' } }),
      prisma.section.findMany({
        where: {
          isActive: true,
          ...(academicYearId ? { academicYearId } : {})
        },
        include: { department: true, year: true }
      }),
      prisma.user.count({ where: { role: 'STAFF' } }),
      prisma.student.count({
        where: {
          status: 'ACTIVE',
          ...(academicYearId ? { academicYearId } : {})
        }
      }),
      prisma.mark.count(),
      prisma.collegeNotice.count()
    ]);

    // 2. Fetch all student records with marks
    const students = await this.getStudentsData({ academicYearId });
    const reports = this.computeStudentReports(students);

    // 3. Assessed students
    const assessedReports = reports.filter(r => r.hasMarks);
    const totalAssessed = assessedReports.length;

    let totalPercentageSum = 0;
    let ia1Sum = 0;
    let ia1Count = 0;
    let ia2Sum = 0;
    let ia2Count = 0;
    let passedCount = 0;
    let highestPct = 0;
    let lowestPct = totalAssessed > 0 ? 100 : 0;

    for (const r of assessedReports) {
      totalPercentageSum += r.percentage;
      if (r.percentage >= 50) {
        passedCount++;
      }
      if (r.percentage > highestPct) highestPct = r.percentage;
      if (r.percentage < lowestPct) lowestPct = r.percentage;

      if (r.ia1Percentage !== null) {
        ia1Sum += r.ia1Percentage;
        ia1Count++;
      }
      if (r.ia2Percentage !== null) {
        ia2Sum += r.ia2Percentage;
        ia2Count++;
      }
    }

    const collegeOverallAvg = totalAssessed > 0 ? this.round2(totalPercentageSum / totalAssessed) : 0;
    const ia1Average = ia1Count > 0 ? this.round2(ia1Sum / ia1Count) : null;
    const ia2Average = ia2Count > 0 ? this.round2(ia2Sum / ia2Count) : null;
    const overallImprovement = (ia1Average !== null && ia2Average !== null)
      ? this.round2(ia2Average - ia1Average)
      : null;
    const overallPassPercentage = totalAssessed > 0
      ? this.round2((passedCount / totalAssessed) * 100)
      : 0;

    // 4. Department Rankings
    const deptMap = new Map<string, {
      dept: any;
      reports: StudentPerformanceReport[];
    }>();
    departments.forEach(d => deptMap.set(d.id, { dept: d, reports: [] }));

    students.forEach((s, idx) => {
      const entry = deptMap.get(s.departmentId);
      if (entry) {
        entry.reports.push(reports[idx]);
      }
    });

    const departmentRankings: DepartmentRankingItem[] = Array.from(deptMap.values()).map(item => {
      const deptAssessed = item.reports.filter(r => r.hasMarks);
      const assessedCount = deptAssessed.length;
      const deptPctSum = deptAssessed.reduce((acc, curr) => acc + curr.percentage, 0);
      const deptOverallAvg = assessedCount > 0 ? this.round2(deptPctSum / assessedCount) : 0;

      let deptIa1Sum = 0;
      let deptIa1Count = 0;
      let deptIa2Sum = 0;
      let deptIa2Count = 0;
      let deptPassCount = 0;

      deptAssessed.forEach(r => {
        if (r.percentage >= 50) deptPassCount++;
        if (r.ia1Percentage !== null) {
          deptIa1Sum += r.ia1Percentage;
          deptIa1Count++;
        }
        if (r.ia2Percentage !== null) {
          deptIa2Sum += r.ia2Percentage;
          deptIa2Count++;
        }
      });

      const deptIa1Avg = deptIa1Count > 0 ? this.round2(deptIa1Sum / deptIa1Count) : null;
      const deptIa2Avg = deptIa2Count > 0 ? this.round2(deptIa2Sum / deptIa2Count) : null;
      const deptImprovement = (deptIa1Avg !== null && deptIa2Avg !== null)
        ? this.round2(deptIa2Avg - deptIa1Avg)
        : null;
      const deptPassPct = assessedCount > 0 ? this.round2((deptPassCount / assessedCount) * 100) : 0;

      return {
        rank: 0,
        departmentId: item.dept.id,
        code: item.dept.code,
        name: item.dept.name,
        totalStudents: item.reports.length,
        assessedStudents: assessedCount,
        ia1Average: deptIa1Avg,
        ia2Average: deptIa2Avg,
        overallAverage: deptOverallAvg,
        improvement: deptImprovement,
        passPercentage: deptPassPct
      };
    });

    // Rank departments by overall average descending, then passPercentage descending
    departmentRankings.sort((a, b) => (b.overallAverage - a.overallAverage) || (b.passPercentage - a.passPercentage));
    departmentRankings.forEach((d, i) => { d.rank = i + 1; });

    // 5. Year Rankings (1st to 4th)
    const yearMap = new Map<string, {
      year: any;
      reports: StudentPerformanceReport[];
    }>();
    years.forEach(y => yearMap.set(y.id, { year: y, reports: [] }));

    students.forEach((s, idx) => {
      const entry = yearMap.get(s.yearId);
      if (entry) {
        entry.reports.push(reports[idx]);
      }
    });

    const yearRankings: YearRankingItem[] = Array.from(yearMap.values()).map(item => {
      const yrAssessed = item.reports.filter(r => r.hasMarks);
      const assessedCount = yrAssessed.length;
      const yrPctSum = yrAssessed.reduce((acc, curr) => acc + curr.percentage, 0);
      const yrOverallAvg = assessedCount > 0 ? this.round2(yrPctSum / assessedCount) : 0;

      let yrIa1Sum = 0;
      let yrIa1Count = 0;
      let yrIa2Sum = 0;
      let yrIa2Count = 0;
      let yrPassCount = 0;

      yrAssessed.forEach(r => {
        if (r.percentage >= 50) yrPassCount++;
        if (r.ia1Percentage !== null) {
          yrIa1Sum += r.ia1Percentage;
          yrIa1Count++;
        }
        if (r.ia2Percentage !== null) {
          yrIa2Sum += r.ia2Percentage;
          yrIa2Count++;
        }
      });

      const yrIa1Avg = yrIa1Count > 0 ? this.round2(yrIa1Sum / yrIa1Count) : null;
      const yrIa2Avg = yrIa2Count > 0 ? this.round2(yrIa2Sum / yrIa2Count) : null;
      const yrImprovement = (yrIa1Avg !== null && yrIa2Avg !== null)
        ? this.round2(yrIa2Avg - yrIa1Avg)
        : null;
      const yrPassPct = assessedCount > 0 ? this.round2((yrPassCount / assessedCount) * 100) : 0;

      return {
        rank: 0,
        yearId: item.year.id,
        yearNumber: item.year.yearNumber,
        name: item.year.name,
        totalStudents: item.reports.length,
        assessedStudents: assessedCount,
        ia1Average: yrIa1Avg,
        ia2Average: yrIa2Avg,
        overallAverage: yrOverallAvg,
        improvement: yrImprovement,
        passPercentage: yrPassPct
      };
    });

    yearRankings.sort((a, b) => (b.overallAverage - a.overallAverage) || (b.passPercentage - a.passPercentage));
    yearRankings.forEach((y, i) => { y.rank = i + 1; });

    // 6. Section Rankings
    const sectionMap = new Map<string, {
      section: any;
      reports: StudentPerformanceReport[];
    }>();
    sections.forEach(sec => sectionMap.set(sec.id, { section: sec, reports: [] }));

    students.forEach((s, idx) => {
      const entry = sectionMap.get(s.sectionId);
      if (entry) {
        entry.reports.push(reports[idx]);
      }
    });

    const sectionRankings: SectionRankingItem[] = Array.from(sectionMap.values()).map(item => {
      const secAssessed = item.reports.filter(r => r.hasMarks);
      const assessedCount = secAssessed.length;
      const secPctSum = secAssessed.reduce((acc, curr) => acc + curr.percentage, 0);
      const secOverallAvg = assessedCount > 0 ? this.round2(secPctSum / assessedCount) : 0;

      let secIa1Sum = 0;
      let secIa1Count = 0;
      let secIa2Sum = 0;
      let secIa2Count = 0;
      let secPassCount = 0;
      let secHigh = 0;
      let secLow = assessedCount > 0 ? 100 : 0;

      secAssessed.forEach(r => {
        if (r.percentage >= 50) secPassCount++;
        if (r.percentage > secHigh) secHigh = r.percentage;
        if (r.percentage < secLow) secLow = r.percentage;

        if (r.ia1Percentage !== null) {
          secIa1Sum += r.ia1Percentage;
          secIa1Count++;
        }
        if (r.ia2Percentage !== null) {
          secIa2Sum += r.ia2Percentage;
          secIa2Count++;
        }
      });

      const secIa1Avg = secIa1Count > 0 ? this.round2(secIa1Sum / secIa1Count) : null;
      const secIa2Avg = secIa2Count > 0 ? this.round2(secIa2Sum / secIa2Count) : null;
      const secImprovement = (secIa1Avg !== null && secIa2Avg !== null)
        ? this.round2(secIa2Avg - secIa1Avg)
        : null;
      const secPassPct = assessedCount > 0 ? this.round2((secPassCount / assessedCount) * 100) : 0;

      return {
        rank: 0,
        sectionId: item.section.id,
        sectionName: item.section.name,
        departmentId: item.section.departmentId,
        departmentCode: item.section.department?.code || '',
        yearId: item.section.yearId,
        yearName: item.section.year?.name || '',
        totalStudents: item.reports.length,
        assessedStudents: assessedCount,
        ia1Average: secIa1Avg,
        ia2Average: secIa2Avg,
        overallAverage: secOverallAvg,
        improvement: secImprovement,
        passPercentage: secPassPct,
        highest: secHigh,
        lowest: secLow
      };
    });

    sectionRankings.sort((a, b) => (b.overallAverage - a.overallAverage) || (b.passPercentage - a.passPercentage));
    sectionRankings.forEach((s, i) => { s.rank = i + 1; });

    // 7. Subject Performance Across College
    const subjectStats = new Map<string, {
      subjectId: string;
      code: string;
      name: string;
      departmentCode: string;
      pctSum: number;
      count: number;
      ia1Sum: number;
      ia1Count: number;
      ia2Sum: number;
      ia2Count: number;
      passCount: number;
    }>();

    for (const r of assessedReports) {
      for (const sb of r.subjectBreakdown) {
        let stat = subjectStats.get(sb.subjectId);
        if (!stat) {
          stat = {
            subjectId: sb.subjectId,
            code: sb.subjectCode,
            name: sb.subjectName,
            departmentCode: r.departmentCode || '',
            pctSum: 0,
            count: 0,
            ia1Sum: 0,
            ia1Count: 0,
            ia2Sum: 0,
            ia2Count: 0,
            passCount: 0
          };
          subjectStats.set(sb.subjectId, stat);
        }

        if (sb.totalMaximum > 0) {
          stat.pctSum += sb.overallPercentage;
          stat.count++;
          if (sb.overallPercentage >= 50) stat.passCount++;
        }

        if (sb.ia1.percentage !== null) {
          stat.ia1Sum += sb.ia1.percentage;
          stat.ia1Count++;
        }
        if (sb.ia2.percentage !== null) {
          stat.ia2Sum += sb.ia2.percentage;
          stat.ia2Count++;
        }
      }
    }

    const subjectPerformance: SubjectPerformanceItem[] = Array.from(subjectStats.values()).map(st => {
      const avgPct = st.count > 0 ? this.round2(st.pctSum / st.count) : 0;
      const ia1Avg = st.ia1Count > 0 ? this.round2(st.ia1Sum / st.ia1Count) : null;
      const ia2Avg = st.ia2Count > 0 ? this.round2(st.ia2Sum / st.ia2Count) : null;
      const diff = (ia1Avg !== null && ia2Avg !== null) ? this.round2(ia2Avg - ia1Avg) : null;
      const passPct = st.count > 0 ? this.round2((st.passCount / st.count) * 100) : 0;

      return {
        subjectId: st.subjectId,
        code: st.code,
        name: st.name,
        departmentCode: st.departmentCode,
        assessedCount: st.count,
        averagePercentage: avgPct,
        ia1Average: ia1Avg,
        ia2Average: ia2Avg,
        improvement: diff,
        passPercentage: passPct
      };
    });

    subjectPerformance.sort((a, b) => b.averagePercentage - a.averagePercentage);

    // 8. Student Highlights
    // Top 10 Students (highest overall %)
    const top10Students = [...assessedReports]
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10);

    // Bottom 10 Students (lowest overall %)
    const bottom10Students = [...assessedReports]
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 10);

    // Most Improved Students (highest improvement IA-2 - IA-1 > 0)
    const mostImprovedStudents = assessedReports
      .filter(r => r.improvement !== null && r.improvement > 0)
      .sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0))
      .slice(0, 10);

    // Students Needing Attention (< 60% or high decline >= 10)
    const studentsNeedingAttention = assessedReports
      .filter(r => r.percentage < 60 || (r.decline !== null && r.decline >= 10))
      .sort((a, b) => a.percentage - b.percentage);

    return {
      scope: 'OVERALL_COLLEGE_ANALYTICS',
      metrics: {
        totalDepartments: departments.length,
        totalStaff: staffCount,
        totalStudents: studentCount,
        totalMarksEntered: marksCount,
        averageScore: collegeOverallAvg,
        totalNotices: noticesCount
      },
      totalStudents: studentCount,
      totalDepartments: departments.length,
      totalYears: years.length,
      totalSections: sections.length,
      ia1Average,
      ia2Average,
      overallImprovement,
      overallPassPercentage,
      highestPercentage: highestPct,
      lowestPercentage: lowestPct,
      departmentRankings,
      yearRankings,
      sectionRankings,
      subjectPerformance,
      top10Students,
      bottom10Students,
      mostImprovedStudents,
      studentsNeedingAttention
    };
  }

  /**
   * ----------------------------------------------------
   * 2. DEPARTMENT ANALYTICS (Comparative & Detailed)
   * ----------------------------------------------------
   */
  static async getDepartmentAnalytics(academicYearId?: string) {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        sections: {
          where: {
            isActive: true,
            ...(academicYearId ? { academicYearId } : {})
          },
          include: { year: true }
        },
        subjects: {
          where: { isActive: true }
        }
      },
      orderBy: { code: 'asc' }
    });

    const students = await this.getStudentsData({ academicYearId });
    const reports = this.computeStudentReports(students);

    // Group reports by department
    const deptDataMap = new Map<string, StudentPerformanceReport[]>();
    departments.forEach(d => deptDataMap.set(d.id, []));

    students.forEach((s, idx) => {
      const list = deptDataMap.get(s.departmentId);
      if (list) list.push(reports[idx]);
    });

    const departmentAnalytics = departments.map(dept => {
      const deptReports = deptDataMap.get(dept.id) || [];
      const assessed = deptReports.filter(r => r.hasMarks);
      const assessedCount = assessed.length;
      const totalStudents = deptReports.length;

      let totalPctSum = 0;
      let ia1Sum = 0;
      let ia1Count = 0;
      let ia2Sum = 0;
      let ia2Count = 0;
      let passedCount = 0;
      let highest = 0;
      let lowest = assessedCount > 0 ? 100 : 0;

      const levelDistribution = {
        excellent: 0,
        veryGood: 0,
        good: 0,
        average: 0,
        needsAttention: 0
      };

      const progressionDistribution = {
        improved: 0,
        declined: 0,
        noChange: 0,
        missingData: 0
      };

      assessed.forEach(r => {
        totalPctSum += r.percentage;
        if (r.percentage >= 50) passedCount++;
        if (r.percentage > highest) highest = r.percentage;
        if (r.percentage < lowest) lowest = r.percentage;

        if (r.ia1Percentage !== null) {
          ia1Sum += r.ia1Percentage;
          ia1Count++;
        }
        if (r.ia2Percentage !== null) {
          ia2Sum += r.ia2Percentage;
          ia2Count++;
        }

        // Tally Level
        switch (r.performanceStatus) {
          case 'Excellent': levelDistribution.excellent++; break;
          case 'Very Good': levelDistribution.veryGood++; break;
          case 'Good': levelDistribution.good++; break;
          case 'Average': levelDistribution.average++; break;
          case 'Needs Attention': levelDistribution.needsAttention++; break;
        }

        // Tally Progression
        switch (r.progressionStatus) {
          case 'IMPROVED': progressionDistribution.improved++; break;
          case 'DECLINED': progressionDistribution.declined++; break;
          case 'NO_CHANGE': progressionDistribution.noChange++; break;
          case 'MISSING_DATA': progressionDistribution.missingData++; break;
        }
      });

      const overallAverage = assessedCount > 0 ? this.round2(totalPctSum / assessedCount) : 0;
      const ia1Average = ia1Count > 0 ? this.round2(ia1Sum / ia1Count) : null;
      const ia2Average = ia2Count > 0 ? this.round2(ia2Sum / ia2Count) : null;
      const improvement = (ia1Average !== null && ia2Average !== null)
        ? this.round2(ia2Average - ia1Average)
        : null;
      const passPercentage = assessedCount > 0 ? this.round2((passedCount / assessedCount) * 100) : 0;

      // Year-wise breakdown inside department
      const yearBreakdownMap = new Map<string, {
        yearName: string;
        yearNumber: number;
        assessedCount: number;
        pctSum: number;
      }>();

      students.filter(s => s.departmentId === dept.id).forEach((s, idx) => {
        const rep = deptReports[idx];
        if (rep && rep.hasMarks) {
          const yrName = s.year?.name || 'Unknown';
          const yrNum = s.year?.yearNumber || 1;
          const entry = yearBreakdownMap.get(yrName) || {
            yearName: yrName,
            yearNumber: yrNum,
            assessedCount: 0,
            pctSum: 0
          };
          entry.assessedCount++;
          entry.pctSum += rep.percentage;
          yearBreakdownMap.set(yrName, entry);
        }
      });

      const yearBreakdown = Array.from(yearBreakdownMap.values()).map(y => ({
        yearName: y.yearName,
        yearNumber: y.yearNumber,
        assessedCount: y.assessedCount,
        averagePercentage: y.assessedCount > 0 ? this.round2(y.pctSum / y.assessedCount) : 0
      })).sort((a, b) => a.yearNumber - b.yearNumber);

      const topStudents = [...assessed]
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 5);

      return {
        departmentId: dept.id,
        code: dept.code,
        name: dept.name,
        totalStudents,
        assessedStudents: assessedCount,
        sectionCount: dept.sections.length,
        subjectCount: dept.subjects.length,
        ia1Average,
        ia2Average,
        overallAverage,
        improvement,
        passPercentage,
        highestScore: highest,
        lowestScore: lowest,
        levelDistribution,
        progressionDistribution,
        yearBreakdown,
        topStudents
      };
    });

    // Comparative ranking
    departmentAnalytics.sort((a, b) => (b.overallAverage - a.overallAverage) || (b.passPercentage - a.passPercentage));

    return {
      departmentAnalytics,
      comparativeRanking: departmentAnalytics.map((d, index) => ({
        rank: index + 1,
        departmentId: d.departmentId,
        code: d.code,
        name: d.name,
        overallAverage: d.overallAverage,
        passPercentage: d.passPercentage,
        improvement: d.improvement
      }))
    };
  }

  /**
   * ----------------------------------------------------
   * 3. YEAR-WISE ANALYTICS (1st, 2nd, 3rd, 4th Year)
   * ----------------------------------------------------
   */
  static async getYearWiseAnalytics(academicYearId?: string) {
    const years = await prisma.year.findMany({
      where: { isActive: true },
      include: {
        sections: {
          where: {
            isActive: true,
            ...(academicYearId ? { academicYearId } : {})
          },
          include: { department: true }
        }
      },
      orderBy: { yearNumber: 'asc' }
    });

    const students = await this.getStudentsData({ academicYearId });
    const reports = this.computeStudentReports(students);

    // Group reports by year
    const yearDataMap = new Map<string, StudentPerformanceReport[]>();
    years.forEach(y => yearDataMap.set(y.id, []));

    students.forEach((s, idx) => {
      const list = yearDataMap.get(s.yearId);
      if (list) list.push(reports[idx]);
    });

    const yearAnalytics = years.map(yr => {
      const yrReports = yearDataMap.get(yr.id) || [];
      const assessed = yrReports.filter(r => r.hasMarks);
      const assessedCount = assessed.length;
      const totalStudents = yrReports.length;

      let totalPctSum = 0;
      let ia1Sum = 0;
      let ia1Count = 0;
      let ia2Sum = 0;
      let ia2Count = 0;
      let passedCount = 0;
      let highest = 0;
      let lowest = assessedCount > 0 ? 100 : 0;

      const levelDistribution = {
        excellent: 0,
        veryGood: 0,
        good: 0,
        average: 0,
        needsAttention: 0
      };

      const progressionDistribution = {
        improved: 0,
        declined: 0,
        noChange: 0,
        missingData: 0
      };

      assessed.forEach(r => {
        totalPctSum += r.percentage;
        if (r.percentage >= 50) passedCount++;
        if (r.percentage > highest) highest = r.percentage;
        if (r.percentage < lowest) lowest = r.percentage;

        if (r.ia1Percentage !== null) {
          ia1Sum += r.ia1Percentage;
          ia1Count++;
        }
        if (r.ia2Percentage !== null) {
          ia2Sum += r.ia2Percentage;
          ia2Count++;
        }

        // Tally Level
        switch (r.performanceStatus) {
          case 'Excellent': levelDistribution.excellent++; break;
          case 'Very Good': levelDistribution.veryGood++; break;
          case 'Good': levelDistribution.good++; break;
          case 'Average': levelDistribution.average++; break;
          case 'Needs Attention': levelDistribution.needsAttention++; break;
        }

        // Tally Progression
        switch (r.progressionStatus) {
          case 'IMPROVED': progressionDistribution.improved++; break;
          case 'DECLINED': progressionDistribution.declined++; break;
          case 'NO_CHANGE': progressionDistribution.noChange++; break;
          case 'MISSING_DATA': progressionDistribution.missingData++; break;
        }
      });

      const overallAverage = assessedCount > 0 ? this.round2(totalPctSum / assessedCount) : 0;
      const ia1Average = ia1Count > 0 ? this.round2(ia1Sum / ia1Count) : null;
      const ia2Average = ia2Count > 0 ? this.round2(ia2Sum / ia2Count) : null;
      const improvement = (ia1Average !== null && ia2Average !== null)
        ? this.round2(ia2Average - ia1Average)
        : null;
      const passPercentage = assessedCount > 0 ? this.round2((passedCount / assessedCount) * 100) : 0;

      // Unique departments in this year
      const deptsInYear = new Set(yr.sections.map(s => s.departmentId));

      // Department breakdown inside year
      const deptBreakdownMap = new Map<string, {
        departmentCode: string;
        departmentName: string;
        assessedCount: number;
        pctSum: number;
      }>();

      students.filter(s => s.yearId === yr.id).forEach((s, idx) => {
        const rep = yrReports[idx];
        if (rep && rep.hasMarks) {
          const deptCode = s.department?.code || 'Unknown';
          const deptName = s.department?.name || 'Unknown';
          const entry = deptBreakdownMap.get(deptCode) || {
            departmentCode: deptCode,
            departmentName: deptName,
            assessedCount: 0,
            pctSum: 0
          };
          entry.assessedCount++;
          entry.pctSum += rep.percentage;
          deptBreakdownMap.set(deptCode, entry);
        }
      });

      const departmentBreakdown = Array.from(deptBreakdownMap.values()).map(d => ({
        departmentCode: d.departmentCode,
        departmentName: d.departmentName,
        assessedCount: d.assessedCount,
        averagePercentage: d.assessedCount > 0 ? this.round2(d.pctSum / d.assessedCount) : 0
      })).sort((a, b) => b.averagePercentage - a.averagePercentage);

      const topStudents = [...assessed]
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 5);

      return {
        yearId: yr.id,
        yearNumber: yr.yearNumber,
        name: yr.name,
        totalStudents,
        assessedStudents: assessedCount,
        departmentCount: deptsInYear.size,
        sectionCount: yr.sections.length,
        ia1Average,
        ia2Average,
        overallAverage,
        improvement,
        passPercentage,
        highestScore: highest,
        lowestScore: lowest,
        levelDistribution,
        progressionDistribution,
        departmentBreakdown,
        topStudents
      };
    });

    // Comparative ranking
    const rankings = [...yearAnalytics]
      .sort((a, b) => (b.overallAverage - a.overallAverage) || (b.passPercentage - a.passPercentage))
      .map((y, idx) => ({
        rank: idx + 1,
        yearId: y.yearId,
        yearNumber: y.yearNumber,
        name: y.name,
        overallAverage: y.overallAverage,
        passPercentage: y.passPercentage,
        improvement: y.improvement
      }));

    return {
      yearAnalytics,
      rankings
    };
  }

  /**
   * ----------------------------------------------------
   * 4. SECTION ANALYTICS
   * ----------------------------------------------------
   */
  static async getSectionAnalytics(sectionId?: string, academicYearId?: string) {
    if (!sectionId) {
      // List all sections with comparative summary metrics
      const sections = await prisma.section.findMany({
        where: {
          isActive: true,
          ...(academicYearId ? { academicYearId } : {})
        },
        include: {
          department: true,
          year: true,
          academicYear: true
        },
        orderBy: [{ department: { code: 'asc' } }, { year: { yearNumber: 'asc' } }, { name: 'asc' }]
      });

      const students = await this.getStudentsData({ academicYearId });
      const reports = this.computeStudentReports(students);

      const secDataMap = new Map<string, StudentPerformanceReport[]>();
      sections.forEach(s => secDataMap.set(s.id, []));

      students.forEach((s, idx) => {
        const list = secDataMap.get(s.sectionId);
        if (list) list.push(reports[idx]);
      });

      const sectionSummaries = sections.map(sec => {
        const secReports = secDataMap.get(sec.id) || [];
        const assessed = secReports.filter(r => r.hasMarks);
        const assessedCount = assessed.length;
        const totalStudents = secReports.length;

        let totalPctSum = 0;
        let ia1Sum = 0;
        let ia1Count = 0;
        let ia2Sum = 0;
        let ia2Count = 0;
        let passedCount = 0;
        let highest = 0;
        let lowest = assessedCount > 0 ? 100 : 0;

        assessed.forEach(r => {
          totalPctSum += r.percentage;
          if (r.percentage >= 50) passedCount++;
          if (r.percentage > highest) highest = r.percentage;
          if (r.percentage < lowest) lowest = r.percentage;

          if (r.ia1Percentage !== null) {
            ia1Sum += r.ia1Percentage;
            ia1Count++;
          }
          if (r.ia2Percentage !== null) {
            ia2Sum += r.ia2Percentage;
            ia2Count++;
          }
        });

        const overallAverage = assessedCount > 0 ? this.round2(totalPctSum / assessedCount) : 0;
        const ia1Average = ia1Count > 0 ? this.round2(ia1Sum / ia1Count) : null;
        const ia2Average = ia2Count > 0 ? this.round2(ia2Sum / ia2Count) : null;
        const improvement = (ia1Average !== null && ia2Average !== null)
          ? this.round2(ia2Average - ia1Average)
          : null;
        const passPercentage = assessedCount > 0 ? this.round2((passedCount / assessedCount) * 100) : 0;

        return {
          sectionId: sec.id,
          sectionName: sec.name,
          displayName: `${sec.department.code} - ${sec.year.name} (Sec ${sec.name})`,
          departmentId: sec.departmentId,
          departmentCode: sec.department.code,
          departmentName: sec.department.name,
          yearId: sec.yearId,
          yearNumber: sec.year.yearNumber,
          yearName: sec.year.name,
          academicYearName: sec.academicYear.yearName,
          totalStudents,
          assessedStudents: assessedCount,
          unassessedStudents: totalStudents - assessedCount,
          ia1Average,
          ia2Average,
          overallAverage,
          improvement,
          passPercentage,
          highest,
          lowest
        };
      });

      sectionSummaries.sort((a, b) => (b.overallAverage - a.overallAverage) || (b.passPercentage - a.passPercentage));

      return {
        sections: sectionSummaries,
        count: sectionSummaries.length
      };
    }

    // Specific section detailed breakdown
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        department: true,
        year: true,
        academicYear: true
      }
    });

    if (!section) {
      throw new Error(`Section not found with ID: ${sectionId}`);
    }

    const students = await prisma.student.findMany({
      where: { sectionId, status: 'ACTIVE' },
      include: {
        marks: {
          include: {
            subject: true,
            assessment: true
          }
        }
      },
      orderBy: { registerNumber: 'asc' }
    });

    // Subjects in this department and year
    const subjects = await prisma.subject.findMany({
      where: {
        departmentId: section.departmentId,
        yearId: section.yearId,
        isActive: true
      }
    });

    const markItemsAll: any[] = [];
    students.forEach(s => {
      s.marks.forEach(m => {
        markItemsAll.push({
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
        });
      });
    });

    const reports = students.map(s => {
      const studentMarks = markItemsAll.filter(m => m.studentId === s.id);
      return AcademicPerformanceService.calculateStudentPerformance(studentMarks, {
        studentId: s.id,
        registerNumber: s.registerNumber,
        studentName: s.name,
        expectedSubjectIds: subjects.map(sb => sb.id)
      });
    });

    const assessed = reports.filter(r => r.hasMarks);
    const totalStudents = students.length;
    const assessedStudents = assessed.length;
    const unassessedStudents = totalStudents - assessedStudents;

    let totalPctSum = 0;
    let ia1Sum = 0;
    let ia1Count = 0;
    let ia2Sum = 0;
    let ia2Count = 0;
    let passedCount = 0;
    let highest = 0;
    let lowest = assessedStudents > 0 ? 100 : 0;

    const levelDistribution = {
      excellent: 0,
      veryGood: 0,
      good: 0,
      average: 0,
      needsAttention: 0
    };

    const progressionDistribution = {
      improved: 0,
      declined: 0,
      noChange: 0,
      missingData: 0
    };

    assessed.forEach(r => {
      totalPctSum += r.percentage;
      if (r.percentage >= 50) passedCount++;
      if (r.percentage > highest) highest = r.percentage;
      if (r.percentage < lowest) lowest = r.percentage;

      if (r.ia1Percentage !== null) {
        ia1Sum += r.ia1Percentage;
        ia1Count++;
      }
      if (r.ia2Percentage !== null) {
        ia2Sum += r.ia2Percentage;
        ia2Count++;
      }

      switch (r.performanceStatus) {
        case 'Excellent': levelDistribution.excellent++; break;
        case 'Very Good': levelDistribution.veryGood++; break;
        case 'Good': levelDistribution.good++; break;
        case 'Average': levelDistribution.average++; break;
        case 'Needs Attention': levelDistribution.needsAttention++; break;
      }

      switch (r.progressionStatus) {
        case 'IMPROVED': progressionDistribution.improved++; break;
        case 'DECLINED': progressionDistribution.declined++; break;
        case 'NO_CHANGE': progressionDistribution.noChange++; break;
        case 'MISSING_DATA': progressionDistribution.missingData++; break;
      }
    });

    const overallAverage = assessedStudents > 0 ? this.round2(totalPctSum / assessedStudents) : 0;
    const ia1Average = ia1Count > 0 ? this.round2(ia1Sum / ia1Count) : null;
    const ia2Average = ia2Count > 0 ? this.round2(ia2Sum / ia2Count) : null;
    const improvement = (ia1Average !== null && ia2Average !== null)
      ? this.round2(ia2Average - ia1Average)
      : null;
    const passPercentage = assessedStudents > 0 ? this.round2((passedCount / assessedStudents) * 100) : 0;

    // Subject Averages in this section
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
      passCount: number;
    }>();

    subjects.forEach(sb => {
      subjectStatsMap.set(sb.id, {
        subjectId: sb.id,
        subjectCode: sb.code,
        subjectName: sb.name,
        totalPctSum: 0,
        pctCount: 0,
        ia1PctSum: 0,
        ia1Count: 0,
        ia2PctSum: 0,
        ia2Count: 0,
        passCount: 0
      });
    });

    for (const r of assessed) {
      for (const sb of r.subjectBreakdown) {
        let stat = subjectStatsMap.get(sb.subjectId);
        if (!stat) {
          stat = {
            subjectId: sb.subjectId,
            subjectCode: sb.subjectCode,
            subjectName: sb.subjectName,
            totalPctSum: 0,
            pctCount: 0,
            ia1PctSum: 0,
            ia1Count: 0,
            ia2PctSum: 0,
            ia2Count: 0,
            passCount: 0
          };
          subjectStatsMap.set(sb.subjectId, stat);
        }

        if (sb.totalMaximum > 0) {
          stat.totalPctSum += sb.overallPercentage;
          stat.pctCount++;
          if (sb.overallPercentage >= 50) stat.passCount++;
        }
        if (sb.ia1.percentage !== null) {
          stat.ia1PctSum += sb.ia1.percentage;
          stat.ia1Count++;
        }
        if (sb.ia2.percentage !== null) {
          stat.ia2PctSum += sb.ia2.percentage;
          stat.ia2Count++;
        }
      }
    }

    const subjectAverages = Array.from(subjectStatsMap.values()).map(s => {
      const avgPct = s.pctCount > 0 ? this.round2(s.totalPctSum / s.pctCount) : 0;
      const ia1Avg = s.ia1Count > 0 ? this.round2(s.ia1PctSum / s.ia1Count) : null;
      const ia2Avg = s.ia2Count > 0 ? this.round2(s.ia2PctSum / s.ia2Count) : null;
      const diff = (ia1Avg !== null && ia2Avg !== null) ? this.round2(ia2Avg - ia1Avg) : null;
      const passPct = s.pctCount > 0 ? this.round2((s.passCount / s.pctCount) * 100) : 0;

      return {
        subjectId: s.subjectId,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        averagePercentage: avgPct,
        ia1Average: ia1Avg,
        ia2Average: ia2Avg,
        improvement: diff,
        passPercentage: passPct,
        assessedCount: s.pctCount
      };
    });

    const topPerformers = [...assessed]
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    const studentsNeedingAttention = assessed
      .filter(r => r.percentage < 60 || (r.decline !== null && r.decline >= 10))
      .sort((a, b) => a.percentage - b.percentage);

    return {
      sectionId: section.id,
      sectionName: section.name,
      displayName: `${section.department.code} - ${section.year.name} (Sec ${section.name})`,
      department: {
        id: section.department.id,
        code: section.department.code,
        name: section.department.name
      },
      year: {
        id: section.year.id,
        yearNumber: section.year.yearNumber,
        name: section.year.name
      },
      academicYear: {
        id: section.academicYear.id,
        yearName: section.academicYear.yearName
      },
      totalStudents,
      assessedStudents,
      unassessedStudents,
      ia1Average,
      ia2Average,
      overallAverage,
      improvement,
      passPercentage,
      highest,
      lowest,
      subjectAverages,
      topPerformers,
      studentsNeedingAttention,
      levelDistribution,
      progressionDistribution,
      studentRoster: reports
    };
  }

  /**
   * ----------------------------------------------------
   * 5. HIERARCHICAL DRILLDOWN
   * College -> Department -> Year -> Section -> Subject -> Student
   * ----------------------------------------------------
   */
  static async getDrilldownNode(params: {
    level?: string;
    academicYearId?: string;
    departmentId?: string;
    yearId?: string;
    sectionId?: string;
    subjectId?: string;
    studentId?: string;
  }) {
    const rawLevel = (params.level || 'college').toLowerCase();

    // 1. COLLEGE LEVEL (Root)
    if (rawLevel === 'college') {
      const departments = await prisma.department.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' }
      });

      const overall = await this.getOverallCollegeAnalytics(params.academicYearId);

      return {
        currentLevel: 'college',
        breadcrumbs: [
          { level: 'college', id: 'root', name: 'Overall College' }
        ],
        summary: {
          totalStudents: overall.totalStudents,
          totalDepartments: overall.totalDepartments,
          totalYears: overall.totalYears,
          totalSections: overall.totalSections,
          ia1Average: overall.ia1Average,
          ia2Average: overall.ia2Average,
          overallImprovement: overall.overallImprovement,
          overallPassPercentage: overall.overallPassPercentage,
          highestPercentage: overall.highestPercentage,
          lowestPercentage: overall.lowestPercentage
        },
        children: overall.departmentRankings.map(d => ({
          level: 'department',
          id: d.departmentId,
          code: d.code,
          name: d.name,
          totalStudents: d.totalStudents,
          assessedStudents: d.assessedStudents,
          overallAverage: d.overallAverage,
          ia1Average: d.ia1Average,
          ia2Average: d.ia2Average,
          improvement: d.improvement,
          passPercentage: d.passPercentage,
          rank: d.rank
        }))
      };
    }

    // 2. DEPARTMENT LEVEL
    if (rawLevel === 'department') {
      if (!params.departmentId) {
        throw new Error('departmentId is required for department drilldown');
      }

      const dept = await prisma.department.findUnique({
        where: { id: params.departmentId }
      });
      if (!dept) throw new Error('Department not found');

      const years = await prisma.year.findMany({
        where: { isActive: true },
        orderBy: { yearNumber: 'asc' }
      });

      const students = await this.getStudentsData({
        academicYearId: params.academicYearId,
        departmentId: dept.id
      });
      const reports = this.computeStudentReports(students);

      // Aggregate for this department
      const assessed = reports.filter(r => r.hasMarks);
      const totalPctSum = assessed.reduce((sum, r) => sum + r.percentage, 0);
      const overallAverage = assessed.length > 0 ? this.round2(totalPctSum / assessed.length) : 0;

      // Group by year
      const yearMap = new Map<string, StudentPerformanceReport[]>();
      years.forEach(y => yearMap.set(y.id, []));
      students.forEach((s, idx) => {
        const list = yearMap.get(s.yearId);
        if (list) list.push(reports[idx]);
      });

      const yearChildren = years.map(yr => {
        const yrReports = yearMap.get(yr.id) || [];
        const yrAssessed = yrReports.filter(r => r.hasMarks);
        const yrPctSum = yrAssessed.reduce((s, r) => s + r.percentage, 0);
        const yrAvg = yrAssessed.length > 0 ? this.round2(yrPctSum / yrAssessed.length) : 0;

        let yrIa1Sum = 0;
        let yrIa1Count = 0;
        let yrIa2Sum = 0;
        let yrIa2Count = 0;
        let yrPassCount = 0;

        yrAssessed.forEach(r => {
          if (r.percentage >= 50) yrPassCount++;
          if (r.ia1Percentage !== null) {
            yrIa1Sum += r.ia1Percentage;
            yrIa1Count++;
          }
          if (r.ia2Percentage !== null) {
            yrIa2Sum += r.ia2Percentage;
            yrIa2Count++;
          }
        });

        const ia1Avg = yrIa1Count > 0 ? this.round2(yrIa1Sum / yrIa1Count) : null;
        const ia2Avg = yrIa2Count > 0 ? this.round2(yrIa2Sum / yrIa2Count) : null;
        const diff = (ia1Avg !== null && ia2Avg !== null) ? this.round2(ia2Avg - ia1Avg) : null;
        const passPct = yrAssessed.length > 0 ? this.round2((yrPassCount / yrAssessed.length) * 100) : 0;

        return {
          level: 'year',
          id: yr.id,
          departmentId: dept.id,
          name: yr.name,
          yearNumber: yr.yearNumber,
          totalStudents: yrReports.length,
          assessedStudents: yrAssessed.length,
          overallAverage: yrAvg,
          ia1Average: ia1Avg,
          ia2Average: ia2Avg,
          improvement: diff,
          passPercentage: passPct
        };
      });

      return {
        currentLevel: 'department',
        department: { id: dept.id, code: dept.code, name: dept.name },
        breadcrumbs: [
          { level: 'college', id: 'root', name: 'Overall College' },
          { level: 'department', id: dept.id, name: dept.code }
        ],
        summary: {
          departmentId: dept.id,
          code: dept.code,
          name: dept.name,
          totalStudents: students.length,
          assessedStudents: assessed.length,
          overallAverage
        },
        children: yearChildren
      };
    }

    // 3. YEAR LEVEL (Inside Department)
    if (rawLevel === 'year') {
      if (!params.departmentId || !params.yearId) {
        throw new Error('Both departmentId and yearId are required for year drilldown');
      }

      const [dept, year, sections] = await Promise.all([
        prisma.department.findUnique({ where: { id: params.departmentId } }),
        prisma.year.findUnique({ where: { id: params.yearId } }),
        prisma.section.findMany({
          where: {
            departmentId: params.departmentId,
            yearId: params.yearId,
            isActive: true,
            ...(params.academicYearId ? { academicYearId: params.academicYearId } : {})
          },
          include: { department: true, year: true }
        })
      ]);

      if (!dept || !year) throw new Error('Department or Year not found');

      const students = await this.getStudentsData({
        academicYearId: params.academicYearId,
        departmentId: dept.id,
        yearId: year.id
      });
      const reports = this.computeStudentReports(students);

      const secMap = new Map<string, StudentPerformanceReport[]>();
      sections.forEach(s => secMap.set(s.id, []));
      students.forEach((s, idx) => {
        const list = secMap.get(s.sectionId);
        if (list) list.push(reports[idx]);
      });

      const sectionChildren = sections.map(sec => {
        const secReports = secMap.get(sec.id) || [];
        const secAssessed = secReports.filter(r => r.hasMarks);
        const secPctSum = secAssessed.reduce((s, r) => s + r.percentage, 0);
        const secAvg = secAssessed.length > 0 ? this.round2(secPctSum / secAssessed.length) : 0;

        let secIa1Sum = 0;
        let secIa1Count = 0;
        let secIa2Sum = 0;
        let secIa2Count = 0;
        let secPassCount = 0;

        secAssessed.forEach(r => {
          if (r.percentage >= 50) secPassCount++;
          if (r.ia1Percentage !== null) {
            secIa1Sum += r.ia1Percentage;
            secIa1Count++;
          }
          if (r.ia2Percentage !== null) {
            secIa2Sum += r.ia2Percentage;
            secIa2Count++;
          }
        });

        const ia1Avg = secIa1Count > 0 ? this.round2(secIa1Sum / secIa1Count) : null;
        const ia2Avg = secIa2Count > 0 ? this.round2(secIa2Sum / secIa2Count) : null;
        const diff = (ia1Avg !== null && ia2Avg !== null) ? this.round2(ia2Avg - ia1Avg) : null;
        const passPct = secAssessed.length > 0 ? this.round2((secPassCount / secAssessed.length) * 100) : 0;

        return {
          level: 'section',
          id: sec.id,
          departmentId: dept.id,
          yearId: year.id,
          name: `Section ${sec.name}`,
          sectionName: sec.name,
          totalStudents: secReports.length,
          assessedStudents: secAssessed.length,
          overallAverage: secAvg,
          ia1Average: ia1Avg,
          ia2Average: ia2Avg,
          improvement: diff,
          passPercentage: passPct
        };
      });

      return {
        currentLevel: 'year',
        department: { id: dept.id, code: dept.code, name: dept.name },
        year: { id: year.id, yearNumber: year.yearNumber, name: year.name },
        breadcrumbs: [
          { level: 'college', id: 'root', name: 'Overall College' },
          { level: 'department', id: dept.id, name: dept.code },
          { level: 'year', id: year.id, name: year.name }
        ],
        summary: {
          yearName: year.name,
          sectionCount: sections.length,
          totalStudents: students.length
        },
        children: sectionChildren
      };
    }

    // 4. SECTION LEVEL
    if (rawLevel === 'section') {
      if (!params.sectionId) {
        throw new Error('sectionId is required for section drilldown');
      }

      const section = await prisma.section.findUnique({
        where: { id: params.sectionId },
        include: { department: true, year: true }
      });
      if (!section) throw new Error('Section not found');

      // Fetch subjects for this department and year
      const subjects = await prisma.subject.findMany({
        where: {
          departmentId: section.departmentId,
          yearId: section.yearId,
          isActive: true
        },
        orderBy: { code: 'asc' }
      });

      const sectionAnalytics = (await this.getSectionAnalytics(section.id, params.academicYearId)) as any;

      // Children are subjects in this section
      const subjectChildren = sectionAnalytics.subjectAverages.map((sb: any) => ({
        level: 'subject',
        id: sb.subjectId,
        sectionId: section.id,
        code: sb.subjectCode,
        name: sb.subjectName,
        averagePercentage: sb.averagePercentage,
        ia1Average: sb.ia1Average,
        ia2Average: sb.ia2Average,
        improvement: sb.improvement,
        passPercentage: sb.passPercentage,
        assessedCount: sb.assessedCount
      }));

      return {
        currentLevel: 'section',
        department: section.department,
        year: section.year,
        section: { id: section.id, name: section.name },
        breadcrumbs: [
          { level: 'college', id: 'root', name: 'Overall College' },
          { level: 'department', id: section.department.id, name: section.department.code },
          { level: 'year', id: section.year.id, name: section.year.name },
          { level: 'section', id: section.id, name: `Sec ${section.name}` }
        ],
        summary: {
          totalStudents: sectionAnalytics.totalStudents,
          assessedStudents: sectionAnalytics.assessedStudents,
          ia1Average: sectionAnalytics.ia1Average,
          ia2Average: sectionAnalytics.ia2Average,
          overallAverage: sectionAnalytics.overallAverage,
          improvement: sectionAnalytics.improvement,
          passPercentage: sectionAnalytics.passPercentage,
          highest: sectionAnalytics.highest,
          lowest: sectionAnalytics.lowest
        },
        children: subjectChildren,
        students: sectionAnalytics.studentRoster.map((r: any) => ({
          level: 'student',
          id: r.studentId,
          registerNumber: r.registerNumber,
          name: r.studentName,
          percentage: r.percentage,
          ia1Percentage: r.ia1Percentage,
          ia2Percentage: r.ia2Percentage,
          improvement: r.improvement,
          performanceStatus: r.performanceStatus,
          progressionStatus: r.progressionStatus
        }))
      };
    }

    // 5. SUBJECT LEVEL (Inside a Section)
    if (rawLevel === 'subject') {
      if (!params.sectionId || !params.subjectId) {
        throw new Error('Both sectionId and subjectId are required for subject drilldown');
      }

      const [section, subject] = await Promise.all([
        prisma.section.findUnique({
          where: { id: params.sectionId },
          include: { department: true, year: true }
        }),
        prisma.subject.findUnique({
          where: { id: params.subjectId }
        })
      ]);

      if (!section || !subject) throw new Error('Section or Subject not found');

      // Fetch marks for students in this section for this subject
      const students = await prisma.student.findMany({
        where: { sectionId: section.id, status: 'ACTIVE' },
        include: {
          marks: {
            where: { subjectId: subject.id },
            include: { assessment: true }
          }
        },
        orderBy: { registerNumber: 'asc' }
      });

      const studentList = students.map(s => {
        let ia1Mark: number | null = null;
        let ia1Max: number | null = null;
        let ia2Mark: number | null = null;
        let ia2Max: number | null = null;
        let totalObt = 0;
        let totalMax = 0;

        s.marks.forEach(m => {
          totalObt += m.marksObtained;
          totalMax += m.maximumMarks;

          if (AcademicPerformanceService.isAssessment(m.assessment.code, 'IA-1')) {
            ia1Mark = m.marksObtained;
            ia1Max = m.maximumMarks;
          } else if (AcademicPerformanceService.isAssessment(m.assessment.code, 'IA-2')) {
            ia2Mark = m.marksObtained;
            ia2Max = m.maximumMarks;
          }
        });

        const ia1Pct = (ia1Mark !== null && ia1Max !== null && ia1Max > 0)
          ? AcademicPerformanceService.calculatePercentage(ia1Mark, ia1Max)
          : null;
        const ia2Pct = (ia2Mark !== null && ia2Max !== null && ia2Max > 0)
          ? AcademicPerformanceService.calculatePercentage(ia2Mark, ia2Max)
          : null;
        const overallPct = totalMax > 0
          ? AcademicPerformanceService.calculatePercentage(totalObt, totalMax)
          : 0;
        const improvementRes = AcademicPerformanceService.calculateImprovement(ia1Pct, ia2Pct);

        return {
          level: 'student',
          id: s.id,
          registerNumber: s.registerNumber,
          name: s.name,
          marksObtained: totalObt,
          maximumMarks: totalMax,
          percentage: overallPct,
          ia1Marks: ia1Mark,
          ia1Max,
          ia1Percentage: ia1Pct,
          ia2Marks: ia2Mark,
          ia2Max,
          ia2Percentage: ia2Pct,
          improvement: improvementRes.improvement,
          progressionStatus: improvementRes.status,
          performanceStatus: AcademicPerformanceService.getPerformanceLevel(overallPct),
          hasMarks: s.marks.length > 0
        };
      });

      const assessedStudents = studentList.filter(s => s.hasMarks);
      const totalPctSum = assessedStudents.reduce((sum, s) => sum + s.percentage, 0);
      const avgPct = assessedStudents.length > 0 ? this.round2(totalPctSum / assessedStudents.length) : 0;

      let ia1Sum = 0;
      let ia1Count = 0;
      let ia2Sum = 0;
      let ia2Count = 0;
      let passedCount = 0;

      assessedStudents.forEach(s => {
        if (s.percentage >= 50) passedCount++;
        if (s.ia1Percentage !== null) {
          ia1Sum += s.ia1Percentage;
          ia1Count++;
        }
        if (s.ia2Percentage !== null) {
          ia2Sum += s.ia2Percentage;
          ia2Count++;
        }
      });

      const ia1Avg = ia1Count > 0 ? this.round2(ia1Sum / ia1Count) : null;
      const ia2Avg = ia2Count > 0 ? this.round2(ia2Sum / ia2Count) : null;
      const diff = (ia1Avg !== null && ia2Avg !== null) ? this.round2(ia2Avg - ia1Avg) : null;
      const passPct = assessedStudents.length > 0 ? this.round2((passedCount / assessedStudents.length) * 100) : 0;

      return {
        currentLevel: 'subject',
        department: section.department,
        year: section.year,
        section: { id: section.id, name: section.name },
        subject: { id: subject.id, code: subject.code, name: subject.name },
        breadcrumbs: [
          { level: 'college', id: 'root', name: 'Overall College' },
          { level: 'department', id: section.department.id, name: section.department.code },
          { level: 'year', id: section.year.id, name: section.year.name },
          { level: 'section', id: section.id, name: `Sec ${section.name}` },
          { level: 'subject', id: subject.id, name: subject.code }
        ],
        summary: {
          subjectCode: subject.code,
          subjectName: subject.name,
          totalStudents: studentList.length,
          assessedStudents: assessedStudents.length,
          averagePercentage: avgPct,
          ia1Average: ia1Avg,
          ia2Average: ia2Avg,
          improvement: diff,
          passPercentage: passPct
        },
        children: studentList
      };
    }

    // 6. STUDENT LEVEL (Terminal Leaf)
    if (rawLevel === 'student') {
      if (!params.studentId) {
        throw new Error('studentId is required for student drilldown');
      }

      const report = await AcademicPerformanceService.getStudentPerformanceFromDb(params.studentId);
      if (!report) throw new Error('Student not found');

      const student = await prisma.student.findUnique({
        where: { id: params.studentId },
        include: { department: true, year: true, section: true }
      });

      return {
        currentLevel: 'student',
        student: {
          id: student?.id,
          name: student?.name,
          registerNumber: student?.registerNumber
        },
        department: student?.department,
        year: student?.year,
        section: student?.section,
        breadcrumbs: [
          { level: 'college', id: 'root', name: 'Overall College' },
          { level: 'department', id: student?.department.id, name: student?.department.code },
          { level: 'year', id: student?.year.id, name: student?.year.name },
          { level: 'section', id: student?.section.id, name: `Sec ${student?.section.name}` },
          { level: 'student', id: student?.id, name: student?.name || 'Student' }
        ],
        summary: {
          studentName: report.studentName,
          registerNumber: report.registerNumber,
          percentage: report.percentage,
          performanceStatus: report.performanceStatus,
          ia1Percentage: report.ia1Percentage,
          ia2Percentage: report.ia2Percentage,
          improvement: report.improvement,
          progressionStatus: report.progressionStatus
        },
        report
      };
    }

    throw new Error(`Unsupported drilldown level: ${rawLevel}`);
  }
}
