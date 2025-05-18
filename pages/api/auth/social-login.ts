import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

/**
 * API endpoint to handle social authentication
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
    const { provider, access_token, id_token } = req.body;
    
    // Validate required fields
    if (!provider || (!access_token && !id_token)) {
      return res.status(400).json({ 
        error: 'Provider and either access_token or id_token are required' 
      });
    }
    
    // Handle different social providers
    let authResponse;
    
    if (provider === 'google') {
      authResponse = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: id_token
      });
    } else if (provider === 'facebook' || provider === 'apple') {
      authResponse = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: process.env.NEXT_PUBLIC_APP_URL
        }
      });
    } else {
      return res.status(400).json({ error: 'Unsupported provider' });
    }
    
    const { data, error } = authResponse;

    if (error) {
      console.error(`Error signing in with ${provider}:`, error);
      return res.status(401).json({ error: error.message });
    }

    // Handle the two possible shapes of 'data'
    if ('user' in data && data.user) {
      // Check if profile exists, if not create one
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') { // No profile found
        // Create profile for the user
        await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            first_name: data.user.user_metadata?.full_name?.split(' ')[0] || '',
            last_name: data.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
            profile_image: data.user.user_metadata?.avatar_url || '',
            role: 'customer',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        // Create wallet for the user
        await supabase
          .from('wallets')
          .insert({
            user_id: data.user.id,
            balance: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      // Return the user data and session
      return res.status(200).json({
        user: data.user,
        session: data.session
      });
    } else if ('provider' in data && 'url' in data) {
      // OAuth flow requires redirect
      return res.status(200).json({
        provider: data.provider,
        url: data.url
      });
    } else {
      // Unexpected data shape
      return res.status(500).json({ error: 'Unexpected authentication response' });
    }
  } catch (error) {
    console.error('Error in social-login endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
