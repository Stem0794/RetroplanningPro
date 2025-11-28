
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import { ProjectPlan } from './types';
import { MOCK_PLAN } from './utils/mockData';

const App: React.FC = () => {
  const [plans, setPlans] = useState<ProjectPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const createMemoryStorage = () => {
    const mem = new Map<string, string>();
    return {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => { mem.set(key, value); },
      removeItem: (key: string) => { mem.delete(key); }
    };
  };

  const storage = (() => {
    try {
      const ls = window.localStorage;
      const testKey = '__retro_test__';
      ls.setItem(testKey, '1');
      ls.removeItem(testKey);
      return ls;
    } catch {
      console.warn('localStorage unavailable; using in-memory storage (data lost on reload).');
      return createMemoryStorage();
    }
  })();

  const safeGet = (key: string) => storage.getItem(key);
  const safeSet = (key: string, value: string) => storage.setItem(key, value);

  const duplicatePlanLocal = (plan: ProjectPlan): ProjectPlan => {
    const newId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const subProjectMap = new Map<string, string>();
    const newSubProjects = plan.subProjects.map((sp) => {
      const newSpId = crypto.randomUUID();
      subProjectMap.set(sp.id, newSpId);
      return { ...sp, id: newSpId };
    });

    const newPhases = plan.phases.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      subProjectId: p.subProjectId ? subProjectMap.get(p.subProjectId) : undefined,
    }));

    return {
      ...plan,
      id: newId,
      name: `${plan.name} (Copy)`,
      createdAt,
      subProjects: newSubProjects,
      phases: newPhases,
      holidays: plan.holidays.map((h) => ({ ...h, id: crypto.randomUUID() })),
    };
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedPlanData = params.get('plan');
    let importedPlan: ProjectPlan | null = null;

    if (sharedPlanData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(sharedPlanData)));
        if (decoded && decoded.id && decoded.phases) {
          importedPlan = {
            ...decoded,
            id: crypto.randomUUID(),
            name: `(Imported) ${decoded.name}`
          };
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (parseErr) {
        console.error('Failed to import shared plan', parseErr);
      }
    }

    let initialPlans: ProjectPlan[] = [];
    const saved = safeGet('retro_plans');
    if (saved) {
      try {
        initialPlans = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse local plans', e);
      }
    }

    if (importedPlan) {
      initialPlans = [importedPlan, ...initialPlans];
      setCurrentPlanId(importedPlan.id);
    }

    if (initialPlans.length === 0) {
      initialPlans = [MOCK_PLAN];
    }

    setPlans(initialPlans);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      safeSet('retro_plans', JSON.stringify(plans));
    }
  }, [plans, isLoaded]);

  const handleCreatePlan = (plan: ProjectPlan) => {
    setPlans(prev => [plan, ...prev]);
    setCurrentPlanId(plan.id);
  };

  const handleDeletePlan = (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    setPlans(prev => prev.filter(p => p.id !== id));
    if (currentPlanId === id) setCurrentPlanId(null);
  };

  const handleDuplicatePlan = (plan: ProjectPlan) => {
    const newPlan = duplicatePlanLocal(plan);
    setPlans(prev => [newPlan, ...prev]);
    setCurrentPlanId(newPlan.id);
  };

  const handleUpdatePlan = (updatedPlan: ProjectPlan) => {
    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  };

  if (!isLoaded) return null;

  const currentPlan = plans.find(p => p.id === currentPlanId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {currentPlan ? (
        <Planner 
          plan={currentPlan}
          onSave={handleUpdatePlan}
          onBack={() => setCurrentPlanId(null)}
        />
      ) : (
        <Dashboard 
          plans={plans}
          onCreate={handleCreatePlan}
          onSelect={(plan) => setCurrentPlanId(plan.id)}
          onDelete={handleDeletePlan}
          onDuplicate={handleDuplicatePlan}
        />
      )}
    </div>
  );
};

export default App;
