import { apiClient } from "@/lib/apiClient";
import type { BilingualInvoiceData } from "@/components/admin/BilingualInvoicePdf";

export type InvoiceServiceType = "booking" | "visa" | "hotel" | "catering" | "transport";

const asNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

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

function toBdt(total: number, currency: string | null | undefined, sarRate: number) {
  return String(currency || "BDT").toUpperCase() === "SAR" ? total * sarRate : total;
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
      subtotal: asNum(booking.total_amount) + asNum(booking.discount),
      discount: asNum(booking.discount),
      total: asNum(booking.total_amount),
      paid: asNum(booking.paid_amount),
      due: asNum(booking.due_amount),
      sar_rate: sarRate,
      notes: booking.notes,
    };
  }

  if (service === "visa") {
    const { data: row } = await apiClient.from("visa_applications").select("*").eq("id", id).single();
    if (!row) return null;

    return {
      invoice_no: row.invoice_no || `VISA-${String(row.id).slice(0, 8).toUpperCase()}`,
      issued_at: row.application_date,
      customer_name: row.applicant_name,
      customer_phone: row.client_reference || "",
      package_name: `Visa - ${row.country_name}`,
      package_name_ar: "خدمة التأشيرة",
      subtotal: asNum(row.billing_amount),
      discount: 0,
      total: asNum(row.billing_amount),
      paid: asNum(row.received_amount),
      due: asNum(row.customer_due),
      sar_rate: sarRate,
      notes: row.remarks,
      items: [
        {
          description_en: `Visa Processing (${row.country_name})`,
          description_ar: "معالجة التأشيرة",
          qty: 1,
          unit_price: asNum(row.billing_amount),
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

    const totalBdt = toBdt(asNum(row.total_price), row.currency, sarRate);
    const perMeal = row.persons && row.days ? totalBdt / (row.persons * row.days) : totalBdt;

    return {
      invoice_no: row.tracking_id || `CAT-${String(row.id).slice(0, 8).toUpperCase()}`,
      issued_at: row.created_at,
      customer_name: row.guest_name,
      customer_phone: row.guest_phone,
      customer_email: row.guest_email,
      customer_address: row.delivery_address,
      package_name: pkg?.name || "Catering Service",
      package_name_ar: "خدمة التموين",
      subtotal: totalBdt,
      discount: 0,
      total: totalBdt,
      paid: 0,
      due: totalBdt,
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

    const totalBdt = asNum(row.total_price);

    return {
      invoice_no: `HOT-${String(row.id).slice(0, 8).toUpperCase()}`,
      issued_at: row.created_at,
      customer_name: profile?.full_name || "Hotel Customer",
      customer_phone: profile?.phone,
      customer_email: profile?.email,
      customer_address: profile?.address,
      package_name: `${hotel?.name || "Hotel"} - ${room?.name || "Room"}`,
      package_name_ar: "حجز الفندق",
      subtotal: totalBdt,
      discount: 0,
      total: totalBdt,
      paid: 0,
      due: totalBdt,
      sar_rate: sarRate,
      notes: row.notes,
      items: [
        {
          description_en: `Hotel Stay (${hotel?.location || ""})`,
          description_ar: "الإقامة",
          qty: Math.max(1, asNum(row.guests)),
          unit_price: totalBdt / Math.max(1, asNum(row.guests)),
        },
      ],
    };
  }

  if (service === "transport") {
    const { data: row } = await apiClient.from("transport_orders").select("*").eq("id", id).single();
    if (!row) return null;

    const totalBdt = toBdt(asNum(row.total_price), row.currency, sarRate);

    return {
      invoice_no: row.tracking_id || `TRN-${String(row.id).slice(0, 8).toUpperCase()}`,
      issued_at: row.created_at,
      customer_name: row.guest_name,
      customer_phone: row.guest_phone,
      customer_email: row.guest_email,
      package_name: `${row.route_from || ""} to ${row.route_to || ""}`.trim() || "Transport Service",
      package_name_ar: "خدمة النقل",
      subtotal: totalBdt,
      discount: 0,
      total: totalBdt,
      paid: 0,
      due: totalBdt,
      sar_rate: sarRate,
      notes: row.notes,
      items: [
        {
          description_en: `Transport (${row.vehicle_type || "Vehicle"})`,
          description_ar: "النقل",
          qty: Math.max(1, asNum(row.passengers)),
          unit_price: totalBdt / Math.max(1, asNum(row.passengers)),
        },
      ],
    };
  }

  return null;
}
