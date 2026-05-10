import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";

type Cfg = {
  whatsapp?: { enabled?: boolean; phone_number_id?: string; access_token?: string; business_account_id?: string };
  sms?: { enabled?: boolean; provider?: "twilio" | "bdgateway"; account_sid?: string; auth_token?: string; from?: string; endpoint?: string; method?: "GET" | "POST" };
  email?: { enabled?: boolean; smtp_host?: string; smtp_port?: number; smtp_secure?: boolean; smtp_user?: string; smtp_password?: string; from?: string };
};

export default function AdminMessagingSettingsPage() {
  const [cfg, setCfg] = useState<Cfg>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState({ channel: "whatsapp", recipient: "", body: "Hello from Tuba Al Hijaz", subject: "Test" });

  useEffect(() => {
    apiClient.request<{ config: Cfg }>("/messaging/config")
      .then((r) => setCfg(r.config || {}))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const update = (channel: keyof Cfg, patch: any) =>
    setCfg((c) => ({ ...c, [channel]: { ...(c[channel] || {}), ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.request("/messaging/config", {
        method: "PUT",
        body: JSON.stringify({ config: cfg }),
      });
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    try {
      await apiClient.request("/messaging/test", { method: "POST", body: JSON.stringify(test) });
      toast.success("Test queued — check Message Logs");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messaging Settings</h1>
        <p className="text-sm text-muted-foreground">Configure WhatsApp Cloud API, SMS gateway, and SMTP email.</p>
      </div>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="test">Send Test</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader><CardTitle>WhatsApp Cloud API</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch checked={!!cfg.whatsapp?.enabled} onCheckedChange={(v) => update("whatsapp", { enabled: v })} />
              </div>
              <div><Label>Phone Number ID</Label><Input value={cfg.whatsapp?.phone_number_id || ""} onChange={(e) => update("whatsapp", { phone_number_id: e.target.value })} /></div>
              <div><Label>Access Token</Label><Input type="password" value={cfg.whatsapp?.access_token || ""} onChange={(e) => update("whatsapp", { access_token: e.target.value })} placeholder="EAAG..." /></div>
              <div><Label>Business Account ID (optional)</Label><Input value={cfg.whatsapp?.business_account_id || ""} onChange={(e) => update("whatsapp", { business_account_id: e.target.value })} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms">
          <Card>
            <CardHeader><CardTitle>SMS Gateway</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch checked={!!cfg.sms?.enabled} onCheckedChange={(v) => update("sms", { enabled: v })} />
              </div>
              <div>
                <Label>Provider</Label>
                <Select value={cfg.sms?.provider || "twilio"} onValueChange={(v) => update("sms", { provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="bdgateway">Bangladesh Gateway (generic HTTP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(cfg.sms?.provider || "twilio") === "twilio" ? (
                <>
                  <div><Label>Account SID</Label><Input value={cfg.sms?.account_sid || ""} onChange={(e) => update("sms", { account_sid: e.target.value })} /></div>
                  <div><Label>Auth Token</Label><Input type="password" value={cfg.sms?.auth_token || ""} onChange={(e) => update("sms", { auth_token: e.target.value })} /></div>
                  <div><Label>From Number</Label><Input value={cfg.sms?.from || ""} onChange={(e) => update("sms", { from: e.target.value })} placeholder="+8801..." /></div>
                </>
              ) : (
                <>
                  <div><Label>Endpoint URL (use {"{phone}"} and {"{message}"} placeholders)</Label><Input value={cfg.sms?.endpoint || ""} onChange={(e) => update("sms", { endpoint: e.target.value })} placeholder="https://gw.example.com/send?to={phone}&text={message}&apikey=..." /></div>
                  <div>
                    <Label>HTTP Method</Label>
                    <Select value={cfg.sms?.method || "GET"} onValueChange={(v) => update("sms", { method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader><CardTitle>SMTP Email</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch checked={!!cfg.email?.enabled} onCheckedChange={(v) => update("email", { enabled: v })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>SMTP Host</Label><Input value={cfg.email?.smtp_host || ""} onChange={(e) => update("email", { smtp_host: e.target.value })} placeholder="smtp.gmail.com" /></div>
                <div><Label>Port</Label><Input type="number" value={cfg.email?.smtp_port || 587} onChange={(e) => update("email", { smtp_port: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Use TLS/SSL (port 465)</Label>
                <Switch checked={!!cfg.email?.smtp_secure} onCheckedChange={(v) => update("email", { smtp_secure: v })} />
              </div>
              <div><Label>SMTP User</Label><Input value={cfg.email?.smtp_user || ""} onChange={(e) => update("email", { smtp_user: e.target.value })} /></div>
              <div><Label>SMTP Password</Label><Input type="password" value={cfg.email?.smtp_password || ""} onChange={(e) => update("email", { smtp_password: e.target.value })} /></div>
              <div><Label>From Address</Label><Input value={cfg.email?.from || ""} onChange={(e) => update("email", { from: e.target.value })} placeholder="Tuba Al Hijaz <noreply@tubaalhijaz.com>" /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader><CardTitle>Send Test Message</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Channel</Label>
                <Select value={test.channel} onValueChange={(v) => setTest({ ...test, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Recipient (phone or email)</Label><Input value={test.recipient} onChange={(e) => setTest({ ...test, recipient: e.target.value })} /></div>
              {test.channel === "email" && (
                <div><Label>Subject</Label><Input value={test.subject} onChange={(e) => setTest({ ...test, subject: e.target.value })} /></div>
              )}
              <div><Label>Body</Label><Input value={test.body} onChange={(e) => setTest({ ...test, body: e.target.value })} /></div>
              <Button onClick={sendTest}>Send Test</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">{saving ? "Saving…" : "Save Settings"}</Button>
      </div>
    </div>
  );
}
