
import * as XLSX from 'xlsx';
import { ProjectPlan, PHASE_LABELS } from '../types';
import { getPlanRange, getWeeksBetween, isSameDay } from '../utils/dateUtils';

export const exportToExcel = (plan: ProjectPlan) => {
  // Handle default export if necessary (common with some bundlers/CDNs for xlsx)
  const X = (XLSX as any).default || XLSX;

  const subProjectsMap = new Map(plan.subProjects?.map(sp => [sp.id, sp.name]) || []);

  // --- SHEET 1: Detailed List ---
  // Sort phases: Subproject -> Start Date
  const sortedPhases = [...plan.phases].sort((a, b) => {
      const spA = a.subProjectId ? subProjectsMap.get(a.subProjectId) || 'General' : 'General';
      const spB = b.subProjectId ? subProjectsMap.get(b.subProjectId) || 'General' : 'General';
      if (spA !== spB) return spA.localeCompare(spB);
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const listData = sortedPhases.map((phase) => ({
    'Subproject': phase.subProjectId ? subProjectsMap.get(phase.subProjectId) || 'General' : 'General',
    'Phase Name': phase.name || PHASE_LABELS[phase.type],
    'Type': PHASE_LABELS[phase.type],
    'Start Date': phase.startDate,
    'End Date': phase.endDate,
    'Details': phase.details || '',
  }));

  const holidayData = plan.holidays.map(h => ({
     'Holiday Name': h.name,
     'Date': h.date
  }));

  const wb = X.utils.book_new();
  
  const wsList = X.utils.json_to_sheet(listData);
  const wscols = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 50 }];
  wsList['!cols'] = wscols;
  X.utils.book_append_sheet(wb, wsList, "Task List");

  // --- SHEET 2: Visual Timeline (Gantt-like Grid) ---
  const { start, end } = getPlanRange(plan);
  const weeks = getWeeksBetween(start, end);
  
  // Create an array of days from start to end
  const allDays: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
      allDays.push(new Date(current));
      current.setDate(current.getDate() + 1);
  }

  // Build the Header Row (Dates)
  // Row 1: Subproject, Task, ...Days...
  const timelineHeader = ["Subproject", "Task Name", "Start", "End", ...allDays.map(d => `${d.getMonth() + 1}/${d.getDate()}`)];
  
  // Build Rows
  const timelineRows = sortedPhases.map(phase => {
      const row: (string | number)[] = [
          phase.subProjectId ? subProjectsMap.get(phase.subProjectId) || 'General' : 'General',
          phase.name || PHASE_LABELS[phase.type],
          phase.startDate,
          phase.endDate
      ];

      const pStart = new Date(phase.startDate);
      const pEnd = new Date(phase.endDate);

      allDays.forEach(day => {
          // Check if day is within phase
          if (day >= pStart && day <= pEnd) {
              row.push("x"); // Active day marker
          } else {
              // Check if weekend
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
               // Check holiday
              const isHoliday = plan.holidays.some(h => isSameDay(new Date(h.date), day));
              
              if (isHoliday) row.push("H");
              else if (isWeekend) row.push("");
              else row.push("");
          }
      });
      return row;
  });

  // Combine Header + Rows
  const timelineDataArray = [timelineHeader, ...timelineRows];
  const wsTimeline = X.utils.aoa_to_sheet(timelineDataArray);
  
  // Simple width adjustments
  const timelineCols = [{ wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
  // Set default width for date columns
  for(let i=0; i < allDays.length; i++) timelineCols.push({ wch: 4 });
  wsTimeline['!cols'] = timelineCols;

  X.utils.book_append_sheet(wb, wsTimeline, "Visual Timeline");
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(holidayData), "Holidays");

  // 4. Save file
  X.writeFile(wb, `${plan.name.replace(/\s+/g, '_')}_retroplanning.xlsx`);
};
