ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS amount_received NUMERIC(12,2)
  CHECK (amount_received IS NULL OR amount_received >= 0);
