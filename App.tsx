
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import { ProjectPlan } from './types';
import { MOCK_PLAN } from './utils/mockData';
import { 
  fetchPlans as fetchPlansFromSupabase, 
  savePlan as savePlanToSupabase, 
  deletePlan as deletePlanFromSupabase, 
  duplicatePlan as duplicatePlanFromSupabase, 
  createPlan as createPlanInSupabase 
} from './services/projects';

const App: React.FC = () => {
  const [plans, setPlans] = useState<ProjectPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlans = async () => {
      try {
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

        let remotePlans = await fetchPlansFromSupabase();

        if (importedPlan) {
          await savePlanToSupabase(importedPlan);
          remotePlans = [importedPlan, ...remotePlans];
          setCurrentPlanId(importedPlan.id);
        }

        setPlans(remotePlans.length === 0 ? [MOCK_PLAN] : remotePlans);
      } catch (e) {
        console.error('Failed to load Supabase plans', e);
        setError((e as Error).message);
        setPlans([MOCK_PLAN]);
      } finally {
        setIsLoaded(true);
      }
    };

    loadPlans();
  }, []);

  const handleCreatePlan = async (plan: ProjectPlan) => {
    try {
      await createPlanInSupabase(plan);
      setPlans(prev => [plan, ...prev]);
      setCurrentPlanId(plan.id);
    } catch (e) {
      console.error('Failed to create plan', e);
      setError('Failed to create plan. Check Supabase credentials and auth user.');
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await deletePlanFromSupabase(id);
      setPlans(prev => prev.filter(p => p.id !== id));
      if (currentPlanId === id) setCurrentPlanId(null);
    } catch (e) {
      console.error('Failed to delete plan', e);
      setError('Failed to delete plan.');
    }
  };

  const handleDuplicatePlan = async (plan: ProjectPlan) => {
    try {
      const newPlan = await duplicatePlanFromSupabase(plan);
      setPlans(prev => [newPlan, ...prev]);
      setCurrentPlanId(newPlan.id);
    } catch (e) {
      console.error('Failed to duplicate plan', e);
      setError('Failed to duplicate plan.');
    }
  };

  const handleUpdatePlan = async (updatedPlan: ProjectPlan) => {
    try {
      await savePlanToSupabase(updatedPlan);
      setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (e) {
      console.error('Failed to save plan', e);
      setError('Failed to save changes.');
    }
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
