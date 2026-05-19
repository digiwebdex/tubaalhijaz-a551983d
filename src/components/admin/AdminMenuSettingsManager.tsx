import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const DEFAULT_MENU_CONFIG = {
  dashboard: true,
  services: true,
  invoices: true,
  reports: true,
  transport: true,
  system: true,
};

export default function AdminMenuSettingsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_MENU_CONFIG);

  useEffect(() => {
    (async () => {
      const { data } = await apiClient
        .from("company_settings")
        .select("setting_value")
        .eq("setting_key", "admin_menu_config")
        .maybeSingle();

      const cfg = (data as any)?.setting_value;
      if (cfg && typeof cfg === "object") {
        setConfig({ ...DEFAULT_MENU_CONFIG, ...cfg });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);

    const existing = await apiClient
      .from("company_settings")
      .select("id")
      .eq("setting_key", "admin_menu_config")
      .maybeSingle();

    const payload = {
      setting_key: "admin_menu_config",
      setting_value: config,
    };

    let result;
    if ((existing.data as any)?.id) {
      result = await apiClient.from("company_settings").update(payload).eq("setting_key", "admin_menu_config");
    } else {
      result = await apiClient.from("company_settings").insert(payload);
    }

    setSaving(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Admin menu settings saved");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading menu settings...</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Control which core sections appear in the streamlined admin sidebar.</p>

      <div className="grid sm:grid-cols-2 gap-3">
        {Object.entries(config).map(([key, value]) => (
          <label key={key} className="flex items-center justify-between bg-secondary/50 border border-border rounded-md px-3 py-2">
            <span className="text-sm capitalize">{key}</span>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => setConfig((prev) => ({ ...prev, [key]: e.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
          </label>
        ))}
      </div>

      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Menu Visibility"}</Button>
    </div>
  );
}
