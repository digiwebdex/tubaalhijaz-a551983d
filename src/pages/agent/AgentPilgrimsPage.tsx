import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAgent } from "@/components/agent/AgentLayout";
import { AgentCard, AgentSectionHeader } from "@/components/agent/AgentUI";

const fmtBDT = (n: number) => `৳ ${new Intl.NumberFormat("en-IN").format(n || 0)}`;

export default function AgentPilgrimsPage() {
  const agent = useAgent();
  const [members, setMembers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agent?.id) return;
    (async () => {
      const { data: bks } = await apiClient.from("bookings").select("*").eq("supplier_agent_id", agent.id);
      const list = Array.isArray(bks) ? bks : [];
      setBookings(list);
      if (list.length === 0) { setLoading(false); return; }
      const ids = list.map((b: any) => b.id);
      // fetch members in parallel
      const results = await Promise.all(
        ids.map((id) => apiClient.from("booking_members").select("*").eq("booking_id", id))
      );
      const all = results.flatMap((r) => (Array.isArray(r.data) ? r.data : []));
      setMembers(all);
      setLoading(false);
    })();
  }, [agent?.id]);

  const bMap = useMemo(() => {
    const m = new Map<string, any>();
    bookings.forEach((b) => m.set(b.id, b));
    return m;
  }, [bookings]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-amber-100">Pilgrims</h1>
        <p className="text-xs text-slate-400 mt-0.5">All pilgrims registered under your agency</p>
      </div>

      <AgentCard className="p-4">
        {loading ? (
          <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>
        ) : members.length === 0 ? (
          <div className="text-sm text-slate-500 py-12 text-center">No pilgrims yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="text-left px-2 py-2">Name</th>
                  <th className="text-left px-2 py-2">Passport</th>
                  <th className="text-left px-2 py-2">Booking</th>
                  <th className="text-right px-2 py-2">Selling</th>
                  <th className="text-right px-2 py-2">Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {members.map((m) => {
                  const b = bMap.get(m.booking_id);
                  return (
                    <tr key={m.id} className="hover:bg-amber-500/5">
                      <td className="px-2 py-2 text-slate-200">{m.full_name}</td>
                      <td className="px-2 py-2 text-slate-400 font-mono text-xs">{m.passport_number || "—"}</td>
                      <td className="px-2 py-2 text-amber-300 font-mono text-xs">{b?.tracking_id || "—"}</td>
                      <td className="px-2 py-2 text-right text-slate-300 tabular-nums">{fmtBDT(Number(m.selling_price))}</td>
                      <td className="px-2 py-2 text-right text-amber-200 tabular-nums">{fmtBDT(Number(m.final_price))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AgentCard>
    </div>
  );
}
