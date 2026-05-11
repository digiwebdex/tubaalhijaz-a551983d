import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Eye, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import TransportVoucherDetailView from "@/components/admin/TransportVoucherDetailView";

type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

interface OrderRow {
  id: string;
  tracking_id?: string | null;
  status: BookingStatus;
  created_at: string;
  // common contact
  contact_name?: string | null;
  contact_phone?: string | null;
  guest_name?: string | null;
  guest_phone?: string | null;
  // type-specific
  [k: string]: any;
}

const STATUS_FILTERS: { value: BookingStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-rose-100 text-rose-800 border-rose-200",
    completed: "bg-sky-100 text-sky-800 border-sky-200",
  };
  return <Badge variant="outline" className={map[status] || ""}>{status}</Badge>;
};

const formatDate = (s?: string | null) => (s ? format(new Date(s), "dd MMM yyyy, HH:mm") : "—");

export default function AdminPendingBookingsPage() {
  const [tab, setTab] = useState<"umrah" | "transport" | "catering" | "visa">("umrah");
  const [filter, setFilter] = useState<BookingStatus | "all">("pending");
  const [loading, setLoading] = useState(false);
  const [umrah, setUmrah] = useState<OrderRow[]>([]);
  const [transport, setTransport] = useState<OrderRow[]>([]);
  const [catering, setCatering] = useState<OrderRow[]>([]);
  const [visa, setVisa] = useState<OrderRow[]>([]);
  const [detail, setDetail] = useState<{ type: string; row: OrderRow } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [u, t, c, v] = await Promise.all([
        (apiClient as any).from("bookings").select("*, packages(name, type)").order("created_at", { ascending: false }).limit(200),
        (apiClient as any).from("transport_voucher_orders").select("*").order("created_at", { ascending: false }).limit(200),
        (apiClient as any).from("catering_orders").select("*").order("created_at", { ascending: false }).limit(200),
        (apiClient as any).from("visa_orders").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      setUmrah((u.data as OrderRow[]) || []);
      setTransport((t.data as OrderRow[]) || []);
      setCatering((c.data as OrderRow[]) || []);
      setVisa((v.data as OrderRow[]) || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filterRows = (rows: OrderRow[]) => filter === "all" ? rows : rows.filter(r => (r.status || "pending") === filter);

  const updateStatus = async (table: string, id: string, status: BookingStatus, extra: Record<string, any> = {}) => {
    try {
      const patch: any = { status, ...extra };
      if (status === "confirmed") {
        const { data: u } = await (apiClient as any).auth.getUser();
        patch.confirmed_at = new Date().toISOString();
        patch.confirmed_by = u?.user?.id || null;
      }
      const { error } = await (apiClient as any).from(table).update(patch).eq("id", id);
      if (error) throw error;
      toast.success(`Booking ${status}`);
      fetchAll();
      setDetail(null);
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${status}`);
    }
  };

  const tableMap: Record<string, string> = {
    umrah: "bookings",
    transport: "transport_voucher_orders",
    catering: "catering_orders",
    visa: "visa_orders",
  };

  const counts = {
    umrah: filterRows(umrah).length,
    transport: filterRows(transport).length,
    catering: filterRows(catering).length,
    visa: filterRows(visa).length,
  };

  const renderActions = (table: string, row: OrderRow) => (
    <div className="flex items-center gap-1 justify-end">
      <Button size="sm" variant="ghost" onClick={() => setDetail({ type: table, row })}>
        <Eye className="w-4 h-4" />
      </Button>
      {row.status === "pending" && (
        <>
          <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            onClick={() => updateStatus(table, row.id, "confirmed")}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm
          </Button>
          <Button size="sm" variant="outline" className="text-rose-700 border-rose-300 hover:bg-rose-50"
            onClick={() => updateStatus(table, row.id, "cancelled")}>
            <XCircle className="w-4 h-4 mr-1" /> Cancel
          </Button>
        </>
      )}
    </div>
  );

  const UmrahTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Package</TableHead>
          <TableHead>Travelers</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filterRows(umrah).map(r => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.tracking_id}</TableCell>
            <TableCell>
              <div className="font-medium">{r.guest_name || "—"}</div>
              <div className="text-xs text-muted-foreground">{r.guest_phone}</div>
            </TableCell>
            <TableCell>{r.packages?.name || "—"}</TableCell>
            <TableCell>{r.num_travelers}</TableCell>
            <TableCell>BDT {Number(r.total_amount || 0).toLocaleString()}</TableCell>
            <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
            <TableCell className="text-right">{renderActions("bookings", r)}</TableCell>
          </TableRow>
        ))}
        {filterRows(umrah).length === 0 && (
          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No bookings</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  const TransportTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Agent / Company</TableHead>
          <TableHead>Package</TableHead>
          <TableHead>Travel Date</TableHead>
          <TableHead>Pilgrims</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filterRows(transport).map(r => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.tracking_id || r.id.slice(0, 8).toUpperCase()}</TableCell>
            <TableCell>
              <div className="font-medium">{r.contact_name}</div>
              <div className="text-xs text-muted-foreground">{r.contact_phone}</div>
            </TableCell>
            <TableCell>
              <div>{r.agent_name || "—"}</div>
              <div className="text-xs text-muted-foreground">{r.umrah_company || ""}</div>
            </TableCell>
            <TableCell>{r.package_name || "—"}</TableCell>
            <TableCell className="text-xs">{r.travel_date || "—"}</TableCell>
            <TableCell>{r.pilgrim_count || "—"}</TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
            <TableCell className="text-right">{renderActions("transport_voucher_orders", r)}</TableCell>
          </TableRow>
        ))}
        {filterRows(transport).length === 0 && (
          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No transport orders</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  const CateringTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Persons × Days</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filterRows(catering).map(r => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.tracking_id || r.id.slice(0, 8).toUpperCase()}</TableCell>
            <TableCell>
              <div className="font-medium">{r.guest_name || "—"}</div>
              <div className="text-xs text-muted-foreground">{r.guest_phone}</div>
            </TableCell>
            <TableCell>{r.persons} × {r.days}</TableCell>
            <TableCell className="text-xs">{r.start_date || "—"}</TableCell>
            <TableCell>{r.currency} {Number(r.total_price || 0).toLocaleString()}</TableCell>
            <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
            <TableCell className="text-right">{renderActions("catering_orders", r)}</TableCell>
          </TableRow>
        ))}
        {filterRows(catering).length === 0 && (
          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No catering orders</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  const VisaTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking</TableHead>
          <TableHead>Applicant</TableHead>
          <TableHead>Visa Type</TableHead>
          <TableHead>Destination</TableHead>
          <TableHead>Applicants</TableHead>
          <TableHead>Travel Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filterRows(visa).map(r => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.tracking_id || r.id.slice(0, 8).toUpperCase()}</TableCell>
            <TableCell>
              <div className="font-medium">{r.contact_name}</div>
              <div className="text-xs text-muted-foreground">{r.contact_phone}</div>
            </TableCell>
            <TableCell>{r.visa_type}</TableCell>
            <TableCell>{r.destination_country || "—"}</TableCell>
            <TableCell>{r.num_applicants}</TableCell>
            <TableCell className="text-xs">{r.travel_date || "—"}</TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
            <TableCell className="text-right">{renderActions("visa_orders", r)}</TableCell>
          </TableRow>
        ))}
        {filterRows(visa).length === 0 && (
          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No visa orders</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">Pending Bookings</h1>
          <p className="text-sm text-muted-foreground">কাস্টমার সাবমিশন রিভিউ ও কনফার্ম করুন</p>
        </div>
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map(f => (
            <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="umrah">Umrah ({counts.umrah})</TabsTrigger>
          <TabsTrigger value="transport">Transport ({counts.transport})</TabsTrigger>
          <TabsTrigger value="catering">Catering ({counts.catering})</TabsTrigger>
          <TabsTrigger value="visa">Visa ({counts.visa})</TabsTrigger>
        </TabsList>

        <TabsContent value="umrah">
          <Card><CardContent className="p-0 overflow-x-auto"><UmrahTable /></CardContent></Card>
        </TabsContent>
        <TabsContent value="transport">
          <Card><CardContent className="p-0 overflow-x-auto"><TransportTable /></CardContent></Card>
        </TabsContent>
        <TabsContent value="catering">
          <Card><CardContent className="p-0 overflow-x-auto"><CateringTable /></CardContent></Card>
        </TabsContent>
        <TabsContent value="visa">
          <Card><CardContent className="p-0 overflow-x-auto"><VisaTable /></CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>{detail?.row?.tracking_id || detail?.row?.id}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              {detail.type === "transport_voucher_orders" ? (
                <TransportVoucherDetailView row={detail.row} />
              ) : (
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detail.row, null, 2)}</pre>
              )}
              {detail.row.status === "pending" && (
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" className="text-rose-700 border-rose-300" onClick={() => updateStatus(detail.type, detail.row.id, "cancelled")}>
                    <XCircle className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus(detail.type, detail.row.id, "confirmed")}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
