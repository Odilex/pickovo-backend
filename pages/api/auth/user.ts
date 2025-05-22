import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { getUserFromRequest } from '../../../utils/auth';

/**
 * API endpoint to get authenticated user information
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from the JWT token
    const userId = await getUserFromRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch user profile data from Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      
      // Check if the error is because the profile doesn't exist
      if (profileError.code === 'PGRST116') {
        // Since we don't have the profile, we need to create one
        // We'll use a placeholder email based on the userId since we can't reliably get the email
        // The actual email will be synced later when the user logs in again
        const placeholderEmail = `${userId.substring(0, 8)}@placeholder.com`;
        
        // Create a new profile for the user
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: placeholderEmail,
            first_name: '',
            last_name: '',
            phone_number: '',
            role: 'customer',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('Error creating user profile:', insertError);
          return res.status(500).json({ error: 'Failed to create user profile' });
        }
        
        // Return the newly created profile
        return res.status(200).json({
          id: userId,
          email: placeholderEmail,
          profile: newProfile
        });
      }
      
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Return user data with email from profile
    return res.status(200).json({
      id: userId,
      email: profile.email,
      profile
    });
  } catch (error) {
    console.error('Error in user endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
