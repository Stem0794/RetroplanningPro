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

const getSafeStorage = (): SupportedStorage | undefined => {
  if (typeof window === 'undefined') return createMemoryStorage();
  try {
    const testKey = '__sb_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    console.warn('Local storage unavailable; falling back to in-memory auth session.');
    return createMemoryStorage();
  }
};

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: getSafeStorage(),
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : undefined;
