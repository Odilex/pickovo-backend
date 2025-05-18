import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { getUserFromRequest } from '../../../utils/auth';

/**
 * API endpoint to list available mechanics
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate the user (optional for public endpoints, but good for rate limiting)
    const userId = await getUserFromRequest(req);
    
    // Get query parameters
    const { 
      specialization, 
      rating, 
      location, 
      distance,
      limit = 20, 
      offset = 0,
      sort_by = 'rating',
      sort_order = 'desc'
    } = req.query;
    
    // Build the query
    let query = supabase
      .from('mechanics')
      .select(`
        id,
        name,
        profile_image,
        specialization,
        experience_years,
        rating,
        hourly_rate,
        location,
        availability_hours,
        is_available
      `)
      .eq('is_available', true);
    
    // Apply filters if provided
    if (specialization) {
      query = query.eq('specialization', specialization);
    }
    
    if (rating) {
      query = query.gte('rating', Number(rating));
    }
    
    // Apply sorting
    if (sort_by && ['rating', 'hourly_rate', 'experience_years'].includes(sort_by as string)) {
      query = query.order(sort_by as string, { 
        ascending: sort_order === 'asc'
      });
    }
    
    // Apply pagination
    query = query.range(
      Number(offset), 
      Number(offset) + Number(limit) - 1
    );
    
    // Execute the query
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching mechanics:', error);
      return res.status(500).json({ error: 'Failed to fetch mechanics' });
    }
    
    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('mechanics')
      .count()
      .eq('is_available', true);
      
    if (countError) {
      console.error('Error counting mechanics:', countError);
    }
    
    // If location and distance are provided, filter by distance
    // This is a simplified approach - in a real app, you'd use PostGIS or a similar solution
    let filteredData = data;
    if (location && distance && typeof location === 'string') {
      // Parse the location string (format: "latitude,longitude")
      const [lat, lng] = location.split(',').map(Number);
      
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(Number(distance))) {
        // Filter mechanics by distance (simplified)
        filteredData = data.filter(mechanic => {
          if (!mechanic.location) return false;
          
          // Parse mechanic location
          const [mechLat, mechLng] = mechanic.location.split(',').map(Number);
          
          // Calculate distance (simplified using Euclidean distance)
          const distanceKm = Math.sqrt(
            Math.pow(mechLat - lat, 2) + Math.pow(mechLng - lng, 2)
          ) * 111; // Rough conversion to kilometers
          
          return distanceKm <= Number(distance);
        });
      }
    }
    
    return res.status(200).json({
      data: filteredData,
      pagination: {
        total: totalCount ? totalCount[0].count : 0,
        offset: Number(offset),
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Error in mechanics endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
