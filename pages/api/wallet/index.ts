import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { withAuth } from '../../../utils/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * API endpoint to manage user wallet
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.userId; // Set by withAuth middleware
  
  // Handle GET request - Get wallet balance and transactions
  if (req.method === 'GET') {
    try {
      // Get query parameters
      const { limit = 10, offset = 0 } = req.query;
      
      // Get wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();
      
      if (walletError && walletError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching wallet:', walletError);
        return res.status(500).json({ error: 'Failed to fetch wallet' });
      }
      
      // If wallet doesn't exist, create one with zero balance
      let balance = 0;
      if (!wallet) {
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert({
            user_id: userId,
            balance: 0,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (createError) {
          console.error('Error creating wallet:', createError);
          return res.status(500).json({ error: 'Failed to create wallet' });
        }
        
        balance = newWallet.balance;
      } else {
        balance = wallet.balance;
      }
      
      // Get recent transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(
          Number(offset), 
          Number(offset) + Number(limit) - 1
        );
      
      if (transactionsError) {
        console.error('Error fetching transactions:', transactionsError);
        return res.status(500).json({ error: 'Failed to fetch transactions' });
      }
      
      // Get total count for pagination
      const { count: totalCount, error: countError } = await supabase
        .from('wallet_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (countError) {
        console.error('Error counting transactions:', countError);
      }
      
      return res.status(200).json({
        balance,
        transactions,
        pagination: {
          total: totalCount ?? 0,
          offset: Number(offset),
          limit: Number(limit)
        }
      });
    } catch (error) {
      console.error('Error in wallet GET endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle POST request - Add or deduct wallet balance
  if (req.method === 'POST') {
    try {
      const { amount, type, description, reference_id } = req.body;
      
      // Validate required fields
      if (!amount || !type) {
        return res.status(400).json({ 
          error: 'Missing required fields: amount and type are required' 
        });
      }
      
      // Validate type
      if (type !== 'credit' && type !== 'debit') {
        return res.status(400).json({ 
          error: 'Type must be either "credit" or "debit"' 
        });
      }
      
      // Validate amount
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ 
          error: 'Amount must be a positive number' 
        });
      }
      
      // Begin a transaction
      const { data, error } = await supabase.rpc('update_wallet_balance', {
        p_user_id: userId,
        p_amount: numAmount,
        p_type: type,
        p_description: description || (type === 'credit' ? 'Wallet top-up' : 'Wallet deduction'),
        p_reference_id: reference_id || uuidv4()
      });
      
      if (error) {
        console.error('Error updating wallet:', error);
        
        // Check if it's an insufficient funds error
        if (error.message.includes('insufficient funds')) {
          return res.status(400).json({ error: 'Insufficient funds' });
        }
        
        return res.status(500).json({ error: 'Failed to update wallet' });
      }
      
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in wallet POST endpoint:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // Handle unsupported methods
  return res.status(405).json({ error: 'Method not allowed' });
}

// Wrap the handler with authentication middleware
export default withAuth(handler);
