import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, Bus, ScrollText, FileCheck, Hotel, UtensilsCrossed,
  Wallet, AlertCircle, TrendingUp, Users, ArrowRight, CreditCard, Receipt,
} from "lucide-react";
import { formatBDT } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

interface ServiceTile {
  key: string;
  title: string;
  arabic: string;
  icon: any;
  link: string;
  accent: string;
  total: number;
  pending: number;
  dueBDT: number;
}

export default function AdminDashboardPage() {
  const [umrah, setUmrah] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [transport, setTransport] = useState<any[]>([]);
  const [visa, setVisa] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [catering, setCatering] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [um, bk, tr, vs, ht, ct, py] = await Promise.all([
        apiClient.from("umrah_orders").select("id,tracking_id,guest_name,num_travelers,status,estimated_price_bdt,paid_amount,due_amount,created_at,travel_month").order("created_at", { ascending: false }),
        apiClient.from("bookings").select("id,tracking_id,guest_name,num_travelers,status,total_amount,paid_amount,due_amount,travel_date,created_at").order("created_at", { ascending: false }),
        apiClient.from("transport_orders").select("id,tracking_id,guest_name,passengers,status,total_price,pickup_date,created_at,route_from,route_to").order("created_at", { ascending: false }),
        apiClient.from("visa_applications").select("id,invoice_no,applicant_name,visa_status,payment_status,billing_amount,customer_due,application_date,country_name").order("application_date", { ascending: false }),
        apiClient.from("hotel_bookings").select("id,status,total_price,paid_amount,due_amount,check_in,created_at,guests").order("created_at", { ascending: false }),
        apiClient.from("catering_orders").select("id,tracking_id,guest_name,persons,days,status,total_price,paid_amount,due_amount,start_date,created_at").order("created_at", { ascending: false }),
        apiClient.from("payments").select("id,amount,amount_sar,source_type,source_id,booking_id,status,method,created_at").order("created_at", { ascending: false }).limit(500),
      ]);
      setUmrah(um.data || []);
      setBookings(bk.data || []);
      setTransport(tr.data || []);
      setVisa(vs.data || []);
      setHotels(ht.data || []);
      setCatering(ct.data || []);
      setPayments(py.data || []);
    })();
  }, []);

  const active = <T extends { status?: string }>(rows: T[]) =>
    rows.filter(r => !["cancelled", "deleted"].includes((r.status || "").toLowerCase()));

  const services: ServiceTile[] = useMemo(() => {
    const um = active(umrah);
    const bk = active(bookings);
    const tr = active(transport);
    const ht = active(hotels);
    const ct = active(catering);
    const vs = visa.filter(v => v.visa_status !== "cancelled");

    const sumDue = (rows: any[], k = "due_amount") => rows.reduce((s, r) => s + Number(r[k] || 0), 0);

    return [
      {
        key: "umrah", title: "Umrah Booking", arabic: "حجز العمرة", icon: ScrollText,
        link: "/admin/umrah-orders", accent: "from-emerald-600/15 to-emerald-600/5 text-emerald-700 border-emerald-600/20",
        total: um.length, pending: um.filter(x => x.status === "pending").length, dueBDT: sumDue(um),
      },
      {
        key: "bookings", title: "Customer Bookings", arabic: "حجوزات العملاء", icon: ClipboardList,
        link: "/admin/bookings", accent: "from-amber-600/15 to-amber-600/5 text-amber-700 border-amber-600/20",
        total: bk.length, pending: bk.filter(x => x.status === "pending").length, dueBDT: sumDue(bk),
      },
      {
        key: "transport", title: "Transport Booking", arabic: "حجز النقل", icon: Bus,
        link: "/admin/transport-booking", accent: "from-sky-600/15 to-sky-600/5 text-sky-700 border-sky-600/20",
        total: tr.length, pending: tr.filter(x => x.status === "pending").length, dueBDT: 0,
      },
      {
        key: "visa", title: "Visa Booking", arabic: "حجز التأشيرة", icon: FileCheck,
        link: "/admin/visa", accent: "from-rose-600/15 to-rose-600/5 text-rose-700 border-rose-600/20",
        total: vs.length,
        pending: vs.filter(v => ["pending", "processing"].includes(v.visa_status)).length,
        dueBDT: sumDue(vs, "customer_due"),
      },
      {
        key: "hotels", title: "Hotel Booking", arabic: "حجز الفندق", icon: Hotel,
        link: "/admin/hotels", accent: "from-indigo-600/15 to-indigo-600/5 text-indigo-700 border-indigo-600/20",
        total: ht.length, pending: ht.filter(x => x.status === "pending").length, dueBDT: sumDue(ht),
      },
      {
        key: "catering", title: "Catering", arabic: "الإعاشة", icon: UtensilsCrossed,
        link: "/admin/catering", accent: "from-orange-600/15 to-orange-600/5 text-orange-700 border-orange-600/20",
        total: ct.length, pending: ct.filter(x => x.status === "pending").length, dueBDT: sumDue(ct),
      },
    ];
  }, [umrah, bookings, transport, visa, hotels, catering]);

  const finance = useMemo(() => {
    const completed = payments.filter(p => p.status === "completed");
    const totalRevenueBDT = completed.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalRevenueSAR = completed.reduce((s, p) => s + Number(p.amount_sar || 0), 0);
    const t = today();
    const todayPayments = completed.filter(p => (p.created_at || "").slice(0, 10) === t);
    const todayBDT = todayPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalDue = services.reduce((s, x) => s + x.dueBDT, 0);
    const totalPilgrims =
      active(umrah).reduce((s, x) => s + Number(x.num_travelers || 0), 0) +
      active(bookings).reduce((s, x) => s + Number(x.num_travelers || 0), 0);
    return { totalRevenueBDT, totalRevenueSAR, todayBDT, todayCount: todayPayments.length, totalDue, totalPilgrims };
  }, [payments, services, umrah, bookings]);

  // Recent activity — merge latest from all sources
  const recentBookings = useMemo(() => {
    const merge = [
      ...umrah.slice(0, 5).map(x => ({ id: x.id, type: "Umrah", name: x.guest_name, ref: x.tracking_id, status: x.status, link: "/admin/umrah-orders", date: x.created_at })),
      ...bookings.slice(0, 5).map(x => ({ id: x.id, type: "Booking", name: x.guest_name, ref: x.tracking_id, status: x.status, link: "/admin/bookings", date: x.created_at })),
      ...transport.slice(0, 5).map(x => ({ id: x.id, type: "Transport", name: x.guest_name, ref: x.tracking_id, status: x.status, link: "/admin/transport-booking", date: x.created_at })),
      ...visa.slice(0, 5).map(x => ({ id: x.id, type: "Visa", name: x.applicant_name, ref: x.invoice_no, status: x.visa_status, link: "/admin/visa", date: x.application_date })),
      ...catering.slice(0, 5).map(x => ({ id: x.id, type: "Catering", name: x.guest_name, ref: x.tracking_id, status: x.status, link: "/admin/catering", date: x.created_at })),
    ];
    return merge.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8);
  }, [umrah, bookings, transport, visa, catering]);

  const recentPayments = payments.slice(0, 8);

  const statusBadge = (s: string) => {
    const k = (s || "").toLowerCase();
    if (k === "completed" || k === "confirmed" || k === "active" || k === "approved")
      return "bg-emerald-500/10 text-emerald-700 border-emerald-600/30";
    if (k === "pending" || k === "processing" || k === "due") return "bg-amber-500/10 text-amber-700 border-amber-600/30";
    if (k === "cancelled" || k === "rejected" || k === "failed") return "bg-rose-500/10 text-rose-700 border-rose-600/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
        <div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-gradient-gold">
            Service Operations Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live snapshot of all active Tuba Al Hijaz services · الخدمات الفعّالة
          </p>
        </div>
        <div className="text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-full border border-primary/10">
          {new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Finance KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-gradient-to-br from-teal-600/15 to-teal-600/5 border-teal-600/20">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Total Revenue</span>
            <Wallet className="h-4 w-4 text-teal-700" />
          </div>
          <div className="text-xl font-bold tabular-nums text-teal-800">{formatBDT(finance.totalRevenueBDT)}</div>
          <div className="text-[11px] opacity-70 mt-1">SAR {finance.totalRevenueSAR.toLocaleString()}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-600/15 to-emerald-600/5 border-emerald-600/20">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Today's Income</span>
            <TrendingUp className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="text-xl font-bold tabular-nums text-emerald-800">{formatBDT(finance.todayBDT)}</div>
          <div className="text-[11px] opacity-70 mt-1">{finance.todayCount} receipts</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-rose-600/15 to-rose-600/5 border-rose-600/20">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Outstanding Due</span>
            <AlertCircle className="h-4 w-4 text-rose-700" />
          </div>
          <div className="text-xl font-bold tabular-nums text-rose-800">{formatBDT(finance.totalDue)}</div>
          <div className="text-[11px] opacity-70 mt-1">across all services</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-600/15 to-amber-600/5 border-amber-600/20">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Total Pilgrims</span>
            <Users className="h-4 w-4 text-amber-700" />
          </div>
          <div className="text-xl font-bold tabular-nums text-amber-800">{finance.totalPilgrims}</div>
          <div className="text-[11px] opacity-70 mt-1">Umrah + Bookings</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-primary/15 to-primary/5 border-primary/20">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Active Services</span>
            <ClipboardList className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xl font-bold tabular-nums">{services.reduce((s, x) => s + x.total, 0)}</div>
          <div className="text-[11px] opacity-70 mt-1">{services.reduce((s, x) => s + x.pending, 0)} pending</div>
        </Card>
      </div>

      {/* Services grid */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Active Services · الخدمات</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(s => {
            const Icon = s.icon;
            return (
              <Link key={s.key} to={s.link} className="group">
                <Card className={`bg-gradient-to-br ${s.accent} border hover:shadow-luxury transition-all`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{s.title}</div>
                          <div className="text-[11px] opacity-70" dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>{s.arabic}</div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/50 rounded-lg p-2">
                        <div className="text-lg font-bold tabular-nums">{s.total}</div>
                        <div className="text-[10px] opacity-70">Total</div>
                      </div>
                      <div className="bg-white/50 rounded-lg p-2">
                        <div className="text-lg font-bold tabular-nums">{s.pending}</div>
                        <div className="text-[10px] opacity-70">Pending</div>
                      </div>
                      <div className="bg-white/50 rounded-lg p-2">
                        <div className="text-sm font-bold tabular-nums leading-tight pt-1">{formatBDT(s.dueBDT)}</div>
                        <div className="text-[10px] opacity-70">Due</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Recent Bookings
            </CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/admin/bookings">View All <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No bookings yet</div>
            ) : (
              <div className="space-y-2">
                {recentBookings.map(b => (
                  <Link to={b.link} key={`${b.type}-${b.id}`} className="flex items-center justify-between border-b last:border-0 py-2 hover:bg-muted/40 px-2 -mx-2 rounded">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{b.type}</Badge>
                        <span className="font-medium text-sm truncate">{b.name || "Guest"}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{b.ref}</div>
                    </div>
                    <Badge variant="outline" className={statusBadge(b.status)}>{b.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Recent Payments
            </CardTitle>
            <Button asChild size="sm" variant="ghost"><Link to="/admin/payments">View All <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No payments yet</div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between border-b last:border-0 py-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{formatBDT(Number(p.amount || 0))}
                        {Number(p.amount_sar || 0) > 0 && <span className="text-xs text-muted-foreground ml-2">SAR {Number(p.amount_sar).toLocaleString()}</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground capitalize">{(p.source_type || "—").replace(/_/g, " ")} · {p.method || "—"}</div>
                    </div>
                    <Badge variant="outline" className={statusBadge(p.status)}>{p.status}</Badge>
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
