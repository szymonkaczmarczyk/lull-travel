const useSupabase = Boolean(
  process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
);

export const db = useSupabase ? await import('./supabase.js') : await import('./file.js');
