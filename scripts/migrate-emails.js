// Script to migrate emails from auth.users to profiles table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize the Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

async function migrateEmails() {
  console.log('Starting email migration...');

  try {
    // Get all profiles without emails
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .is('email', null);

    if (profilesError) {
      throw profilesError;
    }

    console.log(`Found ${profiles.length} profiles without emails`);

    // For each profile, get the user from auth.users and update the profile with the email
    let updatedCount = 0;
    for (const profile of profiles) {
      // Get the user's email from auth.users
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(profile.id);

      if (userError) {
        console.error(`Error getting user ${profile.id}:`, userError);
        continue;
      }

      if (!user || !user.email) {
        console.warn(`No email found for user ${profile.id}`);
        continue;
      }

      // Update the profile with the email
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ email: user.email })
        .eq('id', profile.id);

      if (updateError) {
        console.error(`Error updating profile ${profile.id}:`, updateError);
        continue;
      }

      updatedCount++;
      console.log(`Updated profile ${profile.id} with email ${user.email}`);
    }

    console.log(`Migration complete. Updated ${updatedCount} profiles.`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateEmails();
