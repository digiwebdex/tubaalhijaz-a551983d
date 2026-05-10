import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileCheck2, FileX2, Eye, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface DocReview {
  id: string;
  booking_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  verification_status: string;
  verification_notes: string | null;
  verified_at: string | null;
  created_at: string;
  tracking_id?: string;
  guest_name?: string;
  guest_phone?: string;
}

const STATUS_TABS = [
  { key: "pending", label: "Pending", icon: Clock, color: "text-amber-600" },
  { key: "under_review", label: "Under Review", icon: Eye, color: "text-blue-600" },
  { key: "approved", label: "Approved", icon: CheckCircle2, color: "text-emerald-600" },
  { key: "rejected", label: "Rejected", icon: XCircle, color: "text-red-600" },
  { key: "reupload_required", label: "Re-upload", icon: AlertTriangle, color: "text-orange-600" },
];

const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export default function AdminDocumentReviewsPage() {
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState<DocReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDoc, setReviewDoc] = useState<DocReview | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>("approved");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await apiClient.auth.getSession();
      const r = await fetch(`${apiBase}/document-reviews?status=${tab}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const submitReview = async () => {
    if (!reviewDoc) return;
    setSaving(true);
    try {
      const { data: { session } } = await apiClient.auth.getSession();
      const r = await fetch(`${apiBase}/document-reviews/${reviewDoc.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ status: reviewStatus, notes }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success(`Document ${reviewStatus.replace(/_/g, " ")}`);
      setReviewDoc(null);
      setNotes("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openReview = (doc: DocReview, defaultStatus: string) => {
    setReviewDoc(doc);
    setReviewStatus(defaultStatus);
    setNotes(doc.verification_notes || "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileCheck2 className="h-7 w-7 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold">Document Verification</h1>
          <p className="text-sm text-muted-foreground">Review pilgrim documents — approve, reject, or request re-upload</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="flex items-center gap-1.5">
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              <span className="hidden sm:inline">{s.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Documents — {STATUS_TABS.find(s => s.key === tab)?.label}</CardTitle>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No documents in this status.</p>
          ) : (
            <div className="space-y-3">
              {items.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 hover:bg-accent/30 transition">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold capitalize">{doc.document_type.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className="font-mono text-xs">{doc.tracking_id || "—"}</Badge>
                        <Badge variant={doc.verification_status === "approved" ? "default" : doc.verification_status === "rejected" ? "destructive" : "secondary"}>
                          {doc.verification_status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="font-medium">{doc.guest_name || "Guest"}</span>
                        {doc.guest_phone && <> · {doc.guest_phone}</>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.file_name}</p>
                      {doc.verification_notes && (
                        <p className="text-xs italic text-muted-foreground mt-1 border-l-2 border-amber-300 pl-2">
                          Note: {doc.verification_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button asChild size="sm" variant="outline">
                        <a href={`${apiBase}/uploads/${doc.file_path.split("/").pop()}`} target="_blank" rel="noreferrer">
                          <Eye className="h-4 w-4 mr-1" />View
                        </a>
                      </Button>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openReview(doc, "approved")}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openReview(doc, "rejected")}>
                        <FileX2 className="h-4 w-4 mr-1" />Reject
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openReview(doc, "reupload_required")}>
                        Re-upload
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewDoc} onOpenChange={(o) => !o && setReviewDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Document — <span className="capitalize">{reviewStatus.replace(/_/g, " ")}</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <p><span className="text-muted-foreground">Doc:</span> <span className="font-semibold capitalize">{reviewDoc?.document_type.replace(/_/g, " ")}</span></p>
              <p><span className="text-muted-foreground">Pilgrim:</span> {reviewDoc?.guest_name} · {reviewDoc?.tracking_id}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Internal note (sent to customer)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={reviewStatus === "rejected" ? "Reason for rejection…" : reviewStatus === "reupload_required" ? "What needs to be re-uploaded…" : "Optional note…"}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDoc(null)}>Cancel</Button>
            <Button onClick={submitReview} disabled={saving}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
