import { useEffect, useState } from "react";
import { auth as api } from "@/lib/api";

export type AppRole =
  | "super_admin"
  | "admin"
  | "operations_manager"
  | "visa_officer"
  | "transport_manager"
  | "catering_manager"
  | "finance_manager"
  | "hotel_coordinator"
  | "airport_coordinator"
  | "driver"
  | "accountant"
  | "booking"
  | "cms"
  | "manager"
  | "staff"
  | "viewer"
  | null;

// Priority order — highest privilege first
const ROLE_PRIORITY: Exclude<AppRole, null>[] = [
  "super_admin",
  "admin",
  "operations_manager",
  "finance_manager",
  "visa_officer",
  "transport_manager",
  "catering_manager",
  "hotel_coordinator",
  "airport_coordinator",
  "manager",
  "accountant",
  "booking",
  "cms",
  "driver",
  "staff",
  "viewer",
];

export function useUserRole() {
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { session } } = await api.getSession();
      if (!session) { setLoading(false); return; }

      // Get user from local storage which includes roles from login
      const { data: { user } } = await api.getUser();
      const roles: string[] = user?.roles || [];

      const top = ROLE_PRIORITY.find((r) => roles.includes(r));
      if (top) setRole(top);

      setLoading(false);
    };
    fetchRole();
  }, []);

  return { role, loading };
}
