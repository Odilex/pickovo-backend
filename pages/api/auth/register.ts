import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

/**
 * API endpoint to register a new user
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
    const { email, password, first_name, last_name, phone_number } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Register the user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name,
          last_name,
          phone_number
        }
      }
    });
    
    if (authError) {
      console.error('Error registering user:', authError);
      return res.status(400).json({ error: authError.message });
    }
    
    // If user was created successfully, create a profile record
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          first_name: first_name || '',
          last_name: last_name || '',
          phone_number: phone_number || '',
          role: 'customer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // We don't want to return an error here since the auth user was created
        // Instead, log it and handle it gracefully
      }
      
      // Create an empty wallet for the user
      const { error: walletError } = await supabase
        .from('wallets')
        .insert({
          user_id: authData.user.id,
          balance: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (walletError) {
        console.error('Error creating user wallet:', walletError);
        // Again, log but don't return an error
      }
    }
    
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
        created_at: authData.user?.created_at
      }
    });
  } catch (error) {
    console.error('Error in register endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
