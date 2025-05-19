import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Simple test endpoint to verify API routes are working
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Add CORS headers to allow access from any origin
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  res.status(200).json({ status: 'ok', message: 'API is working' });
}

// Don't use Edge Runtime as it might be causing issues
// export const config = {
//   runtime: 'edge',
// };
