
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notifications" ON public.notifications
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  recipient TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  event_key TEXT,
  related_type TEXT,
  related_id UUID,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  provider_message_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_queue_status_next ON public.message_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_message_queue_channel ON public.message_queue(channel);
CREATE INDEX IF NOT EXISTS idx_message_queue_related ON public.message_queue(related_type, related_id);
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage message queue" ON public.message_queue
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  event_key TEXT,
  related_type TEXT,
  related_id UUID,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_logs_channel ON public.message_logs(channel);
CREATE INDEX IF NOT EXISTS idx_message_logs_created ON public.message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_related ON public.message_logs(related_type, related_id);
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage message logs" ON public.message_logs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  subject TEXT,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_key, channel, language)
);
CREATE INDEX IF NOT EXISTS idx_message_templates_lookup ON public.message_templates(event_key, channel, language);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage message templates" ON public.message_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
