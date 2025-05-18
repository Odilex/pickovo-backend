import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { withAuth } from '../../../utils/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * API endpoint to manage bookings
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.userId; // Set by withAuth middleware
  
  // Handle GET request - List all bookings for the user
  if (req.method === 'GET') {
    try {
      // Get query parameters for filtering
      const { status, mechanic_id, limit = 10, offset = 0 } = req.query;
      
      // Build the query
      let query = supabase
        .from('bookings')
        .select(`
          *,
          mechanics:mechanic_id (id, name, profile_image, specialization, rating),
          vehicles:vehicle_id (id, make, model, year, license_plate)
        `)
        .eq('customer_id', userId)
        .order('scheduled_time', { ascending: false });
      
      // Apply filters if provided
      if (status) {
        query = query.eq('status', status);
      }
      
      if (mechanic_id) {
        query = query.eq('mechanic_id', mechanic_id);
      }
      
      // Apply pagination
      query = query.range(
        Number(offset), 
        Number(offset) + Number(limit) - 1
      );
      
      // Execute the query
      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error fetching bookings:', error);
        return res.status(500).json({ error: 'Failed to fetch bookings' });
      }
      
      // Get total count for pagination
      const { count: totalCount, error: countError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', userId);
        
      if (countError) {
        console.error('Error counting bookings:', countError);
      }
      
      return res.status(200).json({
        data,
        pagination: {
          total: totalCount ?? 0,
          offset: Number(offset),
          limit: Number(limit)
        }
      });
    } catch (error) {
      console.error('Error in bookings GET endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle POST request - Create a new booking
  if (req.method === 'POST') {
    try {
      const { mechanic_id, vehicle_id, scheduled_time, service_type, notes } = req.body;
      
      // Validate required fields
      if (!mechanic_id || !vehicle_id || !scheduled_time || !service_type) {
        return res.status(400).json({ 
          error: 'Missing required fields: mechanic_id, vehicle_id, scheduled_time, and service_type are required' 
        });
      }
      
      // Check if the vehicle belongs to the user
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('id', vehicle_id)
        .eq('user_id', userId)
        .single();
        
      if (vehicleError || !vehicle) {
        return res.status(403).json({ error: 'Vehicle does not belong to the user' });
      }
      
      // Check if the mechanic is available
      const { data: mechanic, error: mechanicError } = await supabase
        .from('mechanics')
        .select('id, is_available')
        .eq('id', mechanic_id)
        .eq('is_available', true)
        .single();
        
      if (mechanicError || !mechanic) {
        return res.status(400).json({ error: 'Mechanic is not available' });
      }
      
      // Create a new booking
      const bookingId = uuidv4();
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          id: bookingId,
          customer_id: userId,
          mechanic_id,
          vehicle_id,
          scheduled_time,
          service_type,
          notes,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating booking:', error);
        return res.status(500).json({ error: 'Failed to create booking' });
      }
      
      // Create a notification for the user
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'booking_created',
          title: 'Booking Created',
          message: `Your booking for ${service_type} has been created and is pending confirmation.`,
          related_id: bookingId,
          is_read: false,
          created_at: new Date().toISOString()
        });
      
      return res.status(201).json(data);
    } catch (error) {
      console.error('Error in bookings POST endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle unsupported methods
  return res.status(405).json({ error: 'Method not allowed' });
}

// Wrap the handler with authentication middleware
export default withAuth(handler);
