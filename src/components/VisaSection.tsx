import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileCheck, Plane, Globe2 } from "lucide-react";
import VisaOrderDialog from "@/components/VisaOrderDialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { useBulkSiteContent } from "@/hooks/useSiteContentProvider";

const ICONS: Record<string, any> = { Plane, Globe2, FileCheck };

const VisaSection = () => {
  const [open, setOpen] = useState(false);
  const [defaultType, setDefaultType] = useState("Umrah");
  const { language } = useLanguage();
  const isBn = language === "bn";
  const { data: cms } = useBulkSiteContent("visa");
  const lc = cms?.[language];

  const heading = lc?.heading || (isBn ? "ভিসা প্রসেসিং" : "Visa Processing");
  const description = lc?.description || (isBn ? "দ্রুত ও নির্ভরযোগ্য ভিসা সেবা" : "Fast and reliable visa service");
  const applyText = lc?.apply_button_text || (isBn ? "আবেদন করুন" : "Apply Now");

  const fallback = [
    { id: "Umrah", icon: "Plane", label: isBn ? "উমরাহ ভিসা" : "Umrah Visa", desc: isBn ? "একক বা গ্রুপের জন্য উমরাহ ভিসা প্রক্রিয়াকরণ" : "Single or group umrah visa processing" },
    { id: "Hajj", icon: "Globe2", label: isBn ? "হজ্জ ভিসা" : "Hajj Visa", desc: isBn ? "অফিসিয়াল হজ্জ ভিসা সাপোর্ট" : "Official Hajj visa support" },
    { id: "Visit", icon: "FileCheck", label: isBn ? "ভিজিট ভিসা" : "Visit Visa", desc: isBn ? "পরিবার ও পর্যটন ভিজিট ভিসা" : "Family & tourism visit visa" },
  ];

  const cmsItems = lc?.items;
  const visaTypes = Array.isArray(cmsItems) && cmsItems.length
    ? cmsItems.map((it: any, i: number) => ({
        id: it.id || fallback[i % fallback.length].id,
        icon: it.icon || fallback[i % fallback.length].icon,
        label: it.label,
        desc: it.desc,
      }))
    : fallback;

  return (
    <section id="visa" className="py-16 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-2">{heading}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {visaTypes.map((v: any) => {
            const Icon = ICONS[v.icon] || Plane;
            return (
              <Card key={v.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <Icon className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h3 className="font-heading font-semibold text-lg mb-1">{v.label}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{v.desc}</p>
                  <Button onClick={() => { setDefaultType(v.id); setOpen(true); }} className="w-full">
                    {applyText}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <VisaOrderDialog open={open} onOpenChange={setOpen} defaultVisaType={defaultType} />
    </section>
  );
};

export default VisaSection;
