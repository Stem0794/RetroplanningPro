
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import { ProjectPlan } from './types';
import { MOCK_PLAN } from './utils/mockData';

const App: React.FC = () => {
  const [plans, setPlans] = useState<ProjectPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 1. Check for shared plan in URL
    const params = new URLSearchParams(window.location.search);
    const sharedPlanData = params.get('plan');
    let importedPlan: ProjectPlan | null = null;

    if (sharedPlanData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(sharedPlanData)));
        // Validate basic structure
        if (decoded && decoded.id && decoded.phases) {
           importedPlan = {
             ...decoded,
             id: crypto.randomUUID(), // New ID to avoid conflicts
             name: `(Imported) ${decoded.name}`
           };
           // Clean URL
           window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (e) {
        console.error("Failed to import plan", e);
      }
    }

    // 2. Load from LocalStorage
    const saved = localStorage.getItem('retro_plans');
    let initialPlans: ProjectPlan[] = [];

    if (saved) {
      try {
        initialPlans = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse plans", e);
      }
    }

    // 3. Logic: If imported plan exists, add it. 
    // If no plans at all (even after import attempt), use Mock.
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

  // Save to LocalStorage whenever plans change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('retro_plans', JSON.stringify(plans));
    }
  }, [plans, isLoaded]);

  const handleCreatePlan = (plan: ProjectPlan) => {
    setPlans(prev => [plan, ...prev]);
    setCurrentPlanId(plan.id);
  };

  const handleDeletePlan = (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
        setPlans(prev => prev.filter(p => p.id !== id));
        if (currentPlanId === id) setCurrentPlanId(null);
    }
  };

  const handleDuplicatePlan = (plan: ProjectPlan) => {
    const newPlan = {
        ...plan,
        id: crypto.randomUUID(),
        name: `${plan.name} (Copy)`,
        createdAt: new Date().toISOString()
    };
    setPlans(prev => [newPlan, ...prev]);
  };

  const handleUpdatePlan = (updatedPlan: ProjectPlan) => {
    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  };

  if (!isLoaded) return null;

  const currentPlan = plans.find(p => p.id === currentPlanId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
