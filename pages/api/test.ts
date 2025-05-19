import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Simple test endpoint to verify API routes are working
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ status: 'ok', message: 'API is working' });
}

// Configure the API endpoint to use Edge Runtime
export const config = {
  runtime: 'edge',
};
