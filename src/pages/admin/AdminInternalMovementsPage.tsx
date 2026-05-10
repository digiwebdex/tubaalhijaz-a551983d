import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Route, MapPin, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Movement {
  id: string;
  voucher_id?: string;
  serial_no: number;
  movement_date?: string;
  from_location: string;
  to_location: string;
  movement_time?: string;
  vehicle?: string;
  driver?: string;
  status: string;
  notes?: string;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

const PRESETS = [
  { from: "Jeddah Airport", to: "Makkah Hotel" },
  { from: "Makkah Hotel", to: "Makkah Ziyara" },
  { from: "Makkah", to: "Madinah" },
  { from: "Madinah Hotel", to: "Madinah Ziyara" },
  { from: "Madinah", to: "Jeddah Airport" },
];

export default function AdminInternalMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState<any>({
    voucher_id: "",
    serial_no: 1,
    movement_date: new Date().toISOString().slice(0, 10),
    from_location: "",
    to_location: "",
    movement_time: "",
    vehicle: "",
    driver: "",
    status: "scheduled",
    notes: "",
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [mv, vc] = await Promise.all([
      apiClient.from("movement_schedules").select("*").order("movement_date", { ascending: false }),
      apiClient.from("transport_vouchers").select("id, voucher_no, group_name").order("issued_at", { ascending: false }),
    ]);
    setMovements((mv.data as any) || []);
    setVouchers((vc.data as any) || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.from_location || !form.to_location) {
      toast.error("From and To locations are required");
      return;
    }
    const payload = {
      ...form,
      voucher_id: form.voucher_id || null,
      movement_date: form.movement_date || null,
      serial_no: Number(form.serial_no) || 1,
    };
    const { error } = await apiClient.from("movement_schedules").insert(payload);
    if (error) {
      toast.error(error.message || "Failed");
      return;
    }
    toast.success("Movement added");
    setOpen(false);
    setForm({ ...form, from_location: "", to_location: "", movement_time: "", notes: "" });
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await apiClient.from("movement_schedules").update({ status }).eq("id", id);
    if (error) return toast.error("Failed");
    toast.success("Status updated");
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this movement?")) return;
    const { error } = await apiClient.from("movement_schedules").delete().eq("id", id);
    if (error) return toast.error("Failed");
    toast.success("Deleted");
    fetchData();
  };

  const seedPresets = async () => {
    if (!form.voucher_id) return toast.error("Select a voucher first");
    if (!confirm("Add the standard 5-leg movement plan to this voucher?")) return;
    const today = new Date().toISOString().slice(0, 10);
    const rows = PRESETS.map((p, i) => ({
      voucher_id: form.voucher_id,
      serial_no: i + 1,
      movement_date: today,
      from_location: p.from,
      to_location: p.to,
      status: "scheduled",
    }));
    for (const r of rows) {
      await apiClient.from("movement_schedules").insert(r);
    }
    toast.success("Standard movement plan added");
    fetchData();
  };

  const filtered = useMemo(() => {
    return filter === "all" ? movements : movements.filter(m => m.status === filter);
  }, [movements, filter]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-gradient-gold flex items-center gap-2">
            <Route className="h-7 w-7 text-primary" />
            Internal Movements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Operational movement schedule — Jeddah → Makkah → Madinah → Jeddah. Real-time status tracking.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-gold text-primary-foreground shadow-gold">
              <Plus className="h-4 w-4 mr-2" /> New Movement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl text-gradient-gold">Add Movement</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs uppercase font-semibold text-muted-foreground">Voucher (optional)</Label>
                <Select value={form.voucher_id} onValueChange={v => setForm({ ...form, voucher_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Link to voucher..." /></SelectTrigger>
                  <SelectContent>
                    {vouchers.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.voucher_no} — {v.group_name || ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Serial No" v={form.serial_no} k="serial_no" type="number" form={form} setForm={setForm} />
              <Field label="Date" v={form.movement_date} k="movement_date" type="date" form={form} setForm={setForm} />
              <Field label="From *" v={form.from_location} k="from_location" form={form} setForm={setForm} placeholder="Jeddah Airport" />
              <Field label="To *" v={form.to_location} k="to_location" form={form} setForm={setForm} placeholder="Makkah Hotel" />
              <Field label="Time" v={form.movement_time} k="movement_time" form={form} setForm={setForm} placeholder="e.g. 14:30" />
              <Field label="Vehicle" v={form.vehicle} k="vehicle" form={form} setForm={setForm} />
              <Field label="Driver" v={form.driver} k="driver" form={form} setForm={setForm} />
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-semibold text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={seedPresets} disabled={!form.voucher_id}>
                + Add Standard 5-leg Plan
              </Button>
              <div className="flex gap-2 sm:ml-auto">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} className="bg-gradient-gold text-primary-foreground">Save</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {["all", "scheduled", "in_progress", "completed", "cancelled"].map(s => (
          <Badge
            key={s}
            variant={filter === s ? "default" : "outline"}
            className={`cursor-pointer px-3 py-1 capitalize ${filter === s ? "bg-primary" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s.replace("_", " ")} {s === "all" && `(${movements.length})`}
          </Badge>
        ))}
      </div>

      <Card className="p-4">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
            No movements yet. Create a voucher first, then add the standard 5-leg plan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/20 bg-secondary/40">
                  <th className="text-center p-3 font-semibold w-12">#</th>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Route</th>
                  <th className="text-center p-3 font-semibold">Time</th>
                  <th className="text-left p-3 font-semibold">Vehicle</th>
                  <th className="text-left p-3 font-semibold">Driver</th>
                  <th className="text-center p-3 font-semibold">Status</th>
                  <th className="text-right p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-3 text-center font-bold text-primary">{m.serial_no}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {m.movement_date ? new Date(m.movement_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.from_location}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{m.to_location}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono text-xs">{m.movement_time || "—"}</td>
                    <td className="p-3 text-xs">{m.vehicle || "—"}</td>
                    <td className="p-3 text-xs">{m.driver || "—"}</td>
                    <td className="p-3 text-center">
                      <Select value={m.status} onValueChange={(v) => updateStatus(m.id, v)}>
                        <SelectTrigger className={`w-32 h-7 text-xs border ${statusColors[m.status] || ""}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, v, k, type = "text", placeholder = "", form, setForm }: any) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase font-semibold text-muted-foreground">{label}</Label>
      <Input type={type} value={v || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={placeholder} />
    </div>
  );
}
