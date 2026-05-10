import { ReactNode } from "react";

export function AgentCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[hsl(220_45%_11%)] to-[hsl(220_55%_8%)] shadow-xl shadow-black/30 ${className}`}>
      {children}
    </div>
  );
}

export function AgentKpi({
  label, labelAr, value, hint, icon: Icon, accent = "amber",
}: {
  label: string; labelAr?: string; value: string | number; hint?: string;
  icon: any; accent?: "amber" | "emerald" | "sky" | "rose" | "violet";
}) {
  const accentMap: Record<string, string> = {
    amber: "from-amber-400/30 to-amber-600/10 text-amber-300 border-amber-500/30",
    emerald: "from-emerald-400/30 to-emerald-600/10 text-emerald-300 border-emerald-500/30",
    sky: "from-sky-400/30 to-sky-600/10 text-sky-300 border-sky-500/30",
    rose: "from-rose-400/30 to-rose-600/10 text-rose-300 border-rose-500/30",
    violet: "from-violet-400/30 to-violet-600/10 text-violet-300 border-violet-500/30",
  };
  return (
    <AgentCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
          {labelAr && <div className="text-[10px] text-slate-500 font-arabic">{labelAr}</div>}
          <div className="mt-2 text-2xl font-bold text-amber-100 tabular-nums truncate">{value}</div>
          {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
        </div>
        <div className={`w-11 h-11 shrink-0 rounded-xl border bg-gradient-to-br flex items-center justify-center ${accentMap[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </AgentCard>
  );
}

export function AgentSectionHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg font-semibold text-amber-100 tracking-wide">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    completed: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
  const cls = map[status?.toLowerCase()] || "bg-slate-500/15 text-slate-300 border-slate-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${cls}`}>
      {status || "—"}
    </span>
  );
}
