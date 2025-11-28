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
  if (typeof window === 'undefined') {
    return { storage: createMemoryStorage(), persistSession: false };
  }

  try {
    const testKey = '__sb_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return { storage: window.localStorage, persistSession: true };
  } catch {
    console.warn('Local storage unavailable; using in-memory auth (sessions won\'t persist across reloads).');
    return { storage: createMemoryStorage(), persistSession: false };
  }
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
