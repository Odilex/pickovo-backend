import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { withAuth } from '../../../utils/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * API endpoint to manage user notifications
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.userId; // Set by withAuth middleware
  
  // Handle GET request - List notifications for a user
  if (req.method === 'GET') {
    try {
      // Get query parameters
      const { 
        is_read, 
        type,
        limit = 20, 
        offset = 0 
      } = req.query;
      
      // Build the query
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      // Apply filters if provided
      if (is_read !== undefined) {
        query = query.eq('is_read', is_read === 'true');
      }
      
      if (type) {
        query = query.eq('type', type);
      }
      
      // Apply pagination
      query = query.range(
        Number(offset), 
        Number(offset) + Number(limit) - 1
      );
      
      // Execute the query
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ error: 'Failed to fetch notifications' });
      }
      
      // Get total count for pagination
      const { count: totalCount, error: countError } = await supabase
        .from('notifications')
        .count()
        .eq('user_id', userId);
        
      if (countError) {
        console.error('Error counting notifications:', countError);
      }
      
      // Get unread count
      const { count: unreadCount, error: unreadError } = await supabase
        .from('notifications')
        .count()
        .eq('user_id', userId)
        .eq('is_read', false);
        
      if (unreadError) {
        console.error('Error counting unread notifications:', unreadError);
      }
      
      return res.status(200).json({
        data,
        unread_count: unreadCount ? unreadCount[0].count : 0,
        pagination: {
          total: totalCount ? totalCount[0].count : 0,
          offset: Number(offset),
          limit: Number(limit)
        }
      });
    } catch (error) {
      console.error('Error in notifications GET endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle POST request - Add a notification
  if (req.method === 'POST') {
    try {
      const { 
        target_user_id, 
        type, 
        title, 
        message, 
        related_id 
      } = req.body;
      
      // Validate required fields
      if (!target_user_id || !type || !title || !message) {
        return res.status(400).json({ 
          error: 'Missing required fields: target_user_id, type, title, and message are required' 
        });
      }
      
      // Check if the user is an admin (only admins can send notifications to other users)
      // This is a simplified approach - in a real app, you'd use a more robust role system
      const { data: isAdmin, error: adminError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (adminError) {
        console.error('Error checking admin status:', adminError);
        return res.status(500).json({ error: 'Failed to verify permissions' });
      }
      
      if (isAdmin?.role !== 'admin' && target_user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to send notifications to other users' });
      }
      
      // Create a new notification
      const notificationId = uuidv4();
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          id: notificationId,
          user_id: target_user_id,
          type,
          title,
          message,
          related_id,
          is_read: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating notification:', error);
        return res.status(500).json({ error: 'Failed to create notification' });
      }
      
      return res.status(201).json(data);
    } catch (error) {
      console.error('Error in notifications POST endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle PATCH request - Mark notifications as read
  if (req.method === 'PATCH') {
    try {
      const { notification_ids, mark_all } = req.body;
      
      // If mark_all is true, mark all notifications as read
      if (mark_all) {
        const { data, error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('is_read', false);
          
        if (error) {
          console.error('Error marking all notifications as read:', error);
          return res.status(500).json({ error: 'Failed to mark notifications as read' });
        }
        
        return res.status(200).json({ message: 'All notifications marked as read' });
      }
      
      // Otherwise, mark specific notifications as read
      if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
        return res.status(400).json({ error: 'notification_ids array is required' });
      }
      
      // Verify that all notifications belong to the user
      const { data: userNotifications, error: verifyError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .in('id', notification_ids);
        
      if (verifyError) {
        console.error('Error verifying notifications:', verifyError);
        return res.status(500).json({ error: 'Failed to verify notifications' });
      }
      
      const userNotificationIds = userNotifications.map(n => n.id);
      const invalidIds = notification_ids.filter(id => !userNotificationIds.includes(id));
      
      if (invalidIds.length > 0) {
        return res.status(403).json({ 
          error: 'Some notification IDs do not belong to the user',
          invalid_ids: invalidIds
        });
      }
      
      // Mark notifications as read
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', notification_ids);
        
      if (error) {
        console.error('Error marking notifications as read:', error);
        return res.status(500).json({ error: 'Failed to mark notifications as read' });
      }
      
      return res.status(200).json({ 
        message: 'Notifications marked as read',
        updated_count: notification_ids.length
      });
    } catch (error) {
      console.error('Error in notifications PATCH endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle unsupported methods
  return res.status(405).json({ error: 'Method not allowed' });
}

// Wrap the handler with authentication middleware
export default withAuth(handler);
