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

const upsertCompanySetting = async (settingKey: string, settingValue: any) => {
  const existing = await apiClient
    .from("company_settings")
    .select("id")
    .eq("setting_key", settingKey)
    .maybeSingle();

  if ((existing.data as any)?.id) {
    return apiClient
      .from("company_settings")
      .update({ setting_key: settingKey, setting_value: settingValue })
      .eq("id", (existing.data as any).id);
  }

  return apiClient
    .from("company_settings")
    .insert({ setting_key: settingKey, setting_value: settingValue });
};

export default function AdminMenuSettingsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_MENU_CONFIG);
  const [coreOnlyMode, setCoreOnlyMode] = useState(true);

  useEffect(() => {
    (async () => {
      const [menuRes, shellRes] = await Promise.all([
        apiClient
          .from("company_settings")
          .select("setting_value")
          .eq("setting_key", "admin_menu_config")
          .maybeSingle(),
        apiClient
          .from("company_settings")
          .select("setting_value")
          .eq("setting_key", "admin_shell_config")
          .maybeSingle(),
      ]);

      const menuCfg = (menuRes.data as any)?.setting_value;
      if (menuCfg && typeof menuCfg === "object") {
        setConfig({ ...DEFAULT_MENU_CONFIG, ...menuCfg });
      }

      const shellCfg = (shellRes.data as any)?.setting_value;
      if (shellCfg && typeof shellCfg === "object") {
        setCoreOnlyMode(shellCfg.core_only_mode !== false);
      }

      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);

    const [menuSave, shellSave] = await Promise.all([
      upsertCompanySetting("admin_menu_config", config),
      upsertCompanySetting("admin_shell_config", { core_only_mode: coreOnlyMode }),
    ]);

    setSaving(false);

    const error = menuSave.error || shellSave.error;
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Admin menu settings saved");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading menu settings...</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Control which sections appear in the streamlined admin sidebar and whether legacy routes are blocked.
      </p>

      <label className="flex items-center justify-between bg-secondary/50 border border-border rounded-md px-3 py-2">
        <span className="text-sm">Core-only route mode (hide legacy modules)</span>
        <input
          type="checkbox"
          checked={coreOnlyMode}
          onChange={(e) => setCoreOnlyMode(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </label>

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
