import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Save,
  Loader2,
  FileText,
  Wallet,
  Filter,
  Eye,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportPDF, exportExcel } from "@/lib/reportExport";
import { generateReceipt } from "@/lib/invoiceGenerator";
import { getCompanyInfoForPdf } from "@/lib/entityPdfGenerator";
import { formatBDT, formatSAR } from "@/lib/utils";
import {
  useIsViewer,
  useCanModifyFinancials,
} from "@/components/admin/AdminLayout";
import AdminActionMenu from "@/components/admin/AdminActionMenu";
import {
  fetchDuePaymentSources,
  SOURCE_LABELS,
  type PaymentSource,
  type PaymentSourceType,
} from "@/lib/paymentSources";

const inputClass =
  "w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "bank", label: "Bank Transfer" },
  { value: "manual", label: "Manual" },
];

const STATUSES = ["pending", "completed", "failed", "refunded"];

const SERVICE_BADGE_COLOR: Record<PaymentSourceType, string> = {
  booking: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  umrah_order: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  hotel: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  catering: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  transport: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
  visa: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  ticket: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
};

type FormState = {
  source_type: PaymentSourceType | "";
  source_id: string;
  amount_bdt: string;
  amount_sar: string;
  payment_method: string;
  transaction_id: string;
  paid_date: string;
  wallet_account_id: string;
  notes: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  source_type: "",
  source_id: "",
  amount_bdt: "",
  amount_sar: "",
  payment_method: "cash",
  transaction_id: "",
  paid_date: new Date().toISOString().split("T")[0],
  wallet_account_id: "",
  notes: "",
  status: "completed",
};

