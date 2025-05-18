import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client with environment variables
// Using service_role key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a Supabase client with the service role key (admin privileges)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

// This client is for server-side operations only and has full database access
// Never expose this client to the client-side
