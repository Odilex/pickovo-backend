import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { withAuth } from '../../../utils/auth';

/**
 * API endpoint to manage a specific booking by ID
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.userId; // Set by withAuth middleware
  const { id } = req.query; // Booking ID from the URL
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid booking ID' });
  }
  
  // Check if the user has access to this booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('customer_id, mechanic_id, status')
    .eq('id', id)
    .single();
  
  if (bookingError) {
    console.error('Error fetching booking:', bookingError);
    return res.status(404).json({ error: 'Booking not found' });
  }
  
  // Check if the user is authorized to access this booking
  const isCustomer = booking.customer_id === userId;
  const isMechanic = booking.mechanic_id === userId;
  
  if (!isCustomer && !isMechanic) {
    return res.status(403).json({ error: 'Not authorized to access this booking' });
  }
  
  // Handle GET request - Get booking details
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          mechanics:mechanic_id (id, name, profile_image, specialization, rating, hourly_rate),
          vehicles:vehicle_id (id, make, model, year, license_plate, color),
          customer:customer_id (id, first_name, last_name, profile_image, phone_number)
        `)
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching booking details:', error);
        return res.status(500).json({ error: 'Failed to fetch booking details' });
      }
      
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in booking GET endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle PATCH request - Update booking status
  if (req.method === 'PATCH') {
    try {
      const { status, notes, total_amount } = req.body;
      
      // Validate the status transition
      if (status) {
        const validTransitions: Record<string, string[]> = {
          'pending': ['confirmed', 'cancelled'],
          'confirmed': ['in_progress', 'cancelled'],
          'in_progress': ['completed', 'cancelled'],
          'completed': [],
          'cancelled': []
        };
        
        if (!validTransitions[booking.status].includes(status)) {
          return res.status(400).json({ 
            error: `Invalid status transition from ${booking.status} to ${status}` 
          });
        }
        
        // Check if the user is authorized to make this status change
        if (status === 'confirmed' || status === 'in_progress' || status === 'completed') {
          // Only mechanics can confirm, start, or complete bookings
          if (!isMechanic) {
            return res.status(403).json({ 
              error: 'Only mechanics can confirm, start, or complete bookings' 
            });
          }
        }
      }
      
      // Build the update object
      const updateData: any = {};
      
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (total_amount !== undefined && isMechanic) updateData.total_amount = total_amount;
      
      updateData.updated_at = new Date().toISOString();
      
      // Update the booking
      const { data, error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating booking:', error);
        return res.status(500).json({ error: 'Failed to update booking' });
      }
      
      // Create a notification for the other party
      const notificationRecipient = isCustomer ? booking.mechanic_id : booking.customer_id;
      let notificationTitle = '';
      let notificationMessage = '';
      
      if (status) {
        switch (status) {
          case 'confirmed':
            notificationTitle = 'Booking Confirmed';
            notificationMessage = 'Your booking has been confirmed by the mechanic.';
            break;
          case 'in_progress':
            notificationTitle = 'Repair Started';
            notificationMessage = 'Work on your vehicle has begun.';
            break;
          case 'completed':
            notificationTitle = 'Repair Completed';
            notificationMessage = 'Your vehicle repair has been completed.';
            break;
          case 'cancelled':
            notificationTitle = 'Booking Cancelled';
            notificationMessage = `Your booking has been cancelled by the ${isCustomer ? 'customer' : 'mechanic'}.`;
            break;
        }
        
        if (notificationTitle) {
          await supabase
            .from('notifications')
            .insert({
              user_id: notificationRecipient,
              type: `booking_${status}`,
              title: notificationTitle,
              message: notificationMessage,
              related_id: id,
              is_read: false,
              created_at: new Date().toISOString()
            });
        }
      }
      
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in booking PATCH endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle DELETE request - Cancel booking
  if (req.method === 'DELETE') {
    try {
      // Only allow cancellation if the booking is pending or confirmed
      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        return res.status(400).json({ 
          error: `Cannot cancel a booking with status: ${booking.status}` 
        });
      }
      
      // Update the booking status to cancelled
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error cancelling booking:', error);
        return res.status(500).json({ error: 'Failed to cancel booking' });
      }
      
      // Create a notification for the other party
      const notificationRecipient = isCustomer ? booking.mechanic_id : booking.customer_id;
      
      await supabase
        .from('notifications')
        .insert({
          user_id: notificationRecipient,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: `Your booking has been cancelled by the ${isCustomer ? 'customer' : 'mechanic'}.`,
          related_id: id,
          is_read: false,
          created_at: new Date().toISOString()
        });
      
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in booking DELETE endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle unsupported methods
  return res.status(405).json({ error: 'Method not allowed' });
}

// Wrap the handler with authentication middleware
export default withAuth(handler);
