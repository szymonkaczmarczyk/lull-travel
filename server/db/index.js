const useSupabase = Boolean(
  process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
);

const isNetworkFailure = (err) => err instanceof TypeError || err?.name === 'TimeoutError';

async function pickDriver() {
  if (!useSupabase) return import('./file.js');
  const supabase = await import('./supabase.js');
  try {
    await supabase.ping();
    return supabase;
  } catch (err) {
    if (!isNetworkFailure(err)) throw err;
    const reason = err.cause?.code ?? err.message;
    console.warn(`  Supabase is unreachable (${reason}). Falling back to local files in server/data/db.`);
    return import('./file.js');
  }
}

export const db = await pickDriver();
