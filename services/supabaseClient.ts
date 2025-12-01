import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const createMemoryStorage = (): SupportedStorage => {
  const store = new Map<string, string>();
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => { store.set(key, value); },
    removeItem: async (key: string) => { store.delete(key); }
  };
};

const getStorageConfig = () => {
  // Some contexts (iframes/sandboxed GitHub Pages) block storage entirely.
  // Avoid touching window.localStorage to prevent SecurityError and use memory-only auth.
  return { storage: createMemoryStorage(), persistSession: false };
};

const getTokenRole = (key: string) => {
  try {
    const payload = key.split('.')[1];
    if (!payload) return null;
    // Base64url decode (JWT payload uses -_/)
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
    const decoded = JSON.parse(atob(padded));
    return decoded?.role ?? null;
  } catch {
    return null;
  }
};

const supabaseKeyRole = supabaseKey ? getTokenRole(supabaseKey) : null;
const supabaseIsServiceKey = supabaseKeyRole === 'service_role';

const shouldInitSupabase = () => {
  if (!supabaseUrl || !supabaseKey) return false;
  if (supabaseIsServiceKey) {
    console.warn('Supabase service_role key detected in client. Use the anon public key instead.');
    return false;
  }
  return true;
};

const storageConfig = getStorageConfig();

export const supabase = shouldInitSupabase()
  ? createClient(supabaseUrl as string, supabaseKey as string, {
      auth: {
        storage: storageConfig.storage,
        persistSession: storageConfig.persistSession,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : undefined;

export const supabaseIsServiceRoleKey = supabaseIsServiceKey;
export const supabaseKeyConfigured = Boolean(supabaseUrl && supabaseKey);
