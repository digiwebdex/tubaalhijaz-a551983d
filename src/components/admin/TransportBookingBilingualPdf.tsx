import logo from "@/assets/tuba-logo.png";

export interface TransportBookingPdfData {
  tracking_id: string;
  issued_at?: string;
  status?: string;

  // Customer (resolved)
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer_passport?: string;

  // Form payload (mirrors customer-facing form)
  agent_name?: string;
  agent_country?: string;
  umrah_company?: string;
  package_name?: string;
  group_numbers?: string[];
  travel_date?: string;

  hotels?: Array<{
    city?: string;
    hotel?: string;
    agreement_no?: string;
    check_in?: string;
    check_out?: string;
    nights?: number | string;
    rooms?: number | string;
  }>;

  transport_type?: string;
  pilgrim_count?: number | string;

  flights?: Array<{
    type?: string;
    airport?: string;
    date?: string;
    time?: string;
    flight_no?: string;
    airline?: string;
  }>;

  internal_movements?: Array<{
    date?: string;
    time?: string;
    from?: string;
    to?: string;
  }>;

  supervisor_makkah_phone?: string;
  supervisor_madinah_phone?: string;
  ops_24h_phone?: string;

  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
}

const dash = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

const SectionHeader = ({ en, ar }: { en: string; ar: string }) => (
  <div
    className="flex items-center justify-between mt-2 mb-1 px-2 py-1 rounded"
    style={{ background: "#0F4C3A", color: "#fff" }}
  >
    <span className="font-bold uppercase tracking-wide text-[10px]">{en}</span>
    <span dir="rtl" className="text-[10px] font-bold">{ar}</span>
  </div>
);

const Th = ({ en, ar, w }: { en: string; ar: string; w?: string }) => (
  <th
    className="border border-[#C9A96E] px-1.5 py-0.5 text-[9px] font-semibold align-middle"
    style={{ background: "#FBF3E2", color: "#0F4C3A", width: w }}
  >
    <div className="flex items-center justify-between gap-1">
      <span className="uppercase">{en}</span>
      <span dir="rtl" className="text-[8px] text-[#7a6a3e]">{ar}</span>
    </div>
  </th>
);

const Td = ({ children }: { children?: any }) => (
  <td className="border border-[#C9A96E]/60 px-1.5 py-0.5 text-[10px] align-middle">{children}</td>
);

