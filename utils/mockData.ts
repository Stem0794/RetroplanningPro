
import { ProjectPlan, PhaseType } from '../types';

export const MOCK_PLAN: ProjectPlan = {
  id: 'demo-plan-001',
  name: 'Demo: E-commerce Mobile App 2025',
  description: 'A sample project plan illustrating the development of a shopping application, including design, API integration, and testing.',
  createdAt: new Date().toISOString(),
  subProjects: [
    { id: 'sp-1', name: 'UX/UI Design' },
    { id: 'sp-2', name: 'Backend API' },
    { id: 'sp-3', name: 'Mobile Frontend' }
  ],
  phases: [
    { id: 'p-1', name: 'Wireframing', startDate: '2025-11-03', endDate: '2025-11-07', type: PhaseType.CONCEPTION, subProjectId: 'sp-1' },
    { id: 'p-2', name: 'High Fidelity Prototypes', startDate: '2025-11-10', endDate: '2025-11-14', type: PhaseType.CONCEPTION, subProjectId: 'sp-1' },
    { id: 'p-3', name: 'Database Setup', startDate: '2025-11-05', endDate: '2025-11-12', type: PhaseType.DEVELOPMENT, subProjectId: 'sp-2' },
    { id: 'p-4', name: 'Auth & User API', startDate: '2025-11-13', endDate: '2025-11-21', type: PhaseType.DEVELOPMENT, subProjectId: 'sp-2' },
    { id: 'p-5', name: 'Product Catalog API', startDate: '2025-11-24', endDate: '2025-12-05', type: PhaseType.DEVELOPMENT, subProjectId: 'sp-2' },
    { id: 'p-6', name: 'App Shell & Navigation', startDate: '2025-11-17', endDate: '2025-11-21', type: PhaseType.DEVELOPMENT, subProjectId: 'sp-3' },
    { id: 'p-7', name: 'Product Screens', startDate: '2025-11-24', endDate: '2025-12-12', type: PhaseType.DEVELOPMENT, subProjectId: 'sp-3' },
    { id: 'p-8', name: 'Integration Testing', startDate: '2025-12-15', endDate: '2025-12-19', type: PhaseType.TESTS, subProjectId: 'sp-2' },
    { id: 'p-9', name: 'Beta Release', startDate: '2025-12-22', endDate: '2025-12-22', type: PhaseType.PUSH_TO_PROD, subProjectId: undefined },
  ],
  holidays: [
    { id: 'h-1', name: 'Christmas Day', date: '2025-12-25' },
    { id: 'h-2', name: 'Boxing Day', date: '2025-12-26' }
  ]
};
