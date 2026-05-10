-- Queue job audit log (success + failure) - one row per terminal state
CREATE TABLE IF NOT EXISTS public.queue_job_logs (
  id BIGSERIAL PRIMARY KEY,
  queue_name TEXT NOT NULL,
  job_id TEXT NOT NULL,
  job_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed','failed','stalled','retrying')),
  attempts INT NOT NULL DEFAULT 1,
  duration_ms INT,
  payload_summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_queue_job_logs_queue_status ON public.queue_job_logs (queue_name, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_job_logs_created_at ON public.queue_job_logs (created_at DESC);

-- Persistent dead-letter store (BullMQ also keeps failed in Redis, but we want a SQL audit trail)
CREATE TABLE IF NOT EXISTS public.failed_jobs (
  id BIGSERIAL PRIMARY KEY,
  queue_name TEXT NOT NULL,
  job_id TEXT NOT NULL,
  job_name TEXT,
  payload JSONB,
  attempts INT NOT NULL DEFAULT 0,
  error_message TEXT,
  error_stack TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retried_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_queue ON public.failed_jobs (queue_name, failed_at DESC);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_unresolved ON public.failed_jobs (failed_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.queue_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;

-- API service role bypasses RLS; admin-only enforcement happens in /api/queues route.
CREATE POLICY "service can read queue logs" ON public.queue_job_logs FOR SELECT USING (true);
CREATE POLICY "service can insert queue logs" ON public.queue_job_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "service can read failed jobs" ON public.failed_jobs FOR SELECT USING (true);
CREATE POLICY "service can write failed jobs" ON public.failed_jobs FOR ALL USING (true) WITH CHECK (true);