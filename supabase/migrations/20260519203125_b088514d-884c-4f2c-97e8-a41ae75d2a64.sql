-- Add wallet metadata columns to accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS holder_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Wallet transfers ledger
CREATE TABLE IF NOT EXISTS public.wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID NOT NULL REFERENCES public.accounts(id),
  to_account_id UUID NOT NULL REFERENCES public.accounts(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage wallet transfers" ON public.wallet_transfers;
CREATE POLICY "Admins manage wallet transfers" ON public.wallet_transfers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Apply transfer atomically
CREATE OR REPLACE FUNCTION public.apply_wallet_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.from_account_id = NEW.to_account_id THEN
    RAISE EXCEPTION 'Source and destination wallets must differ';
  END IF;
  UPDATE public.accounts SET balance = balance - NEW.amount, updated_at = now() WHERE id = NEW.from_account_id;
  UPDATE public.accounts SET balance = balance + NEW.amount, updated_at = now() WHERE id = NEW.to_account_id;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_apply_wallet_transfer ON public.wallet_transfers;
CREATE TRIGGER trg_apply_wallet_transfer
  AFTER INSERT ON public.wallet_transfers
  FOR EACH ROW EXECUTE FUNCTION public.apply_wallet_transfer();

-- Seed default wallets if none exist
INSERT INTO public.accounts (name, type, balance, category, sort_order)
SELECT * FROM (VALUES
  ('Cash',  'asset', 0, 'cash', 1),
  ('Bank',  'asset', 0, 'bank', 2),
  ('bKash', 'asset', 0, 'mfs',  3),
  ('Nagad', 'asset', 0, 'mfs',  4),
  ('Rocket','asset', 0, 'mfs',  5)
) AS v(name,type,balance,category,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.accounts WHERE type='asset');