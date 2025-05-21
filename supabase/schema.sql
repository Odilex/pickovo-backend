-- Create necessary tables for Pickovo backend

-- Enable RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret-here';

-- Create profiles table (extends the default auth.users table)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  profile_image TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'mechanic', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create mechanics table
CREATE TABLE IF NOT EXISTS mechanics (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  profile_image TEXT,
  specialization TEXT,
  experience_years INTEGER,
  rating DECIMAL(3,2) DEFAULT 0,
  hourly_rate DECIMAL(10,2),
  location TEXT, -- Format: "latitude,longitude"
  availability_hours JSONB, -- JSON object with availability schedule
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  license_plate TEXT NOT NULL UNIQUE,
  color TEXT,
  vin TEXT,
  mileage INTEGER,
  insurance_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES mechanics(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  service_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  total_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'mechanic', 'system')),
  content TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stored procedure for wallet operations
CREATE OR REPLACE FUNCTION update_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL,
  p_type TEXT,
  p_description TEXT,
  p_reference_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_wallet_exists BOOLEAN;
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
  v_transaction_id UUID;
  v_result JSONB;
BEGIN
  -- Check if wallet exists
  SELECT EXISTS(SELECT 1 FROM wallets WHERE user_id = p_user_id) INTO v_wallet_exists;
  
  -- Create wallet if it doesn't exist
  IF NOT v_wallet_exists THEN
    INSERT INTO wallets (user_id, balance, created_at, updated_at)
    VALUES (p_user_id, 0, NOW(), NOW());
  END IF;
  
  -- Get current balance
  SELECT balance INTO v_current_balance FROM wallets WHERE user_id = p_user_id;
  
  -- Calculate new balance
  IF p_type = 'credit' THEN
    v_new_balance := v_current_balance + p_amount;
  ELSIF p_type = 'debit' THEN
    v_new_balance := v_current_balance - p_amount;
    -- Check if sufficient funds
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Insufficient funds: current balance % is less than debit amount %', v_current_balance, p_amount;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid transaction type: must be credit or debit';
  END IF;
  
  -- Update wallet balance
  UPDATE wallets SET balance = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  
  -- Create transaction record
  v_transaction_id := gen_random_uuid();
  INSERT INTO wallet_transactions (id, user_id, amount, type, description, reference_id, created_at)
  VALUES (v_transaction_id, p_user_id, p_amount, p_type, p_description, p_reference_id, NOW());
  
  -- Prepare result
  v_result := jsonb_build_object(
    'transaction_id', v_transaction_id,
    'user_id', p_user_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount', p_amount,
    'type', p_type,
    'description', p_description,
    'reference_id', p_reference_id,
    'created_at', NOW()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up RLS policies

-- Profiles table policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Vehicles table policies
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vehicles"
  ON vehicles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vehicles"
  ON vehicles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vehicles"
  ON vehicles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vehicles"
  ON vehicles FOR DELETE
  USING (auth.uid() = user_id);

-- Bookings table policies
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Mechanics can view their assigned bookings"
  ON bookings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mechanics 
    WHERE mechanics.id = bookings.mechanic_id 
    AND mechanics.id = auth.uid()
  ));

CREATE POLICY "Users can insert their own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Messages table policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their bookings"
  ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.id = messages.booking_id 
    AND (bookings.customer_id = auth.uid() OR bookings.mechanic_id = auth.uid())
  ));

CREATE POLICY "Users can insert messages in their bookings"
  ON messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.id = messages.booking_id 
    AND (bookings.customer_id = auth.uid() OR bookings.mechanic_id = auth.uid())
  ));

-- Wallets table policies
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet"
  ON wallets FOR SELECT
  USING (auth.uid() = user_id);

-- Wallet transactions table policies
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Notifications table policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
