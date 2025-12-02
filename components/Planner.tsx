
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Trash2, ArrowLeft, Save, Plus, Download, CalendarOff, X, Edit2, Layers, ChevronDown, ChevronRight, Share2, ZoomIn, ZoomOut, Calendar } from 'lucide-react';
import { ProjectPlan, Phase, PhaseType, PHASE_COLORS, PHASE_LABELS, Holiday, SubProject } from '../types';
import { getPlanRange, getWeeksBetween, getWeekNumber, MONTH_NAMES, isSameDay, formatDate } from '../utils/dateUtils';
import { exportToExcel } from '../services/excel';

interface PlannerProps {
  plan: ProjectPlan;
  onSave: (plan: ProjectPlan) => void;
  onBack: () => void;
  readOnly?: boolean;
}

interface DragState {
  phaseId: string;
  type: 'MOVE' | 'RESIZE_L' | 'RESIZE_R';
  startX: number;
  originalStart: string;
  originalEnd: string;
  hasMoved: boolean;
}

const Planner: React.FC<PlannerProps> = ({ plan, onSave, onBack, readOnly = false }) => {
  const [phases, setPhases] = useState<Phase[]>(plan.phases);
  const [holidays, setHolidays] = useState<Holiday[]>(plan.holidays);
  const [subProjects, setSubProjects] = useState<SubProject[]>(plan.subProjects || []);
  
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [editingSubprojectId, setEditingSubprojectId] = useState<string | null>(null);
  const [editingSubprojectName, setEditingSubprojectName] = useState('');
  const [renamingPhaseId, setRenamingPhaseId] = useState<string | null>(null);
  const [renamingPhaseName, setRenamingPhaseName] = useState('');
  
  // Sidebar states
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'phases' | 'holidays'>('phases');

  // New Phase State
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseStart, setNewPhaseStart] = useState(formatDate(new Date()));
  const [newPhaseEnd, setNewPhaseEnd] = useState(formatDate(new Date()));
  const [newPhaseType, setNewPhaseType] = useState<PhaseType>(PhaseType.DEVELOPMENT);
  const [newPhaseSubProject, setNewPhaseSubProject] = useState<string>('');

  // New SubProject State
  const [newSubProjectName, setNewSubProjectName] = useState('');

  // New Holiday State
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayStart, setNewHolidayStart] = useState(formatDate(new Date()));
  const [newHolidayEnd, setNewHolidayEnd] = useState(formatDate(new Date()));

  // UI State
  const [collapsedSubProjects, setCollapsedSubProjects] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag State
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [frozenPhases, setFrozenPhases] = useState<Phase[] | null>(null);
  const [draggingPhaseId, setDraggingPhaseId] = useState<string | null>(null);
  const [dragOverPhaseId, setDragOverPhaseId] = useState<string | null>(null);
  const hasAutoScrolled = useRef<string | null>(null);
  const newSubProjectInputRef = useRef<HTMLInputElement>(null);

  // Constants
  const BASE_DAY_WIDTH = 30; 
  const DAY_WIDTH = BASE_DAY_WIDTH * zoomLevel;
  const WEEK_WIDTH = DAY_WIDTH * 7;

  // Timeline Calculations
  const timelinePhases = frozenPhases || phases;
  const { start: baseStart, end: baseEnd } = useMemo(() => getPlanRange({ ...plan, phases: timelinePhases, holidays }), [timelinePhases, plan, holidays]);
  const timelineStart = useMemo(() => {
    const d = new Date(baseStart);
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, [baseStart]);
  const timelineEnd = useMemo(() => {
    const d = new Date(baseEnd);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [baseEnd]);
  const weeks = useMemo(() => getWeeksBetween(timelineStart, timelineEnd), [timelineStart, timelineEnd]);

  // --- Handlers ---

  const validateDates = (start: string, end: string): boolean => {
      const d1 = new Date(start);
      const d2 = new Date(end);
      return d1 <= d2;
  };

  // Effect to handle Push 2 Prod logic (1 day duration)
  useEffect(() => {
    if (newPhaseType === PhaseType.PUSH_TO_PROD) {
        setNewPhaseEnd(newPhaseStart);
    }
  }, [newPhaseType, newPhaseStart]);

  const handleSave = async () => {
    if (readOnly) return;
    setSaveStatus('saving');
    try {
      await Promise.resolve(onSave({ ...plan, phases, holidays, subProjects }));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Failed to save', err);
      setSaveStatus('idle');
    }
  };

  const handleShare = () => {
    const currentData = { ...plan, phases, holidays, subProjects };
    const json = JSON.stringify(currentData);
    const encoded = btoa(encodeURIComponent(json));
    const url = `${window.location.origin}${window.location.pathname}?plan=${encoded}`;
    
    navigator.clipboard.writeText(url).then(() => {
        alert("Public link copied to clipboard! You can share this URL with your client.");
    }).catch(() => {
        alert("Failed to copy link. Please try again.");
    });
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 2));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.4));

  const scrollToDate = (target: Date, behavior: ScrollBehavior = 'smooth') => {
    if (!scrollContainerRef.current) return;

    const startOfDay = (d: Date) => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };

    const today = startOfDay(target);
    const gridStart = startOfDay(weeks[0] ? new Date(weeks[0]) : new Date(timelineStart));
    const diffDays = (today.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24);
    const pixelOffset = Math.max(0, diffDays * DAY_WIDTH);
    const containerWidth = scrollContainerRef.current.clientWidth;

    scrollContainerRef.current.scrollTo({
      left: pixelOffset + DAY_WIDTH / 2 - (containerWidth / 2),
      behavior
    });
  };

  const handleScrollToToday = () => scrollToDate(new Date(), 'smooth');

  useEffect(() => {
    if (hasAutoScrolled.current === plan.id) return;
    const id = requestAnimationFrame(() => {
      scrollToDate(new Date(), 'auto');
      hasAutoScrolled.current = plan.id;
    });
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, weeks.length, DAY_WIDTH]);

  const handleAddPhase = () => {
    if (readOnly) return;
    if (!validateDates(newPhaseStart, newPhaseEnd)) {
        alert("Start date must be before or equal to End date.");
        return;
    }

    const newPhase: Phase = {
        id: crypto.randomUUID(),
        name: newPhaseName,
        startDate: newPhaseStart,
        endDate: newPhaseEnd,
        type: newPhaseType,
        subProjectId: newPhaseSubProject || undefined
    };
    setPhases([...phases, newPhase]);
    setNewPhaseName('');
    setSidebarOpen(false); // Close sidebar after quick add
  };

  const handleUpdatePhase = () => {
    if (readOnly) return;
    if (!editingPhase) return;
    
    if (!validateDates(editingPhase.startDate, editingPhase.endDate)) {
        alert("Start date must be before or equal to End date.");
        return;
    }

    setPhases(phases.map(p => p.id === editingPhase.id ? editingPhase : p));
    setEditingPhase(null);
  }

  const handleDeletePhase = (id: string) => {
    if (readOnly) return;
    setPhases(phases.filter(p => p.id !== id));
    if (editingPhase?.id === id) setEditingPhase(null);
  };

  const handleAddSubProject = () => {
    if (readOnly) return;
    if (!newSubProjectName) return;
    const newSp: SubProject = {
        id: crypto.randomUUID(),
        name: newSubProjectName
    };
    setSubProjects([...subProjects, newSp]);
    setNewSubProjectName('');
  };

  const handleDeleteSubProject = (id: string) => {
    if (readOnly) return;
    setPhases(phases.map(p => p.subProjectId === id ? { ...p, subProjectId: undefined } : p));
    setSubProjects(subProjects.filter(sp => sp.id !== id));
  };

  const startRenamingSubproject = (sp: SubProject) => {
    if (readOnly) return;
    setEditingSubprojectId(sp.id);
    setEditingSubprojectName(sp.name);
  };

  const commitSubprojectName = () => {
    if (!editingSubprojectId) return;
    setSubProjects(prev => prev.map(sp => sp.id === editingSubprojectId ? { ...sp, name: editingSubprojectName.trim() || sp.name } : sp));
    setEditingSubprojectId(null);
    setEditingSubprojectName('');
  };

  const startRenamingPhase = (phase: Phase) => {
    if (readOnly) return;
    setRenamingPhaseId(phase.id);
    setRenamingPhaseName(phase.name || '');
  };

  const commitPhaseName = () => {
    if (!renamingPhaseId) return;
    setPhases(prev => prev.map(p => p.id === renamingPhaseId ? { ...p, name: renamingPhaseName.trim() || undefined } : p));
    setRenamingPhaseId(null);
    setRenamingPhaseName('');
  };

  const cancelPhaseName = () => {
    setRenamingPhaseId(null);
    setRenamingPhaseName('');
  };

  const handleAddHoliday = () => {
    if (readOnly) return;
    if (!newHolidayName) return;
    const start = new Date(newHolidayStart);
    const end = new Date(newHolidayEnd);
    if (start > end) return;

    const entries: Holiday[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      entries.push({
        id: crypto.randomUUID(),
        name: newHolidayName,
        date: formatDate(cursor)
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    setHolidays([...holidays, ...entries]);
    const today = formatDate(new Date());
    setNewHolidayName('');
    setNewHolidayStart(today);
    setNewHolidayEnd(today);
  };

  const handleUpdateHoliday = () => {
    if (readOnly) return;
    if (!editingHoliday) return;
    setHolidays(holidays.map(h => h.id === editingHoliday.id ? editingHoliday : h));
    setEditingHoliday(null);
  };

  const handleDeleteHoliday = (id: string) => {
    if (readOnly) return;
    setHolidays(holidays.filter(h => h.id !== id));
    if (editingHoliday?.id === id) setEditingHoliday(null);
  };

  const handleExport = () => {
    exportToExcel({ ...plan, phases, holidays, subProjects });
  };

  const toggleSubProjectCollapse = (id: string) => {
    const newSet = new Set(collapsedSubProjects);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setCollapsedSubProjects(newSet);
  };

  const handleGridClick = (e: React.MouseEvent, subProjectId?: string) => {
      if (readOnly) return;
      // Prevent triggering if clicking on an existing phase (bubbling handled by phase click handler, but safe to check)
      if ((e.target as HTMLElement).closest('.group\\/phase')) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0); // Not adding scrollLeft here because we are clicking relative to the container which moves? 
      // Actually, e.nativeEvent.offsetX is relative to the target. 
      // If we click the row container which is wide, offsetX is the pixel position from start.
      
      const offsetX = e.nativeEvent.offsetX;
      const dayIndex = Math.floor(offsetX / DAY_WIDTH);
      
      const clickDate = new Date(timelineStart);
      clickDate.setDate(clickDate.getDate() + dayIndex);
      const dateStr = formatDate(clickDate);

      // Setup New Phase Form
      setNewPhaseStart(dateStr);
      setNewPhaseEnd(dateStr); // Default 1 day
      setNewPhaseType(PhaseType.DEVELOPMENT);
      setNewPhaseSubProject(subProjectId || '');
      setNewPhaseName('');
      
      setEditingPhase(null);
      setActiveTab('phases');
      setSidebarOpen(true);
  };

  // --- Drag & Drop Logic ---

  const reorderPhases = (sourceId: string, targetId: string) => {
    setPhases(prev => {
      const list = [...prev];
      const fromIndex = list.findIndex(p => p.id === sourceId);
      const toIndex = list.findIndex(p => p.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      if (list[fromIndex].subProjectId !== list[toIndex].subProjectId) return prev; // only reorder within same subproject

      const [moved] = list.splice(fromIndex, 1);
      const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
      list.splice(insertAt, 0, moved);
      return list;
    });
  };

  const handlePhaseRowDragStart = (phaseId: string) => {
    if (readOnly) return;
    setDraggingPhaseId(phaseId);
  };

  const handlePhaseRowDragEnter = (phaseId: string) => {
    if (readOnly) return;
    if (draggingPhaseId && draggingPhaseId !== phaseId) {
      setDragOverPhaseId(phaseId);
    }
  };

  const handlePhaseRowDrop = (phaseId: string) => {
    if (readOnly) return;
    if (draggingPhaseId && draggingPhaseId !== phaseId) {
      reorderPhases(draggingPhaseId, phaseId);
    }
    setDraggingPhaseId(null);
    setDragOverPhaseId(null);
  };

  const handlePhaseRowDragEnd = () => {
    setDraggingPhaseId(null);
    setDragOverPhaseId(null);
  };

  const getDateFromEvent = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;
    const dayIndex = Math.floor(x / DAY_WIDTH);
    const gridStart = new Date(timelineStart);
    gridStart.setHours(0, 0, 0, 0);
    const clickDate = new Date(gridStart);
    clickDate.setDate(clickDate.getDate() + dayIndex);
    return formatDate(clickDate);
  };

  // Drawing-to-add removed

  const addDays = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const handleDragStart = (e: React.MouseEvent, phase: Phase, type: 'MOVE' | 'RESIZE_L' | 'RESIZE_R') => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      phaseId: phase.id,
      type,
      startX: e.clientX,
      originalStart: phase.startDate,
      originalEnd: phase.endDate,
      hasMoved: false
    });
    setFrozenPhases(phases);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaX / DAY_WIDTH);

      if (deltaDays === 0) return;

      if (!dragState.hasMoved && Math.abs(deltaX) > 5) {
          setDragState(prev => prev ? { ...prev, hasMoved: true } : null);
      }

      const originalStartDate = new Date(dragState.originalStart);
      const originalEndDate = new Date(dragState.originalEnd);

      let newStart = dragState.originalStart;
      let newEnd = dragState.originalEnd;

      if (dragState.type === 'MOVE') {
        newStart = addDays(dragState.originalStart, deltaDays);
        newEnd = addDays(dragState.originalEnd, deltaDays);
      } else if (dragState.type === 'RESIZE_L') {
        newStart = addDays(dragState.originalStart, deltaDays);
        if (new Date(newStart) > originalEndDate) {
            newStart = dragState.originalEnd; // Clamp
        }
      } else if (dragState.type === 'RESIZE_R') {
        newEnd = addDays(dragState.originalEnd, deltaDays);
        if (new Date(newEnd) < originalStartDate) {
            newEnd = dragState.originalStart; // Clamp
        }
      }

      setPhases(prev => prev.map(p => 
        p.id === dragState.phaseId 
          ? { ...p, startDate: newStart, endDate: newEnd } 
          : p
      ));
    };

    const handleMouseUp = () => {
      if (dragState) {
        setDragState(null);
        setFrozenPhases(null);
      }
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, DAY_WIDTH]);

  // Styling helper
  const inputClass = "w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all";

  // Rendering Helpers
  const renderGridHeader = () => {
    return (
        <div className="flex">
            {weeks.map((week, wIdx) => {
                const isNewMonth = wIdx === 0 || week.getMonth() !== weeks[wIdx - 1].getMonth();
                const monthName = MONTH_NAMES[week.getMonth()];
                const weekNum = getWeekNumber(week);
                
                const daysInWeek = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(week);
                    d.setDate(d.getDate() + i);
                    return d;
                });

                return (
                    <div key={wIdx} className="flex-shrink-0 flex flex-col" style={{ width: WEEK_WIDTH }}>
                        {/* Month Header */}
                        <div className={`h-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 flex items-center overflow-hidden whitespace-nowrap ${isNewMonth ? 'bg-slate-100 border-l border-slate-300' : 'bg-slate-50 border-b border-slate-200'}`}>
                            {isNewMonth ? `${monthName} ${week.getFullYear()}` : ''}
                        </div>
                        {/* Week Header */}
                        <div className="h-6 border-r border-b border-slate-200 bg-white text-[10px] text-slate-400 flex items-center justify-center">
                            W{weekNum}
                        </div>
                        {/* Days Header */}
                        <div className="h-6 border-b border-slate-200 flex">
                            {daysInWeek.map((day, dIdx) => {
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                return (
                                    <div 
                                        key={dIdx} 
                                        className={`flex-1 border-r border-slate-100 text-[9px] flex items-center justify-center ${isWeekend ? 'bg-slate-50 text-slate-400' : 'text-slate-600'}`}
                                    >
                                        {day.getDate()}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  const renderTimelineRow = (phase: Phase) => {
    const phaseStart = new Date(phase.startDate);
    const phaseEnd = new Date(phase.endDate);
    
    // Calculate Position
    const diffTime = phaseStart.getTime() - weeks[0].getTime();
    const daysFromStart = diffTime / (1000 * 60 * 60 * 24);
    
    // Duration
    const durationTime = phaseEnd.getTime() - phaseStart.getTime();
    const durationDays = (durationTime / (1000 * 60 * 60 * 24)) + 1;

    const left = daysFromStart * DAY_WIDTH;
    const width = durationDays * DAY_WIDTH;
    
    const colors = PHASE_COLORS[phase.type];
    const defaultLabel = phase.name || PHASE_LABELS[phase.type];
    const label = (!phase.name && phase.type === PhaseType.PUSH_TO_PROD) ? '🚀' : defaultLabel;

    const isDraggingThis = dragState?.phaseId === phase.id;

    return (
        <div 
            key={phase.id}
            className={`absolute top-1.5 h-7 rounded-md shadow-sm border ${colors.bg} ${colors.border} ${colors.text} flex items-center px-2 text-[10px] font-semibold z-10 transition-colors group/phase overflow-hidden whitespace-nowrap select-none ${isDraggingThis ? 'cursor-move ring-2 ring-indigo-400 ring-offset-1 z-20' : 'cursor-pointer hover:brightness-95'}`}
            style={{
                left: `${Math.max(0, left)}px`,
                width: `${Math.max(DAY_WIDTH, width)}px`,
            }}
            onMouseDown={(e) => handleDragStart(e, phase, 'MOVE')}
            onClick={(e) => {
                e.stopPropagation(); // Stop grid click
                if (!dragState?.hasMoved) {
                    setEditingPhase(phase);
                    setSidebarOpen(true);
                    setActiveTab('phases');
                }
            }}
            title={`${label} (${phase.startDate} to ${phase.endDate})`}
        >
            <div 
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 z-30"
                onMouseDown={(e) => handleDragStart(e, phase, 'RESIZE_L')}
            />
            <span className="truncate flex-1 pl-1">{label}</span>
            <div 
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 z-30"
                onMouseDown={(e) => handleDragStart(e, phase, 'RESIZE_R')}
            />
        </div>
    );
  };

  // Background Grid: Weekends
  const renderBackgroundGrid = () => {
      return (
          <div className="flex absolute inset-0 z-0 h-full pointer-events-none">
              {weeks.map((week, wIdx) => {
                  const daysInWeek = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(week);
                      d.setDate(d.getDate() + i);
                      return d;
                  });

                  return (
                      <div key={wIdx} className="flex flex-shrink-0" style={{ width: WEEK_WIDTH }}>
                          {daysInWeek.map((day, dIdx) => {
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                return (
                                    <div 
                                        key={dIdx} 
                                        className={`flex-1 border-r border-slate-50 h-full relative ${isWeekend ? 'bg-slate-50/60' : ''}`}
                                    />
                                );
                          })}
                      </div>
                  )
              })}
          </div>
      )
  };

  const renderNewPhaseGhost = (rowKey: string) => {
    if (!isDrawingNewPhase || !newPhaseDraft) return null;
    if (newPhaseDraft.rowKey !== rowKey) return null;
    const start = new Date(newPhaseDraft.startDate);
    const end = new Date(newPhaseDraft.endDate);
    const startDate = start <= end ? start : end;
    const endDate = start <= end ? end : start;
    const diffTime = startDate.getTime() - weeks[0].getTime();
    const daysFromStart = diffTime / (1000 * 60 * 60 * 24);
    const durationDays = ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const left = daysFromStart * DAY_WIDTH;
    const width = Math.max(DAY_WIDTH, durationDays * DAY_WIDTH);
    return (
      <div
        className="absolute top-1.5 h-7 rounded-md border border-dashed border-indigo-400 bg-indigo-500/20 z-10 pointer-events-none"
        style={{ left: `${left}px`, width: `${width}px` }}
      />
    );
  };

  // Holiday Overlay: Highest Z-Index to obscure phases
  const renderHolidayOverlay = () => {
    return (
        <div className="flex absolute inset-0 z-20 h-full pointer-events-none">
            {weeks.map((week, wIdx) => {
                const daysInWeek = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(week);
                    d.setDate(d.getDate() + i);
                    return d;
                });

                return (
                    <div key={wIdx} className="flex flex-shrink-0" style={{ width: WEEK_WIDTH }}>
                        {daysInWeek.map((day, dIdx) => {
                              const holiday = holidays.find(h => isSameDay(new Date(h.date), day));
                              if (!holiday) return <div key={dIdx} className="flex-1" />;

                              return (
                                  <div 
                                      key={dIdx} 
                                      className="flex-1 h-full relative bg-slate-100 hatched-pattern border-l border-slate-200"
                                      title={`Holiday: ${holiday.name}`}
                                  >
                                      {/* Vertical Text for Holiday */}
                                      <div className="absolute inset-0 z-30 flex flex-col justify-end pb-2 items-center overflow-hidden">
                                          <div className="text-[9px] font-bold text-slate-400 rotate-180 writing-vertical whitespace-nowrap opacity-75">
                                              {holiday.name}
                                          </div>
                                      </div>
                                  </div>
                              );
                        })}
                    </div>
                )
            })}
        </div>
    )
};

  const generalPhases = phases.filter(p => !p.subProjectId);
  const groupedPhases = subProjects.map(sp => ({
      subProject: sp,
      phases: phases.filter(p => p.subProjectId === sp.id)
  }));

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top Bar */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-30">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
                <ArrowLeft size={20} />
            </button>
            <div>
                <h1 className="text-lg font-bold text-slate-800">{plan.name}</h1>
                <p className="text-xs text-slate-500">Retroplanning</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
             {/* Zoom Controls */}
             <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
                 <button onClick={handleZoomOut} className="p-1.5 hover:bg-white rounded-md text-slate-500 transition-all disabled:opacity-50" disabled={zoomLevel <= 0.4}>
                    <ZoomOut size={16} />
                 </button>
                 <span className="text-xs font-medium text-slate-500 w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
                 <button onClick={handleZoomIn} className="p-1.5 hover:bg-white rounded-md text-slate-500 transition-all disabled:opacity-50" disabled={zoomLevel >= 2}>
                    <ZoomIn size={16} />
                 </button>
             </div>
             
            <button 
                onClick={handleScrollToToday}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors"
                title="Scroll to Today"
            >
                <Calendar size={16} />
                Today
            </button>

             {!readOnly && (
              <>
                <button 
                  onClick={handleShare}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                  title="Create Public Link"
                >
                  <Share2 size={16} />
                  Share
                </button>
                <div className="w-px h-6 bg-slate-300 mx-1"></div>
                <button 
                  onClick={() => { setSidebarOpen(true); setActiveTab('holidays'); setEditingPhase(null); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <CalendarOff size={16} />
                  Add OOO
                </button>
                <button 
                  onClick={() => { setSidebarOpen(true); setActiveTab('phases'); setEditingHoliday(null); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Plus size={16} />
                  New Phase
                </button>
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <Download size={16} />
                  Export
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  <Save size={16} />
                  {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
                </button>
              </>
             )}
             {readOnly && (
              <span className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full">
                Public view (read-only)
              </span>
             )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden relative flex">
        {/* Floating quick-add actions */}
        {!readOnly && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
            <button
              onClick={() => {
                setSidebarOpen(true);
                setActiveTab('phases');
                setEditingPhase(null);
                setEditingHoliday(null);
                setTimeout(() => newSubProjectInputRef.current?.focus(), 0);
              }}
              className="px-4 py-2 rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-900 text-sm"
            >
              Add Subproject
            </button>
            <button
              onClick={() => {
                setSidebarOpen(true);
                setActiveTab('phases');
                setEditingPhase(null);
                setEditingHoliday(null);
                const today = formatDate(new Date());
                setNewPhaseStart(today);
                setNewPhaseEnd(today);
              }}
              className="px-4 py-2 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 text-sm"
            >
              New Phase
            </button>
            <button
              onClick={() => {
                setSidebarOpen(true);
                setActiveTab('holidays');
                setEditingHoliday(null);
                const today = formatDate(new Date());
                setNewHolidayStart(today);
                setNewHolidayEnd(today);
                setNewHolidayName('');
              }}
              className="px-4 py-2 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 text-sm"
            >
              Add OOO
            </button>
          </div>
        )}
        
        {/* Scrollable Timeline Area */}
        <div ref={scrollContainerRef} className={`flex-1 overflow-auto timeline-scroll bg-white relative ${dragState ? 'cursor-grabbing' : ''}`}>
           <div className="min-w-max p-8 pb-20">
             
             {/* Timeline Header */}
             <div className="sticky top-0 z-30 shadow-sm flex mb-2 bg-white">
                {/* Left Label Spacer */}
                <div className="w-64 bg-white border-r border-b border-slate-200 flex-shrink-0 flex items-end pb-2 px-4 sticky left-0 z-40 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)]">
                    <span className="text-xs font-bold text-slate-400 uppercase">Subprojects & Phases</span>
                </div>
                {renderGridHeader()}
             </div>

             {/* Content */}
             <div className="relative">
                {/* Subprojects Loop */}
                {groupedPhases.map(({ subProject, phases: spPhases }) => {
                    const isCollapsed = collapsedSubProjects.has(subProject.id);
                    return (
                        <div key={subProject.id} className="mb-4">
                            {/* Subproject Header Row */}
                            <div className="flex sticky left-0 z-20 w-full">
                                <div className="w-64 sticky left-0 z-30 bg-slate-50 border-y border-slate-200 px-4 py-2 flex items-center justify-between shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)]">
                                    <button 
                                        onClick={() => toggleSubProjectCollapse(subProject.id)}
                                        className="flex items-center gap-2 font-bold text-slate-700 text-sm hover:text-indigo-600"
                                    >
                {isCollapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
                                        {editingSubprojectId === subProject.id ? (
                                          <input
                                            value={editingSubprojectName}
                                            autoFocus
                                            onChange={(e) => setEditingSubprojectName(e.target.value)}
                                            onBlur={commitSubprojectName}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') commitSubprojectName();
                                              if (e.key === 'Escape') { setEditingSubprojectId(null); setEditingSubprojectName(''); }
                                            }}
                                            className="text-sm font-medium bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                          />
                                        ) : (
                                          <span
                                            className="hover:underline"
                                            onClick={(e) => { e.stopPropagation(); startRenamingSubproject(subProject); }}
                                          >
                                            {subProject.name}
                                          </span>
                                        )}
                                    </button>
                                    <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                        {spPhases.length}
                                    </span>
                                </div>
                                <div className="flex-1 bg-slate-50/50 border-y border-slate-100"></div>
                            </div>

                            {!isCollapsed && (
                                <div className="relative mt-1">
                                    {renderNewPhaseGhost(subProject.id)}
                                    {spPhases.map(phase => (
                                        <div
                                            key={phase.id}
                                            className={`flex h-10 group ${dragOverPhaseId === phase.id ? 'bg-indigo-50/60' : ''}`}
                                            draggable={!readOnly}
                                            onDragStart={() => handlePhaseRowDragStart(phase.id)}
                                            onDragEnter={() => handlePhaseRowDragEnter(phase.id)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={() => handlePhaseRowDrop(phase.id)}
                                            onDragEnd={handlePhaseRowDragEnd}
                                        >
                                            {/* Phase Label */}
                                            <div className={`w-64 sticky left-0 z-30 bg-white border-r border-slate-100 px-8 py-2 flex items-center justify-between shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}>
                                                {renamingPhaseId === phase.id ? (
                                                  <input
                                                    value={renamingPhaseName}
                                                    autoFocus
                                                    onChange={(e) => setRenamingPhaseName(e.target.value)}
                                                    onBlur={commitPhaseName}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') commitPhaseName();
                                                      if (e.key === 'Escape') cancelPhaseName();
                                                    }}
                                                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                  />
                                                ) : (
                                                  <div
                                                    className="truncate text-xs font-medium text-slate-600"
                                                    title={phase.name || PHASE_LABELS[phase.type]}
                                                    onClick={() => startRenamingPhase(phase)}
                                                  >
                                                    {phase.name || PHASE_LABELS[phase.type]}
                                                  </div>
                                                )}
                                                {!readOnly && (
                                                  <button 
                                                      onClick={() => { setEditingPhase(phase); setSidebarOpen(true); setActiveTab('phases'); }}
                                                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 transition-opacity"
                                                  >
                                                      <Edit2 size={10}/>
                                                  </button>
                                                )}
                                            </div>
                                            
                                            {/* Grid Track */}
                                            <div 
                                            className="relative flex-1 cursor-crosshair"
                                            onClick={(e) => handleGridClick(e, subProject.id)}
                                        >
                                            {renderBackgroundGrid()}
                                            {renderTimelineRow(phase)}
                                            {renderHolidayOverlay()}
                                        </div>
                                    </div>
                                    ))}
                        {/* Empty Row for Click to Add */}
                        <div className="flex h-8 hover:bg-slate-50/50 transition-colors">
                            <div className="w-64 sticky left-0 z-30 bg-white border-r border-slate-100 px-8 py-2 text-xs text-slate-300 italic">
                                Click grid to add phase +
                            </div>
                            <div 
                                className="relative flex-1 cursor-crosshair"
                                            onClick={(e) => handleGridClick(e, subProject.id)}
                                        >
                                            {renderBackgroundGrid()}
                                            {renderHolidayOverlay()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* General / Uncategorized Phases */}
                <div className="mb-4">
                    <div className="flex sticky left-0 z-20 w-full">
                            <div className="w-64 sticky left-0 z-30 bg-slate-50 border-y border-slate-200 px-4 py-2 flex items-center shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)]">
                            <span className="font-bold text-slate-700 text-sm">General</span>
                        </div>
                        <div className="flex-1 bg-slate-50/50 border-y border-slate-100"></div>
                    </div>
                    <div className="relative mt-1">
                        {generalPhases.map(phase => (
                            <div
                                key={phase.id}
                                className={`flex h-10 group ${dragOverPhaseId === phase.id ? 'bg-indigo-50/60' : ''}`}
                                draggable={!readOnly}
                                onDragStart={() => handlePhaseRowDragStart(phase.id)}
                                onDragEnter={() => handlePhaseRowDragEnter(phase.id)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handlePhaseRowDrop(phase.id)}
                                onDragEnd={handlePhaseRowDragEnd}
                            >
                                <div className={`w-64 sticky left-0 z-30 bg-white border-r border-slate-100 px-4 py-2 flex items-center justify-between shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}>
                                    {renamingPhaseId === phase.id ? (
                                      <input
                                        value={renamingPhaseName}
                                        autoFocus
                                        onChange={(e) => setRenamingPhaseName(e.target.value)}
                                        onBlur={commitPhaseName}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') commitPhaseName();
                                          if (e.key === 'Escape') cancelPhaseName();
                                        }}
                                        className="w-full text-xs font-medium bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                      />
                                    ) : (
                                      <div
                                        className="truncate text-xs font-medium text-slate-600"
                                        onClick={() => startRenamingPhase(phase)}
                                      >
                                        {phase.name || PHASE_LABELS[phase.type]}
                                      </div>
                                    )}
                                    {!readOnly && (
                                      <button 
                                          onClick={() => { setEditingPhase(phase); setSidebarOpen(true); setActiveTab('phases'); }}
                                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 transition-opacity"
                                      >
                                          <Edit2 size={10}/>
                                      </button>
                                    )}
                                </div>
                            <div 
                            className="relative flex-1 cursor-crosshair"
                            onClick={(e) => handleGridClick(e)}
                        >
                            {renderBackgroundGrid()}
                            {renderTimelineRow(phase)}
                            {renderHolidayOverlay()}
                        </div>
                    </div>
                ))}
                        {/* Empty Row General */}
                        <div className="flex h-8 hover:bg-slate-50/50 transition-colors">
                            <div className="w-64 sticky left-0 z-30 bg-white border-r border-slate-100 px-8 py-2 text-xs text-slate-300 italic">
                                Click grid to add phase +
                            </div>
                            <div 
                                className="relative flex-1 cursor-crosshair"
                                onClick={(e) => handleGridClick(e)}
                            >
                                {renderBackgroundGrid()}
                                {renderHolidayOverlay()}
                            </div>
                        </div>
                    </div>
                </div>
             </div>
           </div>
        </div>

        {/* Right Sidebar */}
        {!readOnly && isSidebarOpen && (
            <div className="w-96 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col h-full animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="font-bold text-slate-700 uppercase tracking-wide text-sm">
                        {activeTab === 'phases' ? 'Manage Phases & Subprojects' : 'Manage Holidays'}
                    </h2>
                    <button onClick={() => { setSidebarOpen(false); setEditingPhase(null); setEditingHoliday(null); }} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* PHASE MANAGEMENT */}
                    {activeTab === 'phases' && editingPhase ? (
                        <div className="space-y-4">
                             <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4">
                                <h3 className="text-indigo-800 font-semibold mb-2 flex items-center gap-2">
                                    <Edit2 size={14}/> Editing Phase
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Name (Optional)</label>
                                        <input 
                                            type="text" 
                                            className={inputClass} 
                                            placeholder={PHASE_LABELS[editingPhase.type]}
                                            value={editingPhase.name || ''} 
                                            onChange={e => setEditingPhase({...editingPhase, name: e.target.value})} 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Start</label>
                                            <input 
                                                type="date" 
                                                className={inputClass} 
                                                value={editingPhase.startDate} 
                                                onChange={e => setEditingPhase({...editingPhase, startDate: e.target.value})} 
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">End</label>
                                            <input 
                                                type="date" 
                                                className={inputClass} 
                                                value={editingPhase.endDate} 
                                                onChange={e => setEditingPhase({...editingPhase, endDate: e.target.value})} 
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                                        <select className={inputClass} value={editingPhase.type} onChange={e => setEditingPhase({...editingPhase, type: e.target.value as PhaseType})}>
                                            {Object.keys(PhaseType).map(t => (
                                                <option key={t} value={t}>{PHASE_LABELS[t as PhaseType]}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <button onClick={handleUpdatePhase} className="flex-1 bg-indigo-600 text-white py-2 rounded text-sm hover:bg-indigo-700">Update</button>
                                        <button onClick={() => handleDeletePhase(editingPhase.id)} className="px-3 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                             </div>
                             <button onClick={() => setEditingPhase(null)} className="w-full py-2 text-sm text-slate-500 underline">Cancel Edit</button>
                        </div>
                    ) : activeTab === 'phases' ? (
                        /* ADD MODE */
                        <div className="space-y-8">
                            {/* Subproject Section */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    <Layers size={16} className="text-slate-400"/> Subprojects
                                </h3>
                                <div className="flex gap-2 mb-3">
                                    <input 
                                        type="text" 
                                        placeholder="New Subproject Name"
                                        className={inputClass}
                                        value={newSubProjectName}
                                        onChange={(e) => setNewSubProjectName(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleAddSubProject}
                                        className="bg-slate-800 text-white px-3 rounded-lg text-sm hover:bg-slate-900 shadow-sm"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {subProjects.map(sp => (
                                        <div key={sp.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded hover:bg-slate-100 group">
                                            <span>{sp.name}</span>
                                            <button onClick={() => handleDeleteSubProject(sp.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    ))}
                                    {subProjects.length === 0 && <p className="text-xs text-slate-400 italic">No subprojects defined.</p>}
                                </div>
                            </div>

                            {/* Add Phase Section */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="font-semibold text-slate-700 mb-3">Add New Phase</h3>
                                <div className="space-y-3">
                                    <select 
                                        className={inputClass}
                                        value={newPhaseSubProject}
                                        onChange={(e) => setNewPhaseSubProject(e.target.value)}
                                    >
                                        <option value="">General (No Subproject)</option>
                                        {subProjects.map(sp => (
                                            <option key={sp.id} value={sp.id}>{sp.name}</option>
                                        ))}
                                    </select>

                                    <div className="grid grid-cols-2 gap-2">
                                        <select 
                                            className={inputClass}
                                            value={newPhaseType}
                                            onChange={(e) => setNewPhaseType(e.target.value as PhaseType)}
                                        >
                                            {Object.keys(PhaseType).map(t => (
                                                <option key={t} value={t}>{PHASE_LABELS[t as PhaseType]}</option>
                                            ))}
                                        </select>
                                        <input 
                                            type="text" 
                                            placeholder="Name (Opt)" 
                                            className={inputClass}
                                            value={newPhaseName}
                                            onChange={(e) => setNewPhaseName(e.target.value)}
                                        />
                                    </div>

                                     <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Start</label>
                                            <input 
                                                type="date" 
                                                className={inputClass} 
                                                value={newPhaseStart} 
                                                onChange={e => setNewPhaseStart(e.target.value)} 
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">End</label>
                                            <input 
                                                type="date" 
                                                className={inputClass} 
                                                value={newPhaseEnd} 
                                                onChange={e => setNewPhaseEnd(e.target.value)} 
                                                disabled={newPhaseType === PhaseType.PUSH_TO_PROD}
                                            />
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={handleAddPhase}
                                        className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                                    >
                                        Add Phase
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* HOLIDAYS TAB */
                        editingHoliday ? (
                             <div className="space-y-4">
                                 <div className="bg-red-50 p-4 rounded-lg border border-red-100 mb-4">
                                    <h3 className="text-red-800 font-semibold mb-2 flex items-center gap-2">
                                        <Edit2 size={14}/> Editing: {editingHoliday.name}
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Holiday Name</label>
                                            <input 
                                                type="text" 
                                                className="w-full p-2 border border-red-200 rounded text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-red-400"
                                                value={editingHoliday.name}
                                                onChange={(e) => setEditingHoliday({...editingHoliday, name: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                                            <input 
                                                type="date" 
                                                className="w-full p-2 border border-red-200 rounded text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-red-400" 
                                                value={editingHoliday.date} 
                                                onChange={e => setEditingHoliday({...editingHoliday, date: e.target.value})} 
                                            />
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <button onClick={handleUpdateHoliday} className="flex-1 bg-red-600 text-white py-2 rounded text-sm hover:bg-red-700">Update</button>
                                            <button onClick={() => handleDeleteHoliday(editingHoliday.id)} className="px-3 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                 </div>
                                 <button onClick={() => setEditingHoliday(null)} className="w-full py-2 text-sm text-slate-500 underline">Cancel Edit</button>
                            </div>
                        ) : (
                             <div className="space-y-6">
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                                    <h3 className="font-semibold text-red-800 mb-3">Add OOO / Holiday</h3>
                                    <div className="space-y-3">
                                        <input 
                                            type="text" 
                                            placeholder="Holiday Name (e.g. Christmas)" 
                                            className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm shadow-sm placeholder-red-300 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                            value={newHolidayName}
                                            onChange={(e) => setNewHolidayName(e.target.value)}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                          <input 
                                              type="date" 
                                              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" 
                                              value={newHolidayStart} 
                                              onChange={e => setNewHolidayStart(e.target.value)} 
                                          />
                                          <input 
                                              type="date" 
                                              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm shadow-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" 
                                              value={newHolidayEnd} 
                                              onChange={e => setNewHolidayEnd(e.target.value)} 
                                          />
                                        </div>
                                        <button 
                                            onClick={handleAddHoliday}
                                            className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
                                        >
                                            Add OOO
                                        </button>
                                    </div>
                                </div>

                                 <div>
                                    <h3 className="font-semibold text-slate-700 mb-2">Planned Absences</h3>
                                    {holidays.length === 0 && <p className="text-sm text-slate-400">No holidays added yet.</p>}
                                    <div className="space-y-2">
                                        {holidays.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(h => (
                                            <div 
                                                key={h.id} 
                                                onClick={() => setEditingHoliday(h)}
                                                className="p-3 bg-white border border-slate-200 rounded-lg flex justify-between items-center cursor-pointer hover:border-red-300 group transition-all hover:shadow-sm"
                                            >
                                                <div>
                                                    <div className="font-medium text-sm text-slate-800">{h.name}</div>
                                                    <div className="text-xs text-slate-500">{h.date}</div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Edit2 size={14} className="text-slate-400 hover:text-indigo-500" />
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteHoliday(h.id); }} 
                                                        className="text-slate-400 hover:text-red-500"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                             </div>
                        )
                    )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default Planner;
