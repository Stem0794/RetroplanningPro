
export enum PhaseType {
  CONCEPTION = 'CONCEPTION',
  DEVELOPMENT = 'DEVELOPMENT',
  TESTS = 'TESTS',
  PUSH_TO_PROD = 'PUSH_TO_PROD',
  OTHER = 'OTHER'
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // ISO string YYYY-MM-DD
}

export interface SubProject {
  id: string;
  name: string;
}

export interface Phase {
  id: string;
  name?: string; // Made optional
  startDate: string; // ISO string YYYY-MM-DD
  endDate: string; // ISO string YYYY-MM-DD
  type: PhaseType;
  details?: string;
  subProjectId?: string;
}

export interface ProjectPlan {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  phases: Phase[];
  holidays: Holiday[];
  subProjects: SubProject[];
}

export const PHASE_COLORS: Record<PhaseType, { bg: string; text: string; border: string }> = {
  [PhaseType.CONCEPTION]: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  [PhaseType.DEVELOPMENT]: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  [PhaseType.TESTS]: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  [PhaseType.PUSH_TO_PROD]: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' }, // Changed to Red
  [PhaseType.OTHER]: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
};

export const PHASE_LABELS: Record<PhaseType, string> = {
  [PhaseType.CONCEPTION]: 'Conception',
  [PhaseType.DEVELOPMENT]: 'Développement',
  [PhaseType.TESTS]: 'Tests / QA',
  [PhaseType.PUSH_TO_PROD]: 'Push to Prod',
  [PhaseType.OTHER]: 'Other',
};
