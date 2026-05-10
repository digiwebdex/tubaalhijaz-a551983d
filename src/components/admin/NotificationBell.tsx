import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  event_type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  severity: "info" | "success" | "warning" | "error";
  read_at?: string | null;
  created_at: string;
};

const severityDot: Record<string, string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
};

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const lastSeenIds = useRef<Set<string>>(new Set());
  const initialLoad = useRef(true);

  const load = async () => {
    try {
      const res = await apiClient.request<{ items: Notification[]; unread: number }>(
        "/notifications?limit=30"
      );
      const data = res || { items: [], unread: 0 };
      // Toast for newly arriving notifications (skip first load)
      if (!initialLoad.current) {
        const newOnes = data.items.filter((n) => !lastSeenIds.current.has(n.id));
        newOnes.slice(0, 3).forEach((n) => {
          if (n.severity === "error") toast.error(n.title, { description: n.body || undefined });
          else if (n.severity === "warning") toast.warning(n.title, { description: n.body || undefined });
          else if (n.severity === "success") toast.success(n.title, { description: n.body || undefined });
          else toast(n.title, { description: n.body || undefined });
        });
      }
      lastSeenIds.current = new Set(data.items.map((n) => n.id));
      initialLoad.current = false;
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);

  const markAllRead = async () => {
    try {
      await apiClient.request("/notifications/read-all", { method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnread(0);
    } catch {}
  };

  const markRead = async (id: string) => {
    try {
      await apiClient.request(`/notifications/${id}/read`, { method: "POST" });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {}
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 px-2 text-xs">
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[420px]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const inner = (
                  <div className="flex gap-3 p-3 hover:bg-muted/50 transition-colors">
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${severityDot[n.severity] || severityDot.info}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className={`text-sm flex-1 ${n.read_at ? "text-muted-foreground" : "font-semibold"}`}>
                          {n.title}
                        </div>
                        <time className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </time>
                      </div>
                      {n.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                    </div>
                  </div>
                );
                return (
                  <li key={n.id} onClick={() => !n.read_at && markRead(n.id)}>
                    {n.link ? (
                      <Link to={n.link} onClick={() => setOpen(false)}>{inner}</Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
