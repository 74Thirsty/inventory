CREATE TABLE IF NOT EXISTS work_requests (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('received','planned','awaiting_clarification','ready_for_review','approved','rejected','completed')),
  source_text TEXT NOT NULL,
  source_channel TEXT NOT NULL DEFAULT 'api',
  source_message_id TEXT UNIQUE,
  submitted_by TEXT,
  idempotency_key TEXT UNIQUE,
  intent_summary TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context)='object'),
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(deliverables)='array'),
  open_questions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(open_questions)='array'),
  execution_plan JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(execution_plan)='array'),
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(risk_flags)='array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_requests_status_created_idx ON work_requests(status,created_at DESC);
CREATE TABLE IF NOT EXISTS work_request_events (
  id BIGSERIAL PRIMARY KEY,
  work_request_id UUID NOT NULL REFERENCES work_requests(id),
  event_type TEXT NOT NULL,
  actor TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_request_events_request_idx ON work_request_events(work_request_id,occurred_at);
