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
    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    // Handle email confirmation error
    if (error && error.message.includes('Email not confirmed')) {
      console.log('Email not confirmed, attempting to confirm automatically...');
      
      // Find the user by email
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error('Error listing users:', userError);
        return res.status(401).json({ error: error.message });
      }
      
      // Find the user with matching email
      const user = userData.users.find(u => u.email === email);
      
      if (user) {
        // Confirm the email
        const { error: confirmError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email_confirm: true }
        );
        
        if (confirmError) {
          console.error('Error confirming email:', confirmError);
          return res.status(401).json({ error: error.message });
        }
        
        // Try logging in again
        const loginResult = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (loginResult.error) {
          console.error('Error logging in after email confirmation:', loginResult.error);
          return res.status(401).json({ error: loginResult.error.message });
        }
        
        data = loginResult.data;
      } else {
        return res.status(401).json({ error: 'User not found' });
      }
    } else if (error) {
      console.error('Error logging in:', error);
      return res.status(401).json({ error: error.message });
    }
    
    // Make sure we have user and session data
    if (!data.user || !data.session) {
      console.error('Missing user or session data after successful login');
      return res.status(500).json({ error: 'Authentication succeeded but user data is missing' });
    }
    
    // Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching user profile:', profileError);
      // Continue anyway since we have the auth data
    }
    
    // Return the user data and session
    return res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        ...profile
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
