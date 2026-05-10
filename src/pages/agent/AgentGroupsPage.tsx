import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAgent } from "@/components/agent/AgentLayout";
import { AgentCard, AgentSectionHeader } from "@/components/agent/AgentUI";
import { Boxes } from "lucide-react";

export default function AgentGroupsPage() {
  const agent = useAgent();
  const [bookings, setBookings] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agent?.id) return;
    (async () => {
      const [b, p] = await Promise.all([
        apiClient.from("bookings").select("*").eq("supplier_agent_id", agent.id),
        apiClient.from("packages").select("*"),
      ]);
      setBookings(Array.isArray(b.data) ? b.data : []);
      setPackages(Array.isArray(p.data) ? p.data : []);
      setLoading(false);
    })();
  }, [agent?.id]);

  const groups = useMemo(() => {
    const byPkg = new Map<string, { pkg: any; rows: any[]; pilgrims: number }>();
    bookings
      .filter((b) => b.status !== "cancelled")
      .forEach((b) => {
        const key = b.package_id;
        if (!byPkg.has(key)) {
          const pkg = packages.find((p) => p.id === key);
          byPkg.set(key, { pkg, rows: [], pilgrims: 0 });
        }
        const g = byPkg.get(key)!;
        g.rows.push(b);
        g.pilgrims += Number(b.num_travelers || 0);
      });
    return Array.from(byPkg.values());
  }, [bookings, packages]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-amber-100">Groups</h1>
        <p className="text-xs text-slate-400 mt-0.5">Pilgrims grouped by package</p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>
      ) : groups.length === 0 ? (
        <AgentCard className="p-12 text-center text-sm text-slate-500">No groups yet.</AgentCard>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {groups.map((g) => (
            <AgentCard key={g.pkg?.id || "n"} className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300">
                  <Boxes className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-amber-100 font-semibold truncate">{g.pkg?.name || "Unknown package"}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{g.pkg?.type || ""} · {g.pkg?.duration_days || "—"} days</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                  <div className="text-[10px] uppercase text-slate-500">Bookings</div>
                  <div className="text-xl font-bold text-amber-200 tabular-nums">{g.rows.length}</div>
                </div>
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                  <div className="text-[10px] uppercase text-slate-500">Pilgrims</div>
                  <div className="text-xl font-bold text-emerald-300 tabular-nums">{g.pilgrims}</div>
                </div>
              </div>
            </AgentCard>
          ))}
        </div>
      )}
    </div>
  );
}
