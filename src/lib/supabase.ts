import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key-for-build-time-validation';

if (!supabaseUrl) {
  console.warn('Warning: Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
}

if (!supabaseServiceKey) {
  console.warn('Warning: Missing SUPABASE_SERVICE_ROLE_KEY environment variable. API requests will fail to bypass RLS.');
}

// Admin client bypasses Row Level Security (RLS) policies - perfect for backend data processing
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
