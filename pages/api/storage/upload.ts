import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { withAuth } from '../../../utils/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * API endpoint to handle file uploads to Supabase Storage
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.userId; // Set by withAuth middleware
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file_data, file_name, content_type, bucket = 'public' } = req.body;
    
    // Validate required fields
    if (!file_data || !file_name || !content_type) {
      return res.status(400).json({ 
        error: 'Missing required fields: file_data, file_name, and content_type are required' 
      });
    }
    
    // Decode base64 file data
    const buffer = Buffer.from(
      file_data.replace(/^data:.*?;base64,/, ''), 
      'base64'
    );
    
    // Generate a unique file path
    const fileExt = file_name.split('.').pop();
    const filePath = `${userId}/${uuidv4()}.${fileExt}`;
    
    // Upload file to Supabase Storage
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: content_type,
        upsert: false
      });
    
    if (error) {
      console.error('Error uploading file:', error);
      return res.status(500).json({ error: 'Failed to upload file' });
    }
    
    // Get public URL for the uploaded file
    const { data: urlData } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    return res.status(200).json({
      file_path: filePath,
      public_url: urlData.publicUrl
    });
  } catch (error) {
    console.error('Error in upload endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Wrap the handler with authentication middleware
export default withAuth(handler);
