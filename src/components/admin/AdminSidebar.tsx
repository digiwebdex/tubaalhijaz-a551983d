import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  FileSignature,
  Settings,
  LogOut,
  ScrollText,
  Hotel,
  FileCheck,
  UtensilsCrossed,
  Bus,
  ClipboardList,
  CreditCard,
  Wallet,
} from "lucide-react";
import logo from "@/assets/tuba-logo.png";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { apiClient } from "@/lib/apiClient";
import { useNavigate } from "react-router-dom";
import type { AppRole } from "@/hooks/useUserRole";

const DEFAULT_MENU_CONFIG = {
  dashboard: true,
  services: true,
  invoices: true,
  reports: true,
  transport: true,
  system: true,
};

const dashboardMenu = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, roles: ["admin", "accountant", "booking", "viewer"] },
];

const servicesMenu = [
  { title: "Customer Bookings", url: "/admin/bookings", icon: ClipboardList, roles: ["admin", "accountant", "booking", "viewer"] },
  { title: "Transport Booking", url: "/admin/transport-booking", icon: Bus, roles: ["admin", "accountant", "booking", "viewer"] },
  { title: "Umrah Booking", url: "/admin/umrah-orders", icon: ScrollText, roles: ["admin", "accountant", "booking", "viewer"] },
  { title: "Visa Booking", url: "/admin/visa", icon: FileCheck, roles: ["admin", "accountant", "booking", "viewer"] },
  { title: "Hotel Booking", url: "/admin/hotels", icon: Hotel, roles: ["admin", "accountant", "booking", "viewer"] },
  { title: "Catering", url: "/admin/catering", icon: UtensilsCrossed, roles: ["admin", "accountant", "booking", "viewer"] },
];

const financeMenu = [
  { title: "Invoices", url: "/admin/invoices", icon: Receipt, roles: ["admin", "accountant", "booking", "viewer"] },
  { title: "Payments", url: "/admin/payments", icon: CreditCard, roles: ["admin", "accountant", "viewer"] },
];

const reportMenu = [
  { title: "Statement", url: "/admin/reports", icon: FileText, roles: ["admin", "accountant", "viewer"] },
];

const docsMenu = [
  { title: "Transport Voucher", url: "/admin/transport-booking", icon: FileSignature, roles: ["admin", "accountant", "booking", "viewer"] },
];

const systemMenu = [
  { title: "Settings", url: "/admin/settings", icon: Settings, roles: ["admin"] },
];

export function AdminSidebar({ role }: { role: AppRole }) {
  const navigate = useNavigate();
  const [menuConfig, setMenuConfig] = useState(DEFAULT_MENU_CONFIG);

  useEffect(() => {
    (async () => {
      const { data } = await apiClient
        .from("company_settings")
        .select("setting_value")
        .eq("setting_key", "admin_menu_config")
        .maybeSingle();

      const cfg = (data as any)?.setting_value;
      if (cfg && typeof cfg === "object") {
        setMenuConfig({ ...DEFAULT_MENU_CONFIG, ...cfg });
      }
    })();
  }, []);

  const handleLogout = async () => {
    await apiClient.auth.signOut();
    navigate("/");
  };

  const filterByRole = (items: typeof dashboardMenu) =>
    items.filter((item) => role && item.roles.includes(role));

  const renderGroup = (label: string, items: typeof dashboardMenu) => {
    const filtered = filterByRole(items);
    if (filtered.length === 0) return null;

    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-primary/70 px-3 mb-1 font-semibold">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filtered.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end={item.url === "/admin"}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground/70 hover:bg-primary/5 hover:text-primary transition-colors"
                    activeClassName="bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-semibold border-l-2 border-primary"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-primary/10">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-lg p-1.5 shadow-gold border border-primary/30">
            <img src={logo} alt="Tuba Al Hijaz" className="h-9 w-9 object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-base font-bold text-gradient-gold leading-tight">Tuba Al Hijaz</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Core Admin Suite</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {menuConfig.dashboard && renderGroup("Dashboard", dashboardMenu)}
        {menuConfig.services && renderGroup("Services", servicesMenu)}
        {menuConfig.invoices && renderGroup("Invoices", financeMenu)}
        {menuConfig.reports && renderGroup("Reports", reportMenu)}
        {menuConfig.transport && renderGroup("Transport", docsMenu)}
        {menuConfig.system && renderGroup("System", systemMenu)}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-primary/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
