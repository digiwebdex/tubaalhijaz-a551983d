
-- ============================================================
-- 1. payments: make polymorphic, relax booking_id
-- ============================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

-- Drop FK + NOT NULL on booking_id so it can be NULL for non-booking sources
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_booking_id_fkey;
ALTER TABLE public.payments ALTER COLUMN booking_id DROP NOT NULL;

-- Backfill: any existing rows (none now, but be safe) were booking-based
UPDATE public.payments
  SET source_type = 'booking',
      source_id   = booking_id
  WHERE source_type IS NULL AND booking_id IS NOT NULL;

-- Constraint: allowed source types
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_source_type_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_source_type_check
  CHECK (source_type IS NULL OR source_type IN (
    'booking','umrah_order','hotel','catering','transport','visa','ticket'
  ));

CREATE INDEX IF NOT EXISTS idx_payments_source ON public.payments(source_type, source_id);

-- ============================================================
-- 2. Source tables: add paid_amount + due_amount where missing
-- ============================================================
ALTER TABLE public.umrah_orders
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_amount  numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_amount  numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.catering_orders
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_amount  numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_amount  numeric(12,2) NOT NULL DEFAULT 0;

-- Initialise due_amount = total
UPDATE public.umrah_orders     SET paid_amount = 0, due_amount = COALESCE(estimated_price_bdt, 0) WHERE id IS NOT NULL;
UPDATE public.hotel_bookings   SET paid_amount = 0, due_amount = COALESCE(total_price, 0)         WHERE id IS NOT NULL;
UPDATE public.catering_orders  SET paid_amount = 0, due_amount = COALESCE(total_price, 0)         WHERE id IS NOT NULL;
UPDATE public.transport_orders SET paid_amount = 0, due_amount = COALESCE(total_price, 0)         WHERE id IS NOT NULL;

-- ============================================================
-- 3. Wipe payments and reset paid/due on existing source tables
-- ============================================================
DELETE FROM public.payments WHERE id IS NOT NULL;

UPDATE public.bookings
  SET paid_amount = 0,
      due_amount  = COALESCE(total_amount, 0)
  WHERE id IS NOT NULL;

UPDATE public.visa_applications
  SET received_amount = 0,
      customer_due    = COALESCE(billing_amount, 0)
  WHERE id IS NOT NULL;

UPDATE public.ticket_bookings
  SET received_amount = 0,
      customer_due    = COALESCE(customer_billing_amount, 0)
  WHERE id IS NOT NULL;

-- Recalculate wallet balances from ground truth
SELECT public.recalculate_wallet_balances();

-- ============================================================
-- 4. Rewrite on_payment_completed trigger to be source-aware
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_payment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_src_type       text;
  v_src_id         uuid;
  v_total_paid     numeric;
  v_total_amount   numeric;
  v_total_income   numeric;
  v_total_expense  numeric;
  v_expense_total  numeric;
  v_label          text;
  v_user           uuid;
