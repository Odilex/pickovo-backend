import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { withAuth } from '../../../utils/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * API endpoint to manage user vehicles
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.userId; // Set by withAuth middleware
  
  // Handle GET request - List all vehicles for the user
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching vehicles:', error);
        return res.status(500).json({ error: 'Failed to fetch vehicles' });
      }
      
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in vehicles GET endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle POST request - Add a new vehicle
  if (req.method === 'POST') {
    try {
      const { make, model, year, license_plate, color, vin, mileage, insurance_info } = req.body;
      
      // Validate required fields
      if (!make || !model || !year || !license_plate) {
        return res.status(400).json({ 
          error: 'Missing required fields: make, model, year, and license_plate are required' 
        });
      }
      
      // Check if license plate already exists
      const { data: existingVehicle, error: existingError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('license_plate', license_plate)
        .single();
        
      if (existingVehicle) {
        return res.status(409).json({ error: 'A vehicle with this license plate already exists' });
      }
      
      // Create a new vehicle
      const vehicleId = uuidv4();
      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          id: vehicleId,
          user_id: userId,
          make,
          model,
          year,
          license_plate,
          color,
          vin,
          mileage,
          insurance_info,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating vehicle:', error);
        return res.status(500).json({ error: 'Failed to create vehicle' });
      }
      
      return res.status(201).json(data);
    } catch (error) {
      console.error('Error in vehicles POST endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle unsupported methods
  return res.status(405).json({ error: 'Method not allowed' });
}

// Wrap the handler with authentication middleware
export default withAuth(handler);
