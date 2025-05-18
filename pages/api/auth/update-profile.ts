import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { withAuth } from '../../../utils/auth';

/**
 * API endpoint to update user profile
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.userId; // Set by withAuth middleware
  
  // Only allow PATCH requests
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { first_name, last_name, phone_number, profile_image } = req.body;
    
    // Update the profile
    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name,
        last_name,
        phone_number,
        profile_image,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in update-profile endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Wrap the handler with authentication middleware
export default withAuth(handler);
