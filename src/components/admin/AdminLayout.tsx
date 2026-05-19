import { createContext, useContext } from "react";
import { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { auth as api } from "@/lib/api";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { NotificationBell } from "./NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";
import { Eye } from "lucide-react";
import type { AppRole } from "@/hooks/useUserRole";

// Role context so child components can access the current admin role
const AdminRoleContext = createContext<AppRole>(null);
export const useAdminRole = () => useContext(AdminRoleContext);
export const useIsViewer = () => useContext(AdminRoleContext) === "viewer";

/** Only admin can see profit data */
export const useCanSeeProfit = () => {
  const role = useContext(AdminRoleContext);
  return role === "admin";
};

/** Admin and accountant can modify financial data */
export const useCanModifyFinancials = () => {
  const role = useContext(AdminRoleContext);
  return role === "admin" || role === "accountant";
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  accountant: "Accountant",
  booking: "Booking",
  cms: "CMS",
  viewer: "Viewer",
};

const CORE_ALLOWED_PATHS = [
  "/admin",
  "/admin/bookings",
  "/admin/transport-booking",
  "/admin/umrah-orders",
  "/admin/visa",
  "/admin/hotels",
  "/admin/catering",
  "/admin/invoices",
  "/admin/payments",
  "/admin/reports",
  "/admin/settings",
];

const isCoreAllowedRoute = (pathname: string) => {
  return CORE_ALLOWED_PATHS.some((allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`));
};

export default function AdminLayout() {
  useSessionTimeout();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);
  const [coreOnlyMode, setCoreOnlyMode] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session } } = await api.getSession();
        if (!session) { navigate("/auth", { replace: true }); return; }

        const { data: { user } } = await api.getUser();
        let roles: string[] = user?.roles || [];

        // Fallback: if roles are empty, try fetching from localStorage user
        if (roles.length === 0) {
          try {
            const localUser = JSON.parse(localStorage.getItem('rk_user') || 'null');
            roles = localUser?.roles || [];
          } catch {}
        }

        if (roles.length === 0) {
          toast.error("Access denied");
          navigate("/dashboard", { replace: true });
          return;
        }

        if (roles.includes("admin")) setRole("admin");
        else if (roles.includes("accountant")) setRole("accountant");
        else if (roles.includes("booking")) setRole("booking");
        else if (roles.includes("cms")) setRole("cms");
        else if (roles.includes("viewer")) setRole("viewer");
        else { toast.error("Access denied"); navigate("/dashboard", { replace: true }); return; }

        try {
          const { data: shellConfig } = await apiClient
            .from("company_settings")
            .select("setting_value")
            .eq("setting_key", "admin_shell_config")
            .maybeSingle();

          const cfg = (shellConfig as any)?.setting_value;
          if (cfg && typeof cfg === "object" && cfg.core_only_mode === false) {
            setCoreOnlyMode(false);
          }
        } catch {
          // keep safe default: core-only mode on
        }

        setLoading(false);
      } catch {
        navigate("/auth", { replace: true });
      }
    };
    checkAccess();
  }, [navigate]);

  useEffect(() => {
    if (loading) return;
    if (!coreOnlyMode) return;
    if (isCoreAllowedRoute(location.pathname)) return;

    toast.info("This module is hidden in Core Admin mode.");
    navigate("/admin", { replace: true });
  }, [coreOnlyMode, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const isReadOnly = role === "viewer";
  const isCmsOnly = role === "cms";

  return (
    <AdminRoleContext.Provider value={role}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar role={role} />
          <main className="flex-1 flex flex-col min-w-0">
            <header className="h-14 border-b border-border flex items-center px-4 sticky top-0 bg-background z-40">
              <SidebarTrigger />
              <div className="ml-4 flex-1">
                <GlobalSearch />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <NotificationBell />
                <span className="text-xs text-muted-foreground capitalize bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                  {ROLE_LABELS[role || ""] || role}
                </span>
              </div>
            </header>
            {isReadOnly && (
              <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2 text-amber-700 text-sm">
                <Eye className="h-4 w-4" />
                <span className="font-medium">Read-Only Mode</span> — You can only view data, no changes can be made.
              </div>
            )}
            {isCmsOnly && (
              <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-2 flex items-center gap-2 text-blue-700 text-sm">
                <Eye className="h-4 w-4" />
                <span className="font-medium">CMS Mode</span> — You can only access content management.
              </div>
            )}
            <div className="flex-1 p-6 overflow-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </AdminRoleContext.Provider>
  );
}