export default function AdminPaymentsPage() {
  const isViewer = useIsViewer();
  const canModify = useCanModifyFinancials();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [sources, setSources] = useState<PaymentSource[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Dialogs
  const [showAdd, setShowAdd] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("action") === "add";
  });
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
  const [bookingSearch, setBookingSearch] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewPayment, setViewPayment] = useState<any | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // ============ Data loading ============
  const loadAll = async () => {
    setLoading(true);
    try {
      const [payRes, walletRes, sourceRows] = await Promise.all([
        apiClient
          .from("payments")
          .select(
            "id,source_type,source_id,booking_id,customer_id,user_id,amount,amount_sar,payment_method,transaction_id,status,paid_at,created_at,notes,receipt_file_path,wallet_account_id"
          )
          .order("created_at", { ascending: false }),
        apiClient
          .from("accounts")
          .select("id,name,type,balance")
          .eq("type", "asset"),
        fetchDuePaymentSources(),
      ]);

      setPayments(Array.isArray(payRes.data) ? payRes.data : []);
      setWallets(Array.isArray(walletRes.data) ? walletRes.data : []);
      setSources(sourceRows);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ============ Booking picker ============
  const filteredSources = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    if (!q) return sources.slice(0, 50);
    return sources
      .filter(
        (s) =>
          s.tracking_id.toLowerCase().includes(q) ||
          s.customer_name.toLowerCase().includes(q) ||
          s.customer_phone.toLowerCase().includes(q) ||
          s.service_label.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [bookingSearch, sources]);

  const sourceMap = useMemo(() => {
    const m = new Map<string, PaymentSource>();
    sources.forEach((s) => m.set(`${s.source_type}:${s.source_id}`, s));
    return m;
  }, [sources]);

  const selectedSource = useMemo(() => {
    if (!addForm.source_type || !addForm.source_id) return null;
    return sourceMap.get(`${addForm.source_type}:${addForm.source_id}`) || null;
  }, [addForm.source_type, addForm.source_id, sourceMap]);

  // ============ List filters ============
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (serviceFilter !== "all" && (p.source_type || "booking") !== serviceFilter)
        return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (dateFrom && (p.paid_at || p.created_at) < dateFrom) return false;
      if (dateTo && (p.paid_at || p.created_at) > `${dateTo}T23:59:59`)
        return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${p.transaction_id || ""} ${p.notes || ""} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, serviceFilter, statusFilter, dateFrom, dateTo, search]);

  const totals = useMemo(() => {
    let bdt = 0;
    let sar = 0;
    for (const p of filteredPayments) {
      if (p.status === "cancelled" || p.status === "failed") continue;
      bdt += Number(p.amount) || 0;
      sar += Number(p.amount_sar) || 0;
    }
    return { bdt, sar, count: filteredPayments.length };
  }, [filteredPayments]);

  // ============ Receipt upload ============
  const uploadReceipt = async (paymentId: string): Promise<string | null> => {
    if (!receiptFile) return null;
    const ext = receiptFile.name.split(".").pop() || "bin";
    const path = `payment-${paymentId}.${ext}`;
    const { error } = await apiClient.storage
      .from("payment-receipts")
      .upload(path, receiptFile, { upsert: true });
    if (error) {
      toast.error("Receipt upload failed: " + error.message);
      return null;
    }
    return path;
  };

  // ============ Create ============
  const resetAddForm = () => {
    setAddForm(EMPTY_FORM);
    setBookingSearch("");
    setReceiptFile(null);
  };

  const handleAdd = async () => {
    if (!canModify) return;
    if (!addForm.source_type || !addForm.source_id) {
      toast.error("Please select a booking");
      return;
    }
    const bdt = Number(addForm.amount_bdt) || 0;
    const sar = Number(addForm.amount_sar) || 0;
    if (bdt <= 0 && sar <= 0) {
      toast.error("Enter an amount in BDT or SAR");
      return;
    }
    if (!addForm.wallet_account_id) {
      toast.error("Please select a wallet account");
      return;
    }

    setSubmitting(true);
    try {
      const tempId = crypto.randomUUID();
      const receiptPath = await uploadReceipt(tempId);

      const userResp = await apiClient.auth.getUser();
      const uid =
        userResp?.data?.user?.id || "00000000-0000-0000-0000-000000000000";

      const payload: any = {
        id: tempId,
        source_type: addForm.source_type,
        source_id: addForm.source_id,
        booking_id:
          addForm.source_type === "booking" ? addForm.source_id : null,
        customer_id: selectedSource?.customer_id || null,
        user_id: selectedSource?.user_id || uid,
        amount: bdt,
        amount_sar: sar,
        payment_method: addForm.payment_method,
        transaction_id: addForm.transaction_id || null,
        status: addForm.status,
        paid_at:
          addForm.status === "completed"
            ? new Date(addForm.paid_date).toISOString()
            : null,
        wallet_account_id: addForm.wallet_account_id,
        notes: addForm.notes || null,
        receipt_file_path: receiptPath,
      };

      const { error } = await apiClient.from("payments").insert(payload);
      if (error) throw error;

      toast.success("Payment recorded");
      setShowAdd(false);
      resetAddForm();
      await loadAll();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  // ============ Edit ============
  const startEdit = (p: any) => {
    setEditId(p.id);
    setEditForm({
      source_type: (p.source_type || "booking") as PaymentSourceType,
      source_id: p.source_id || p.booking_id || "",
      amount_bdt: String(p.amount ?? ""),
      amount_sar: String(p.amount_sar ?? ""),
      payment_method: p.payment_method || "cash",
      transaction_id: p.transaction_id || "",
      paid_date: (p.paid_at || p.created_at || new Date().toISOString()).slice(
        0,
        10
      ),
      wallet_account_id: p.wallet_account_id || "",
      notes: p.notes || "",
      status: p.status || "completed",
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    const bdt = Number(editForm.amount_bdt) || 0;
    const sar = Number(editForm.amount_sar) || 0;
    if (bdt <= 0 && sar <= 0) {
      toast.error("Enter an amount");
      return;
    }
    try {
      const { error } = await apiClient
        .from("payments")
        .update({
          amount: bdt,
          amount_sar: sar,
          payment_method: editForm.payment_method,
          transaction_id: editForm.transaction_id || null,
          status: editForm.status,
          paid_at:
            editForm.status === "completed"
              ? new Date(editForm.paid_date).toISOString()
              : null,
          wallet_account_id: editForm.wallet_account_id || null,
          notes: editForm.notes || null,
        })
        .eq("id", editId);
      if (error) throw error;
      toast.success("Payment updated");
      setEditId(null);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    }
  };

  // ============ Delete ============
  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await apiClient
        .from("payments")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      toast.success("Payment deleted");
      setDeleteId(null);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  };

  // ============ Receipt PDF ============
  const handleReceipt = async (p: any) => {
    setGeneratingId(p.id);
    try {
      const company = await getCompanyInfoForPdf();
      await generateReceipt(
        {
          id: p.id,
          amount: Number(p.amount) || 0,
          payment_method: p.payment_method || "cash",
          transaction_id: p.transaction_id || "",
          paid_at: p.paid_at || p.created_at,
          status: p.status || "completed",
          notes: p.notes || "",
        } as any,
        {
          tracking_id: p.source_id || p.booking_id || p.id,
        } as any,
        { full_name: "" } as any,
        company
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate receipt");
    } finally {
      setGeneratingId(null);
    }
  };

  // ============ Export ============
  const exportRows = () =>
    filteredPayments.map((p) => ({
      date: (p.paid_at || p.created_at || "").slice(0, 10),
      source: SOURCE_LABELS[(p.source_type as PaymentSourceType) || "booking"],
      reference: p.source_id || p.booking_id || "",
      method: p.payment_method,
      bdt: Number(p.amount) || 0,
      sar: Number(p.amount_sar) || 0,
      status: p.status,
      txn: p.transaction_id || "",
      notes: p.notes || "",
    }));

  const handlePDF = () =>
    exportPDF({
      title: "Payment Management",
      columns: [
        { header: "Date", dataKey: "date" },
        { header: "Source", dataKey: "source" },
        { header: "Reference", dataKey: "reference" },
        { header: "Method", dataKey: "method" },
        { header: "BDT", dataKey: "bdt" },
        { header: "SAR", dataKey: "sar" },
        { header: "Status", dataKey: "status" },
      ],
      rows: exportRows(),
    });

  const handleExcel = () =>
    exportExcel({ filename: "payments", rows: exportRows() });

  // ============ Render ============
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Management</h1>
          <p className="text-sm text-muted-foreground">
            Record customer payments against any booking from across the system.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePDF}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/70"
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button
            onClick={handleExcel}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/70"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
          {canModify && (
            <button
              onClick={() => {
                resetAddForm();
                setShowAdd(true);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New Payment
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Receipts (filtered)
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {totals.count.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total BDT
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
            {formatBDT(totals.bdt)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total SAR
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-300">
            {formatSAR(totals.sar)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Transaction ID, notes…"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Services</option>
              {(Object.keys(SOURCE_LABELS) as PaymentSourceType[]).map((k) => (
                <option key={k} value={k}>
                  {SOURCE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-right">BDT</th>
              <th className="px-3 py-2 text-right">SAR</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading payments…
                </td>
              </tr>
            ) : filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-muted-foreground">
                  No payments found.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => {
                const st = (p.source_type || "booking") as PaymentSourceType;
                return (
                  <tr key={p.id} className="hover:bg-secondary/30">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {(p.paid_at || p.created_at || "").slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SERVICE_BADGE_COLOR[st]}`}
                      >
                        {SOURCE_LABELS[st]}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {(p.source_id || p.booking_id || "").slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatBDT(Number(p.amount) || 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-300">
                      {Number(p.amount_sar) > 0 ? formatSAR(p.amount_sar) : "—"}
                    </td>
                    <td className="px-3 py-2 capitalize">{p.payment_method}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : p.status === "pending"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <AdminActionMenu
                        items={[
                          {
                            label: "View",
                            icon: <Eye className="h-4 w-4" />,
                            onClick: () => setViewPayment(p),
                          },
                          {
                            label: "Receipt PDF",
                            icon:
                              generatingId === p.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              ),
                            onClick: () => handleReceipt(p),
                          },
                          ...(canModify
                            ? [
                                {
                                  label: "Edit",
                                  icon: <Edit2 className="h-4 w-4" />,
                                  onClick: () => startEdit(p),
                                },
                                {
                                  label: "Delete",
                                  icon: <Trash2 className="h-4 w-4" />,
                                  destructive: true,
                                  onClick: () => setDeleteId(p.id),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => !o && setShowAdd(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Booking picker */}
            <div>
              <label className="text-sm font-medium">Select Booking *</label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Search by tracking ID, customer name or phone…"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-border bg-background">
                {sources.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No bookings with outstanding due.
                  </div>
                ) : filteredSources.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No matches.
                  </div>
                ) : (
                  filteredSources.map((s) => {
                    const selected =
                      addForm.source_type === s.source_type &&
                      addForm.source_id === s.source_id;
                    return (
                      <button
                        type="button"
                        key={`${s.source_type}:${s.source_id}`}
                        onClick={() =>
                          setAddForm({
                            ...addForm,
                            source_type: s.source_type,
                            source_id: s.source_id,
                            amount_bdt: String(s.due),
                          })
                        }
                        className={`flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm hover:bg-secondary/40 ${
                          selected ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${SERVICE_BADGE_COLOR[s.source_type]}`}
                          >
                            {SOURCE_LABELS[s.source_type]}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {s.tracking_id} · {s.customer_name}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {s.customer_phone || "—"}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs">
                          <div>Total: {formatBDT(s.total)}</div>
                          <div className="text-rose-600 dark:text-rose-300">
                            Due: {formatBDT(s.due)}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {selectedSource && (
                <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  Selected: <strong>{selectedSource.tracking_id}</strong> ·{" "}
                  {selectedSource.customer_name} · Due{" "}
                  <strong>{formatBDT(selectedSource.due)}</strong>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Amount (BDT) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={addForm.amount_bdt}
                  onChange={(e) =>
                    setAddForm({ ...addForm, amount_bdt: e.target.value })
                  }
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Amount (SAR)</label>
                <input
                  type="number"
                  step="0.01"
                  value={addForm.amount_sar}
                  onChange={(e) =>
                    setAddForm({ ...addForm, amount_sar: e.target.value })
                  }
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Method + Wallet */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Method *</label>
                <select
                  value={addForm.payment_method}
                  onChange={(e) =>
                    setAddForm({ ...addForm, payment_method: e.target.value })
                  }
                  className={inputClass}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Wallet Account *</label>
                <select
                  value={addForm.wallet_account_id}
                  onChange={(e) =>
                    setAddForm({ ...addForm, wallet_account_id: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">— Select Wallet —</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      <Wallet className="inline" /> {w.name} ({formatBDT(w.balance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date + Txn */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Date *</label>
                <input
                  type="date"
                  value={addForm.paid_date}
                  onChange={(e) =>
                    setAddForm({ ...addForm, paid_date: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Transaction ID</label>
                <input
                  value={addForm.transaction_id}
                  onChange={(e) =>
                    setAddForm({ ...addForm, transaction_id: e.target.value })
                  }
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Status + Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={addForm.status}
                  onChange={(e) =>
                    setAddForm({ ...addForm, status: e.target.value })
                  }
                  className={inputClass}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Receipt File</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                className={inputClass}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Payment
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Amount (BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.amount_bdt}
                  onChange={(e) =>
                    setEditForm({ ...editForm, amount_bdt: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Amount (SAR)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.amount_sar}
                  onChange={(e) =>
                    setEditForm({ ...editForm, amount_sar: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Method</label>
                <select
                  value={editForm.payment_method}
                  onChange={(e) =>
                    setEditForm({ ...editForm, payment_method: e.target.value })
                  }
                  className={inputClass}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Wallet</label>
                <select
                  value={editForm.wallet_account_id}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      wallet_account_id: e.target.value,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">—</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={editForm.paid_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, paid_date: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className={inputClass}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Transaction ID</label>
              <input
                value={editForm.transaction_id}
                onChange={(e) =>
                  setEditForm({ ...editForm, transaction_id: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
                className={inputClass}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditId(null)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete payment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will reverse wallet and ledger entries for this payment. This
            action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setDeleteId(null)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        open={!!viewPayment}
        onOpenChange={(o) => !o && setViewPayment(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {viewPayment && (
            <div className="space-y-2 text-sm">
              <Row
                label="Source"
                value={
                  SOURCE_LABELS[
                    (viewPayment.source_type as PaymentSourceType) || "booking"
                  ]
                }
              />
              <Row
                label="Reference"
                value={viewPayment.source_id || viewPayment.booking_id || "—"}
                mono
              />
              <Row
                label="Amount (BDT)"
                value={formatBDT(Number(viewPayment.amount) || 0)}
              />
              <Row
                label="Amount (SAR)"
                value={
                  Number(viewPayment.amount_sar) > 0
                    ? formatSAR(viewPayment.amount_sar)
                    : "—"
                }
              />
              <Row label="Method" value={viewPayment.payment_method} />
              <Row label="Status" value={viewPayment.status} />
              <Row
                label="Date"
                value={(viewPayment.paid_at || viewPayment.created_at || "").slice(
                  0,
                  10
                )}
              />
              <Row label="Transaction ID" value={viewPayment.transaction_id || "—"} />
              <Row label="Notes" value={viewPayment.notes || "—"} />
              {viewPayment.receipt_file_path && (
                <button
                  onClick={async () => {
                    const { data } = await apiClient.storage
                      .from("payment-receipts")
                      .createSignedUrl(viewPayment.receipt_file_path, 300);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
                >
                  <FileText className="h-4 w-4" /> View receipt
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
