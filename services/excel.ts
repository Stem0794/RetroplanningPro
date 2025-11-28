
import * as XLSX from 'xlsx';
import { ProjectPlan, PHASE_LABELS, PhaseType } from '../types';
import { getPlanRange, isSameDay } from '../utils/dateUtils';

export const exportToExcel = (plan: ProjectPlan) => {
  // Handle default export if necessary (common with some bundlers/CDNs for xlsx)
  const X = (XLSX as any).default || XLSX;

  // Palette aligned to app colors
  const PHASE_HEX: Record<PhaseType, string> = {
    [PhaseType.CONCEPTION]: 'DDEAFE',    // blue-100
    [PhaseType.DEVELOPMENT]: 'FFE8C7',   // amber-100
    [PhaseType.TESTS]: 'EDE9FE',         // violet-100
    [PhaseType.PUSH_TO_PROD]: 'FEE2E2',  // red-100
    [PhaseType.OTHER]: 'E5E7EB'          // gray-200
  };

  const headerStyle = {
    font: { bold: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'E0E7FF' } },
    alignment: { horizontal: 'center', vertical: 'center' as const },
    border: { bottom: { style: 'thin', color: { rgb: 'CBD5E1' } } }
  };

  const outlineBorder = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  };

  const applyHeader = (ws: XLSX.WorkSheet, rowIndex: number, colCount: number) => {
    for (let c = 0; c < colCount; c++) {
      const addr = X.utils.encode_cell({ c, r: rowIndex });
      if (!ws[addr]) continue;
      ws[addr].s = headerStyle;
    }
  };

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
  applyHeader(wsList, 0, wscols.length);
  X.utils.book_append_sheet(wb, wsList, "Task List");

  // --- SHEET 2: Visual Timeline (Gantt-like Grid) ---
  const { start, end } = getPlanRange(plan);
  
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

  applyHeader(wsTimeline, 0, timelineCols.length);

  // Color active days with phase colors; holidays highlighted red
  sortedPhases.forEach((phase, phaseIdx) => {
    const row = phaseIdx + 1; // header is row 0
    const pStart = new Date(phase.startDate);
    const pEnd = new Date(phase.endDate);
    const fillColor = PHASE_HEX[phase.type] || 'E5E7EB';

    allDays.forEach((day, dayIdx) => {
      const col = 4 + dayIdx; // first 4 columns are meta
      const addr = X.utils.encode_cell({ c: col, r: row });
      const isHoliday = plan.holidays.some(h => isSameDay(new Date(h.date), day));
      const isActive = day >= pStart && day <= pEnd;
      if (!isActive && !isHoliday) return;

      wsTimeline[addr] = wsTimeline[addr] || { v: '' };
      wsTimeline[addr].v = isHoliday ? 'H' : '■';
      wsTimeline[addr].s = {
        font: { color: { rgb: '0F172A' }, bold: true, sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: isHoliday ? 'FECACA' : fillColor } },
        border: outlineBorder
      };
    });
  });

  X.utils.book_append_sheet(wb, wsTimeline, "Visual Timeline");

  const wsHoliday = X.utils.json_to_sheet(holidayData);
  if (holidayData.length) {
    applyHeader(wsHoliday, 0, Object.keys(holidayData[0]).length);
  }
  X.utils.book_append_sheet(wb, wsHoliday, "Holidays");

  // 4. Save file
  X.writeFile(wb, `${plan.name.replace(/\s+/g, '_')}_retroplanning.xlsx`);
};
