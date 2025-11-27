import { Phase, ProjectPlan } from "../types";

export const getPlanRange = (plan: ProjectPlan) => {
  if (plan.phases.length === 0) {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    return { start, end };
  }

  const startDates = plan.phases.map(p => new Date(p.startDate).getTime());
  const endDates = plan.phases.map(p => new Date(p.endDate).getTime());

  // Buffer of 1 week before and after
  const minDate = new Date(Math.min(...startDates));
  minDate.setDate(minDate.getDate() - 7);
  
  const maxDate = new Date(Math.max(...endDates));
  maxDate.setDate(maxDate.getDate() + 14);

  return { start: minDate, end: maxDate };
};

export const getWeeksBetween = (start: Date, end: Date) => {
  const weeks = [];
  const current = new Date(start);
  // Align to Monday
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);

  while (current <= end) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return weeks;
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export const isWithinInterval = (date: Date, start: Date, end: Date) => {
  return date >= start && date <= end;
};

export const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];
