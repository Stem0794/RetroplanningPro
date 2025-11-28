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

const storageConfig = getStorageConfig();

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: storageConfig.storage,
        persistSession: storageConfig.persistSession,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : undefined;
