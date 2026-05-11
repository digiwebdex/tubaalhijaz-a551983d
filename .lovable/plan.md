## Goal

Replace the multiple scattered transport-related admin pages with a single **Transport Booking** page that mirrors the customer-facing Transport Voucher Booking form (Group/Package, Hotels, Transport, Flights, Internal Movements, Supervisors, Your Contact) and ships a bilingual (English + Arabic) printable invoice/PDF that includes the customer's information.

## What gets removed

Sidebar entries + routes + page files:

1. `Transport Vouchers` → `/admin/transport-vouchers` → `AdminTransportVouchersPage.tsx`
2. `Internal Movements` → `/admin/internal-movements` → `AdminInternalMovementsPage.tsx`
3. Existing `TransportVoucherPdf.tsx` (single-language voucher) — replaced by new bilingual PDF.

Kept as-is (out of scope, different feature):
- `Transport` (`/admin/transport`) — manages the transport **services catalogue** shown on the website (vehicles list, prices). Not a booking page; we leave it untouched unless you say otherwise.
- `Pending Bookings` — keeps the existing transport detail view; clicking through will deep-link to the new Transport Booking page.

## What gets built

### 1. New page: `Transport Booking`
- Sidebar: single new item **"Transport Booking"** → `/admin/transport-booking`.
- File: `src/pages/admin/AdminTransportBookingPage.tsx`.
- Two states:
  - **List view** — table of all `transport_voucher_orders` rows: Tracking, Customer, Group, Pilgrims, Travel Date, Status, Actions (View / Print / Confirm / Cancel / Delete).
  - **Detail view** — opens a sectioned read-only "table" that mirrors the customer form 1-to-1, with bilingual labels (EN left, AR right) for every section and field:
    1. Group / Package — المجموعة / الباقة
    2. Hotels — الفنادق (Makkah + Madinah rows: Hotel, Agreement no., Check-in, Check-out, Nights, Rooms)
    3. Transport — النقل (Type, Number of pilgrims)
    4. Flights — الرحلات (Arrival + Departure: Airport, Date, Time, Flight no., Airline)
    5. Internal Movements — التحركات الداخلية (rows: Date, Time, From, To)
    6. Supervisors — المشرفون (Makkah, Madinah, Ops 24h)
    7. Your Contact — معلومات الاتصال (Full name, Phone, Email, Notes)
  - Header on the detail view shows the linked **Customer card** (name, phone, email, address, passport if present — pulled from `profiles` when `user_id` is set, otherwise from guest fields on the booking).

### 2. Bilingual PDF / printable invoice
- New component: `src/components/admin/TransportBookingBilingualPdf.tsx`.
- New route: `/admin/transport-booking/:id/invoice` → `AdminTransportBookingInvoicePage.tsx` with **Print / Save PDF** button (same pattern as `AdminBilingualInvoicePage`).
- Layout: A4, branded header (logo + company info) + "Transport Booking Voucher / إيصال حجز النقل" + tracking ID + issue date.
- Customer block: name, phone, email, address, passport — bilingual labels.
- Body: same 7 sections as the detail view, rendered as bordered tables with EN label on the left and AR label on the right of each cell, values centred. Empty/missing rows are hidden.
- Footer: authorised signature (reuses `pdfSignature` helper) + bilingual terms note.
- Fonts: existing Noto Sans + Noto Sans Arabic already loaded in the project.

### 3. Wiring
- `src/App.tsx` — remove the two old lazy imports + routes, add the two new ones.
- `src/components/admin/AdminSidebar.tsx` — remove the two old entries, add one **Transport Booking** entry (icon `FileSignature`, same role list as before).
- `src/pages/admin/AdminPendingBookingsPage.tsx` — keep the existing inline `TransportVoucherDetailView`; the "Open" / tracking link there now navigates to `/admin/transport-booking?id=…`.
- `src/components/admin/TransportVoucherDetailView.tsx` — kept and reused inside the new detail view (single source of truth for the form-style render).

## Data

No schema changes. Reads from the existing `transport_voucher_orders` table (`data` JSONB holds the full form payload), plus `profiles` for the linked customer. Confirm/Cancel/Delete reuse the existing endpoints already used by `AdminPendingBookingsPage`.

## Files touched (summary)

Create
- `src/pages/admin/AdminTransportBookingPage.tsx`
- `src/pages/admin/AdminTransportBookingInvoicePage.tsx`
- `src/components/admin/TransportBookingBilingualPdf.tsx`

Edit
- `src/App.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/pages/admin/AdminPendingBookingsPage.tsx` (link target only)

Delete
- `src/pages/admin/AdminTransportVouchersPage.tsx`
- `src/pages/admin/AdminInternalMovementsPage.tsx`
- `src/components/admin/TransportVoucherPdf.tsx`

## One thing to confirm

The existing `Transport` sidebar item (`/admin/transport`) manages the **transport services catalogue** displayed on the public website (vehicles, capacity, price), which is a different feature from bookings. I plan to leave it untouched. Tell me if you also want this removed/merged.