export function TransportBookingBilingualPdf({ data: d }: { data: TransportBookingPdfData }) {
  const hotels = d.hotels && d.hotels.length ? d.hotels : [];
  const flights = d.flights && d.flights.length ? d.flights : [];
  const movements = d.internal_movements && d.internal_movements.length ? d.internal_movements : [];

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .voucher-print, .voucher-print * { visibility: visible !important; }
          .voucher-print { position: absolute !important; left: 0; top: 0; width: 100% !important; margin: 0 !important; }
          .print-hide { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <div
        className="voucher-print bg-white text-[#1a1a1a] mx-auto p-8"
        style={{
          width: "210mm",
          minHeight: "297mm",
          fontFamily: "'Manrope','Noto Naskh Arabic',sans-serif",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b-4 border-[#C9A96E] pb-3 mb-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Tuba Al Hijaz" className="h-14 w-14 object-contain" />
            <div>
              <div className="font-bold text-[18px] text-[#0F4C3A] leading-tight">Tuba Al Hijaz</div>
              <div className="text-[10px] text-gray-600">Umrah & Hajj Operations</div>
              <div className="text-[10px] text-gray-600">tubaalhijaz.com · +880 1XXX-XXXXXX</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-[16px] text-[#0F4C3A]">Transport Booking Voucher</div>
            <div dir="rtl" className="font-bold text-[14px] text-[#0F4C3A]">إيصال حجز النقل</div>
            <div className="text-[10px] text-gray-600 mt-1">
              <span className="font-mono">{d.tracking_id}</span> · {fmtDate(d.issued_at)}
            </div>
            {d.status && (
              <div
                className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] uppercase font-bold"
                style={{
                  background: d.status === "confirmed" ? "#d1fae5" : d.status === "cancelled" ? "#fee2e2" : "#fef3c7",
                  color: d.status === "confirmed" ? "#065f46" : d.status === "cancelled" ? "#991b1b" : "#92400e",
                }}
              >
                {d.status}
              </div>
            )}
          </div>
        </div>

        {/* Customer */}
        <SectionHeader en="Customer Information" ar="بيانات العميل" />
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <Th en="Full name" ar="الاسم الكامل" w="22%" />
              <Td>{dash(d.customer_name || d.contact_name)}</Td>
              <Th en="Phone" ar="الهاتف" w="22%" />
              <Td>{dash(d.customer_phone || d.contact_phone)}</Td>
            </tr>
            <tr>
              <Th en="Email" ar="البريد" />
              <Td>{dash(d.customer_email || d.contact_email)}</Td>
              <Th en="Passport" ar="جواز السفر" />
              <Td>{dash(d.customer_passport)}</Td>
            </tr>
            <tr>
              <Th en="Address" ar="العنوان" />
              <td className="border border-[#C9A96E]/60 px-2 py-1.5 text-[11px]" colSpan={3}>
                {dash(d.customer_address)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Agent / Group / Package */}
        <SectionHeader en="Group / Package" ar="المجموعة / الباقة" />
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <Th en="Agent name" ar="اسم الوكيل" w="22%" />
              <Td>{dash(d.agent_name)}</Td>
              <Th en="Agent country" ar="دولة الوكيل" w="22%" />
              <Td>{dash(d.agent_country)}</Td>
            </tr>
            <tr>
              <Th en="Umrah Company" ar="شركة العمرة" />
              <Td>{dash(d.umrah_company)}</Td>
              <Th en="Package / Program" ar="البرنامج" />
              <Td>{dash(d.package_name)}</Td>
            </tr>
            <tr>
              <Th en="Group numbers" ar="أرقام المجموعات" />
              <Td>{dash(d.group_numbers?.join(", "))}</Td>
              <Th en="Travel date" ar="تاريخ السفر" />
              <Td>{dash(d.travel_date)}</Td>
            </tr>
          </tbody>
        </table>

        {/* Hotels */}
        <SectionHeader en="Hotels" ar="الفنادق" />
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th en="City" ar="المدينة" w="14%" />
              <Th en="Hotel" ar="الفندق" />
              <Th en="Agreement No." ar="رقم الاتفاقية" w="14%" />
              <Th en="Check-in" ar="الدخول" w="11%" />
              <Th en="Check-out" ar="الخروج" w="11%" />
              <Th en="Nights" ar="الليالي" w="8%" />
              <Th en="Rooms" ar="الغرف" w="8%" />
            </tr>
          </thead>
          <tbody>
            {hotels.length === 0 && (
              <tr><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td></tr>
            )}
            {hotels.map((h, i) => (
              <tr key={i}>
                <Td>{dash(h.city)}</Td>
                <Td>{dash(h.hotel)}</Td>
                <Td>{dash(h.agreement_no)}</Td>
                <Td>{dash(h.check_in)}</Td>
                <Td>{dash(h.check_out)}</Td>
                <Td>{dash(h.nights)}</Td>
                <Td>{dash(h.rooms)}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Transport */}
        <SectionHeader en="Transport" ar="النقل" />
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <Th en="Type of transportation" ar="نوع الحافلة" w="22%" />
              <Td>{dash(d.transport_type)}</Td>
              <Th en="Number of pilgrims" ar="عدد المعتمرين" w="22%" />
              <Td>{dash(d.pilgrim_count)}</Td>
            </tr>
          </tbody>
        </table>

        {/* Flights */}
        <SectionHeader en="Flights" ar="الرحلات" />
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th en="Type" ar="النوع" w="12%" />
              <Th en="Airport" ar="المطار" />
              <Th en="Date" ar="التاريخ" w="14%" />
              <Th en="Time" ar="الوقت" w="10%" />
              <Th en="Flight No." ar="رقم الرحلة" w="14%" />
              <Th en="Airline" ar="الخطوط" />
            </tr>
          </thead>
          <tbody>
            {flights.length === 0 && (
              <tr><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td></tr>
            )}
            {flights.map((f, i) => (
              <tr key={i}>
                <Td>{dash(f.type)}</Td>
                <Td>{dash(f.airport)}</Td>
                <Td>{dash(f.date)}</Td>
                <Td>{dash(f.time)}</Td>
                <Td>{dash(f.flight_no)}</Td>
                <Td>{dash(f.airline)}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Internal Movements */}
        <SectionHeader en="Internal Movements" ar="التنقلات الداخلية" />
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th en="Date" ar="التاريخ" w="18%" />
              <Th en="Time" ar="الوقت" w="14%" />
              <Th en="From" ar="من" />
              <Th en="To" ar="إلى" />
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && (
              <tr><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td></tr>
            )}
            {movements.map((m, i) => (
              <tr key={i}>
                <Td>{dash(m.date)}</Td>
                <Td>{dash(m.time)}</Td>
                <Td>{dash(m.from)}</Td>
                <Td>{dash(m.to)}</Td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Supervisors */}
        <SectionHeader en="Supervisors / Operations" ar="المشرفون / العمليات" />
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <Th en="Makkah supervisor" ar="مشرف مكة" w="22%" />
              <Td>{dash(d.supervisor_makkah_phone)}</Td>
              <Th en="Madinah supervisor" ar="مشرف المدينة" w="22%" />
              <Td>{dash(d.supervisor_madinah_phone)}</Td>
            </tr>
            <tr>
              <Th en="Ops 24h" ar="عمليات 24 ساعة" />
              <td className="border border-[#C9A96E]/60 px-2 py-1.5 text-[11px]" colSpan={3}>
                {dash(d.ops_24h_phone)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        {d.notes && (
          <>
            <SectionHeader en="Notes" ar="ملاحظات" />
            <div className="border border-[#C9A96E]/60 p-3 text-[11px] whitespace-pre-wrap">{d.notes}</div>
          </>
        )}

        {/* Footer / Signature */}
        <div className="mt-8 pt-4 border-t-2 border-[#C9A96E] flex justify-between items-end">
          <div className="text-[9px] text-gray-600 max-w-[60%]">
            This voucher is generated by Tuba Al Hijaz operations system. هذا الإيصال صادر من نظام عمليات طوبى الحجاز.
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 w-48 pt-1 text-[10px] text-gray-700">
              Authorised Signature · التوقيع المعتمد
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
