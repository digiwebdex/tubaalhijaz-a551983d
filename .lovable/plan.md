# Rebuild Payment Management

A clean, single-purpose **Customer Payments** module that records receipts against any booking from any service menu (Umrah Orders, Customer Bookings, Hotel, Catering, Transport, Visa, Ticket), with BDT + SAR side-by-side. Moallem and Supplier payments leave this page entirely.

## What the new page does

A single page, no tabs. One table, one "+ New Payment" dialog.

- **Booking picker** searches across all 7 source menus in one combo. Each row shows: `[Service badge] Tracking ID — Customer — Total / Paid / Due`. Only bookings with **due > 0** appear.
- **Amount section**: two inputs side-by-side — Amount (BDT) and Amount (SAR), both manual, both stored.
- **Method + Wallet Account + Date + Transaction ID + Receipt upload** — same fields as today.
- **Auto-fill** customer name/phone from the selected booking; cannot be edited from the dialog.
- **Filters**: date range, service type, status, customer search.
- **Row actions**: View details, Edit, Delete, Print receipt.

## Data model changes (the important part)

The current `payments` table is hard-bound to `bookings.id` via FK. To accept receipts from 7 different source tables, we make it polymorphic:

```text
payments
├── source_type   text   ('umrah_order' | 'booking' | 'hotel' | 'catering'
│                          | 'transport' | 'visa' | 'ticket')
├── source_id     uuid
├── booking_id    uuid   (nullable, kept for backward-compat where source_type='booking')
├── amount        numeric  -- BDT (primary)
├── amount_sar    numeric
├── ... existing columns
```

- Drop the NOT NULL + FK on `booking_id`.
- Add `source_type`, `source_id`, plus an index.
- Add `paid_amount` / `due_amount` columns to `umrah_orders`, `hotel_bookings`, `catering_orders`, `transport_orders`, `catering_orders` (the ones missing them). Visa, Ticket, Bookings already track this.
- Rewrite trigger `on_payment_completed` to:
  1. Post the ledger entry tagged with `source_type`.
  2. Update the correct source table's `paid_amount` / `due_amount` based on `source_type`.
  3. Keep wallet balance update (unchanged).
- Keep `auto_assign_wallet` trigger as-is.

## Destructive step (one-time)

You confirmed wiping all payment data:

- `DELETE FROM payments` (all rows)
- Reset `paid_amount=0`, `due_amount=total_amount` on `bookings`, `visa_applications`, `ticket_bookings`
- Recalculate wallet balances via existing `recalculate_wallet_balances()` function
- Moallem and Supplier payment tables are **untouched** — they keep working from their own pages

Counts confirmed: all relevant tables currently have 0 rows, so this is risk-free.

## Other pages that reference `payments` — light updates only

These pages read payments for display/reporting. They keep working without changes because the new columns are additive. Where they assume "payment → booking", they'll show "—" for non-booking sources, which is acceptable:

- `AdminBookingsPage`, `AdminDueAlertsPage`, `AdminReceivablesPage` — read-only, no changes needed
- `AdminAccountingPage`, `AdminReportsPage`, `AdminAnalyticsPage`, `AdminDashboardPage` — read-only, will pick up SAR totals if they already use `amount_sar`
- `AdminCustomersPage`, `AdminMoallemProfilePage`, `CustomerFinancialReport` — read-only
- `InvoicePage`, `Dashboard` (customer-facing) — read-only

## Files

**Rewritten**
- `src/pages/admin/AdminPaymentsPage.tsx` — completely new, ~600 lines, replaces the 1156-line version. Single tab (Customer Payments only), unified booking picker.

**New helper**
- `src/lib/paymentSources.ts` — fetches due bookings from all 7 sources, normalises into one shape `{ source_type, source_id, label, customer, total, paid, due }`.

**Migration**
- Schema changes above + DELETE + reset queries + trigger rewrite.

## Out of scope (deliberately removed from this page)

- Moallem payments → stays on `AdminMoallemProfilePage`
- Supplier payments → stays on `AdminSupplierAgentProfilePage`
- Commission payments → stays where they are

## Steps

1. Run the migration (schema + wipe + trigger rewrite).
2. Add `src/lib/paymentSources.ts`.
3. Rewrite `src/pages/admin/AdminPaymentsPage.tsx`.
4. Sanity-test: create one payment against an Umrah Order and one against a Visa Application, verify wallet + source's paid/due update.

Once you approve, I'll start with the migration.