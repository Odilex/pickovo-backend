import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

/**
 * API endpoint to log in a user
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Authenticate the user with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('Error logging in:', error);
      return res.status(401).json({ error: error.message });
    }
    
    // First try to get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If profile doesn't exist, create it using the create-profile endpoint
    if (profileError && profileError.code === 'PGRST116') {
      try {
        // Get Supabase API key from environment
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseKey) {
          console.error('Supabase API key not found in environment variables');
          return res.status(500).json({ error: 'Supabase API key not configured' });
        }

        // Call the create-profile endpoint
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/create-profile`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${data.session.access_token}`,
              'apikey': supabaseKey,
              'Content-Type': 'application/json'
            }
          });

          // Always try to get the response text first
          const responseText = await response.text();
          console.log('Profile creation response:', responseText);

          if (!response.ok) {
            try {
              const error = JSON.parse(responseText);
              console.error('Error creating profile:', error);
              throw new Error(error.message || 'Failed to create profile');
            } catch (e) {
              console.error('Error parsing profile creation response:', e);
              throw new Error('Failed to parse profile creation response');
            }
          } else {
            try {
              const data = JSON.parse(responseText);
              console.log('Profile creation response data:', data);
            } catch (e) {
              console.error('Error parsing profile creation response:', e);
              // If we can't parse JSON, just log it and continue
              console.log('Raw response:', responseText);
            }
          }
        } catch (e) {
          console.error('Error calling create-profile endpoint:', e);
          throw e;
        }
      } catch (e) {
        console.error('Error calling create-profile endpoint:', e);
      }
    }

    // Return the user data and session
    return res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        first_name: data.user.user_metadata?.first_name || '',
        last_name: data.user.user_metadata?.last_name || ''
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('Error in login endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
