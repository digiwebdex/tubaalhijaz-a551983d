import { Badge } from "@/components/ui/badge";

interface Props {
  row: any;
}

const Field = ({ en, ar, value }: { en: string; ar: string; value?: any }) => (
  <div className="space-y-1">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">{en}</span>
      <span dir="rtl" className="text-[11px] text-muted-foreground">{ar}</span>
    </div>
    <div className="px-3 py-2 rounded-md border border-border bg-background text-sm min-h-[36px] break-words">
      {value === null || value === undefined || value === "" ? <span className="text-muted-foreground">—</span> : String(value)}
    </div>
  </div>
);

const SectionTitle = ({ en, ar }: { en: string; ar: string }) => (
  <div className="flex items-center justify-between border-b border-border pb-2 mb-3 mt-4">
    <h3 className="font-heading text-sm font-bold uppercase tracking-wide">{en}</h3>
    <span dir="rtl" className="text-sm text-muted-foreground">{ar}</span>
  </div>
);

const nightsBetween = (a?: string, b?: string) => {
  if (!a || !b) return 0;
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (isNaN(d1) || isNaN(d2) || d2 < d1) return 0;
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
};

export default function TransportVoucherDetailView({ row }: Props) {
  const hotels: any[] = Array.isArray(row?.hotels) ? row.hotels : [];
  const flights: any[] = Array.isArray(row?.flights) ? row.flights : [];
  const movements: any[] = Array.isArray(row?.internal_movements) ? row.internal_movements : [];
  const groups: string[] = Array.isArray(row?.group_numbers) ? row.group_numbers : [];

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b">
        <div>
          <div className="font-heading text-lg font-bold">Transport Voucher Booking</div>
          <div className="text-xs text-muted-foreground font-mono">
            {row?.tracking_id || row?.id?.slice(0, 8).toUpperCase()}
          </div>
        </div>
        <span dir="rtl" className="text-base font-semibold">قسيمة النقل</span>
      </div>

      {/* Agent / Company */}
      <div className="grid md:grid-cols-3 gap-3">
        <Field en="Agent name" ar="اسم الوكيل" value={row?.agent_name} />
        <Field en="Agent country" ar="دولة الوكيل" value={row?.agent_country} />
        <Field en="Umrah Company" ar="شركة عمرة" value={row?.umrah_company} />
      </div>

      {/* Group / Package */}
      <SectionTitle en="Group / Package" ar="المجموعة / البرنامج" />
      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide">Group numbers</span>
            <span dir="rtl" className="text-[11px] text-muted-foreground">أرقام المجموعات</span>
          </div>
          <div className="flex flex-wrap gap-1 px-3 py-2 rounded-md border border-border bg-background min-h-[36px]">
            {groups.length ? groups.map((g, i) => <Badge key={i} variant="secondary">{g}</Badge>) : <span className="text-muted-foreground text-sm">—</span>}
          </div>
        </div>
        <Field en="Package / Program" ar="البرنامج" value={row?.package_name} />
        <Field en="Travel date" ar="التاريخ" value={row?.travel_date} />
      </div>

      {/* Hotels */}
      <SectionTitle en="Hotels" ar="الفنادق" />
      <div className="space-y-3">
        {hotels.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
        {hotels.map((h, i) => (
          <div key={i} className="border border-border rounded-lg p-3 bg-secondary/30">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline">{h.city}</Badge>
              <span dir="rtl" className="text-sm text-muted-foreground">
                {h.city === "MAKKAH" ? "مكة المكرمة" : "المدينة المنورة"}
              </span>
            </div>
            <div className="grid md:grid-cols-6 gap-3">
              <div className="md:col-span-2"><Field en="Hotel" ar="الفندق" value={h.hotel} /></div>
              <Field en="Agreement No." ar="رقم الاتفاقية" value={h.agreement_no} />
              <Field en="Check-in" ar="تاريخ الدخول" value={h.check_in} />
              <Field en="Check-out" ar="تاريخ الخروج" value={h.check_out} />
              <div className="grid grid-cols-2 gap-2">
                <Field en="Nights" ar="الليالي" value={h.nights ?? (nightsBetween(h.check_in, h.check_out) || "")} />
                <Field en="Rooms" ar="الغرف" value={h.rooms} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transport */}
      <SectionTitle en="Transport" ar="النقل" />
      <div className="grid md:grid-cols-2 gap-3">
        <Field en="Type of transportation" ar="نوع الحافلة" value={row?.transport_type} />
        <Field en="Number of pilgrims" ar="عدد المعتمرين" value={row?.pilgrim_count} />
      </div>

      {/* Flights */}
      <SectionTitle en="Flights" ar="الرحلات" />
      <div className="space-y-3">
        {flights.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
        {flights.map((f, i) => (
          <div key={i} className="border border-border rounded-lg p-3 bg-secondary/30">
            <div className="flex items-center gap-2 mb-3">
              <Badge>{f.type}</Badge>
              <span dir="rtl" className="text-sm text-muted-foreground">
                {f.type === "ARRIVAL" ? "وصول" : "مغادرة"}
              </span>
            </div>
            <div className="grid md:grid-cols-5 gap-3">
              <Field en="Airport" ar="المطار" value={f.airport} />
              <Field en="Date" ar="التاريخ" value={f.date} />
              <Field en="Time" ar="الوقت" value={f.time} />
              <Field en="Flight number" ar="رقم الرحلة" value={f.flight_no} />
              <Field en="Airline" ar="الخطوط" value={f.airline} />
            </div>
          </div>
        ))}
      </div>

      {/* Internal Movements */}
      <SectionTitle en="Internal Movements" ar="التنقلات الداخلية" />
      <div className="space-y-2">
        {movements.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
        {movements.map((m, i) => (
          <div key={i} className="grid md:grid-cols-4 gap-3 border border-border rounded-lg p-3 bg-secondary/30">
            <Field en="Date" ar="التاريخ" value={m.date} />
            <Field en="From" ar="من" value={m.from} />
            <Field en="To" ar="إلى" value={m.to} />
            <Field en="Time" ar="الوقت" value={m.time} />
          </div>
        ))}
      </div>

      {/* Supervisors */}
      <SectionTitle en="Supervisors / Operations" ar="المشرفون / العمليات" />
      <div className="grid md:grid-cols-3 gap-3">
        <Field en="Supervisor — Makkah" ar="مشرف مكة" value={row?.supervisor_makkah_phone} />
        <Field en="Supervisor — Madinah" ar="مشرف المدينة" value={row?.supervisor_madinah_phone} />
        <Field en="Ops 24h" ar="عمليات 24 ساعة" value={row?.ops_24h_phone} />
      </div>

      {/* Contact */}
      <SectionTitle en="Contact" ar="جهة الاتصال" />
      <div className="grid md:grid-cols-3 gap-3">
        <Field en="Contact name" ar="الاسم" value={row?.contact_name} />
        <Field en="Phone" ar="الهاتف" value={row?.contact_phone} />
        <Field en="Email" ar="البريد" value={row?.contact_email} />
      </div>

      {row?.notes && (
        <>
          <SectionTitle en="Notes" ar="ملاحظات" />
          <div className="px-3 py-2 rounded-md border border-border bg-background text-sm whitespace-pre-wrap">{row.notes}</div>
        </>
      )}
    </div>
  );
}
