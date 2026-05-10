import { useEffect, useState } from "react";
import QRCode from "qrcode";
import logo from "@/assets/tuba-logo.png";

export interface BilingualInvoiceData {
  invoice_no: string;
  issued_at?: string;
  due_date?: string;
  // Customer
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  passport_no?: string;
  // Package / service
  package_name?: string;
  package_name_ar?: string;
  travel_date?: string;
  return_date?: string;
  num_travelers?: number;
  // Lines
  items?: Array<{
    description_en: string;
    description_ar?: string;
    qty: number;
    unit_price: number;
  }>;
  // Totals (BDT)
  subtotal: number;
  discount?: number;
  vat?: number;
  total: number;
  paid?: number;
  due?: number;
  // Currency conversion
  sar_rate?: number; // 1 SAR = ? BDT
  notes?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

export function BilingualInvoicePdf({ data: d }: { data: BilingualInvoiceData }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/verify-invoice/${d.invoice_no}`, {
      width: 140, margin: 1, color: { dark: "#0F4C3A", light: "#ffffff" },
    }).then(setQr).catch(() => {});
  }, [d.invoice_no]);

  const items = d.items?.length
    ? d.items
    : [{
        description_en: d.package_name || "Umrah Package",
        description_ar: d.package_name_ar || "باقة العمرة",
        qty: d.num_travelers || 1,
        unit_price: d.subtotal / Math.max(1, d.num_travelers || 1),
      }];

  const sarRate = d.sar_rate || 32; // approx
  const totalSAR = d.total / sarRate;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .invoice-print, .invoice-print * { visibility: visible !important; }
          .invoice-print { position: absolute !important; left: 0; top: 0; width: 100% !important; margin: 0 !important; }
          .print-hide { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="invoice-print bg-white text-[#1a1a1a] p-8 mx-auto"
        style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Manrope','Noto Naskh Arabic',sans-serif" }}>
        {/* Header */}
        <div className="flex items-start justify-between border-b-4 border-[#C9A96E] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Tuba Al Hijaz" className="h-16 w-16 object-contain" />
            <div>
              <div className="text-2xl font-bold text-[#0F4C3A]" style={{ fontFamily: "'Cormorant Garamond',serif" }}>
                Tuba Al Hijaz
              </div>
              <div className="text-xs text-gray-600">Travel & Tourism — Umrah & Hajj</div>
              <div className="text-[10px] text-gray-500">Dhaka · Makkah · Madinah · Jeddah</div>
              <div className="text-[10px] text-gray-500 mt-1">tubaalhijaz.com · +880 ----</div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-[#0F4C3A] text-white px-4 py-2 rounded">
              <div className="text-[10px] uppercase tracking-widest opacity-80">Tax Invoice</div>
              <div className="text-lg font-bold tracking-wider" dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>
                فاتورة ضريبية
              </div>
            </div>
            <div className="text-xs mt-2 font-mono font-bold text-[#C9A96E]">{d.invoice_no}</div>
            <div className="text-[10px] text-gray-500">Issued / تاريخ: {fmtDate(d.issued_at)}</div>
            {d.due_date && <div className="text-[10px] text-gray-500">Due / الاستحقاق: {fmtDate(d.due_date)}</div>}
          </div>
        </div>

        {/* Customer + QR */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2 border border-gray-200 rounded p-3">
            <div className="flex justify-between text-[11px] text-[#0F4C3A] font-bold uppercase mb-2 border-b border-gray-200 pb-1">
              <span>Bill To</span>
              <span dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>إلى السيد / السيدة</span>
            </div>
            <div className="text-sm font-bold">{d.customer_name || "—"}</div>
            <div className="text-[11px] text-gray-600">{d.customer_phone || ""} {d.customer_email ? ` · ${d.customer_email}` : ""}</div>
            {d.customer_address && <div className="text-[11px] text-gray-500">{d.customer_address}</div>}
            {d.passport_no && (
              <div className="text-[11px] mt-1">
                <span className="font-semibold">Passport / جواز السفر:</span> {d.passport_no}
              </div>
            )}
            {(d.travel_date || d.return_date) && (
              <div className="text-[11px] mt-1 flex gap-3">
                <span><strong>Travel / السفر:</strong> {fmtDate(d.travel_date)}</span>
                <span><strong>Return / العودة:</strong> {fmtDate(d.return_date)}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded p-2">
            {qr && <img src={qr} alt="QR" className="w-28 h-28" />}
            <div className="text-[9px] text-gray-500 mt-1 text-center">Scan to verify<br/>امسح للتحقق</div>
          </div>
        </div>

        {/* Items */}
        <table className="w-full text-[11px] border border-gray-300 mb-4">
          <thead className="bg-gradient-to-r from-[#0F4C3A] to-[#1a6b50] text-white">
            <tr>
              <th className="p-2 text-center w-8">#</th>
              <th className="p-2 text-left">Description / الوصف</th>
              <th className="p-2 text-center w-16">Qty<br/>الكمية</th>
              <th className="p-2 text-right w-28">Unit (BDT)<br/>السعر</th>
              <th className="p-2 text-right w-28">Total (BDT)<br/>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-gray-200">
                <td className="p-2 text-center font-bold text-[#C9A96E]">{i + 1}</td>
                <td className="p-2">
                  <div className="font-semibold">{it.description_en}</div>
                  {it.description_ar && (
                    <div className="text-gray-500 text-[10px]" dir="rtl"
                      style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>{it.description_ar}</div>
                  )}
                </td>
                <td className="p-2 text-center">{it.qty}</td>
                <td className="p-2 text-right tabular-nums">{fmt(it.unit_price)}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{fmt(it.qty * it.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <table className="text-[11px] w-80 border border-gray-300">
            <tbody>
              <TotRow en="Subtotal" ar="المجموع الفرعي" v={d.subtotal} />
              {!!d.discount && <TotRow en="Discount" ar="الخصم" v={-d.discount} />}
              {!!d.vat && <TotRow en="VAT" ar="ضريبة القيمة المضافة" v={d.vat} />}
              <tr className="bg-[#0F4C3A] text-white">
                <td className="p-2 font-bold">TOTAL / الإجمالي</td>
                <td className="p-2 text-right tabular-nums font-bold">৳ {fmt(d.total)}</td>
              </tr>
              <tr className="bg-amber-50">
                <td className="p-1.5 text-[10px] text-gray-600">≈ SAR (1 SAR = ৳{sarRate})</td>
                <td className="p-1.5 text-right tabular-nums text-[10px]">SAR {fmt(totalSAR)}</td>
              </tr>
              {d.paid !== undefined && <TotRow en="Paid" ar="المدفوع" v={d.paid} cls="text-green-700" />}
              {d.due !== undefined && d.due > 0 && (
                <tr className="border-t-2 border-[#C9A96E] bg-red-50">
                  <td className="p-2 font-bold text-red-700">Balance Due / الرصيد المستحق</td>
                  <td className="p-2 text-right tabular-nums font-bold text-red-700">৳ {fmt(d.due)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {d.notes && (
          <div className="mb-4 p-2 bg-amber-50 border-l-4 border-[#C9A96E] text-[11px]">
            <strong>Notes / ملاحظات:</strong> {d.notes}
          </div>
        )}

        <div className="text-[10px] text-gray-600 border border-gray-200 rounded p-2 mb-4">
          <strong>Terms / الشروط:</strong> All payments are non-refundable after visa issuance. ·
          جميع المدفوعات غير قابلة للاسترداد بعد إصدار التأشيرة. · Bookings governed by Saudi Ministry of Hajj rules.
        </div>

        {/* Footer */}
        <div className="border-t-2 border-[#C9A96E] pt-3 mt-6 grid grid-cols-3 gap-4 text-center text-[10px] text-gray-600">
          <Sig en="Prepared By" ar="أعدّ بواسطة" />
          <Sig en="Authorized Signature" ar="توقيع معتمد" />
          <Sig en="Customer Acknowledgement" ar="إقرار العميل" />
        </div>

        <div className="mt-4 text-center text-[9px] text-gray-400">
          tubaalhijaz.com · Computer-generated invoice · فاتورة صادرة إلكترونياً
        </div>
      </div>
    </>
  );
}

function TotRow({ en, ar, v, cls = "" }: { en: string; ar: string; v: number; cls?: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className={`p-1.5 ${cls}`}>
        <span className="font-semibold">{en}</span>
        <span className="text-gray-400 mx-1">/</span>
        <span dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>{ar}</span>
      </td>
      <td className={`p-1.5 text-right tabular-nums ${cls}`}>৳ {fmt(v)}</td>
    </tr>
  );
}

function Sig({ en, ar }: { en: string; ar: string }) {
  return (
    <div>
      <div className="border-b border-gray-400 mx-auto w-32 h-10"></div>
      <div className="mt-1">{en}</div>
      <div dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic',serif" }}>{ar}</div>
    </div>
  );
}
