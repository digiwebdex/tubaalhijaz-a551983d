import { useEffect, useState, useMemo } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useIsViewer, useCanModifyFinancials } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  RefreshCw, Plus, Search, RotateCcw, CheckCircle, XCircle,
  AlertTriangle, DollarSign, TrendingDown, FileText
} from "lucide-react";
import { format } from "date-fns";
import { formatBDT } from "@/lib/utils";

const inputClass = "w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

const REFUND_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "bank", label: "Bank Transfer" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  processed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function AdminRefundsPage() {
  const isViewer = useIsViewer();
  const canModify = useCanModifyFinancials();
  const [refunds, setRefunds] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [walletAccounts, setWalletAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Modals
  const [showAddRefund, setShowAddRefund] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [refundForm, setRefundForm] = useState({
    refund_amount: 0,
    deduction_amount: 0,
    original_amount: 0,
    refund_method: "cash",
    wallet_account_id: "",
    reason: "",
  });

  // Policy form
  const [policyForm, setPolicyForm] = useState({
    name: "", description: "", refund_type: "percentage", refund_value: 0,
    min_days_before_departure: 0, is_default: false,
  });

  const fetchAll = async () => {
    setLoading(true);
    const [refRes, polRes, bkRes, walRes] = await Promise.all([
      apiClient.from("refunds").select("*, bookings(tracking_id, guest_name, total_amount, paid_amount, status, packages(name)), cancellation_policies(name)").order("created_at", { ascending: false }),
      apiClient.from("cancellation_policies").select("*").eq("is_active", true).order("name", { ascending: true }),
      apiClient.from("bookings").select("id, tracking_id, guest_name, total_amount, paid_amount, status, packages(name)").order("created_at", { ascending: false }),
      apiClient.from("accounts").select("*").eq("type", "asset").order("name", { ascending: true }),
    ]);
    setRefunds(refRes.data || []);
    setPolicies(polRes.data || []);
    setBookings((bkRes.data || []).filter((b: any) => b.status !== "cancelled"));
    setWalletAccounts(walRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // When booking changes, update original amount
  useEffect(() => {
    if (!selectedBookingId) return;
    const bk = bookings.find((b: any) => b.id === selectedBookingId);
    if (bk) {
      const paid = Number(bk.paid_amount || 0);
      setRefundForm(prev => ({ ...prev, original_amount: paid, refund_amount: paid, deduction_amount: 0 }));
    }
  }, [selectedBookingId, bookings]);

  // When policy changes, recalculate
  useEffect(() => {
    if (!selectedPolicyId || !refundForm.original_amount) return;
    const pol = policies.find((p: any) => p.id === selectedPolicyId);
    if (pol) {
      const orig = refundForm.original_amount;
      let deduction = pol.refund_type === "percentage"
        ? orig * (1 - Number(pol.refund_value) / 100)
        : Number(pol.refund_value);
      deduction = Math.min(deduction, orig);
      setRefundForm(prev => ({
        ...prev,
        deduction_amount: Math.round(deduction),
        refund_amount: Math.round(orig - deduction),
      }));
    }
  }, [selectedPolicyId, policies, refundForm.original_amount]);

  const handleCreateRefund = async () => {
    if (!selectedBookingId) { toast.error("Please select a booking"); return; }
    if (refundForm.refund_amount <= 0) { toast.error("Refund amount must be greater than 0"); return; }

    const { error } = await apiClient.from("refunds").insert({
      booking_id: selectedBookingId,
      policy_id: selectedPolicyId || null,
      original_amount: refundForm.original_amount,
      refund_amount: refundForm.refund_amount,
      deduction_amount: refundForm.deduction_amount,
      refund_method: refundForm.refund_method,
      wallet_account_id: refundForm.wallet_account_id || null,
      reason: refundForm.reason,
      status: "pending",
    });

    if (error) { toast.error(error.message); return; }
    toast.success("Refund request created");
    setShowAddRefund(false);
    resetForm();
    fetchAll();
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await apiClient.from("refunds").update({
      status: newStatus,
      ...(newStatus === "processed" ? { processed_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Refund ${newStatus}`);
    fetchAll();
  };

  const handleSavePolicy = async () => {
    if (!policyForm.name) { toast.error("Please enter name"); return; }
    const { error } = await apiClient.from("cancellation_policies").insert(policyForm);
    if (error) { toast.error(error.message); return; }
    toast.success("Policy created");
    setPolicyForm({ name: "", description: "", refund_type: "percentage", refund_value: 0, min_days_before_departure: 0, is_default: false });
    fetchAll();
  };

  const resetForm = () => {
    setSelectedBookingId("");
    setSelectedPolicyId("");
    setRefundForm({ refund_amount: 0, deduction_amount: 0, original_amount: 0, refund_method: "cash", wallet_account_id: "", reason: "" });
  };

  const filteredRefunds = useMemo(() => {
    let list = refunds;
    if (filterStatus !== "all") list = list.filter((r: any) => r.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r: any) =>
        r.bookings?.tracking_id?.toLowerCase().includes(q) ||
        r.bookings?.guest_name?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [refunds, filterStatus, searchQuery]);

  const stats = useMemo(() => ({
    total: refunds.length,
    pending: refunds.filter((r: any) => r.status === "pending").length,
    processed: refunds.filter((r: any) => r.status === "processed").length,
    totalRefunded: refunds.filter((r: any) => r.status === "processed").reduce((s: number, r: any) => s + Number(r.refund_amount), 0),
  }), [refunds]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin h-6 w-6 text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Refunds & Cancellations</h1>
          <p className="text-sm text-muted-foreground">Manage booking cancellations and refunds</p>
        </div>
        {!isViewer && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPolicyModal(true)}>
              <FileText className="h-4 w-4 mr-1" /> Manage Policy
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setShowAddRefund(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New Refund
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Refunds</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Processed</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.processed}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Refunded</p>
          <p className="text-2xl font-bold text-destructive">{formatBDT(stats.totalRefunded)}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input className={inputClass + " pl-9"} placeholder="Search by tracking ID, name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className={inputClass + " w-auto"} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="processed">Processed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tracking</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Original Amount</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Deduction</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Refund</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Method</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              {!isViewer && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRefunds.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No refunds found</td></tr>
            ) : filteredRefunds.map((r: any) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{r.bookings?.tracking_id || "—"}</td>
                <td className="px-4 py-3">{r.bookings?.guest_name || "—"}</td>
                <td className="px-4 py-3 text-right">{formatBDT(r.original_amount)}</td>
                <td className="px-4 py-3 text-right text-destructive">{formatBDT(r.deduction_amount)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatBDT(r.refund_amount)}</td>
                <td className="px-4 py-3 text-center capitalize">{r.refund_method}</td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs">{format(new Date(r.created_at), "dd/MM/yyyy")}</td>
                {!isViewer && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      {r.status === "pending" && canModify && (
                        <>
                          <Button size="sm" variant="ghost" className="text-emerald-600 h-7 px-2" onClick={() => handleUpdateStatus(r.id, "approved")}>
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => handleUpdateStatus(r.id, "rejected")}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {r.status === "approved" && canModify && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleUpdateStatus(r.id, "processed")}>
                          <DollarSign className="h-3.5 w-3.5 mr-1" /> Process
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Refund Modal */}
      <Dialog open={showAddRefund} onOpenChange={setShowAddRefund}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Refund Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Booking *</label>
              <select className={inputClass} value={selectedBookingId} onChange={e => setSelectedBookingId(e.target.value)}>
                <option value="">-- Select booking --</option>
                {bookings.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.tracking_id} — {b.guest_name} ({formatBDT(b.paid_amount)} paid)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cancellation Policy</label>
              <select className={inputClass} value={selectedPolicyId} onChange={e => setSelectedPolicyId(e.target.value)}>
                <option value="">-- Custom refund --</option>
                {policies.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.refund_type === "percentage" ? `${p.refund_value}%` : formatBDT(p.refund_value)})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Original Amount</label>
                <input className={inputClass} type="number" value={refundForm.original_amount} onChange={e => {
                  const v = Number(e.target.value);
                  setRefundForm(prev => ({ ...prev, original_amount: v, refund_amount: v - prev.deduction_amount }));
                }} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Deduction</label>
                <input className={inputClass} type="number" value={refundForm.deduction_amount} onChange={e => {
                  const v = Number(e.target.value);
                  setRefundForm(prev => ({ ...prev, deduction_amount: v, refund_amount: prev.original_amount - v }));
                }} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Refund Amount</label>
                <input className={inputClass + " font-bold"} type="number" value={refundForm.refund_amount} readOnly />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Refund Method</label>
                <select className={inputClass} value={refundForm.refund_method} onChange={e => setRefundForm(prev => ({ ...prev, refund_method: e.target.value }))}>
                  {REFUND_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Wallet Account</label>
                <select className={inputClass} value={refundForm.wallet_account_id} onChange={e => setRefundForm(prev => ({ ...prev, wallet_account_id: e.target.value }))}>
                  <option value="">-- Select --</option>
                  {walletAccounts.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({formatBDT(w.balance)})</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Reason</label>
              <textarea className={inputClass} rows={2} value={refundForm.reason} onChange={e => setRefundForm(prev => ({ ...prev, reason: e.target.value }))} placeholder="Enter cancellation reason..." />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddRefund(false)}>Rejected</Button>
              <Button onClick={handleCreateRefund}><RotateCcw className="h-4 w-4 mr-1" /> Create Refund</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Policy Modal */}
      <Dialog open={showPolicyModal} onOpenChange={setShowPolicyModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Cancellation Policy</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Existing policies */}
            {policies.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {policies.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.refund_type === "percentage" ? `${p.refund_value}% Refund` : `${formatBDT(p.refund_value)} flat deduction`}
                        {p.min_days_before_departure > 0 && ` • min ${p.min_days_before_departure} days before`}
                      </p>
                    </div>
                    {p.is_default && <Badge variant="secondary">Default</Badge>}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-semibold">Add New Policy</p>
              <input className={inputClass} placeholder="Policy name" value={policyForm.name} onChange={e => setPolicyForm(prev => ({ ...prev, name: e.target.value }))} />
              <input className={inputClass} placeholder="Description (optional)" value={policyForm.description} onChange={e => setPolicyForm(prev => ({ ...prev, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <select className={inputClass} value={policyForm.refund_type} onChange={e => setPolicyForm(prev => ({ ...prev, refund_type: e.target.value }))}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount</option>
                </select>
                <input className={inputClass} type="number" placeholder={policyForm.refund_type === "percentage" ? "Refund %" : "Deduction Amount"} value={policyForm.refund_value} onChange={e => setPolicyForm(prev => ({ ...prev, refund_value: Number(e.target.value) }))} />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSavePolicy}><Plus className="h-4 w-4 mr-1" /> Save Policy</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
