import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Users } from "lucide-react";
import logo from "@/assets/tuba-logo.png";

export default function AdminGroupManifestPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [packageId, setPackageId] = useState<string>("all");
  const [groupName, setGroupName] = useState("Tuba Al Hijaz Umrah Group");
  const [departureDate, setDepartureDate] = useState("");
  const [airline, setAirline] = useState("Saudia");
  const [flightNo, setFlightNo] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: b }, { data: m }] = await Promise.all([
        apiClient.from("packages").select("id, title").eq("status", "active"),
        apiClient.from("bookings").select("*, packages(title)").neq("status", "cancelled").neq("status", "deleted").order("created_at", { ascending: false }).limit(1000),
        apiClient.from("booking_members").select("*"),
      ]);
      setPackages(p || []);
      setBookings(b || []);
      setMembers(m || []);
    })();
  }, []);

  const rows = useMemo(() => {
    const filtered = packageId === "all" ? bookings : bookings.filter(b => b.package_id === packageId);
    const out: any[] = [];
    filtered.forEach(b => {
      const bMembers = members.filter(m => m.booking_id === b.id);
      if (bMembers.length > 0) {
        bMembers.forEach(m => out.push({
          name: m.full_name, passport: m.passport_number || "—",
          phone: b.guest_phone || "—", tracking: b.tracking_id, package: b.packages?.title,
        }));
      } else {
        out.push({
          name: b.guest_name || "—", passport: b.guest_passport || "—",
          phone: b.guest_phone || "—", tracking: b.tracking_id, package: b.packages?.title,
        });
      }
    });
    return out;
  }, [bookings, members, packageId]);

  return (
    <div className="p-6 space-y-4 print-hide-wrapper">
      <div className="print-hide">
        <h1 className="text-2xl font-bold text-[#0F4C3A]">
          Group Manifest <span className="text-base font-normal text-[#C9A96E]" dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>· بيان المجموعة</span>
        </h1>
        <p className="text-sm text-muted-foreground">Bilingual passenger manifest for airport, ground handler & Saudi authorities.</p>
      </div>

      <Card className="print-hide">
        <CardHeader><CardTitle className="text-base">Manifest Configuration</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Package Filter</Label>
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Active Bookings</SelectItem>
                {packages.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Group Name</Label><Input value={groupName} onChange={e => setGroupName(e.target.value)} /></div>
          <div><Label>Departure Date</Label><Input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} /></div>
          <div><Label>Airline</Label><Input value={airline} onChange={e => setAirline(e.target.value)} /></div>
          <div><Label>Flight No.</Label><Input value={flightNo} onChange={e => setFlightNo(e.target.value)} /></div>
          <div className="flex items-end">
            <Button onClick={() => window.print()} className="w-full bg-[#0F4C3A] hover:bg-[#1a6b50]">
              <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
            </Button>
          </div>
          <div className="md:col-span-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> {rows.length} pilgrims will be listed.
          </div>
        </CardContent>
      </Card>

      {/* Printable manifest */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .manifest-print, .manifest-print * { visibility: visible !important; }
          .manifest-print { position: absolute !important; left: 0; top: 0; width: 100% !important; }
          .print-hide { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <div className="manifest-print bg-white text-[#1a1a1a] p-8 mx-auto" style={{ width: "210mm", fontFamily: "'Manrope','Noto Naskh Arabic',sans-serif" }}>
        <div className="flex items-start justify-between border-b-4 border-[#C9A96E] pb-3 mb-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Tuba Al Hijaz" className="h-14 w-14 object-contain" />
            <div>
              <div className="text-xl font-bold text-[#0F4C3A]" style={{ fontFamily: "'Cormorant Garamond',serif" }}>Tuba Al Hijaz Travel & Tourism</div>
              <div className="text-[10px] text-gray-500">Dhaka · Makkah · Madinah · Jeddah · tubaalhijaz.com</div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-[#0F4C3A] text-white px-4 py-2 rounded">
              <div className="text-[10px] uppercase tracking-widest opacity-80">Group Manifest</div>
              <div className="text-base font-bold" dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>بيان المجموعة</div>
            </div>
          </div>
        </div>

        <table className="w-full text-[11px] mb-3">
          <tbody>
            <tr>
              <td className="py-1"><strong>Group / المجموعة:</strong> {groupName}</td>
              <td className="py-1"><strong>Departure / المغادرة:</strong> {departureDate || "—"}</td>
            </tr>
            <tr>
              <td className="py-1"><strong>Airline / شركة الطيران:</strong> {airline}</td>
              <td className="py-1"><strong>Flight / رقم الرحلة:</strong> {flightNo || "—"}</td>
            </tr>
            <tr>
              <td className="py-1" colSpan={2}><strong>Total Pilgrims / إجمالي المعتمرين:</strong> <span className="text-[#C9A96E] font-bold">{rows.length}</span></td>
            </tr>
          </tbody>
        </table>

        <table className="w-full text-[10px] border border-gray-300">
          <thead className="bg-gradient-to-r from-[#0F4C3A] to-[#1a6b50] text-white">
            <tr>
              <th className="p-1.5 text-center w-8">#</th>
              <th className="p-1.5 text-left">Full Name<br/><span className="font-normal opacity-80" dir="rtl">الاسم الكامل</span></th>
              <th className="p-1.5 text-left w-32">Passport<br/><span className="font-normal opacity-80" dir="rtl">جواز السفر</span></th>
              <th className="p-1.5 text-left w-28">Phone<br/><span className="font-normal opacity-80" dir="rtl">الجوال</span></th>
              <th className="p-1.5 text-left w-24">Tracking<br/><span className="font-normal opacity-80" dir="rtl">المرجع</span></th>
              <th className="p-1.5 text-left">Package<br/><span className="font-normal opacity-80" dir="rtl">الباقة</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">No pilgrims found for this filter.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-t border-gray-200">
                <td className="p-1.5 text-center font-bold text-[#C9A96E]">{i + 1}</td>
                <td className="p-1.5">{r.name}</td>
                <td className="p-1.5 font-mono">{r.passport}</td>
                <td className="p-1.5 font-mono">{r.phone}</td>
                <td className="p-1.5 font-mono text-[9px]">{r.tracking}</td>
                <td className="p-1.5 text-gray-600">{r.package}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-3 gap-4 text-center text-[10px] text-gray-600">
          {[
            ["Operations Manager", "مدير العمليات"],
            ["Group Leader", "قائد المجموعة"],
            ["Authorized Signature", "توقيع معتمد"],
          ].map(([en, ar]) => (
            <div key={en}>
              <div className="border-b border-gray-400 mx-auto w-32 h-10"></div>
              <div className="mt-1">{en}</div>
              <div dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>{ar}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-[9px] text-gray-400">
          Generated {new Date().toLocaleString("en-GB")} · tubaalhijaz.com · Computer-generated manifest
        </div>
      </div>
    </div>
  );
}
