import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import {
  TransportBookingBilingualPdf,
  TransportBookingPdfData,
} from "@/components/admin/TransportBookingBilingualPdf";

export default function AdminTransportBookingInvoicePage() {
  const { id } = useParams();
  const [data, setData] = useState<TransportBookingPdfData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: r } = await (apiClient as any)
        .from("transport_voucher_orders")
        .select("*")
        .eq("id", id)
        .single();
      if (!r) { setLoading(false); return; }

      let customer: any = null;
      if (r.user_id && r.user_id !== "00000000-0000-0000-0000-000000000000") {
        const { data: c } = await (apiClient as any)
          .from("profiles")
          .select("full_name, phone, email, address, passport_number")
          .eq("id", r.user_id)
          .single();
        customer = c;
      }

      setData({
        tracking_id: r.tracking_id || `TT-${String(r.id).slice(0, 8).toUpperCase()}`,
        issued_at: r.created_at,
        status: r.status,

        customer_name: customer?.full_name || r.contact_name,
        customer_phone: customer?.phone || r.contact_phone,
        customer_email: customer?.email || r.contact_email,
        customer_address: customer?.address,
        customer_passport: customer?.passport_number,

        agent_name: r.agent_name,
        agent_country: r.agent_country,
        umrah_company: r.umrah_company,
        package_name: r.package_name,
        group_numbers: Array.isArray(r.group_numbers) ? r.group_numbers : [],
        travel_date: r.travel_date,

        hotels: Array.isArray(r.hotels) ? r.hotels : [],
        transport_type: r.transport_type,
        pilgrim_count: r.pilgrim_count,
        flights: Array.isArray(r.flights) ? r.flights : [],
        internal_movements: Array.isArray(r.internal_movements) ? r.internal_movements : [],

        supervisor_makkah_phone: r.supervisor_makkah_phone,
        supervisor_madinah_phone: r.supervisor_madinah_phone,
        ops_24h_phone: r.ops_24h_phone,

        contact_name: r.contact_name,
        contact_phone: r.contact_phone,
        contact_email: r.contact_email,
        notes: r.notes,
      });
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading voucher…</div>;
  if (!data) return <div className="p-12 text-center text-muted-foreground">Voucher not found.</div>;

  return (
    <div className="transport-invoice-print-shell bg-gray-100 min-h-screen py-6">
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center px-4 print-hide">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/transport-booking"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <Button onClick={() => window.print()} size="sm" className="bg-[#0F4C3A] hover:bg-[#1a6b50]">
          <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
      </div>
      <div className="transport-invoice-print-frame shadow-2xl">
        <TransportBookingBilingualPdf data={data} />
      </div>
    </div>
  );
}
