import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate, Outlet, NavLink } from "react-router-dom";
import { auth as api, apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { NotificationBell } from "@/components/admin/NotificationBell";
import {
  LayoutDashboard, Users, FileText, Wallet, Plane, FolderOpen,
  Boxes, LogOut, Crown, Menu, X
} from "lucide-react";

type AgentRecord = { id: string; agent_name: string; company_name?: string | null; commission_pct?: number };

const AgentContext = createContext<AgentRecord | null>(null);
export const useAgent = () => useContext(AgentContext);

const NAV = [
  { to: "/agent", label: "Dashboard", labelAr: "لوحة التحكم", icon: LayoutDashboard, end: true },
  { to: "/agent/bookings", label: "Bookings", labelAr: "الحجوزات", icon: FileText },
  { to: "/agent/pilgrims", label: "Pilgrims", labelAr: "الحجاج", icon: Users },
  { to: "/agent/groups", label: "Groups", labelAr: "المجموعات", icon: Boxes },
  { to: "/agent/commissions", label: "Commissions", labelAr: "العمولات", icon: Wallet },
  { to: "/agent/documents", label: "Documents", labelAr: "المستندات", icon: FolderOpen },
  { to: "/agent/operations", label: "Operations", labelAr: "العمليات", icon: Plane },
];

export default function AgentLayout() {
  useSessionTimeout();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await api.getSession();
        if (!session) { navigate("/auth?redirect=/agent", { replace: true }); return; }
        const { data: { user } } = await api.getUser();
        const roles: string[] = user?.roles || [];
        if (!roles.includes("agent") && !roles.includes("admin")) {
          toast.error("Agent access required");
          navigate("/dashboard", { replace: true });
          return;
        }
        // Find linked supplier_agents record
        const { data: agents } = await apiClient.from("supplier_agents")
          .select("id,agent_name,company_name,commission_pct,agent_user_id")
          .eq("agent_user_id", user.id);
        const rec = Array.isArray(agents) ? agents[0] : null;
        if (!rec) {
          toast.error("No agent profile linked. Contact admin.");
          navigate("/dashboard", { replace: true });
          return;
        }
        setAgent(rec);
      } catch {
        navigate("/auth?redirect=/agent", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleLogout = async () => {
    await api.signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220_45%_8%)] text-amber-300">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AgentContext.Provider value={agent}>
      <div className="min-h-screen flex bg-[hsl(220_45%_8%)] text-slate-100">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-gradient-to-b from-[hsl(220_50%_10%)] via-[hsl(220_55%_8%)] to-[hsl(220_60%_6%)] border-r border-amber-500/20 transition-transform`}>
          <div className="p-6 border-b border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Crown className="w-6 h-6 text-[hsl(220_55%_10%)]" />
              </div>
              <div>
                <div className="text-amber-300 font-semibold text-sm tracking-wide">AGENT PORTAL</div>
                <div className="text-xs text-slate-400">B2B Umrah Operations</div>
              </div>
            </div>
            {agent && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="text-sm font-semibold text-amber-200 truncate">{agent.agent_name}</div>
                {agent.company_name && (
                  <div className="text-xs text-slate-400 truncate">{agent.company_name}</div>
                )}
                <div className="text-[10px] text-amber-400/80 mt-1">
                  Commission: {agent.commission_pct ?? 0}%
                </div>
              </div>
            )}
          </div>

          <nav className="p-4 space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-200 border border-amber-500/30 shadow-inner"
                      : "text-slate-400 hover:text-amber-200 hover:bg-amber-500/5"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] opacity-50 font-arabic">{item.labelAr}</span>
              </NavLink>
            ))}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-amber-500/20">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" />
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 sticky top-0 z-20 bg-[hsl(220_55%_9%)]/80 backdrop-blur border-b border-amber-500/20 flex items-center px-4 gap-3">
            <button onClick={() => setSidebarOpen((s) => !s)} className="lg:hidden text-amber-300">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="text-sm text-amber-200 font-semibold tracking-wide">
              Saudi Umrah Operations
            </div>
            <div className="ml-auto flex items-center gap-3">
              <NotificationBell />
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-amber-400/40 text-amber-300 bg-amber-500/5">
                External Agent
              </span>
            </div>
          </header>
          <div className="flex-1 p-4 sm:p-6 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </AgentContext.Provider>
  );
}
