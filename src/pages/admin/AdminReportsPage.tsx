import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Printer, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type StatementEntry = {
  id: string;
  date: string;
  refNo: string;
  service: "umrah" | "visa" | "hotel" | "transport" | "catering";
  description: string;
  billBdt: number;
  billSar: number;
  payBdt: number;
  paySar: number;
  rate: number;
  status: string;
  rowType: "bill" | "payment";
  customerKey: string;
  customerLabel: string;
};

const DEFAULT_RATE = 30;
const SERVICE_LABELS = {
  umrah: "Umrah Booking",
  visa: "Visa Booking",
  hotel: "Hotel Booking",
  transport: "Transport Booking",
  catering: "Catering",
} as const;

const DEFAULT_LABELS = {
  statement_title: "Statement Report",
  statement_subtitle: "Customer statement with BDT/SAR and running balance.",
};

const asNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateIso = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

const normalizeService = (raw?: string | null): StatementEntry["service"] => {
  const value = String(raw || "").toLowerCase();
  if (value.includes("transport")) return "transport";
  if (value.includes("visa")) return "visa";
  if (value.includes("hotel")) return "hotel";
  if (value.includes("cater")) return "catering";
  return "umrah";
};

const buildCustomerIdentity = ({
  userId,
  name,
  phone,
  email,
}: {
  userId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}) => {
  const safeName = String(name || "Unknown Customer").trim() || "Unknown Customer";

  if (userId) {
    return { key: `user:${userId}`, label: safeName };
  }

  const safePhone = String(phone || "").trim();
  const safeEmail = String(email || "").trim().toLowerCase();
  const fallback = `${safeName.toLowerCase()}|${safePhone || safeEmail || "no-contact"}`;
  return { key: `guest:${fallback}`, label: safeName };
};

