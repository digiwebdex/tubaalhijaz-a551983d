import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BilingualInvoicePdf, type BilingualInvoiceData } from "@/components/admin/BilingualInvoicePdf";
import { buildServiceInvoiceData } from "@/lib/serviceInvoiceBuilder";

export default function AdminBilingualInvoicePage() {
  const { id } = useParams();
  const [data, setData] = useState<BilingualInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      const invoice = await buildServiceInvoiceData("booking", id);
      setData(invoice);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading invoice...</div>;
  if (!data) return <div className="p-12 text-center text-muted-foreground">Invoice not found.</div>;

  return (
    <div className="bg-gray-100 min-h-screen py-6">
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center px-4 print-hide">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/invoices"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <Button onClick={() => window.print()} size="sm" className="bg-[#0F4C3A] hover:bg-[#1a6b50]">
          <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
      </div>
      <div className="shadow-2xl">
        <BilingualInvoicePdf data={data} />
      </div>
    </div>
  );
}
