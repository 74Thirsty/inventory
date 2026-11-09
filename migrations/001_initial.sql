CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'donation_received','purchase_received','reimbursement_requested',
    'inventory_used','inventory_adjustment','cash_contribution','equipment_received'
  )),
  status TEXT NOT NULL CHECK (status IN ('draft_needs_approval','approved','rejected')),
  occurred_at DATE,
  counterparty JSONB,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  amount_paid NUMERIC(12,2) CHECK (amount_paid IS NULL OR amount_paid >= 0),
  currency CHAR(3),
  purpose TEXT,
  received_by TEXT,
  notes TEXT,
  source_transcript TEXT,
  source_message_id TEXT UNIQUE,
  source_channel TEXT NOT NULL DEFAULT 'api',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  document_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transactions_status_created_idx ON transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_type_created_idx ON transactions(transaction_type, created_at DESC);
CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  event_type TEXT NOT NULL,
  actor TEXT,
  source TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_transaction_idx ON audit_events(transaction_id, occurred_at);
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
