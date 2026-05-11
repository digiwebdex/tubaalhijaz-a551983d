import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, FileSignature, Search, Eye, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TransportVoucherPdf } from "@/components/admin/TransportVoucherPdf";

interface Voucher {
  id: string;
  voucher_no: string;
  agent_name?: string;
  group_name?: string;
  umrah_company?: string;
  makkah_hotel?: string;
  madinah_hotel?: string;
  num_pilgrims?: number;
  airline?: string;
  flight_number?: string;
  flight_date?: string;
  status: string;
  issued_at?: string;
  [k: string]: any;
}

const initialForm = {
  agent_name: "", agent_country: "Bangladesh", umrah_company: "Tuba Al Hijaz", group_name: "",
  makkah_hotel: "", madinah_hotel: "", agreement_number: "", check_in_date: "", check_out_date: "",
  nights: 14, total_rooms: 0,
  transport_company: "", vehicle_type: "Bus 47-seater", driver_name: "", driver_phone: "",
  num_pilgrims: 0,
  arrival_flight: "", departure_flight: "", airline: "Saudia", flight_number: "",
  airport: "Jeddah (JED)", flight_date: "", flight_time: "",
  makkah_supervisor: "", madinah_supervisor: "", ops_24h_phone: "+966 ",
  notes: "", language: "en",
};

