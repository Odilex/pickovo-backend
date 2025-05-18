import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

/**
 * API endpoint to handle password reset requests
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
    const { email, redirectTo } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
    });
    
    if (error) {
      console.error('Error sending password reset email:', error);
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({ 
      message: 'Password reset email sent successfully' 
    });
  } catch (error) {
    console.error('Error in reset-password endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
