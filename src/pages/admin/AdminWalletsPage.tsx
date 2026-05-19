import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Save, X, Wallet, ArrowLeftRight,
  Banknote, Building2, Smartphone, CreditCard, Loader2, RefreshCw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBDT } from "@/lib/utils";

type WalletAccount = {
  id: string;
  name: string;
  type: string;
  balance: number;
  category: string | null;
  account_number: string | null;
  holder_name: string | null;
  bank_name: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type Transfer = {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

const CATEGORIES = [
  { value: "cash", label: "Cash", icon: Banknote, color: "text-amber-600 bg-amber-500/10" },
  { value: "bank", label: "Bank", icon: Building2, color: "text-emerald-600 bg-emerald-500/10" },
  { value: "mfs", label: "Mobile Banking", icon: Smartphone, color: "text-pink-600 bg-pink-500/10" },
  { value: "card", label: "Card", icon: CreditCard, color: "text-blue-600 bg-blue-500/10" },
  { value: "other", label: "Other", icon: Wallet, color: "text-muted-foreground bg-muted" },
];

const catMeta = (c: string | null) =>
  CATEGORIES.find((x) => x.value === c) || CATEGORIES[4];

const emptyForm = {
  id: "",
  name: "",
  category: "cash",
  account_number: "",
  holder_name: "",
  bank_name: "",
  notes: "",
  is_active: true,
  sort_order: 0,
  opening_balance: 0,
};

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: 0,
    transfer_date: new Date().toISOString().slice(0, 10),
    reference: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: accs }, { data: trs }] = await Promise.all([
      apiClient.from("accounts" as any).select("*").eq("type", "asset").order("sort_order", { ascending: true }),
      apiClient.from("wallet_transfers" as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setWallets((accs as any) || []);
    setTransfers((trs as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalBalance = useMemo(
    () => wallets.filter(w => w.is_active).reduce((s, w) => s + Number(w.balance || 0), 0),
    [wallets]
  );

  const openCreate = () => {
    setForm({ ...emptyForm, sort_order: wallets.length + 1 });
    setIsEdit(false);
    setDialogOpen(true);
  };

  const openEdit = (w: WalletAccount) => {
    setForm({
      id: w.id,
      name: w.name,
      category: w.category || "other",
      account_number: w.account_number || "",
      holder_name: w.holder_name || "",
      bank_name: w.bank_name || "",
      notes: w.notes || "",
      is_active: w.is_active,
      sort_order: w.sort_order,
      opening_balance: Number(w.balance) || 0,
    });
    setIsEdit(true);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Wallet name is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        type: "asset",
        category: form.category,
        account_number: form.account_number || null,
        holder_name: form.holder_name || null,
        bank_name: form.bank_name || null,
        notes: form.notes || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };
      if (isEdit) {
        const { error } = await apiClient
          .from("accounts" as any)
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
        toast.success("Wallet updated");
      } else {
        payload.balance = Number(form.opening_balance) || 0;
        const { error } = await apiClient.from("accounts" as any).insert(payload);
        if (error) throw error;
        toast.success("Wallet created");
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save wallet");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (w: WalletAccount) => {
    if (!confirm(`Delete wallet "${w.name}"? This cannot be undone.`)) return;
    const { error } = await apiClient.from("accounts" as any).delete().eq("id", w.id);
    if (error) {
      toast.error(error.message || "Cannot delete (wallet may be in use)");
      return;
    }
    toast.success("Wallet deleted");
    load();
  };

  const submitTransfer = async () => {
    if (!transferForm.from_account_id || !transferForm.to_account_id) {
      toast.error("Select source and destination wallets");
      return;
    }
    if (transferForm.from_account_id === transferForm.to_account_id) {
      toast.error("Source and destination must differ");
      return;
    }
    if (!transferForm.amount || transferForm.amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const { error } = await apiClient.from("wallet_transfers" as any).insert({
        from_account_id: transferForm.from_account_id,
        to_account_id: transferForm.to_account_id,
        amount: Number(transferForm.amount),
        transfer_date: transferForm.transfer_date,
        reference: transferForm.reference || null,
        notes: transferForm.notes || null,
      });
      if (error) throw error;
      toast.success("Transfer recorded");
      setTransferOpen(false);
      setTransferForm({
        from_account_id: "", to_account_id: "", amount: 0,
        transfer_date: new Date().toISOString().slice(0, 10), reference: "", notes: "",
      });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  const walletName = (id: string) => wallets.find(w => w.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Wallet Accounts
          </h1>
          <p className="text-sm text-muted-foreground">Manage cash, bank and mobile-banking wallets used across all payments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => setTransferOpen(true)} disabled={wallets.length < 2}>
            <ArrowLeftRight className="h-4 w-4 mr-2" /> Transfer
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add Wallet
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatBDT(totalBalance)}</div>
            <div className="text-xs text-muted-foreground mt-1">Across {wallets.filter(w=>w.is_active).length} active wallets</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Wallets</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{wallets.length}</div>
            <div className="text-xs text-muted-foreground mt-1">{wallets.filter(w=>!w.is_active).length} inactive</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Recent Transfers</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{transfers.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Last 50</div>
          </CardContent>
        </Card>
      </div>

      {/* Wallet grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((w) => {
          const meta = catMeta(w.category);
          const Icon = meta.icon;
          return (
            <Card key={w.id} className={!w.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${meta.color}`}><Icon className="h-5 w-5" /></div>
                    <div>
                      <div className="font-semibold">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{meta.label}</div>
                    </div>
                  </div>
                  {!w.is_active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Balance</div>
                  <div className="text-xl font-bold tabular-nums">{formatBDT(Number(w.balance || 0))}</div>
                </div>
                {(w.account_number || w.holder_name || w.bank_name) && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {w.bank_name && <div>Bank: {w.bank_name}</div>}
                    {w.account_number && <div>A/C: {w.account_number}</div>}
                    {w.holder_name && <div>Holder: {w.holder_name}</div>}
                  </div>
                )}
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(w)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => remove(w)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!loading && wallets.length === 0 && (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">No wallets yet. Click "Add Wallet" to create one.</CardContent></Card>
        )}
      </div>

      {/* Recent transfers */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Transfers</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">From</th>
                  <th className="px-4 py-2">To</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-2">{new Date(t.transfer_date).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{walletName(t.from_account_id)}</td>
                    <td className="px-4 py-2">{walletName(t.to_account_id)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{formatBDT(Number(t.amount))}</td>
                    <td className="px-4 py-2 text-muted-foreground">{t.reference || "—"}</td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No transfers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isEdit ? "Edit Wallet" : "Add New Wallet"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Wallet Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Office Cash" />
              </div>
              <div>
                <Label>Category *</Label>
                <select className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
              {!isEdit && (
                <div className="col-span-2">
                  <Label>Opening Balance (BDT)</Label>
                  <Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} />
                </div>
              )}
              <div>
                <Label>Bank Name</Label>
                <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <Label>Account / Wallet Number</Label>
                <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="Optional" />
              </div>
              <div className="col-span-2">
                <Label>Holder Name</Label>
                <Input value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} placeholder="Optional" />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-border pt-3">
                <Label htmlFor="active">Active</Label>
                <Switch id="active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Transfer Between Wallets</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From *</Label>
                <select className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm" value={transferForm.from_account_id} onChange={(e) => setTransferForm({ ...transferForm, from_account_id: e.target.value })}>
                  <option value="">-- Select --</option>
                  {wallets.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name} ({formatBDT(Number(w.balance))})</option>)}
                </select>
              </div>
              <div>
                <Label>To *</Label>
                <select className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm" value={transferForm.to_account_id} onChange={(e) => setTransferForm({ ...transferForm, to_account_id: e.target.value })}>
                  <option value="">-- Select --</option>
                  {wallets.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Amount (BDT) *</Label>
                <Input type="number" step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Date *</Label>
                <Input type="date" value={transferForm.transfer_date} onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Reference</Label>
                <Input value={transferForm.reference} onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })} placeholder="Transaction ID / cheque no." />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
            <Button onClick={submitTransfer} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowLeftRight className="h-4 w-4 mr-1" />}
              Record Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
