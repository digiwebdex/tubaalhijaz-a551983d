import { apiClient } from "@/lib/apiClient";
import type { BilingualInvoiceData } from "@/components/admin/BilingualInvoicePdf";

export type InvoiceServiceType = "booking" | "visa" | "hotel" | "catering" | "transport";

const asNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

async function getSarRate() {
  const { data } = await apiClient
    .from("company_settings")
    .select("setting_value")
    .eq("setting_key", "currency_rate")
    .maybeSingle();

  const cfg = (data as any)?.setting_value || {};
  const rate = asNum(cfg?.sar_to_bdt);
  return rate > 0 ? rate : 30;
}

function deriveDualTotal({
  total,
  amountBdt,
  amountSar,
  currency,
  sarRate,
}: {
  total?: any;
  amountBdt?: any;
  amountSar?: any;
  currency?: string | null | undefined;
  sarRate: number;
}) {
  let bdt = asNum(amountBdt);
  let sar = asNum(amountSar);
  const base = asNum(total);
  const curr = String(currency || "BDT").toUpperCase();

  if (bdt <= 0 && base > 0 && curr !== "SAR") bdt = base;
  if (sar <= 0 && base > 0 && curr === "SAR") sar = base;

  if (bdt <= 0 && sar > 0) bdt = sar * sarRate;
  if (sar <= 0 && bdt > 0) sar = bdt / Math.max(sarRate, 0.0001);

  return { bdt: round2(bdt), sar: round2(sar) };
}

async function fetchTransportRecord(id: string) {
  const voucher = await apiClient.from("transport_voucher_orders").select("*").eq("id", id).maybeSingle();
  if (voucher.data) return { source: "voucher", row: voucher.data as any };

  const modernOrder = await apiClient.from("transport_orders").select("*").eq("id", id).maybeSingle();
  if (modernOrder.data) return { source: "order", row: modernOrder.data as any };

  const legacyBooking = await apiClient.from("transport_bookings").select("*").eq("id", id).maybeSingle();
  if (legacyBooking.data) return { source: "legacy", row: legacyBooking.data as any };

  return null;
}

