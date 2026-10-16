import { createClient } from '@supabase/supabase-js';

export function createServerClient(env = process.env) {
 const key = env.SUPABASE_SERVICE_ROLE_KEY;
 if (!env.SUPABASE_URL || !key) throw new Error('Server database configuration is missing');
 // Legacy JWTs identify their role. Never accept a browser key as a server key.
 if (key.startsWith('sb_publishable_')) throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a server secret, not a publishable key');
 if (key.split('.').length === 3) {
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role; }
  catch { throw new Error('SUPABASE_SERVICE_ROLE_KEY is not a valid legacy API key'); }
  if (role !== 'service_role') throw new Error('SUPABASE_SERVICE_ROLE_KEY must have service_role permission');
 }
 return createClient(env.SUPABASE_URL, key);
}
