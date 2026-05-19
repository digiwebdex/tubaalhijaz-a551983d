ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_sar numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.moallem_payments ADD COLUMN IF NOT EXISTS amount_sar numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_agent_payments ADD COLUMN IF NOT EXISTS amount_sar numeric(12,2) NOT NULL DEFAULT 0;