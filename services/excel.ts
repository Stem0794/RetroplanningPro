import * as XLSX from 'xlsx';
import { ProjectPlan, PHASE_LABELS, PhaseType } from '../types';
import { getPlanRange, getWeekNumber, isSameDay } from '../utils/dateUtils';

export const exportToExcel = (plan: ProjectPlan) => {
  const X = (XLSX as any).default || XLSX;

  const PHASE_HEX: Record<PhaseType, string> = {
    [PhaseType.CONCEPTION]: 'DDEAFE',
    [PhaseType.DEVELOPMENT]: 'FFE8C7',
    [PhaseType.TESTS]: 'EDE9FE',
    [PhaseType.PUSH_TO_PROD]: 'FEE2E2',
    [PhaseType.OTHER]: 'E5E7EB'
  };

  const INDIGO = '6366F1';
  const SLATE = '0F172A';
  const SLATE_LIGHT = 'CBD5E1';
  const PANEL = 'F8FAFC';

  const headerStyle = {
    font: { bold: true, color: { rgb: SLATE } },
    fill: { fgColor: { rgb: 'E0E7FF' } },
    alignment: { horizontal: 'center', vertical: 'center' as const },
    border: { bottom: { style: 'thin', color: { rgb: SLATE_LIGHT } } }
  };
  const titleStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 },
    alignment: { horizontal: 'center', vertical: 'center' as const },
    fill: { fgColor: { rgb: INDIGO } }
  };
  const subtitleStyle = {
    font: { bold: true, color: { rgb: SLATE }, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center' as const },
    fill: { fgColor: { rgb: PANEL } }
  };
  const monthHeaderStyle = {
    font: { bold: true, color: { rgb: SLATE }, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' as const },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    border: {
      top: { style: 'thin', color: { rgb: SLATE_LIGHT } },
      bottom: { style: 'thin', color: { rgb: SLATE_LIGHT } },
      left: { style: 'thin', color: { rgb: SLATE_LIGHT } },
      right: { style: 'thin', color: { rgb: SLATE_LIGHT } }
    }
  };
  const dayHeaderStyle = {
    font: { bold: true, color: { rgb: SLATE }, sz: 9 },
    alignment: { horizontal: 'center', vertical: 'center' as const },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    border: {
      top: { style: 'thin', color: { rgb: SLATE_LIGHT } },
      bottom: { style: 'thin', color: { rgb: SLATE_LIGHT } },
      left: { style: 'thin', color: { rgb: SLATE_LIGHT } },
      right: { style: 'thin', color: { rgb: SLATE_LIGHT } }
    }
  };
  const weekendHeaderStyle = {
    ...dayHeaderStyle,
    fill: { fgColor: { rgb: 'E2E8F0' } }
  };
  const weekHeaderStyle = {
    font: { bold: true, color: { rgb: SLATE }, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' as const },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    border: {
      top: { style: 'thin', color: { rgb: SLATE_LIGHT } },
      bottom: { style: 'thin', color: { rgb: SLATE_LIGHT } },
      left: { style: 'thin', color: { rgb: SLATE_LIGHT } },
      right: { style: 'thin', color: { rgb: SLATE_LIGHT } }
    }
  };
  const outlineBorder = {
    top: { style: 'thin', color: { rgb: SLATE_LIGHT } },
    bottom: { style: 'thin', color: { rgb: SLATE_LIGHT } },
    left: { style: 'thin', color: { rgb: SLATE_LIGHT } },
    right: { style: 'thin', color: { rgb: SLATE_LIGHT } }
  };

  const applyHeader = (ws: XLSX.WorkSheet, rowIndex: number, colCount: number) => {
    for (let c = 0; c < colCount; c++) {
      const addr = X.utils.encode_cell({ c, r: rowIndex });
      if (!ws[addr]) continue;
      ws[addr].s = headerStyle;
    }
  };

  const merge = (ws: XLSX.WorkSheet, sRow: number, sCol: number, eRow: number, eCol: number) => {
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push({ s: { r: sRow, c: sCol }, e: { r: eRow, c: eCol } });
  };

  const setCellStyle = (ws: XLSX.WorkSheet, r: number, c: number, style: XLSX.CellStyle) => {
    const addr = X.utils.encode_cell({ r, c });
    ws[addr] = ws[addr] || { v: '' };
    ws[addr].s = style;
  };

  const subProjectsMap = new Map(plan.subProjects?.map(sp => [sp.id, sp.name]) || []);

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

  // ----- LIST SHEET -----
  const listHeader = ['Subproject', 'Phase Name', 'Type', 'Start Date', 'End Date', 'Details'];
  const listAOA = [
    [`${plan.name} — Task List`, '', '', '', '', ''],
    [`Range: ${new Date(plan.createdAt).toLocaleDateString()} → ${new Date(plan.phases[plan.phases.length - 1]?.endDate || plan.createdAt).toLocaleDateString()}`, '', '', '', '', ''],
    [],
    listHeader,
    ...listData.map(row => [
      row['Subproject'],
      row['Phase Name'],
      row['Type'],
      row['Start Date'],
      row['End Date'],
      row['Details']
    ])
  ];

  const wsList = X.utils.aoa_to_sheet(listAOA);
  const wscols = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 50 }];
  wsList['!cols'] = wscols;
  merge(wsList, 0, 0, 0, wscols.length - 1);
  merge(wsList, 1, 1, 0, wscols.length - 1);
  setCellStyle(wsList, 0, 0, { ...titleStyle });
  setCellStyle(wsList, 1, 0, { ...subtitleStyle });
  applyHeader(wsList, 3, wscols.length);
  X.utils.book_append_sheet(wb, wsList, "Task List");

  // --- SHEET 2: Visual Timeline (Gantt-like Grid) ---
  const { start, end } = getPlanRange(plan);
  const allDays: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    allDays.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const metaCols = ["Subproject", "Task Name", "Start", "End"];
  const dayLabels = allDays.map(d => `${d.getDate()}`);

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
      const isHoliday = plan.holidays.some(h => isSameDay(new Date(h.date), day));
      const isActive = day >= pStart && day <= pEnd;
      row.push(isHoliday ? 'H' : isActive ? '■' : '');
    });
    return row;
  });

  // Month spans for header
  const monthSpans: { label: string; span: number }[] = [];
  const weekSpans: { label: string; span: number }[] = [];
  if (allDays.length) {
    let currentMonth = allDays[0].getMonth();
    let currentYear = allDays[0].getFullYear();
    let span = 0;
    let currentWeek = getWeekNumber(allDays[0]);
    let weekYear = allDays[0].getFullYear();
    let weekSpan = 0;
    allDays.forEach((d, idx) => {
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        span += 1;
      } else {
        monthSpans.push({ label: `${allDays[idx - 1].toLocaleString('default', { month: 'short' })} ${currentYear}`, span });
        currentMonth = d.getMonth();
        currentYear = d.getFullYear();
        span = 1;
      }
      const w = getWeekNumber(d);
      const wy = d.getFullYear();
      if (w === currentWeek && wy === weekYear) {
        weekSpan += 1;
      } else {
        weekSpans.push({ label: `W${currentWeek}`, span: weekSpan });
        currentWeek = w;
        weekYear = wy;
        weekSpan = 1;
      }
      if (idx === allDays.length - 1) {
        monthSpans.push({ label: `${d.toLocaleString('default', { month: 'short' })} ${currentYear}`, span });
        weekSpans.push({ label: `W${currentWeek}`, span: weekSpan });
      }
    });
  }

  const timelineDataArray = [
    [`${plan.name} — Timeline`, ...Array(metaCols.length + allDays.length - 1).fill('')],
    [`Range: ${start.toLocaleDateString()} → ${end.toLocaleDateString()}`, ...Array(metaCols.length + allDays.length - 1).fill('')],
    [],
    [...metaCols, ...allDays.map(() => '')], // month row placeholders
    [...metaCols, ...allDays.map(() => '')], // week row placeholders
    [...metaCols, ...dayLabels],
    ...timelineRows
  ];
  const wsTimeline = X.utils.aoa_to_sheet(timelineDataArray);

  const timelineCols = [{ wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
  for (let i = 0; i < allDays.length; i++) timelineCols.push({ wch: 4 });
  wsTimeline['!cols'] = timelineCols;

  merge(wsTimeline, 0, 0, 0, timelineCols.length + allDays.length - 1);
  merge(wsTimeline, 1, 1, 0, timelineCols.length + allDays.length - 1);
  setCellStyle(wsTimeline, 0, 0, { ...titleStyle });
  setCellStyle(wsTimeline, 1, 0, { ...subtitleStyle });

  // Month header (row 3)
  let colOffset = metaCols.length;
  monthSpans.forEach((m) => {
    const startCol = colOffset;
    const endCol = colOffset + m.span - 1;
    merge(wsTimeline, 3, startCol, 3, endCol);
    setCellStyle(wsTimeline, 3, startCol, { ...monthHeaderStyle });
    wsTimeline[X.utils.encode_cell({ r: 3, c: startCol })].v = m.label;
    colOffset += m.span;
  });

  // Week header (row 4)
  colOffset = metaCols.length;
  weekSpans.forEach((w) => {
    const startCol = colOffset;
    const endCol = colOffset + w.span - 1;
    merge(wsTimeline, 4, startCol, 4, endCol);
    setCellStyle(wsTimeline, 4, startCol, { ...weekHeaderStyle });
    wsTimeline[X.utils.encode_cell({ r: 4, c: startCol })].v = w.label;
    colOffset += w.span;
  });

  // Day header (row 5)
  applyHeader(wsTimeline, 5, metaCols.length + allDays.length);
  allDays.forEach((d, idx) => {
    const addr = X.utils.encode_cell({ r: 5, c: metaCols.length + idx });
    wsTimeline[addr].s = (d.getDay() === 0 || d.getDay() === 6) ? weekendHeaderStyle : dayHeaderStyle;
    wsTimeline[addr].v = d.getDate();
  });

  // Phase bars
  sortedPhases.forEach((phase, phaseIdx) => {
    const row = phaseIdx + 6; // after title/range/spacer/month/week/day rows
    const pStart = new Date(phase.startDate);
    const pEnd = new Date(phase.endDate);
    const fillColor = PHASE_HEX[phase.type] || 'E5E7EB';

    allDays.forEach((day, dayIdx) => {
      const col = metaCols.length + dayIdx;
      const addr = X.utils.encode_cell({ c: col, r: row });
      const isHoliday = plan.holidays.some(h => isSameDay(new Date(h.date), day));
      const isActive = day >= pStart && day <= pEnd;
      if (!isActive && !isHoliday) return;

      wsTimeline[addr] = wsTimeline[addr] || { v: '' };
      wsTimeline[addr].v = isHoliday ? 'H' : '■';
      wsTimeline[addr].s = {
        font: { color: { rgb: SLATE }, bold: true, sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: isHoliday ? 'FECACA' : fillColor } },
        border: outlineBorder
      };
    });
  });

  X.utils.book_append_sheet(wb, wsTimeline, "Visual Timeline");

  // Holidays sheet
  const wsHoliday = X.utils.json_to_sheet(holidayData);
  if (holidayData.length) {
    applyHeader(wsHoliday, 0, Object.keys(holidayData[0]).length);
    wsHoliday['!cols'] = [{ wch: 25 }, { wch: 14 }];
    setCellStyle(wsHoliday, 0, 0, { ...headerStyle });
    setCellStyle(wsHoliday, 0, 1, { ...headerStyle });
  }
  X.utils.book_append_sheet(wb, wsHoliday, "Holidays");

  X.writeFile(wb, `${plan.name.replace(/\s+/g, '_')}_retroplanning.xlsx`);
};
