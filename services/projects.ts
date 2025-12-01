import { supabase } from './supabaseClient';
import { Holiday, Phase, PhaseType, ProjectPlan, SubProject } from '../types';

const mapPhase = (row: any): Phase => ({
  id: row.id,
  name: row.name ?? undefined,
  details: row.details ?? undefined,
  startDate: row.start_date,
  endDate: row.end_date,
  type: row.type as PhaseType,
  subProjectId: row.sub_project_id ?? undefined,
});

const mapProject = (row: any): ProjectPlan => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  createdAt: row.created_at,
  phases: (row.phases || []).map(mapPhase),
  holidays: (row.holidays || []).map((h: any): Holiday => ({
    id: h.id,
    name: h.name,
    date: h.date,
  })),
  subProjects: (row.subprojects || []).map((s: any): SubProject => ({
    id: s.id,
    name: s.name,
  })),
});

const ensureClient = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (anon public key).');
  }
  return supabase;
};

export const fetchPlans = async (): Promise<ProjectPlan[]> => {
  const client = ensureClient();

  const { data, error } = await client
    .from('projects')
    .select(`
      id,
      name,
      description,
      created_at,
      phases:phases (
        id, name, details, start_date, end_date, type, sub_project_id
      ),
      subprojects:subprojects (
        id, name
      ),
      holidays:holidays (
        id, name, date
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapProject);
};

const replaceChildren = async (projectId: string, plan: ProjectPlan) => {
  const client = ensureClient();

  let resp = await client.from('subprojects').delete().eq('project_id', projectId);
  if (resp.error) throw resp.error;
  if (plan.subProjects.length) {
    resp = await client.from('subprojects').insert(
      plan.subProjects.map((sp) => ({
        id: sp.id,
        name: sp.name,
        project_id: projectId,
      }))
    );
    if (resp.error) throw resp.error;
  }

  resp = await client.from('phases').delete().eq('project_id', projectId);
  if (resp.error) throw resp.error;
  if (plan.phases.length) {
    resp = await client.from('phases').insert(
      plan.phases.map((p) => ({
        id: p.id,
        name: p.name ?? null,
        details: p.details ?? null,
        start_date: p.startDate,
        end_date: p.endDate,
        type: p.type,
        project_id: projectId,
        sub_project_id: p.subProjectId ?? null,
      }))
    );
    if (resp.error) throw resp.error;
  }

  resp = await client.from('holidays').delete().eq('project_id', projectId);
  if (resp.error) throw resp.error;
  if (plan.holidays.length) {
    resp = await client.from('holidays').insert(
      plan.holidays.map((h) => ({
        id: h.id,
        name: h.name,
        date: h.date,
        project_id: projectId,
      }))
    );
    if (resp.error) throw resp.error;
  }
};

export const savePlan = async (plan: ProjectPlan) => {
  const client = ensureClient();

  const { error } = await client
    .from('projects')
    .upsert({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      created_at: plan.createdAt,
    })
    .eq('id', plan.id);
  if (error) throw error;

  await replaceChildren(plan.id, plan);
};

export const deletePlan = async (id: string) => {
  const client = ensureClient();
  const { error } = await client.from('projects').delete().eq('id', id);
  if (error) throw error;
};

export const duplicatePlan = async (plan: ProjectPlan): Promise<ProjectPlan> => {
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

  const newPlan: ProjectPlan = {
    ...plan,
    id: newId,
    name: `${plan.name} (Copy)`,
    createdAt,
    subProjects: newSubProjects,
    phases: newPhases,
    holidays: plan.holidays.map((h) => ({ ...h, id: crypto.randomUUID() })),
  };

  await savePlan(newPlan);
  return newPlan;
};

export const createPlan = async (plan: ProjectPlan) => {
  await savePlan(plan);
};
