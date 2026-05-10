import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { RotateCw, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type QueueRow = {
  id: string; channel: string; recipient: string; subject?: string; body: string;
  status: string; attempts: number; max_attempts: number; last_error?: string;
  event_key?: string; created_at: string; next_attempt_at: string;
};
type LogRow = {
  id: string; channel: string; recipient: string; status: string; subject?: string;
  body?: string; error?: string; created_at: string; event_key?: string;
};

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  sending: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  sent: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  failed: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30",
};

export default function AdminMessageLogsPage() {
  const [tab, setTab] = useState<"queue" | "logs">("queue");
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [channel, setChannel] = useState<string>("");

  const load = async () => {
    try {
      const ch = channel ? `&channel=${channel}` : "";
      if (tab === "queue") {
        const rows = await apiClient.from("message_queue").select("*").order("created_at", { ascending: false }).limit(200);
        setQueue((rows as any).data || rows || []);
      } else {
        const rows = await apiClient.from("message_logs").select("*").order("created_at", { ascending: false }).limit(200);
        setLogs((rows as any).data || rows || []);
      }
      void ch;
    } catch (e: any) { toast.error(e.message); }
  };

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [tab, channel]);

  const retry = async (id: string) => {
    try { await apiClient.request(`/messaging/queue/${id}/retry`, { method: "POST" }); toast.success("Retry queued"); load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const cancel = async (id: string) => {
    try { await apiClient.request(`/messaging/queue/${id}/cancel`, { method: "POST" }); toast.success("Cancelled"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const filteredQueue = channel ? queue.filter((r) => r.channel === channel) : queue;
  const filteredLogs = channel ? logs.filter((r) => r.channel === channel) : logs;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Message Center</h1>
          <p className="text-sm text-muted-foreground">Live queue and delivery logs across WhatsApp, SMS, and Email.</p>
        </div>
        <div className="flex gap-2">
          {["", "whatsapp", "sms", "email"].map((c) => (
            <Button key={c || "all"} variant={channel === c ? "default" : "outline"} size="sm" onClick={() => setChannel(c)}>
              {c || "All"}
            </Button>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader><CardTitle>{tab === "queue" ? "Outgoing Queue" : "Delivery History"}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {tab === "queue" ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead><TableHead>Channel</TableHead><TableHead>Recipient</TableHead>
                <TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead>
                <TableHead>Error</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredQueue.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No messages in queue.</TableCell></TableRow>
                ) : filteredQueue.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{r.channel}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{r.recipient}</TableCell>
                    <TableCell className="text-xs">{r.event_key || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={`capitalize ${statusColor[r.status]}`}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs">{r.attempts}/{r.max_attempts}</TableCell>
                    <TableCell className="text-xs text-rose-600 max-w-xs truncate" title={r.last_error || ""}>{r.last_error || "—"}</TableCell>
                    <TableCell className="space-x-1">
                      {(r.status === "failed" || r.status === "pending") && (
                        <Button size="icon" variant="ghost" onClick={() => retry(r.id)}><RotateCw className="h-4 w-4" /></Button>
                      )}
                      {r.status !== "sent" && r.status !== "cancelled" && (
                        <Button size="icon" variant="ghost" onClick={() => cancel(r.id)}><X className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead><TableHead>Channel</TableHead><TableHead>Recipient</TableHead>
                <TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Detail</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No delivery logs yet.</TableCell></TableRow>
                ) : filteredLogs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{r.channel}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{r.recipient}</TableCell>
                    <TableCell className="text-xs">{r.event_key || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={`capitalize ${statusColor[r.status]}`}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs max-w-md truncate" title={r.error || r.subject || r.body || ""}>{r.error || r.subject || r.body || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