BEGIN
  -- Resolve source for the row being processed
  v_src_type := COALESCE(NEW.source_type, OLD.source_type,
                CASE WHEN COALESCE(NEW.booking_id, OLD.booking_id) IS NOT NULL THEN 'booking' END);
  v_src_id   := COALESCE(NEW.source_id, OLD.source_id, NEW.booking_id, OLD.booking_id);

  -- ============ ledger + wallet on INSERT/UPDATE to completed =============
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status <> 'completed') THEN

    v_label := 'Payment for ' || COALESCE(v_src_type, 'unknown') || ' ' || COALESCE(v_src_id::text, '');
    v_user  := COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);

    INSERT INTO public.transactions (
      type, category, amount, debit, credit, source_type, source_id,
      booking_id, user_id, date, note, payment_method, customer_id, reference
    ) VALUES (
      'income', 'payment', NEW.amount, NEW.amount, 0, COALESCE(v_src_type,'customer'), v_src_id,
      CASE WHEN v_src_type = 'booking' THEN v_src_id ELSE NULL END,
      v_user, CURRENT_DATE, v_label, NEW.payment_method, NEW.customer_id, NEW.id::text
    );

    UPDATE public.accounts SET balance = balance + NEW.amount, updated_at = now()
      WHERE type = 'income' AND name = 'Revenue';
    IF NOT FOUND THEN
      INSERT INTO public.accounts (name, type, balance) VALUES ('Revenue', 'income', NEW.amount);
    END IF;

    IF NEW.wallet_account_id IS NOT NULL THEN
      UPDATE public.accounts SET balance = balance + NEW.amount, updated_at = now()
        WHERE id = NEW.wallet_account_id;
    END IF;
  END IF;

  -- ============ reversal on UPDATE away from completed =============
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    DELETE FROM public.transactions WHERE reference = OLD.id::text AND type = 'income';
    UPDATE public.accounts SET balance = GREATEST(0, balance - OLD.amount), updated_at = now()
      WHERE type = 'income' AND name = 'Revenue';
    IF OLD.wallet_account_id IS NOT NULL THEN
      UPDATE public.accounts SET balance = GREATEST(0, balance - OLD.amount), updated_at = now()
        WHERE id = OLD.wallet_account_id;
    END IF;
  END IF;

  -- ============ reversal on DELETE of completed =============
  IF TG_OP = 'DELETE' AND OLD.status = 'completed' THEN
    DELETE FROM public.transactions WHERE reference = OLD.id::text AND type = 'income';
    UPDATE public.accounts SET balance = GREATEST(0, balance - OLD.amount), updated_at = now()
      WHERE type = 'income' AND name = 'Revenue';
    IF OLD.wallet_account_id IS NOT NULL THEN
      UPDATE public.accounts SET balance = GREATEST(0, balance - OLD.amount), updated_at = now()
        WHERE id = OLD.wallet_account_id;
    END IF;
  END IF;

  -- ============ Recompute paid_amount/due_amount on the source row =============
  IF v_src_type IS NOT NULL AND v_src_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
      FROM public.payments
      WHERE status = 'completed'
        AND ((source_type = v_src_type AND source_id = v_src_id)
             OR (v_src_type = 'booking' AND booking_id = v_src_id));

    IF v_src_type = 'booking' THEN
      SELECT COALESCE(total_amount,0) INTO v_total_amount FROM public.bookings WHERE id = v_src_id;
      v_total_paid := LEAST(v_total_paid, v_total_amount);
      UPDATE public.bookings
        SET paid_amount = v_total_paid,
            due_amount  = GREATEST(0, v_total_amount - v_total_paid),
            status      = CASE WHEN v_total_paid >= v_total_amount AND v_total_amount > 0 THEN 'completed' ELSE status END
        WHERE id = v_src_id;

    ELSIF v_src_type = 'umrah_order' THEN
      SELECT COALESCE(estimated_price_bdt,0) INTO v_total_amount FROM public.umrah_orders WHERE id = v_src_id;
      UPDATE public.umrah_orders
        SET paid_amount = v_total_paid,
            due_amount  = GREATEST(0, v_total_amount - v_total_paid)
        WHERE id = v_src_id;

    ELSIF v_src_type = 'hotel' THEN
      SELECT COALESCE(total_price,0) INTO v_total_amount FROM public.hotel_bookings WHERE id = v_src_id;
      UPDATE public.hotel_bookings
        SET paid_amount = v_total_paid,
            due_amount  = GREATEST(0, v_total_amount - v_total_paid)
        WHERE id = v_src_id;

    ELSIF v_src_type = 'catering' THEN
      SELECT COALESCE(total_price,0) INTO v_total_amount FROM public.catering_orders WHERE id = v_src_id;
      UPDATE public.catering_orders
        SET paid_amount = v_total_paid,
            due_amount  = GREATEST(0, v_total_amount - v_total_paid)
        WHERE id = v_src_id;

    ELSIF v_src_type = 'transport' THEN
      SELECT COALESCE(total_price,0) INTO v_total_amount FROM public.transport_orders WHERE id = v_src_id;
      UPDATE public.transport_orders
        SET paid_amount = v_total_paid,
            due_amount  = GREATEST(0, v_total_amount - v_total_paid)
        WHERE id = v_src_id;

    ELSIF v_src_type = 'visa' THEN
      SELECT COALESCE(billing_amount,0) INTO v_total_amount FROM public.visa_applications WHERE id = v_src_id;
      UPDATE public.visa_applications
        SET received_amount = v_total_paid,
            customer_due    = GREATEST(0, v_total_amount - v_total_paid)
        WHERE id = v_src_id;

    ELSIF v_src_type = 'ticket' THEN
      SELECT COALESCE(customer_billing_amount,0) INTO v_total_amount FROM public.ticket_bookings WHERE id = v_src_id;
      UPDATE public.ticket_bookings
        SET received_amount = v_total_paid,
            customer_due    = GREATEST(0, v_total_amount - v_total_paid)
        WHERE id = v_src_id;
    END IF;
  END IF;

  -- ============ refresh financial_summary =============
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO v_total_income, v_total_expense FROM public.transactions;
  SELECT COALESCE(SUM(amount),0) INTO v_expense_total FROM public.expenses;
  v_total_expense := v_total_expense + v_expense_total;

  IF EXISTS (SELECT 1 FROM public.financial_summary LIMIT 1) THEN
    UPDATE public.financial_summary
      SET total_income = v_total_income,
          total_expense = v_total_expense,
          net_profit = v_total_income - v_total_expense,
          updated_at = now()
      WHERE id IS NOT NULL;
  ELSE
    INSERT INTO public.financial_summary (total_income, total_expense, net_profit)
      VALUES (v_total_income, v_total_expense, v_total_income - v_total_expense);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
