import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

/**
 * API endpoint to create user profile
 * This endpoint should only be called after successful login
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
    // Get user data from the JWT token
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // First check if profile exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profileError) {
      return res.status(200).json({
        message: 'Profile already exists',
        profile: existingProfile
      });
    }

    // Create profile using auth metadata
    const { error: createError } = await supabase.auth.updateUser({
      data: {
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        phone_number: ''
      }
    });

    if (createError) {
      console.error('Error updating user metadata:', createError);
      return res.status(500).json({ error: createError.message });
    }

    // Get Supabase API key from environment
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseKey) {
      console.error('Supabase API key not found in environment variables');
      return res.status(500).json({ error: 'Supabase API key not configured' });
    }

    // Now try to create the profile
    try {
      const { data: newProfile, error: profileCreateError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          role: 'customer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (profileCreateError) {
        console.error('Error creating profile:', profileCreateError);
        throw profileCreateError;
      }

      return res.status(200).json({
        message: 'Profile created successfully',
        profile: newProfile
      });
    } catch (error: any) {
      console.error('Error in profile creation:', error);
      // Always return a JSON response
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error),
        success: false 
      });
    }
  } catch (error: any) {
    console.error('Error in create-profile endpoint:', error);
    // Always return a JSON response
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : String(error),
      success: false 
    });
  } finally {
    // Ensure we always return a JSON response
    return res.status(200).json({
      success: true,
      message: 'Profile creation endpoint reached'
    });
  }
}
