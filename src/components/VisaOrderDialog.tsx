import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultVisaType?: string;
  defaultDestination?: string;
}

export default function VisaOrderDialog({ open, onOpenChange, defaultVisaType = "Umrah", defaultDestination = "Saudi Arabia" }: Props) {
  const { language } = useLanguage();
  const isBn = language === "bn";

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [visaType, setVisaType] = useState(defaultVisaType);
  const [destination, setDestination] = useState(defaultDestination);
  const [numApplicants, setNumApplicants] = useState(1);
  const [passportNumber, setPassportNumber] = useState("");
  const [passportExpiry, setPassportExpiry] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setSuccess(null);
    setVisaType(defaultVisaType);
    setDestination(defaultDestination);
  }, [open, defaultVisaType, defaultDestination]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim() || !visaType.trim()) {
      toast.error(isBn ? "নাম, ফোন ও ভিসা টাইপ আবশ্যক" : "Name, phone and visa type required");
      return;
    }
    setSubmitting(true);
    try {
      let uid: string | null = null;
      try {
        const { data: userData } = await (apiClient as any).auth.getUser();
        uid = userData?.user?.id || null;
      } catch {}

      const { data, error } = await (apiClient as any)
        .from("visa_orders")
        .insert({
          user_id: uid,
          contact_name: contactName,
          contact_phone: contactPhone,
          contact_email: contactEmail || null,
          visa_type: visaType,
          destination_country: destination || null,
          num_applicants: numApplicants,
          passport_number: passportNumber || null,
          passport_expiry: passportExpiry || null,
          travel_date: travelDate || null,
          return_date: returnDate || null,
          notes: notes || null,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;

      try {
        await (apiClient as any).functions.invoke("send-notification", {
          body: {
            event_type: "visa_order",
            subject: `New Visa Application — ${visaType}`,
            message: `${contactName} (${contactPhone}) applied for ${visaType} visa for ${numApplicants} applicant(s) to ${destination}.`,
            booking_ref: data?.id,
          },
        });
      } catch {}

      setSuccess((data?.tracking_id as string) || (data?.id as string)?.slice(0, 8).toUpperCase() || "OK");
      toast.success(isBn ? "আবেদন সফল হয়েছে" : "Application submitted");
    } catch (err: any) {
      toast.error(err?.message || (isBn ? "সাবমিট ব্যর্থ" : "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[96vw]">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            {isBn ? "ভিসা আবেদন" : "Visa Application"}
          </DialogTitle>
          <DialogDescription>
            {isBn ? "আপনার ভিসা প্রক্রিয়াকরণের জন্য নিচের তথ্য দিন" : "Submit your visa processing request"}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-3" />
            <h3 className="font-heading text-xl font-bold mb-1">{isBn ? "আবেদন গৃহীত!" : "Application Received!"}</h3>
            <p className="text-sm text-muted-foreground mb-3">{isBn ? "শীঘ্রই যোগাযোগ করব" : "We will contact you shortly"}</p>
            <p className="text-xs font-mono bg-secondary inline-block px-3 py-1.5 rounded">REF: {success}</p>
            <div className="mt-5">
              <Button onClick={() => onOpenChange(false)} className="w-full">{isBn ? "বন্ধ করুন" : "Close"}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isBn ? "ভিসা টাইপ" : "Visa Type"} *</Label>
                <Input value={visaType} onChange={e => setVisaType(e.target.value)} placeholder="Umrah / Hajj / Visit / Work" required />
              </div>
              <div>
                <Label>{isBn ? "গন্তব্য" : "Destination"}</Label>
                <Input value={destination} onChange={e => setDestination(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isBn ? "আবেদনকারী সংখ্যা" : "Applicants"}</Label>
                <Input type="number" min={1} value={numApplicants} onChange={e => setNumApplicants(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div>
                <Label>{isBn ? "পাসপোর্ট নম্বর" : "Passport Number"}</Label>
                <Input value={passportNumber} onChange={e => setPassportNumber(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isBn ? "পাসপোর্ট মেয়াদ" : "Passport Expiry"}</Label>
                <Input type="date" value={passportExpiry} onChange={e => setPassportExpiry(e.target.value)} />
              </div>
              <div>
                <Label>{isBn ? "ভ্রমণ তারিখ" : "Travel Date"}</Label>
                <Input type="date" value={travelDate} onChange={e => setTravelDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>{isBn ? "প্রত্যাবর্তন তারিখ" : "Return Date"}</Label>
              <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>

            <hr className="my-2" />

            <div>
              <Label>{isBn ? "নাম" : "Full Name"} *</Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isBn ? "ফোন" : "Phone"} *</Label>
                <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} required />
              </div>
              <div>
                <Label>{isBn ? "ইমেইল" : "Email"}</Label>
                <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{isBn ? "নোট" : "Notes"}</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isBn ? "সাবমিট হচ্ছে..." : "Submitting..."}</> : (isBn ? "আবেদন সাবমিট করুন" : "Submit Application")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
