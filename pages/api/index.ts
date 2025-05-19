import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Root API endpoint for testing
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ 
    status: 'ok', 
    message: 'API root is working',
    endpoints: {
      auth: ['/api/auth/login', '/api/auth/register', '/api/auth/user'],
      bookings: ['/api/bookings'],
      mechanics: ['/api/mechanics'],
      test: ['/api/test']
    }
  });
}

// Configure the API endpoint to use Edge Runtime
export const config = {
  runtime: 'edge',
};
