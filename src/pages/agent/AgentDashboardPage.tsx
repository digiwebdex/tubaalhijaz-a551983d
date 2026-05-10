import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAgent } from "@/components/agent/AgentLayout";
import { AgentCard, AgentKpi, AgentSectionHeader, StatusPill } from "@/components/agent/AgentUI";
import { Users, FileText, CreditCard, AlertCircle, Plane, Wallet, TrendingUp, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { formatTrackingId } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
const fmtBDT = (n: number) => `৳ ${fmt(n)}`;

export default function AgentDashboardPage() {
  const agent = useAgent();
  const [bookings, setBookings] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agent?.id) return;
    (async () => {
      const [b, c, p] = await Promise.all([
        apiClient.from("bookings").select("*").eq("supplier_agent_id", agent.id),
        apiClient.from("agent_commissions").select("*").eq("supplier_agent_id", agent.id),
        apiClient.from("commission_payouts").select("*").eq("supplier_agent_id", agent.id),
      ]);
      setBookings(Array.isArray(b.data) ? b.data : []);
      setCommissions(Array.isArray(c.data) ? c.data : []);
      setPayouts(Array.isArray(p.data) ? p.data : []);
      setLoading(false);
    })();
  }, [agent?.id]);

  const k = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "cancelled");
    const totalPilgrims = active.reduce((s, b) => s + (b.num_travelers || 0), 0);
    const dueAmount = active.reduce((s, b) => s + Number(b.due_amount || 0), 0);
    const commTotal = commissions.reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const commPaid = commissions.reduce((s, c) => s + Number(c.paid_amount || 0), 0);
    const commPending = Math.max(0, commTotal - commPaid);
    return {
      groups: new Set(active.map((b) => b.installment_plan_id || b.id)).size, // proxy
      pilgrims: totalPilgrims,
      activeBookings: active.length,
      pendingVisa: active.filter((b) => (b.status || "").toLowerCase().includes("pending")).length,
      due: dueAmount,
      commTotal,
      commPaid,
      commPending,
    };
  }, [bookings, commissions]);

  if (loading) {
    return <div className="text-amber-300 text-sm">Loading operational dashboard…</div>;
  }

  const recent = [...bookings].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-amber-400/80">Welcome back</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-amber-100 mt-1">{agent?.agent_name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">Live operations &middot; مرحبا بك في بوابة الوكيل</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AgentKpi label="Total Pilgrims" labelAr="إجمالي الحجاج" value={fmt(k.pilgrims)} icon={Users} accent="amber" />
        <AgentKpi label="Active Bookings" labelAr="الحجوزات النشطة" value={fmt(k.activeBookings)} icon={FileText} accent="sky" />
        <AgentKpi label="Pending Status" labelAr="قيد المراجعة" value={fmt(k.pendingVisa)} icon={ClipboardCheck} accent="violet" />
        <AgentKpi label="Due Payments" labelAr="المدفوعات المستحقة" value={fmtBDT(k.due)} icon={AlertCircle} accent="rose" />
        <AgentKpi label="Total Commission" labelAr="إجمالي العمولة" value={fmtBDT(k.commTotal)} icon={TrendingUp} accent="emerald" />
        <AgentKpi label="Commission Paid" labelAr="العمولة المدفوعة" value={fmtBDT(k.commPaid)} icon={Wallet} accent="emerald" />
        <AgentKpi label="Commission Pending" labelAr="العمولة المستحقة" value={fmtBDT(k.commPending)} icon={CreditCard} accent="amber" />
        <AgentKpi label="Upcoming Departures" labelAr="الرحلات القادمة" value={fmt(k.activeBookings)} icon={Plane} accent="sky" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <AgentCard className="lg:col-span-2 p-5">
          <AgentSectionHeader
            title="Recent Bookings"
            subtitle="Last 6 bookings linked to your agency"
            actions={<Link to="/agent/bookings" className="text-xs text-amber-300 hover:text-amber-200">View all →</Link>}
          />
          {recent.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">No bookings yet.</div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left px-2 py-2">Tracking</th>
                    <th className="text-left px-2 py-2">Guest</th>
                    <th className="text-right px-2 py-2">Travelers</th>
                    <th className="text-right px-2 py-2">Total</th>
                    <th className="text-right px-2 py-2">Due</th>
                    <th className="text-left px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/10">
                  {recent.map((b) => (
                    <tr key={b.id} className="hover:bg-amber-500/5">
                      <td className="px-2 py-2 text-amber-300 font-mono text-xs">{formatTrackingId(b.tracking_id)}</td>
                      <td className="px-2 py-2 text-slate-200 truncate max-w-[180px]">{b.guest_name || "—"}</td>
                      <td className="px-2 py-2 text-right text-slate-300 tabular-nums">{b.num_travelers}</td>
                      <td className="px-2 py-2 text-right text-slate-200 tabular-nums">{fmtBDT(Number(b.total_amount))}</td>
                      <td className="px-2 py-2 text-right text-rose-300 tabular-nums">{fmtBDT(Number(b.due_amount || 0))}</td>
                      <td className="px-2 py-2"><StatusPill status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AgentCard>

        <AgentCard className="p-5">
          <AgentSectionHeader title="Payment Alerts" subtitle="Bookings with outstanding dues" />
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {bookings
              .filter((b) => Number(b.due_amount || 0) > 0 && b.status !== "cancelled")
              .slice(0, 8)
              .map((b) => (
                <div key={b.id} className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-amber-200 font-mono">{formatTrackingId(b.tracking_id)}</div>
                    <div className="text-sm text-rose-300 font-bold tabular-nums">{fmtBDT(Number(b.due_amount))}</div>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-1">{b.guest_name}</div>
                </div>
              ))}
            {bookings.every((b) => Number(b.due_amount || 0) === 0) && (
              <div className="text-sm text-slate-500 py-8 text-center">All clear ✓</div>
            )}
          </div>
        </AgentCard>
      </div>

      <AgentCard className="p-5">
        <AgentSectionHeader title="Commission Payouts" subtitle="Recent payouts received" />
        {payouts.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">No payouts recorded yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="text-left px-2 py-2">Date</th>
                  <th className="text-left px-2 py-2">Method</th>
                  <th className="text-left px-2 py-2">Reference</th>
                  <th className="text-right px-2 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {payouts.slice(0, 10).map((p) => (
                  <tr key={p.id}>
                    <td className="px-2 py-2 text-slate-300">{p.payout_date}</td>
                    <td className="px-2 py-2 text-slate-300 capitalize">{p.payment_method || "—"}</td>
                    <td className="px-2 py-2 text-slate-400">{p.reference || "—"}</td>
                    <td className="px-2 py-2 text-right text-emerald-300 tabular-nums">{fmtBDT(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AgentCard>
    </div>
  );
}
