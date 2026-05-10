import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Hotel, FileCheck, AlertTriangle, Bus, MessageSquare, Phone, ArrowRight } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export default function AdminOperationsCenterPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [visa, setVisa] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: v }, { data: m }] = await Promise.all([
        apiClient.from("bookings").select("*, packages(title, duration_days)").neq("status", "cancelled").neq("status", "deleted").order("created_at", { ascending: false }).limit(500),
        apiClient.from("visa_applications").select("*").eq("status", "active").order("application_date", { ascending: false }).limit(200),
        apiClient.from("movement_schedules").select("*").order("scheduled_at", { ascending: true }).limit(200),
      ]);
      setBookings(b || []);
      setVisa(v || []);
      setMovements(m || []);
    })();
  }, []);

  const t = today();
  const t7 = inDays(7);
  const arrivalsToday = bookings.filter(x => x.travel_date?.slice(0, 10) === t);
  const departuresWeek = bookings.filter(x => x.return_date && x.return_date.slice(0, 10) >= t && x.return_date.slice(0, 10) <= t7);
  const visaPending = visa.filter(v => ["pending", "processing"].includes(v.visa_status));
  const dues = bookings.filter(x => Number(x.due_amount) > 0).slice(0, 50);
  const todayMovements = movements.filter(m => m.scheduled_at?.slice(0, 10) === t);

  const tile = (icon: any, label: string, ar: string, count: number, color: string, link: string) => {
    const Icon = icon;
    return (
      <Link to={link}>
        <Card className="hover:border-[#C9A96E] transition-all hover:shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold mt-3 tabular-nums text-[#0F4C3A]">{count}</div>
            <div className="text-sm font-semibold">{label}</div>
            <div className="text-[10px] text-muted-foreground" dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>{ar}</div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F4C3A]">
          Operations Center <span className="text-base font-normal text-[#C9A96E]" dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>· مركز العمليات</span>
        </h1>
        <p className="text-sm text-muted-foreground">Live snapshot of today's pilgrim operations, visa workflow, transport & receivables.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tile(Plane, "Arrivals Today", "وصول اليوم", arrivalsToday.length, "bg-blue-600", "/admin/bookings")}
        {tile(Hotel, "Departures (7d)", "مغادرات الأسبوع", departuresWeek.length, "bg-amber-600", "/admin/bookings")}
        {tile(FileCheck, "Visa Pending", "تأشيرات معلقة", visaPending.length, "bg-yellow-600", "/admin/visa")}
        {tile(Bus, "Movements Today", "تحركات اليوم", todayMovements.length, "bg-emerald-700", "/admin/movements")}
        {tile(AlertTriangle, "Due Payments", "مستحقات", dues.length, "bg-red-600", "/admin/due-alerts")}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plane className="h-4 w-4 text-[#C9A96E]" /> Today's Arrivals · وصول اليوم</CardTitle></CardHeader>
          <CardContent>
            {arrivalsToday.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No arrivals scheduled today.</div>
            ) : (
              <div className="space-y-2">
                {arrivalsToday.slice(0, 8).map(b => (
                  <div key={b.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="font-medium text-sm">{b.guest_name || "Pilgrim"}</div>
                      <div className="text-xs text-muted-foreground">{b.tracking_id} · {b.num_travelers} pax · {b.packages?.title}</div>
                    </div>
                    <div className="flex gap-1">
                      {b.guest_phone && (
                        <Button asChild size="icon" variant="ghost"><a href={`tel:${b.guest_phone}`}><Phone className="h-3.5 w-3.5" /></a></Button>
                      )}
                      {b.guest_phone && (
                        <Button asChild size="icon" variant="ghost"><a target="_blank" rel="noopener" href={`https://wa.me/${b.guest_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Tuba Al Hijaz: Welcome ${b.guest_name || ""} (${b.tracking_id}). Our team will receive you at the airport.`)}`}><MessageSquare className="h-3.5 w-3.5" /></a></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileCheck className="h-4 w-4 text-[#C9A96E]" /> Visa Workflow · سير عمل التأشيرة</CardTitle></CardHeader>
          <CardContent>
            {visaPending.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No pending visa applications.</div>
            ) : (
              <div className="space-y-2">
                {visaPending.slice(0, 8).map(v => (
                  <div key={v.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="font-medium text-sm">{v.applicant_name}</div>
                      <div className="text-xs text-muted-foreground">{v.country_name} · {v.passport_number || "—"}</div>
                    </div>
                    <Badge variant="outline" className={v.visa_status === "processing" ? "bg-blue-500/10 text-blue-700" : "bg-yellow-500/10 text-yellow-700"}>
                      {v.visa_status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bus className="h-4 w-4 text-[#C9A96E]" /> Transport Movements · التحركات</CardTitle></CardHeader>
          <CardContent>
            {todayMovements.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No movements scheduled today.</div>
            ) : (
              <div className="space-y-2">
                {todayMovements.slice(0, 8).map(m => (
                  <div key={m.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="font-medium text-sm">{m.from_location} → {m.to_location}</div>
                      <div className="text-xs text-muted-foreground">{m.scheduled_at?.slice(11, 16) || "—"} · {m.vehicle_type || ""}</div>
                    </div>
                    <Badge variant="outline">{m.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[#C9A96E]" /> Receivables · المستحقات</CardTitle></CardHeader>
          <CardContent>
            {dues.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">All clear — no outstanding balances.</div>
            ) : (
              <div className="space-y-2">
                {dues.slice(0, 8).map(b => (
                  <div key={b.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="font-medium text-sm">{b.guest_name || "Pilgrim"}</div>
                      <div className="text-xs text-muted-foreground">{b.tracking_id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-600 tabular-nums">৳{Number(b.due_amount).toLocaleString("en-IN")}</div>
                      <Link to={`/admin/invoices/${b.id}`} className="text-[10px] text-[#0F4C3A] underline">Invoice</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
