import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/apiClient";

type ServiceKey = "booking" | "visa" | "catering" | "hotel" | "transport";

const money = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const asNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function deriveDual({
  amountBdt,
  amountSar,
  amount,
  currency,
  rate,
}: {
  amountBdt?: any;
  amountSar?: any;
  amount?: any;
  currency?: any;
  rate: number;
}) {
  let bdt = asNum(amountBdt);
  let sar = asNum(amountSar);
  const base = asNum(amount);
  const curr = String(currency || "BDT").toUpperCase();

  if (bdt <= 0 && base > 0 && curr !== "SAR") bdt = base;
  if (sar <= 0 && base > 0 && curr === "SAR") sar = base;

  if (bdt <= 0 && sar > 0) bdt = sar * rate;
  if (sar <= 0 && bdt > 0) sar = bdt / Math.max(rate, 0.0001);

  return { bdt, sar };
}

export default function AdminInvoicesPage() {
  const [tab, setTab] = useState<ServiceKey>("booking");
  const [loading, setLoading] = useState(true);
  const [sarRate, setSarRate] = useState(30);
  const [rows, setRows] = useState<Record<ServiceKey, any[]>>({
    booking: [],
    visa: [],
    catering: [],
    hotel: [],
    transport: [],
  });

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [
        bookings,
        visas,
        catering,
        hotels,
        transportOrders,
        transportVouchers,
        transportBookings,
        rateRes,
      ] = await Promise.all([
        apiClient.from("bookings").select("id,tracking_id,guest_name,total_amount,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt").order("created_at", { ascending: false }),
        apiClient.from("visa_applications").select("id,invoice_no,applicant_name,billing_amount,status,visa_status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt").order("created_at", { ascending: false }),
        apiClient.from("catering_orders").select("id,tracking_id,guest_name,total_price,currency,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt").order("created_at", { ascending: false }),
        apiClient.from("hotel_bookings").select("id,total_price,currency,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt").order("created_at", { ascending: false }),
        apiClient.from("transport_orders").select("id,tracking_id,guest_name,total_price,currency,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt").order("created_at", { ascending: false }),
        apiClient.from("transport_voucher_orders").select("id,tracking_id,contact_name,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt").order("created_at", { ascending: false }),
        apiClient.from("transport_bookings").select("id,guest_name,total_price,currency,status,created_at,amount_bdt,amount_sar,fx_rate_sar_to_bdt").order("created_at", { ascending: false }),
        apiClient.from("company_settings").select("setting_value").eq("setting_key", "currency_rate").maybeSingle(),
      ]);

      const cfg = (rateRes.data as any)?.setting_value || {};
      const rate = asNum(cfg?.sar_to_bdt) > 0 ? asNum(cfg?.sar_to_bdt) : 30;
      setSarRate(rate);

      const mergedTransport = [
        ...(transportVouchers.data || []).map((r: any) => ({ ...r, __source: "transport_voucher_orders" })),
        ...(transportOrders.data || []).map((r: any) => ({ ...r, __source: "transport_orders" })),
        ...(transportBookings.data || []).map((r: any) => ({ ...r, __source: "transport_bookings" })),
      ].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      setRows({
        booking: bookings.data || [],
        visa: visas.data || [],
        catering: catering.data || [],
        hotel: hotels.data || [],
        transport: mergedTransport,
      });

      setLoading(false);
    })();
  }, []);

  const tableRows = useMemo(() => rows[tab] || [], [rows, tab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-muted-foreground">Unified invoice center for booking, visa, hotel, transport, and catering services.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["booking", "Umrah Booking"],
          ["visa", "Visa Booking"],
          ["hotel", "Hotel Booking"],
          ["transport", "Transport Booking"],
          ["catering", "Catering"],
        ] as [ServiceKey, string][]).map(([value, label]) => (
          <Button key={value} variant={tab === value ? "default" : "outline"} size="sm" onClick={() => setTab(value)}>
            {label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base capitalize">{tab} invoices ({tableRows.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading invoices...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Ref</th>
                  <th className="text-left p-2">Customer</th>
                  <th className="text-right p-2">Amount BDT</th>
                  <th className="text-right p-2">Amount SAR</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-right p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row: any) => {
                  const ref = row.tracking_id || row.invoice_no || row.id;
                  const customer = row.guest_name || row.contact_name || row.applicant_name || "Customer";
                  const status = row.visa_status || row.status || "pending";

                  const dual = deriveDual({
                    amountBdt: row.amount_bdt,
                    amountSar: row.amount_sar,
                    amount: row.total_amount || row.billing_amount || row.total_price,
                    currency: row.currency,
                    rate: asNum(row.fx_rate_sar_to_bdt) > 0 ? asNum(row.fx_rate_sar_to_bdt) : sarRate,
                  });

                  return (
                    <tr key={`${tab}-${row.id}`} className="border-b">
                      <td className="p-2 font-mono text-xs">{ref}</td>
                      <td className="p-2">{customer}</td>
                      <td className="p-2 text-right tabular-nums">{money(dual.bdt)}</td>
                      <td className="p-2 text-right tabular-nums">{money(dual.sar)}</td>
                      <td className="p-2 capitalize">{status}</td>
                      <td className="p-2">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</td>
                      <td className="p-2 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/admin/invoices/service/${tab}/${row.id}`}>
                            <FileText className="h-4 w-4 mr-1" /> Open
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">No records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
