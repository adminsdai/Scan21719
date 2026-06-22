const { createClient } = require('@supabase/supabase-js');

// These environment variables must be configured in Vercel.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
// For admin operations (verifying passkeys, reading logs) we might need the service role key 
// since RLS prevents normal selection. However, if we just use the service role key for backend actions,
// we bypass RLS. Wait, the user specifically wanted RLS. 
// If we use RLS, then the "anon" key is restricted. To read, we MUST pass a custom JWT 
// or use the service role key. Since we are managing our own Passkey Auth, we don't have a Supabase User.
// Thus, we will use the Service Role Key for backend-only protected routes (like the Dashboard data), 
// but we still enforce RLS so that public API calls or compromised anon keys cannot modify data.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey; 

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');
const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'placeholder');

module.exports = { supabase, supabaseAdmin };