export default function AdminTransportVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [previewVoucher, setPreviewVoucher] = useState<Voucher | null>(null);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [vRes, oRes] = await Promise.all([
      apiClient.from("transport_vouchers").select("*").order("issued_at", { ascending: false }),
      apiClient.from("transport_voucher_orders").select("*").order("created_at", { ascending: false }),
    ]);
    if (vRes.error) toast.error("Failed to load vouchers");
    if (oRes.error) toast.error("Failed to load voucher orders");
    setVouchers((vRes.data as any) || []);
    setOrders((oRes.data as any) || []);
    setLoading(false);
  };

  const updateOrderStatus = async (id: string, status: string) => {
    const { error } = await apiClient.from("transport_voucher_orders").update({ status }).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Order updated");
    fetchData();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Delete this voucher order?")) return;
    const { error } = await apiClient.from("transport_voucher_orders").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Order deleted");
    fetchData();
  };

  const generateVoucherNo = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const rnd = Math.floor(Math.random() * 9000 + 1000);
    return `TAH-TV-${ymd}-${rnd}`;
  };

  const handleSave = async () => {
    if (!form.agent_name || !form.group_name) {
      toast.error("Agent name and group name are required");
      return;
    }
    setSaving(true);
    const payload: any = {
      ...form,
      voucher_no: generateVoucherNo(),
      status: "active",
      nights: Number(form.nights) || 0,
      total_rooms: Number(form.total_rooms) || 0,
      num_pilgrims: Number(form.num_pilgrims) || 0,
      check_in_date: form.check_in_date || null,
      check_out_date: form.check_out_date || null,
      flight_date: form.flight_date || null,
    };
    const { error } = await apiClient.from("transport_vouchers").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to create voucher");
      return;
    }
    toast.success("Voucher created successfully");
    setOpen(false);
    setForm(initialForm);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this voucher?")) return;
    const { error } = await apiClient.from("transport_vouchers").update({ status: "deleted" }).eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Voucher deleted");
    fetchData();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vouchers
      .filter(v => v.status !== "deleted")
      .filter(v => !q || [v.voucher_no, v.agent_name, v.group_name, v.umrah_company].some(f => String(f || "").toLowerCase().includes(q)));
  }, [vouchers, search]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-gradient-gold flex items-center gap-2">
            <FileSignature className="h-7 w-7 text-primary" />
            Transport Vouchers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bilingual EN/AR operational movement vouchers with QR verification — Saudi Umrah operations standard.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-gold text-primary-foreground shadow-gold">
              <Plus className="h-4 w-4 mr-2" /> New Voucher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading text-gradient-gold">Create Transport Voucher</DialogTitle>
            </DialogHeader>
            <VoucherForm form={form} setForm={setForm} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-gold text-primary-foreground">
                {saving ? "Saving..." : "Create Voucher"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Submitted voucher orders (from public/customer dialog) */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Submitted Voucher Orders</h2>
          <Badge variant="outline">{orders.length} orders</Badge>
        </div>
        {orders.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No customer-submitted voucher orders yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left p-3 font-semibold">Submitted</th>
                  <th className="text-left p-3 font-semibold">Contact</th>
                  <th className="text-left p-3 font-semibold">Agent / Company</th>
                  <th className="text-left p-3 font-semibold">Package</th>
                  <th className="text-left p-3 font-semibold">Travel Date</th>
                  <th className="text-right p-3 font-semibold">Pilgrims</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-right p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="p-3">
                      <div className="font-medium">{o.contact_name}</div>
                      <div className="text-xs text-muted-foreground">{o.contact_phone}</div>
                    </td>
                    <td className="p-3">
                      <div>{o.agent_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{o.umrah_company || ""}</div>
                    </td>
                    <td className="p-3 text-xs">{o.package_name || "—"}</td>
                    <td className="p-3 text-xs">{o.travel_date ? new Date(o.travel_date).toLocaleDateString() : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{o.pilgrim_count || 0}</td>
                    <td className="p-3">
                      <Badge variant={o.status === "pending" ? "secondary" : "outline"}>{o.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setOrderDetail(o)} title="View"><Eye className="h-4 w-4" /></Button>
                        {o.status === "pending" && (
                          <Button size="sm" variant="ghost" onClick={() => updateOrderStatus(o.id, "processed")} title="Mark processed">✓</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => deleteOrder(o.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by voucher no, agent, group, company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-md"
          />
          <Badge variant="outline" className="ml-auto">{filtered.length} vouchers</Badge>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No vouchers yet. Click <strong>New Voucher</strong> to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left p-3 font-semibold">Voucher No</th>
                  <th className="text-left p-3 font-semibold">Agent</th>
                  <th className="text-left p-3 font-semibold">Group</th>
                  <th className="text-left p-3 font-semibold">Hotels</th>
                  <th className="text-right p-3 font-semibold">Pilgrims</th>
                  <th className="text-left p-3 font-semibold">Flight</th>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-right p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="p-3 font-mono text-xs text-primary font-semibold">{v.voucher_no}</td>
                    <td className="p-3">
                      <div className="font-medium">{v.agent_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{v.umrah_company || ""}</div>
                    </td>
                    <td className="p-3">{v.group_name || "—"}</td>
                    <td className="p-3 text-xs">
                      <div>🕌 {v.makkah_hotel || "—"}</div>
                      <div>🕌 {v.madinah_hotel || "—"}</div>
                    </td>
                    <td className="p-3 text-right tabular-nums font-semibold">{v.num_pilgrims || 0}</td>
                    <td className="p-3 text-xs">
                      <div className="font-medium">{v.airline} {v.flight_number}</div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {v.flight_date ? new Date(v.flight_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setPreviewVoucher(v)} title="Preview">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setPreviewVoucher(v); setTimeout(() => window.print(), 300); }} title="Print">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(v.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Order detail modal */}
      <Dialog open={!!orderDetail} onOpenChange={() => setOrderDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Voucher Order Details</DialogTitle>
          </DialogHeader>
          {orderDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><b>Contact:</b> {orderDetail.contact_name} ({orderDetail.contact_phone})</div>
                <div><b>Email:</b> {orderDetail.contact_email || "—"}</div>
                <div><b>Agent:</b> {orderDetail.agent_name || "—"} ({orderDetail.agent_country || "—"})</div>
                <div><b>Umrah Company:</b> {orderDetail.umrah_company || "—"}</div>
                <div><b>Package:</b> {orderDetail.package_name || "—"}</div>
                <div><b>Travel Date:</b> {orderDetail.travel_date || "—"}</div>
                <div><b>Transport:</b> {orderDetail.transport_type || "—"}</div>
                <div><b>Pilgrims:</b> {orderDetail.pilgrim_count || 0}</div>
                <div><b>Makkah Sup. Phone:</b> {orderDetail.supervisor_makkah_phone || "—"}</div>
                <div><b>Madinah Sup. Phone:</b> {orderDetail.supervisor_madinah_phone || "—"}</div>
                <div><b>Ops 24h:</b> {orderDetail.ops_24h_phone || "—"}</div>
                <div><b>Status:</b> {orderDetail.status}</div>
              </div>
              {orderDetail.group_numbers?.length > 0 && (
                <div><b>Group Numbers:</b> {Array.isArray(orderDetail.group_numbers) ? orderDetail.group_numbers.join(", ") : JSON.stringify(orderDetail.group_numbers)}</div>
              )}
              {orderDetail.hotels && (
                <div><b>Hotels:</b><pre className="bg-secondary/40 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(orderDetail.hotels, null, 2)}</pre></div>
              )}
              {orderDetail.flights && (
                <div><b>Flights:</b><pre className="bg-secondary/40 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(orderDetail.flights, null, 2)}</pre></div>
              )}
              {orderDetail.internal_movements && (
                <div><b>Internal Movements:</b><pre className="bg-secondary/40 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(orderDetail.internal_movements, null, 2)}</pre></div>
              )}
              {orderDetail.notes && <div><b>Notes:</b> {orderDetail.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview/Print modal */}
      <Dialog open={!!previewVoucher} onOpenChange={() => setPreviewVoucher(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 border-b print-hide">
            <DialogTitle className="flex items-center justify-between">
              <span>Voucher Preview — {previewVoucher?.voucher_no}</span>
              <Button onClick={() => window.print()} className="bg-gradient-gold text-primary-foreground">
                <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewVoucher && <TransportVoucherPdf voucher={previewVoucher} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Form sub-component =====
function VoucherForm({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const f = (k: string, v: any) => setForm({ ...form, [k]: v });
  const Field = ({ label, k, type = "text", placeholder = "" }: any) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input type={type} value={form[k] || ""} onChange={e => f(k, e.target.value)} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="space-y-6 py-2">
      <Section title="Agent Information">
        <Field label="Agent Name *" k="agent_name" />
        <Field label="Agent Country" k="agent_country" />
        <Field label="Umrah Company" k="umrah_company" />
        <Field label="Group Name *" k="group_name" />
      </Section>

      <Section title="Hotel Information">
        <Field label="Makkah Hotel" k="makkah_hotel" placeholder="e.g. Hilton Makkah" />
        <Field label="Madinah Hotel" k="madinah_hotel" placeholder="e.g. Pullman Zamzam" />
        <Field label="Agreement Number" k="agreement_number" />
        <Field label="Total Rooms" k="total_rooms" type="number" />
        <Field label="Check-in Date" k="check_in_date" type="date" />
        <Field label="Check-out Date" k="check_out_date" type="date" />
        <Field label="Nights" k="nights" type="number" />
      </Section>

      <Section title="Transport Information">
        <Field label="Transport Company" k="transport_company" placeholder="e.g. SAPTCO" />
        <Field label="Vehicle Type" k="vehicle_type" placeholder="Bus 47-seater" />
        <Field label="Driver Name" k="driver_name" />
        <Field label="Driver Phone" k="driver_phone" />
        <Field label="Number of Pilgrims" k="num_pilgrims" type="number" />
      </Section>

      <Section title="Flight Information">
        <Field label="Airline" k="airline" />
        <Field label="Flight Number" k="flight_number" />
        <Field label="Arrival Flight" k="arrival_flight" />
        <Field label="Departure Flight" k="departure_flight" />
        <Field label="Airport" k="airport" />
        <Field label="Flight Date" k="flight_date" type="date" />
        <Field label="Flight Time" k="flight_time" placeholder="e.g. 14:30" />
      </Section>

      <Section title="Operations Supervisors">
        <Field label="Makkah Supervisor" k="makkah_supervisor" />
        <Field label="Madinah Supervisor" k="madinah_supervisor" />
        <Field label="Operations 24h Number" k="ops_24h_phone" />
      </Section>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</Label>
        <Textarea value={form.notes} onChange={e => f("notes", e.target.value)} rows={2} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-primary/20 pb-1">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
