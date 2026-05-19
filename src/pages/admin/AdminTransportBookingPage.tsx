import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Printer, Download, Pencil, CheckCircle2, XCircle, Trash2, RefreshCw, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
import TransportVoucherDetailView from "@/components/admin/TransportVoucherDetailView";
import TransportOrderDialog from "@/components/TransportOrderDialog";

type Status = "pending" | "confirmed" | "cancelled" | "completed";

const STATUS_FILTERS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
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

const fmtDate = (s?: string | null) => (s ? format(new Date(s), "dd MMM yyyy, HH:mm") : "—");

export default function AdminTransportBookingPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data, error } = await (apiClient as any)
        .from("transport_voucher_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load transport bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = filter === "all" ? rows : rows.filter(r => (r.status || "pending") === filter);

  const updateStatus = async (id: string, status: Status) => {
    try {
      const patch: any = { status };
      if (status === "confirmed") {
        const { data: u } = await (apiClient as any).auth.getUser();
        patch.confirmed_at = new Date().toISOString();
        patch.confirmed_by = u?.user?.id || null;
      }
      const { error } = await (apiClient as any).from("transport_voucher_orders").update(patch).eq("id", id);
      if (error) throw error;
      toast.success(`Booking ${status}`);
      setDetail(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${status}`);
    }
  };

  const deleteRow = async (id: string) => {
    if (!confirm("Delete this transport booking?")) return;
    try {
      const { error } = await (apiClient as any).from("transport_voucher_orders").delete().eq("id", id);
      if (error) throw error;
      toast.success("Deleted");
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const counts = {
    all: rows.length,
    pending: rows.filter(r => (r.status || "pending") === "pending").length,
    confirmed: rows.filter(r => r.status === "confirmed").length,
    cancelled: rows.filter(r => r.status === "cancelled").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">Transport Booking</h1>
          <p className="text-sm text-muted-foreground">
            ট্রান্সপোর্ট ভাউচার বুকিং — কাস্টমার ফর্ম অনুযায়ী একই টেবিল ও বাইলিঙ্গুয়াল ইনভয়েস
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)}>
              {f.label} ({(counts as any)[f.value] ?? 0})
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Transport Booking
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Agent / Company</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Travel Date</TableHead>
                <TableHead>Pilgrims</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.tracking_id || r.id.slice(0, 8).toUpperCase()}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.contact_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.contact_phone}</div>
                  </TableCell>
                  <TableCell>
                    <div>{r.agent_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.umrah_company || ""}</div>
                  </TableCell>
                  <TableCell>{r.package_name || "—"}</TableCell>
                  <TableCell className="text-xs">{r.travel_date || "—"}</TableCell>
                  <TableCell>{r.pilgrim_count || "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                  <TableCell><StatusBadge status={r.status || "pending"} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" title="View" onClick={() => setDetail(r)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Edit" onClick={() => setEditRow(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Print" asChild>
                        <Link to={`/admin/transport-booking/${r.id}/invoice`} target="_blank">
                          <Printer className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" title="Download PDF" asChild>
                        <Link to={`/admin/transport-booking/${r.id}/invoice?download=1`} target="_blank">
                          <Download className="w-4 h-4" />
                        </Link>
                      </Button>
                      {(r.status === "pending" || !r.status) && (
                        <>
                          <Button size="sm" variant="ghost" className="text-emerald-700" title="Confirm"
                            onClick={() => updateStatus(r.id, "confirmed")}>
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-rose-700" title="Cancel"
                            onClick={() => updateStatus(r.id, "cancelled")}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="text-rose-700" title="Delete"
                        onClick={() => deleteRow(r.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    No transport bookings
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transport Booking</DialogTitle>
            <DialogDescription>{detail?.tracking_id || detail?.id}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <TransportVoucherDetailView row={detail} />
              <div className="flex flex-wrap gap-2 justify-end pt-2 border-t">
                <Button variant="outline" asChild>
                  <Link to={`/admin/transport-booking/${detail.id}/invoice`} target="_blank">
                    <Printer className="w-4 h-4 mr-1" /> Print / PDF
                  </Link>
                </Button>
                {(detail.status === "pending" || !detail.status) && (
                  <>
                    <Button variant="outline" className="text-rose-700 border-rose-300"
                      onClick={() => updateStatus(detail.id, "cancelled")}>
                      <XCircle className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => updateStatus(detail.id, "confirmed")}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <TransportOrderDialog
        open={createOpen}
        onOpenChange={(v) => { setCreateOpen(v); if (!v) fetchAll(); }}
        service={null}
      />
    </div>
  );
}
