import { NextApiRequest } from 'next';
import { supabase } from '../lib/supabase';

/**
 * Extracts and validates the JWT token from the request
 * @param req - Next.js API request
 * @returns The user ID if authenticated, null otherwise
 */
export async function getUserFromRequest(req: NextApiRequest): Promise<string | null> {
  // Get the authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  // Extract the token
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return null;
  }
  
  try {
    // Verify the JWT with Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return null;
    }
    
    return data.user.id;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Middleware to check if a user is authenticated
 * @param handler - The API route handler
 * @returns A wrapped handler that checks authentication
 */
export function withAuth(handler: Function) {
  return async (req: NextApiRequest, res: any) => {
    const userId = await getUserFromRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Add the user ID to the request for use in the handler
    req.userId = userId;
    
    return handler(req, res);
  };
}

/**
 * Helper to check if a user has admin role
 * @param userId - The user ID to check
 * @returns Boolean indicating if user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  return data.role === 'admin';
}

// Extend the NextApiRequest type to include userId
declare module 'next' {
  interface NextApiRequest {
    userId?: string;
  }
}
