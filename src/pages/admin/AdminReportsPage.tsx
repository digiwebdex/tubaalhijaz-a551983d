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
  service: string;
  description: string;
  billBdt: number;
  billSar: number;
  payBdt: number;
  paySar: number;
  rate: number;
  status: string;
  rowType: "bill" | "payment";
};

const DEFAULT_RATE = 30;
const asNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateIso = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rate, setRate] = useState(DEFAULT_RATE);

  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
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

    const [bRes, pRes, profRes, rateRes] = await Promise.all([
      apiClient
        .from("bookings")
        .select("id,tracking_id,guest_name,guest_phone,user_id,total_amount,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt,packages(name,type)"),
      apiClient
        .from("payments")
        .select("id,booking_id,user_id,customer_id,amount,status,paid_at,created_at,payment_method,notes,amount_bdt,amount_sar,fx_rate_sar_to_bdt"),
      apiClient.from("profiles").select("user_id,full_name,phone"),
      apiClient.from("company_settings").select("setting_value").eq("setting_key", "currency_rate").maybeSingle(),
    ]);

    setBookings(bRes.data || []);
    setPayments((pRes.data || []).filter((p: any) => p.status === "completed" || p.status === "pending"));
    setProfiles(profRes.data || []);

    const cfg = (rateRes.data as any)?.setting_value || {};
    const sarToBdt = asNum(cfg?.sar_to_bdt);
    setRate(sarToBdt > 0 ? sarToBdt : DEFAULT_RATE);

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

  const customerOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();

    bookings.forEach((b: any) => {
      const key = b.user_id ? `user:${b.user_id}` : `guest:${(b.guest_name || "unknown").toLowerCase()}`;
      const profile = b.user_id ? profileMap.get(b.user_id) : null;
      const label = profile?.full_name || b.guest_name || "Unknown Customer";
      if (!map.has(key)) map.set(key, { id: key, label });
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [bookings, profileMap]);

  const serviceTypes = useMemo(() => {
    const s = new Set<string>();
    bookings.forEach((b: any) => {
      if (b.packages?.type) s.add(String(b.packages.type));
    });
    return Array.from(s).sort();
  }, [bookings]);

  const inDateRange = (value: string) => {
    const t = new Date(value).getTime();
    const from = new Date(`${dateFrom}T00:00:00`).getTime();
    const to = new Date(`${dateTo}T23:59:59`).getTime();
    return t >= from && t <= to;
  };

  const matchesCustomer = (booking: any): boolean => {
    if (selectedCustomer === "all") return true;
    if (selectedCustomer.startsWith("user:")) {
      const userId = selectedCustomer.replace("user:", "");
      return booking?.user_id === userId;
    }
    if (selectedCustomer.startsWith("guest:")) {
      const guest = selectedCustomer.replace("guest:", "");
      return String(booking?.guest_name || "").toLowerCase() === guest;
    }
    return true;
  };

  const allEntries = useMemo<StatementEntry[]>(() => {
    const rows: StatementEntry[] = [];

    bookings.forEach((b: any) => {
      if (!matchesCustomer(b)) return;
      const r = asNum(b.fx_rate_sar_to_bdt) > 0 ? asNum(b.fx_rate_sar_to_bdt) : rate;
      const billBdt = asNum(b.amount_bdt) > 0 ? asNum(b.amount_bdt) : asNum(b.total_amount);
      const billSar = asNum(b.amount_sar) > 0 ? asNum(b.amount_sar) : billBdt / Math.max(r, 0.0001);

      rows.push({
        id: `bill-${b.id}`,
        date: b.created_at,
        refNo: b.tracking_id || b.id,
        service: b.packages?.type || "general",
        description: `Invoice: ${b.packages?.name || "Booking"}`,
        billBdt,
        billSar,
        payBdt: 0,
        paySar: 0,
        rate: r,
        status: b.status || "pending",
        rowType: "bill",
      });
    });

    payments.forEach((p: any) => {
      const booking = bookingMap.get(p.booking_id);
      if (!matchesCustomer(booking)) return;

      const r = asNum(p.fx_rate_sar_to_bdt) > 0 ? asNum(p.fx_rate_sar_to_bdt) : rate;
      const payBdt = asNum(p.amount_bdt) > 0 ? asNum(p.amount_bdt) : asNum(p.amount);
      const paySar = asNum(p.amount_sar) > 0 ? asNum(p.amount_sar) : payBdt / Math.max(r, 0.0001);

      rows.push({
        id: `pay-${p.id}`,
        date: p.paid_at || p.created_at,
        refNo: booking?.tracking_id || p.booking_id || p.id,
        service: booking?.packages?.type || "general",
        description: `Payment: ${p.payment_method || "manual"}`,
        billBdt: 0,
        billSar: 0,
        payBdt,
        paySar,
        rate: r,
        status: p.status || "completed",
        rowType: "payment",
      });
    });

    return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [bookings, payments, bookingMap, rate, selectedCustomer]);

  const openingBalance = useMemo(() => {
    let bdt = 0;
    let sar = 0;

    allEntries.forEach((e) => {
      if (new Date(e.date).getTime() < new Date(`${dateFrom}T00:00:00`).getTime()) {
        bdt += e.billBdt - e.payBdt;
        sar += e.billSar - e.paySar;
      }
    });

    return { bdt, sar };
  }, [allEntries, dateFrom]);

  const filteredRows = useMemo(() => {
    let rows = allEntries.filter((e) => inDateRange(e.date));

    if (serviceType !== "all") {
      rows = rows.filter((e) => e.service === serviceType);
    }

    if (status !== "all") {
      rows = rows.filter((e) => e.status === status);
    }

    let runningBdt = openingBalance.bdt;
    let runningSar = openingBalance.sar;

    return rows.map((e) => {
      runningBdt += e.billBdt - e.payBdt;
      runningSar += e.billSar - e.paySar;
      return {
        ...e,
        runningBdt,
        runningSar,
      };
    });
  }, [allEntries, serviceType, status, openingBalance]);

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

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFontSize(14);
    doc.text("Tuba Al Hijaz - Customer Statement", 14, 14);
    doc.setFontSize(9);
    doc.text(`Date Range: ${dateFrom} to ${dateTo}`, 14, 20);
    doc.text(`Opening Balance: BDT ${money(openingBalance.bdt)} | SAR ${money(openingBalance.sar)}`, 14, 25);

    autoTable(doc, {
      startY: 30,
      styles: { fontSize: 7.5, cellPadding: 1.6 },
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
        r.service,
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

    const y = (doc as any).lastAutoTable?.finalY || 30;
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
          <h1 className="font-heading text-2xl font-bold">Statement Report</h1>
          <p className="text-sm text-muted-foreground">Exact-style customer statement with BDT/SAR and running balance.</p>
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
                {serviceTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
                <td className="p-2 capitalize">{r.service}</td>
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
