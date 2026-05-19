import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Loader2, Coins } from "lucide-react";

type CurrencyDefault = "BDT" | "SAR";

export default function CurrencyRateSettings() {
  const [rate, setRate] = useState("30");
  const [showDual, setShowDual] = useState(true);
  const [defaultInvoiceCurrency, setDefaultInvoiceCurrency] = useState<CurrencyDefault>("BDT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .from("company_settings")
      .select("setting_value")
      .eq("setting_key", "currency_rate")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as any)?.setting_value || {};
        setRate(String(v.sar_to_bdt ?? 30));
        setShowDual(v.show_dual_currency !== false);
        setDefaultInvoiceCurrency(v.default_invoice_currency === "SAR" ? "SAR" : "BDT");
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    const numRate = Number(rate);
    if (!numRate || numRate <= 0) {
      toast.error("Enter a valid Riyal rate");
      return;
    }
    setSaving(true);

    const payload = {
      sar_to_bdt: numRate,
      show_dual_currency: showDual,
      default_invoice_currency: defaultInvoiceCurrency,
    };

    const existing = await apiClient
      .from("company_settings")
      .select("id")
      .eq("setting_key", "currency_rate")
      .maybeSingle();

    let result;
    if ((existing.data as any)?.id) {
      result = await apiClient
        .from("company_settings")
        .update({ setting_value: payload })
        .eq("id", (existing.data as any).id);
    } else {
      result = await apiClient
        .from("company_settings")
        .insert({ setting_key: "currency_rate", setting_value: payload });
    }

    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    toast.success("Riyal rate updated");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure SAR to BDT conversion and default currency display behavior for statements and invoices.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1.5">1 SAR = ? BDT</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full bg-secondary border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">Default Invoice Currency</label>
          <select
            value={defaultInvoiceCurrency}
            onChange={(e) => setDefaultInvoiceCurrency((e.target.value === "SAR" ? "SAR" : "BDT") as CurrencyDefault)}
            className="w-full bg-secondary border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="BDT">BDT</option>
            <option value="SAR">SAR</option>
          </select>
        </div>

        <div className="flex items-center gap-3 sm:col-span-2">
          <input
            id="dual-currency"
            type="checkbox"
            checked={showDual}
            onChange={(e) => setShowDual(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <label htmlFor="dual-currency" className="text-sm font-medium">
            Show both BDT and SAR on customer-facing screens and PDFs
          </label>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-gradient-gold text-primary-foreground font-semibold px-5 py-2.5 rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
        Save Rate
      </button>
    </div>
  );
}
