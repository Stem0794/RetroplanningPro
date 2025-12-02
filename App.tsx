
import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import { ProjectPlan } from './types';
import { MOCK_PLAN } from './utils/mockData';
import {
  fetchPlans as fetchRemotePlans,
  savePlan as saveRemotePlan,
  deletePlan as deleteRemotePlan,
  duplicatePlan as duplicateRemotePlan,
  createPlan as createRemotePlan
} from './services/projects';
import { supabase, supabaseIsServiceRoleKey } from './services/supabaseClient';

const App: React.FC = () => {
  const [plans, setPlans] = useState<ProjectPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isPublicView, setIsPublicView] = useState(false);
  const [useLocalOnly, setUseLocalOnly] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get('plan')); // public shared links force local-only
    } catch {
      return false;
    }
  });

  const supabaseEnabled = Boolean(supabase && !supabaseIsServiceRoleKey && !useLocalOnly);

  const handleError = (message: string, err: unknown) => {
    console.error(message, err);
    setError(message);
  };
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
    if (!supabaseEnabled) {
      setSession(null);
      setSessionChecked(true);
      return;
    }

    const syncSession = async () => {
      const { data, error } = await supabase!.auth.getSession();
      if (error) {
        handleError('Échec de récupération de session Supabase', error);
      }
      setSession(data.session ?? null);
      setSessionChecked(true);
    };

    syncSession();

    const { data: listener } = supabase!.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession ?? null);
      if (event === 'SIGNED_OUT') {
        setUseLocalOnly(true);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, [supabaseEnabled]);

  useEffect(() => {
    const loadPlans = async () => {
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
            // Public shared links should not require Supabase auth; keep this session local.
            setUseLocalOnly(true);
            setIsPublicView(true);
          }
        } catch (parseErr) {
          handleError('Failed to import shared plan', parseErr);
        }
      }

      let initialPlans: ProjectPlan[] | null = null;

      if (supabaseEnabled && session) {
        try {
          initialPlans = await fetchRemotePlans();
        } catch (err: any) {
          const message = typeof err?.message === 'string' && err.message.includes('secret API key')
            ? 'Supabase is misconfigured: use the anon public key, not the service role key.'
            : 'Failed to load plans from Supabase. Falling back to local data.';
          handleError(message, err);
        }
      }

      if (!initialPlans) {
        initialPlans = [];
        const saved = safeGet('retro_plans');
        if (saved) {
          try {
            initialPlans = JSON.parse(saved);
          } catch (e) {
            handleError('Failed to parse local plans', e);
          }
        }
      }

      if (importedPlan) {
        initialPlans = [importedPlan, ...initialPlans];
        setCurrentPlanId(importedPlan.id);
        if (supabaseEnabled && session) {
          try {
            await createRemotePlan(importedPlan);
          } catch (err) {
            handleError('Failed to save imported plan to Supabase', err);
          }
        }
      }

      if (initialPlans.length === 0) {
        initialPlans = [MOCK_PLAN];
      }

      setPlans(initialPlans);
      setIsLoaded(true);
    };

    void loadPlans();
  }, [supabaseEnabled, session]);

  useEffect(() => {
    if (!supabaseEnabled && isLoaded) {
      safeSet('retro_plans', JSON.stringify(plans));
    }
  }, [plans, isLoaded, supabaseEnabled]);

  const handleCreatePlan = async (plan: ProjectPlan) => {
    if (supabaseEnabled && session) {
      try {
        await createRemotePlan(plan);
      } catch (err) {
        handleError('Failed to create project in Supabase', err);
        return;
      }
    }
    setPlans(prev => [plan, ...prev]);
    setCurrentPlanId(plan.id);
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    if (supabaseEnabled && session) {
      try {
        await deleteRemotePlan(id);
      } catch (err) {
        handleError('Failed to delete project from Supabase', err);
        return;
      }
    }
    setPlans(prev => prev.filter(p => p.id !== id));
    if (currentPlanId === id) setCurrentPlanId(null);
  };

  const handleDuplicatePlan = async (plan: ProjectPlan) => {
    if (supabaseEnabled && session) {
      try {
        const newPlan = await duplicateRemotePlan(plan);
        setPlans(prev => [newPlan, ...prev]);
        setCurrentPlanId(newPlan.id);
        return;
      } catch (err) {
        handleError('Failed to duplicate project in Supabase', err);
        return;
      }
    }
    const newPlan = duplicatePlanLocal(plan);
    setPlans(prev => [newPlan, ...prev]);
    setCurrentPlanId(newPlan.id);
  };

  const handleUpdatePlan = async (updatedPlan: ProjectPlan) => {
    if (supabaseEnabled && session) {
      try {
        await saveRemotePlan(updatedPlan);
      } catch (err) {
        handleError('Failed to save project to Supabase', err);
        return;
      }
    }
    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  };

  const handleLogin = async () => {
    if (!supabaseEnabled || !supabase) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setAuthEmail('');
        setAuthPassword('');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (supabaseEnabled && supabase) {
      await supabase.auth.signOut();
      setSession(null);
      setUseLocalOnly(true);
    }
  };

  const supabaseWarning = supabaseIsServiceRoleKey
    ? 'La clé Supabase configurée est une clé service_role. Remplace-la par la clé \"anon public\" dans les secrets.'
    : null;

  if (!isLoaded) return null;

  const currentPlan = plans.find(p => p.id === currentPlanId);

  if (supabaseEnabled && sessionChecked && !session) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Connexion requise</h1>
            <p className="text-sm text-slate-500">Connecte-toi pour synchroniser tes projets avec Supabase, ou continue en local.</p>
          </div>
          {(error || authError || supabaseWarning) && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm space-y-1">
              {supabaseWarning && <div>{supabaseWarning}</div>}
              {error && <div>{error}</div>}
              {authError && <div>{authError}</div>}
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="ton.email@domaine.com"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Mot de passe</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={!authEmail || !authPassword || authLoading || !!supabaseWarning}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-lg font-semibold transition-colors"
            >
              {authLoading ? 'Connexion…' : 'Se connecter'}
            </button>
            <div className="text-center">
              <button
                onClick={() => setUseLocalOnly(true)}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Continuer en local sans connexion
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {supabaseWarning && (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 px-4 py-3 text-sm">
          {supabaseWarning}
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {supabaseEnabled && session && (
        <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 text-xs flex justify-between items-center">
          <span>Connecté à Supabase</span>
          <button onClick={handleLogout} className="text-emerald-700 underline">Se déconnecter</button>
        </div>
      )}
      {currentPlan ? (
        <Planner 
          plan={currentPlan}
          onSave={handleUpdatePlan}
          onBack={() => setCurrentPlanId(null)}
          readOnly={isPublicView}
        />
      ) : (
        <Dashboard 
          plans={plans}
          onCreate={handleCreatePlan}
          onSelect={(plan) => setCurrentPlanId(plan.id)}
          onDelete={handleDeletePlan}
          onDuplicate={handleDuplicatePlan}
          onUpdate={handleUpdatePlan}
        />
      )}
    </div>
  );
};

export default App;