const deriveDualAmounts = ({
  amountBdt,
  amountSar,
  amount,
  currency,
  rate,
  fallbackRate,
}: {
  amountBdt?: any;
  amountSar?: any;
  amount?: any;
  currency?: any;
  rate?: any;
  fallbackRate: number;
}) => {
  const safeRate = asNum(rate) > 0 ? asNum(rate) : fallbackRate;
  let bdt = asNum(amountBdt);
  let sar = asNum(amountSar);
  const base = asNum(amount);
  const curr = String(currency || "BDT").toUpperCase();

  if (bdt <= 0 && base > 0 && curr !== "SAR") bdt = base;
  if (sar <= 0 && base > 0 && curr === "SAR") sar = base;

  if (bdt <= 0 && sar > 0) bdt = sar * safeRate;
  if (sar <= 0 && bdt > 0) sar = bdt / Math.max(safeRate, 0.0001);

  return {
    bdt: round2(bdt),
    sar: round2(sar),
    rate: round2(safeRate),
  };
};

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [labels, setLabels] = useState(DEFAULT_LABELS);

  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [visas, setVisas] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [catering, setCatering] = useState<any[]>([]);
  const [transportVouchers, setTransportVouchers] = useState<any[]>([]);
  const [transportOrders, setTransportOrders] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [serviceType, setServiceType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return dateIso(d);
  });
  const [dateTo, setDateTo] = useState<string>(() => dateIso(new Date()));

  const fetchAll = async (showSoftLoading = false) => {
    if (showSoftLoading) setRefreshing(true);
    else setLoading(true);

    const [
      bRes,
      pRes,
      vRes,
      hRes,
      cRes,
      tvRes,
      toRes,
      profRes,
      rateRes,
      labelRes,
    ] = await Promise.all([
      apiClient
        .from("bookings")
        .select("id,tracking_id,guest_name,guest_phone,guest_email,user_id,total_amount,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt,packages(name,type)"),
      apiClient
        .from("payments")
        .select("id,booking_id,user_id,customer_id,amount,status,paid_at,created_at,payment_method,notes,amount_bdt,amount_sar,fx_rate_sar_to_bdt"),
      apiClient
        .from("visa_applications")
        .select("id,invoice_no,applicant_name,passport_number,client_reference,billing_amount,received_amount,customer_due,visa_status,status,application_date,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt"),
      apiClient
        .from("hotel_bookings")
        .select("id,user_id,total_price,currency,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt"),
      apiClient
        .from("catering_orders")
        .select("id,tracking_id,user_id,guest_name,guest_phone,guest_email,total_price,currency,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt"),
      apiClient
        .from("transport_voucher_orders")
        .select("id,tracking_id,user_id,contact_name,contact_phone,contact_email,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt"),
      apiClient
        .from("transport_orders")
        .select("id,tracking_id,user_id,guest_name,guest_phone,guest_email,total_price,currency,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt"),
      apiClient.from("profiles").select("user_id,full_name,phone,email"),
      apiClient.from("company_settings").select("setting_value").eq("setting_key", "currency_rate").maybeSingle(),
      apiClient.from("company_settings").select("setting_value").eq("setting_key", "content_labels").maybeSingle(),
    ]);

    setBookings(Array.isArray(bRes.data) ? bRes.data : []);
    setPayments(Array.isArray(pRes.data) ? pRes.data : []);
    setVisas(Array.isArray(vRes.data) ? vRes.data : []);
    setHotels(Array.isArray(hRes.data) ? hRes.data : []);
    setCatering(Array.isArray(cRes.data) ? cRes.data : []);
    setTransportVouchers(Array.isArray(tvRes.data) ? tvRes.data : []);
    setTransportOrders(Array.isArray(toRes.data) ? toRes.data : []);
    setProfiles(Array.isArray(profRes.data) ? profRes.data : []);

    const cfg = (rateRes.data as any)?.setting_value || {};
    const sarToBdt = asNum(cfg?.sar_to_bdt);
    setRate(sarToBdt > 0 ? sarToBdt : DEFAULT_RATE);

    const labelCfg = (labelRes.data as any)?.setting_value;
    if (labelCfg && typeof labelCfg === "object") {
      setLabels({
        statement_title: labelCfg.statement_title || DEFAULT_LABELS.statement_title,
        statement_subtitle: labelCfg.statement_subtitle || DEFAULT_LABELS.statement_subtitle,
      });
    } else {
      setLabels(DEFAULT_LABELS);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAll(false);
  }, []);

  const profileMap = useMemo(() => {
    const m = new Map<string, any>();
    profiles.forEach((p: any) => {
      if (p.user_id) m.set(p.user_id, p);
    });
    return m;
  }, [profiles]);

  const bookingMap = useMemo(() => {
    const m = new Map<string, any>();
    bookings.forEach((b: any) => m.set(b.id, b));
    return m;
  }, [bookings]);

  const allEntries = useMemo<StatementEntry[]>(() => {
    const rows: StatementEntry[] = [];

    const pushRow = (entry: StatementEntry) => {
      if (!entry.date) return;
      rows.push(entry);
    };

    bookings.forEach((b: any) => {
      const profile = b.user_id ? profileMap.get(b.user_id) : null;
      const customer = buildCustomerIdentity({
        userId: b.user_id,
        name: profile?.full_name || b.guest_name,
        phone: profile?.phone || b.guest_phone,
        email: profile?.email || b.guest_email,
      });
      const service = normalizeService(b.packages?.type || "umrah");
      const dual = deriveDualAmounts({
        amountBdt: b.amount_bdt,
        amountSar: b.amount_sar,
        amount: b.total_amount,
        currency: "BDT",
        rate: b.fx_rate_sar_to_bdt,
        fallbackRate: rate,
      });

      pushRow({
        id: `bill-booking-${b.id}`,
        date: b.created_at,
        refNo: b.tracking_id || b.id,
        service,
        description: `Invoice: ${b.packages?.name || SERVICE_LABELS[service]}`,
        billBdt: dual.bdt,
        billSar: dual.sar,
        payBdt: 0,
        paySar: 0,
        rate: dual.rate,
        status: b.status || "pending",
        rowType: "bill",
        customerKey: customer.key,
        customerLabel: customer.label,
      });
    });

    visas.forEach((v: any) => {
      const customer = buildCustomerIdentity({
        name: v.applicant_name,
        phone: v.client_reference,
      });

      const bill = deriveDualAmounts({
        amountBdt: v.amount_bdt,
        amountSar: v.amount_sar,
        amount: v.billing_amount,
        currency: "BDT",
        rate: v.fx_rate_sar_to_bdt,
        fallbackRate: rate,
      });

      pushRow({
        id: `bill-visa-${v.id}`,
        date: v.application_date || v.created_at,
        refNo: v.invoice_no || v.id,
        service: "visa",
        description: `Invoice: Visa (${v.passport_number || "Application"})`,
        billBdt: bill.bdt,
        billSar: bill.sar,
        payBdt: 0,
        paySar: 0,
        rate: bill.rate,
        status: v.visa_status || v.status || "pending",
        rowType: "bill",
        customerKey: customer.key,
        customerLabel: customer.label,
      });

      if (asNum(v.received_amount) > 0) {
        const pay = deriveDualAmounts({
          amount: v.received_amount,
          currency: "BDT",
          rate: v.fx_rate_sar_to_bdt,
          fallbackRate: rate,
        });

        pushRow({
          id: `pay-visa-${v.id}`,
          date: v.application_date || v.created_at,
          refNo: v.invoice_no || v.id,
          service: "visa",
          description: "Payment: Visa Received",
          billBdt: 0,
          billSar: 0,
          payBdt: pay.bdt,
          paySar: pay.sar,
          rate: pay.rate,
          status: v.visa_status || v.status || "completed",
          rowType: "payment",
          customerKey: customer.key,
          customerLabel: customer.label,
        });
      }
    });

    hotels.forEach((h: any) => {
      const profile = h.user_id ? profileMap.get(h.user_id) : null;
      const customer = buildCustomerIdentity({
        userId: h.user_id,
        name: profile?.full_name || "Hotel Customer",
        phone: profile?.phone,
        email: profile?.email,
      });

      const dual = deriveDualAmounts({
        amountBdt: h.amount_bdt,
        amountSar: h.amount_sar,
        amount: h.total_price,
        currency: h.currency || "BDT",
        rate: h.fx_rate_sar_to_bdt,
        fallbackRate: rate,
      });

      if (dual.bdt <= 0 && dual.sar <= 0) return;

      pushRow({
        id: `bill-hotel-${h.id}`,
        date: h.created_at,
        refNo: `HOT-${String(h.id).slice(0, 8).toUpperCase()}`,
        service: "hotel",
        description: "Invoice: Hotel Booking",
        billBdt: dual.bdt,
        billSar: dual.sar,
        payBdt: 0,
        paySar: 0,
        rate: dual.rate,
        status: h.status || "pending",
        rowType: "bill",
        customerKey: customer.key,
        customerLabel: customer.label,
      });
    });

    catering.forEach((c: any) => {
      const profile = c.user_id ? profileMap.get(c.user_id) : null;
      const customer = buildCustomerIdentity({
        userId: c.user_id,
        name: profile?.full_name || c.guest_name,
        phone: profile?.phone || c.guest_phone,
        email: profile?.email || c.guest_email,
      });

      const dual = deriveDualAmounts({
        amountBdt: c.amount_bdt,
        amountSar: c.amount_sar,
        amount: c.total_price,
        currency: c.currency || "BDT",
        rate: c.fx_rate_sar_to_bdt,
        fallbackRate: rate,
      });

      if (dual.bdt <= 0 && dual.sar <= 0) return;

      pushRow({
        id: `bill-catering-${c.id}`,
        date: c.created_at,
        refNo: c.tracking_id || c.id,
        service: "catering",
        description: "Invoice: Catering Service",
        billBdt: dual.bdt,
        billSar: dual.sar,
        payBdt: 0,
        paySar: 0,
        rate: dual.rate,
        status: c.status || "pending",
        rowType: "bill",
        customerKey: customer.key,
        customerLabel: customer.label,
      });
    });

    transportOrders.forEach((t: any) => {
      const profile = t.user_id ? profileMap.get(t.user_id) : null;
      const customer = buildCustomerIdentity({
        userId: t.user_id,
        name: profile?.full_name || t.guest_name,
        phone: profile?.phone || t.guest_phone,
        email: profile?.email || t.guest_email,
      });

      const dual = deriveDualAmounts({
        amountBdt: t.amount_bdt,
        amountSar: t.amount_sar,
        amount: t.total_price,
        currency: t.currency || "BDT",
        rate: t.fx_rate_sar_to_bdt,
        fallbackRate: rate,
      });

      if (dual.bdt <= 0 && dual.sar <= 0) return;

      pushRow({
        id: `bill-transport-order-${t.id}`,
        date: t.created_at,
        refNo: t.tracking_id || t.id,
        service: "transport",
        description: "Invoice: Transport Booking",
        billBdt: dual.bdt,
        billSar: dual.sar,
        payBdt: 0,
        paySar: 0,
        rate: dual.rate,
        status: t.status || "pending",
        rowType: "bill",
        customerKey: customer.key,
        customerLabel: customer.label,
      });
    });

    transportVouchers.forEach((v: any) => {
      const profile = v.user_id ? profileMap.get(v.user_id) : null;
      const customer = buildCustomerIdentity({
        userId: v.user_id,
        name: profile?.full_name || v.contact_name,
        phone: profile?.phone || v.contact_phone,
        email: profile?.email || v.contact_email,
      });

      const dual = deriveDualAmounts({
        amountBdt: v.amount_bdt,
        amountSar: v.amount_sar,
        rate: v.fx_rate_sar_to_bdt,
        fallbackRate: rate,
      });

      if (dual.bdt <= 0 && dual.sar <= 0) return;

      pushRow({
        id: `bill-transport-voucher-${v.id}`,
        date: v.created_at,
        refNo: v.tracking_id || v.id,
        service: "transport",
        description: "Invoice: Transport Voucher",
        billBdt: dual.bdt,
        billSar: dual.sar,
        payBdt: 0,
        paySar: 0,
        rate: dual.rate,
        status: v.status || "pending",
        rowType: "bill",
        customerKey: customer.key,
        customerLabel: customer.label,
      });
    });

    payments.forEach((p: any) => {
      const booking = bookingMap.get(p.booking_id);
      const profile = (p.user_id || p.customer_id) ? profileMap.get(p.user_id || p.customer_id) : null;
      const customer = buildCustomerIdentity({
        userId: p.customer_id || p.user_id || booking?.user_id,
        name: profile?.full_name || booking?.guest_name,
        phone: profile?.phone || booking?.guest_phone,
        email: profile?.email || booking?.guest_email,
      });

      const dual = deriveDualAmounts({
        amountBdt: p.amount_bdt,
        amountSar: p.amount_sar,
        amount: p.amount,
        currency: "BDT",
        rate: p.fx_rate_sar_to_bdt,
        fallbackRate: rate,
      });

      const service = normalizeService(booking?.packages?.type || "umrah");

      pushRow({
        id: `pay-booking-${p.id}`,
        date: p.paid_at || p.created_at,
        refNo: booking?.tracking_id || p.booking_id || p.id,
        service,
        description: `Payment: ${p.payment_method || "manual"}`,
        billBdt: 0,
        billSar: 0,
        payBdt: dual.bdt,
        paySar: dual.sar,
        rate: dual.rate,
        status: p.status || "completed",
        rowType: "payment",
        customerKey: customer.key,
        customerLabel: customer.label,
      });
    });

    return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [
    bookings,
    payments,
    visas,
    hotels,
    catering,
    transportVouchers,
    transportOrders,
    bookingMap,
    profileMap,
    rate,
  ]);

  const customerOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    allEntries.forEach((e) => {
      if (!map.has(e.customerKey)) {
        map.set(e.customerKey, { id: e.customerKey, label: e.customerLabel });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allEntries]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    allEntries.forEach((e) => {
      if (e.status) set.add(e.status);
    });
    return Array.from(set).sort();
  }, [allEntries]);

  const scopedEntries = useMemo(() => {
    return allEntries.filter((e) => {
      if (selectedCustomer !== "all" && e.customerKey !== selectedCustomer) return false;
      if (serviceType !== "all" && e.service !== serviceType) return false;
      if (status !== "all" && e.status !== status) return false;
      return true;
    });
  }, [allEntries, selectedCustomer, serviceType, status]);

  const openingBalance = useMemo(() => {
    const fromTs = new Date(`${dateFrom}T00:00:00`).getTime();

    return scopedEntries.reduce(
      (acc, e) => {
        if (new Date(e.date).getTime() < fromTs) {
          acc.bdt += e.billBdt - e.payBdt;
          acc.sar += e.billSar - e.paySar;
        }
        return acc;
      },
      { bdt: 0, sar: 0 }
    );
  }, [scopedEntries, dateFrom]);

  const filteredRows = useMemo(() => {
    const fromTs = new Date(`${dateFrom}T00:00:00`).getTime();
    const toTs = new Date(`${dateTo}T23:59:59`).getTime();

    let runningBdt = openingBalance.bdt;
    let runningSar = openingBalance.sar;

    return scopedEntries
      .filter((e) => {
        const ts = new Date(e.date).getTime();
        return ts >= fromTs && ts <= toTs;
      })
      .map((e) => {
        runningBdt += e.billBdt - e.payBdt;
        runningSar += e.billSar - e.paySar;
        return {
          ...e,
          runningBdt,
          runningSar,
        };
      });
  }, [scopedEntries, dateFrom, dateTo, openingBalance]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row: any) => {
        acc.billBdt += row.billBdt;
        acc.billSar += row.billSar;
        acc.payBdt += row.payBdt;
        acc.paySar += row.paySar;
        acc.closingBdt = row.runningBdt;
        acc.closingSar = row.runningSar;
        return acc;
      },
      {
        billBdt: 0,
        billSar: 0,
        payBdt: 0,
        paySar: 0,
        closingBdt: openingBalance.bdt,
        closingSar: openingBalance.sar,
      }
    );
  }, [filteredRows, openingBalance]);

  const selectedCustomerLabel = useMemo(() => {
    if (selectedCustomer === "all") return "All Customers";
    return customerOptions.find((c) => c.id === selectedCustomer)?.label || "Customer";
  }, [selectedCustomer, customerOptions]);

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFontSize(14);
    doc.text(`Tuba Al Hijaz - ${labels.statement_title}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Customer: ${selectedCustomerLabel}`, 14, 20);
    doc.text(`Date Range: ${dateFrom} to ${dateTo}`, 14, 25);
    doc.text(`Opening Balance: BDT ${money(openingBalance.bdt)} | SAR ${money(openingBalance.sar)}`, 14, 30);

    autoTable(doc, {
      startY: 35,
      styles: { fontSize: 7.3, cellPadding: 1.4 },
      headStyles: { fillColor: [15, 76, 58] },
      head: [[
        "Date",
        "Particulars",
        "Ref",
        "Service",
        "Bill BDT",
        "Rate",
        "Bill SAR",
        "Pay BDT",
        "Rate",
        "Pay SAR",
        "Balance BDT",
        "Balance SAR",
        "Status",
      ]],
      body: filteredRows.map((r: any) => [
        format(new Date(r.date), "dd MMM yyyy"),
        r.description,
        r.refNo,
        SERVICE_LABELS[r.service],
        r.billBdt ? money(r.billBdt) : "",
        r.billBdt ? money(r.rate) : "",
        r.billSar ? money(r.billSar) : "",
        r.payBdt ? money(r.payBdt) : "",
        r.payBdt ? money(r.rate) : "",
        r.paySar ? money(r.paySar) : "",
        money(r.runningBdt),
        money(r.runningSar),
        r.status,
      ]),
    });

    const y = (doc as any).lastAutoTable?.finalY || 35;
    doc.setFontSize(9);
    doc.text(`Totals: Bill BDT ${money(totals.billBdt)} | Bill SAR ${money(totals.billSar)} | Payment BDT ${money(totals.payBdt)} | Payment SAR ${money(totals.paySar)}`, 14, y + 8);
    doc.text(`Closing: BDT ${money(totals.closingBdt)} | SAR ${money(totals.closingSar)}`, 14, y + 13);

    doc.save(`customer-statement-${dateFrom}-to-${dateTo}.pdf`);
  };

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading statement...</div>;
  }

  return (
    <div className="space-y-4 statement-page">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          .statement-print, .statement-print * { visibility: visible !important; }
          .statement-print { position: absolute !important; left: 0; top: 0; width: 100% !important; }
          .print-hide { display: none !important; }
        }
      `}</style>

      <div className="print-hide flex flex-wrap gap-2 items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">{labels.statement_title}</h1>
          <p className="text-sm text-muted-foreground">{labels.statement_subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchAll(true)}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <FileDown className="h-4 w-4 mr-1" /> Download PDF
          </Button>
          <Button size="sm" onClick={() => window.print()} className="bg-[#0F4C3A] hover:bg-[#1a6b50]">
            <Printer className="h-4 w-4 mr-1" /> Print Landscape
          </Button>
        </div>
      </div>

      <Card className="print-hide">
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Customer</label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customerOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Service</label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="umrah">Umrah Booking</SelectItem>
                <SelectItem value="visa">Visa Booking</SelectItem>
                <SelectItem value="hotel">Hotel Booking</SelectItem>
                <SelectItem value="transport">Transport Booking</SelectItem>
                <SelectItem value="catering">Catering</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Date From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Date To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Base FX (1 SAR)</label>
            <Input value={money(rate)} readOnly />
          </div>
        </CardContent>
      </Card>

      <div className="statement-print bg-white border border-border rounded-lg overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-[#0F4C3A] text-white">
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Particulars</th>
              <th className="p-2 text-left">Ref</th>
              <th className="p-2 text-left">Service</th>
              <th className="p-2 text-right">Bill BDT</th>
              <th className="p-2 text-right">Rate</th>
              <th className="p-2 text-right">Bill SAR</th>
              <th className="p-2 text-right">Pay BDT</th>
              <th className="p-2 text-right">Rate</th>
              <th className="p-2 text-right">Pay SAR</th>
              <th className="p-2 text-right">Balance BDT</th>
              <th className="p-2 text-right">Balance SAR</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-amber-50 border-b">
              <td className="p-2 font-semibold" colSpan={10}>Opening Balance</td>
              <td className="p-2 text-right font-semibold">{money(openingBalance.bdt)}</td>
              <td className="p-2 text-right font-semibold">{money(openingBalance.sar)}</td>
              <td className="p-2">-</td>
            </tr>

            {filteredRows.map((r: any) => (
              <tr key={r.id} className="border-b hover:bg-muted/30">
                <td className="p-2">{format(new Date(r.date), "dd MMM yyyy")}</td>
                <td className="p-2">{r.description}</td>
                <td className="p-2 font-mono text-[10px]">{r.refNo}</td>
                <td className="p-2">{SERVICE_LABELS[r.service]}</td>
                <td className="p-2 text-right tabular-nums">{r.billBdt ? money(r.billBdt) : ""}</td>
                <td className="p-2 text-right tabular-nums">{r.billBdt ? money(r.rate) : ""}</td>
                <td className="p-2 text-right tabular-nums">{r.billSar ? money(r.billSar) : ""}</td>
                <td className="p-2 text-right tabular-nums">{r.payBdt ? money(r.payBdt) : ""}</td>
                <td className="p-2 text-right tabular-nums">{r.payBdt ? money(r.rate) : ""}</td>
                <td className="p-2 text-right tabular-nums">{r.paySar ? money(r.paySar) : ""}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{money(r.runningBdt)}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{money(r.runningSar)}</td>
                <td className="p-2 capitalize">{r.status}</td>
              </tr>
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={13} className="p-8 text-center text-muted-foreground">No statement rows found for the selected filter.</td>
              </tr>
            )}

            <tr className="bg-[#0F4C3A]/10 border-t-2 border-[#0F4C3A]">
              <td className="p-2 font-bold" colSpan={4}>Totals</td>
              <td className="p-2 text-right font-bold">{money(totals.billBdt)}</td>
              <td className="p-2" />
              <td className="p-2 text-right font-bold">{money(totals.billSar)}</td>
              <td className="p-2 text-right font-bold">{money(totals.payBdt)}</td>
              <td className="p-2" />
              <td className="p-2 text-right font-bold">{money(totals.paySar)}</td>
              <td className="p-2 text-right font-bold">{money(totals.closingBdt)}</td>
              <td className="p-2 text-right font-bold">{money(totals.closingSar)}</td>
              <td className="p-2">Closing</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