export async function buildServiceInvoiceData(service: InvoiceServiceType, id: string): Promise<BilingualInvoiceData | null> {
  const sarRate = await getSarRate();

  if (service === "booking") {
    const { data: booking } = await apiClient.from("bookings").select("*").eq("id", id).single();
    if (!booking) return null;

    const [{ data: pkg }, { data: profile }] = await Promise.all([
      apiClient.from("packages").select("name").eq("id", booking.package_id).maybeSingle(),
      booking.user_id
        ? apiClient.from("profiles").select("full_name,phone,email,address").eq("user_id", booking.user_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const total = deriveDualTotal({
      total: booking.total_amount,
      amountBdt: booking.amount_bdt,
      amountSar: booking.amount_sar,
      sarRate,
      currency: "BDT",
    });

    return {
      invoice_no: booking.tracking_id || `INV-${String(booking.id).slice(0, 8).toUpperCase()}`,
      issued_at: booking.created_at,
      customer_name: profile?.full_name || booking.guest_name,
      customer_phone: profile?.phone || booking.guest_phone,
      customer_email: profile?.email || booking.guest_email,
      customer_address: profile?.address || booking.guest_address,
      passport_no: booking.guest_passport,
      package_name: pkg?.name || "Umrah Service",
      package_name_ar: "الخدمة",
      num_travelers: booking.num_travelers || 1,
      subtotal: asNum(booking.subtotal_amount || total.bdt + asNum(booking.discount)),
      discount: asNum(booking.discount),
      total: total.bdt,
      paid: asNum(booking.paid_amount),
      due: asNum(booking.due_amount || Math.max(total.bdt - asNum(booking.paid_amount), 0)),
      sar_rate: sarRate,
      notes: booking.notes,
    };
  }

  if (service === "visa") {
    const { data: row } = await apiClient.from("visa_applications").select("*").eq("id", id).single();
    if (!row) return null;

    const total = deriveDualTotal({
      total: row.billing_amount,
      amountBdt: row.amount_bdt,
      amountSar: row.amount_sar,
      sarRate,
      currency: "BDT",
    });

    return {
      invoice_no: row.invoice_no || `VISA-${String(row.id).slice(0, 8).toUpperCase()}`,
      issued_at: row.application_date,
      customer_name: row.applicant_name,
      customer_phone: row.client_reference || "",
      package_name: `Visa - ${row.country_name}`,
      package_name_ar: "خدمة التأشيرة",
      subtotal: total.bdt,
      discount: 0,
      total: total.bdt,
      paid: asNum(row.received_amount),
      due: asNum(row.customer_due || Math.max(total.bdt - asNum(row.received_amount), 0)),
      sar_rate: sarRate,
      notes: row.remarks,
      items: [
        {
          description_en: `Visa Processing (${row.country_name})`,
          description_ar: "معالجة التأشيرة",
          qty: 1,
          unit_price: total.bdt,
        },
      ],
    };
  }

  if (service === "catering") {
    const { data: row } = await apiClient.from("catering_orders").select("*").eq("id", id).single();
    if (!row) return null;

    const { data: pkg } = row.package_id
      ? await apiClient.from("catering_packages").select("name").eq("id", row.package_id).maybeSingle()
      : { data: null };

    const total = deriveDualTotal({
      total: row.total_price,
      amountBdt: row.amount_bdt,
      amountSar: row.amount_sar,
      currency: row.currency,
      sarRate,
    });

    const perMeal = row.persons && row.days ? total.bdt / (row.persons * row.days) : total.bdt;

    return {
      invoice_no: row.tracking_id || `CAT-${String(row.id).slice(0, 8).toUpperCase()}`,
      issued_at: row.created_at,
      customer_name: row.guest_name,
      customer_phone: row.guest_phone,
      customer_email: row.guest_email,
      customer_address: row.delivery_address,
      package_name: pkg?.name || "Catering Service",
      package_name_ar: "خدمة التموين",
      subtotal: total.bdt,
      discount: 0,
      total: total.bdt,
      paid: 0,
      due: total.bdt,
      sar_rate: sarRate,
      notes: row.notes,
      items: [
        {
          description_en: `${pkg?.name || "Catering"} (${row.days || 1} days)`,
          description_ar: "التموين",
          qty: Math.max(1, asNum(row.persons)),
          unit_price: perMeal,
        },
      ],
    };
  }

  if (service === "hotel") {
    const { data: row } = await apiClient.from("hotel_bookings").select("*").eq("id", id).single();
    if (!row) return null;

    const [{ data: hotel }, { data: room }, { data: profile }] = await Promise.all([
      apiClient.from("hotels").select("name,location").eq("id", row.hotel_id).maybeSingle(),
      apiClient.from("hotel_rooms").select("name").eq("id", row.room_id).maybeSingle(),
      row.user_id ? apiClient.from("profiles").select("full_name,phone,email,address").eq("user_id", row.user_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const total = deriveDualTotal({
      total: row.total_price,
      amountBdt: row.amount_bdt,
      amountSar: row.amount_sar,
      currency: row.currency,
      sarRate,
    });

    return {
      invoice_no: `HOT-${String(row.id).slice(0, 8).toUpperCase()}`,
      issued_at: row.created_at,
      customer_name: profile?.full_name || "Hotel Customer",
      customer_phone: profile?.phone,
      customer_email: profile?.email,
      customer_address: profile?.address,
      package_name: `${hotel?.name || "Hotel"} - ${room?.name || "Room"}`,
      package_name_ar: "حجز الفندق",
      subtotal: total.bdt,
      discount: 0,
      total: total.bdt,
      paid: 0,
      due: total.bdt,
      sar_rate: sarRate,
      notes: row.notes,
      items: [
        {
          description_en: `Hotel Stay (${hotel?.location || ""})`,
          description_ar: "الإقامة",
          qty: Math.max(1, asNum(row.guests)),
          unit_price: total.bdt / Math.max(1, asNum(row.guests)),
        },
      ],
    };
  }

  if (service === "transport") {
    const record = await fetchTransportRecord(id);
    if (!record) return null;

    const row = record.row;
    const total = deriveDualTotal({
      total: row.total_price,
      amountBdt: row.amount_bdt,
      amountSar: row.amount_sar,
      currency: row.currency,
      sarRate,
    });

    const customerName = row.guest_name || row.contact_name || "Transport Customer";
    const customerPhone = row.guest_phone || row.contact_phone || "";
    const customerEmail = row.guest_email || row.contact_email || "";
    const routeLabel = `${row.route_from || row.pickup_location || ""} to ${row.route_to || row.dropoff_location || ""}`.trim();
    const pax = Math.max(1, asNum(row.passengers || row.pilgrim_count || 1));

    return {
      invoice_no: row.tracking_id || `TRN-${String(row.id).slice(0, 8).toUpperCase()}`,
      issued_at: row.created_at,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      package_name: routeLabel || "Transport Service",
      package_name_ar: "خدمة النقل",
      subtotal: total.bdt,
      discount: 0,
      total: total.bdt,
      paid: 0,
      due: total.bdt,
      sar_rate: sarRate,
      notes: row.notes,
      items: [
        {
          description_en: `Transport (${row.vehicle_type || row.transport_type || "Vehicle"})`,
          description_ar: "النقل",
          qty: pax,
          unit_price: total.bdt / pax,
        },
      ],
    };
  }

  return null;
}
