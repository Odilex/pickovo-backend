import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { withAuth } from '../../../utils/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * API endpoint to manage messages for a booking
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.userId; // Set by withAuth middleware
  
  // Handle GET request - List messages for a booking
  if (req.method === 'GET') {
    try {
      const { booking_id, limit = 50, offset = 0 } = req.query;
      
      // Validate required fields
      if (!booking_id) {
        return res.status(400).json({ error: 'booking_id is required' });
      }
      
      // Check if the user is part of this booking (either as customer or mechanic)
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('customer_id, mechanic_id')
        .eq('id', booking_id)
        .single();
      
      if (bookingError || !booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      
      // Check if the user is authorized to view these messages
      if (booking.customer_id !== userId && booking.mechanic_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to view these messages' });
      }
      
      // Get messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          sender_type,
          content,
          attachment_url,
          created_at,
          is_read
        `)
        .eq('booking_id', booking_id)
        .order('created_at', { ascending: true })
        .range(
          Number(offset), 
          Number(offset) + Number(limit) - 1
        );
      
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }
      
      // Get total count for pagination
      const { count: totalCount, error: countError } = await supabase
        .from('messages')
        .count()
        .eq('booking_id', booking_id);
        
      if (countError) {
        console.error('Error counting messages:', countError);
      }
      
      // Mark messages as read if the user is the recipient
      const unreadMessages = messages.filter(msg => 
        !msg.is_read && msg.sender_id !== userId
      );
      
      if (unreadMessages.length > 0) {
        const unreadIds = unreadMessages.map(msg => msg.id);
        
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
      
      return res.status(200).json({
        data: messages,
        pagination: {
          total: totalCount ? totalCount[0].count : 0,
          offset: Number(offset),
          limit: Number(limit)
        }
      });
    } catch (error) {
      console.error('Error in messages GET endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle POST request - Send a message
  if (req.method === 'POST') {
    try {
      const { booking_id, content, attachment_url } = req.body;
      
      // Validate required fields
      if (!booking_id || !content) {
        return res.status(400).json({ 
          error: 'Missing required fields: booking_id and content are required' 
        });
      }
      
      // Check if the user is part of this booking (either as customer or mechanic)
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('customer_id, mechanic_id')
        .eq('id', booking_id)
        .single();
      
      if (bookingError || !booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      
      // Check if the user is authorized to send messages in this booking
      if (booking.customer_id !== userId && booking.mechanic_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to send messages in this booking' });
      }
      
      // Determine sender type
      const senderType = booking.customer_id === userId ? 'customer' : 'mechanic';
      
      // Create a new message
      const messageId = uuidv4();
      const { data, error } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          booking_id,
          sender_id: userId,
          sender_type: senderType,
          content,
          attachment_url,
          is_read: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating message:', error);
        return res.status(500).json({ error: 'Failed to create message' });
      }
      
      // Create a notification for the recipient
      const recipientId = senderType === 'customer' ? booking.mechanic_id : booking.customer_id;
      
      await supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          type: 'new_message',
          title: 'New Message',
          message: `You have a new message in your booking conversation.`,
          related_id: booking_id,
          is_read: false,
          created_at: new Date().toISOString()
        });
      
      // Trigger Supabase Realtime for instant updates (if configured)
      
      return res.status(201).json(data);
    } catch (error) {
      console.error('Error in messages POST endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle unsupported methods
  return res.status(405).json({ error: 'Method not allowed' });
}

// Wrap the handler with authentication middleware
export default withAuth(handler);
