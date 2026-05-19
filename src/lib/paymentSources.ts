// Unified booking source loader for Payment Management.
// Fetches "due" rows from every menu that can receive a customer payment and
// normalises them into one shape so the AdminPaymentsPage can present a single
// booking picker across Umrah Orders, Customer Bookings, Hotel, Catering,
// Transport, Visa Applications, and Ticket Bookings.

import { apiClient } from "@/lib/apiClient";

export type PaymentSourceType =
  | "booking"
  | "umrah_order"
  | "hotel"
  | "catering"
  | "transport"
  | "visa"
  | "ticket";

export interface PaymentSource {
  source_type: PaymentSourceType;
  source_id: string;
  tracking_id: string;
  customer_name: string;
  customer_phone: string;
  customer_id?: string | null;
  user_id?: string | null;
  service_label: string;
  total: number;
  paid: number;
  due: number;
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const safe = async <T = any>(p: any): Promise<{ data: T[] }> => {
  try {
    const r = await Promise.resolve(p);
    return { data: Array.isArray(r?.data) ? r.data : [] };
  } catch (e) {
    console.warn("[paymentSources] query failed:", e);
    return { data: [] };
  }
};

export async function fetchDuePaymentSources(): Promise<PaymentSource[]> {
  const [
    bookingsRes,
    umrahRes,
    hotelRes,
    cateringRes,
    transportRes,
    visaRes,
    ticketRes,
  ] = await Promise.all([
    safe(
      apiClient
        .from("bookings")
        .select(
          "id,tracking_id,guest_name,guest_phone,user_id,total_amount,paid_amount,due_amount,status"
        )
    ),
    safe(
      apiClient
        .from("umrah_orders")
        .select(
          "id,tracking_id,guest_name,guest_phone,user_id,customer_id,estimated_price_bdt,paid_amount,due_amount,status,program_tier"
        )
    ),
    safe(
      apiClient
        .from("hotel_bookings")
        .select("id,user_id,total_price,paid_amount,due_amount,status")
    ),
    safe(
      apiClient
        .from("catering_orders")
        .select(
          "id,tracking_id,user_id,guest_name,guest_phone,total_price,paid_amount,due_amount,status"
        )
    ),
    safe(
      apiClient
        .from("transport_orders")
        .select(
          "id,tracking_id,user_id,guest_name,guest_phone,total_price,paid_amount,due_amount,status"
        )
    ),
    safe(
      apiClient
        .from("visa_applications")
        .select(
          "id,invoice_no,applicant_name,client_reference,billing_amount,received_amount,customer_due,status,visa_status"
        )
    ),
    safe(
      apiClient
        .from("ticket_bookings")
        .select(
          "id,invoice_no,passenger_name,passenger_phone,customer_billing_amount,received_amount,customer_due,payment_status"
        )
    ),
  ]);

  const rows: PaymentSource[] = [];

  for (const b of bookingsRes.data) {
    const total = num(b.total_amount);
    const paid = num(b.paid_amount);
    const due = num(b.due_amount ?? total - paid);
    if (due <= 0 || (b.status || "").toLowerCase() === "cancelled") continue;
    rows.push({
      source_type: "booking",
      source_id: b.id,
      tracking_id: b.tracking_id || `BK-${String(b.id).slice(0, 6)}`,
      customer_name: b.guest_name || "Customer",
      customer_phone: b.guest_phone || "",
      user_id: b.user_id,
      service_label: "Customer Booking",
      total,
      paid,
      due,
    });
  }

  for (const u of umrahRes.data) {
    const total = num(u.estimated_price_bdt);
    const paid = num(u.paid_amount);
    const due = num(u.due_amount ?? total - paid);
    if (due <= 0 || (u.status || "").toLowerCase() === "cancelled") continue;
    rows.push({
      source_type: "umrah_order",
      source_id: u.id,
      tracking_id: u.tracking_id || `UMR-${String(u.id).slice(0, 6)}`,
      customer_name: u.guest_name || "Umrah Customer",
      customer_phone: u.guest_phone || "",
      customer_id: u.customer_id,
      user_id: u.user_id,
      service_label: `Umrah Order${u.program_tier ? ` · ${u.program_tier}` : ""}`,
      total,
      paid,
      due,
    });
  }

  for (const h of hotelRes.data) {
    const total = num(h.total_price);
    const paid = num(h.paid_amount);
    const due = num(h.due_amount ?? total - paid);
    if (due <= 0 || (h.status || "").toLowerCase() === "cancelled") continue;
    rows.push({
      source_type: "hotel",
      source_id: h.id,
      tracking_id: `HOT-${String(h.id).slice(0, 6).toUpperCase()}`,
      customer_name: "Hotel Customer",
      customer_phone: "",
      user_id: h.user_id,
      service_label: "Hotel Booking",
      total,
      paid,
      due,
    });
  }

  for (const c of cateringRes.data) {
    const total = num(c.total_price);
    const paid = num(c.paid_amount);
    const due = num(c.due_amount ?? total - paid);
    if (due <= 0 || (c.status || "").toLowerCase() === "cancelled") continue;
    rows.push({
      source_type: "catering",
      source_id: c.id,
      tracking_id: c.tracking_id || `CAT-${String(c.id).slice(0, 6)}`,
      customer_name: c.guest_name || "Catering Customer",
      customer_phone: c.guest_phone || "",
      user_id: c.user_id,
      service_label: "Catering",
      total,
      paid,
      due,
    });
  }

  for (const t of transportRes.data) {
    const total = num(t.total_price);
    const paid = num(t.paid_amount);
    const due = num(t.due_amount ?? total - paid);
    if (due <= 0 || (t.status || "").toLowerCase() === "cancelled") continue;
    rows.push({
      source_type: "transport",
      source_id: t.id,
      tracking_id: t.tracking_id || `TRN-${String(t.id).slice(0, 6)}`,
      customer_name: t.guest_name || "Transport Customer",
      customer_phone: t.guest_phone || "",
      user_id: t.user_id,
      service_label: "Transport Booking",
      total,
      paid,
      due,
    });
  }

  for (const v of visaRes.data) {
    const total = num(v.billing_amount);
    const paid = num(v.received_amount);
    const due = num(v.customer_due ?? total - paid);
    if (due <= 0 || (v.status || "").toLowerCase() === "cancelled") continue;
    rows.push({
      source_type: "visa",
      source_id: v.id,
      tracking_id: v.invoice_no || `VS-${String(v.id).slice(0, 6)}`,
      customer_name: v.applicant_name || "Visa Applicant",
      customer_phone: v.client_reference || "",
      service_label: "Visa Application",
      total,
      paid,
      due,
    });
  }

  for (const t of ticketRes.data) {
    const total = num(t.customer_billing_amount);
    const paid = num(t.received_amount);
    const due = num(t.customer_due ?? total - paid);
    if (due <= 0 || (t.payment_status || "").toLowerCase() === "cancelled") continue;
    rows.push({
      source_type: "ticket",
      source_id: t.id,
      tracking_id: t.invoice_no || `TKT-${String(t.id).slice(0, 6)}`,
      customer_name: t.passenger_name || "Ticket Customer",
      customer_phone: t.passenger_phone || "",
      service_label: "Ticket Booking",
      total,
      paid,
      due,
    });
  }

  // Largest due first so common cases are at the top
  rows.sort((a, b) => b.due - a.due);
  return rows;
}

export const SOURCE_LABELS: Record<PaymentSourceType, string> = {
  booking: "Customer Booking",
  umrah_order: "Umrah Order",
  hotel: "Hotel",
  catering: "Catering",
  transport: "Transport",
  visa: "Visa",
  ticket: "Ticket",
};
