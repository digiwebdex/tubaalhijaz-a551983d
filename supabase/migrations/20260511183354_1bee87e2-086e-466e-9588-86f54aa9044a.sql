
-- 1. visa_orders table
CREATE TABLE IF NOT EXISTS public.visa_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE DEFAULT ('TT-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  user_id UUID,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  visa_type TEXT NOT NULL,
  destination_country TEXT,
  num_applicants INTEGER NOT NULL DEFAULT 1,
  passport_number TEXT,
  passport_expiry DATE,
  travel_date DATE,
  return_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visa_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create visa order" ON public.visa_orders;
CREATE POLICY "Anyone can create visa order" ON public.visa_orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own visa orders" ON public.visa_orders;
CREATE POLICY "Users view own visa orders" ON public.visa_orders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage visa orders" ON public.visa_orders;
CREATE POLICY "Admins manage visa orders" ON public.visa_orders FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_visa_orders_user ON public.visa_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_visa_orders_status ON public.visa_orders(status);
CREATE INDEX IF NOT EXISTS idx_visa_orders_created ON public.visa_orders(created_at DESC);

-- 2. Add user_id + confirm columns to transport_voucher_orders + catering_orders
ALTER TABLE public.transport_voucher_orders
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE DEFAULT ('TT-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  ADD COLUMN IF NOT EXISTS confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

ALTER TABLE public.catering_orders
  ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE DEFAULT ('TT-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  ADD COLUMN IF NOT EXISTS confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- transport_voucher_orders RLS for customers
DROP POLICY IF EXISTS "Anyone can create transport voucher order" ON public.transport_voucher_orders;
CREATE POLICY "Anyone can create transport voucher order" ON public.transport_voucher_orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own transport voucher orders" ON public.transport_voucher_orders;
CREATE POLICY "Users view own transport voucher orders" ON public.transport_voucher_orders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage transport voucher orders" ON public.transport_voucher_orders;
CREATE POLICY "Admins manage transport voucher orders" ON public.transport_voucher_orders FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- bookings: add confirmed_by/confirmed_at
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
