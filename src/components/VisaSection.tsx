import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileCheck, Plane, Globe2 } from "lucide-react";
import VisaOrderDialog from "@/components/VisaOrderDialog";
import { useLanguage } from "@/i18n/LanguageContext";

const VisaSection = () => {
  const [open, setOpen] = useState(false);
  const [defaultType, setDefaultType] = useState("Umrah");
  const { language } = useLanguage();
  const isBn = language === "bn";

  const visaTypes = [
    { id: "Umrah", labelEn: "Umrah Visa", labelBn: "উমরাহ ভিসা", icon: Plane, desc: isBn ? "একক বা গ্রুপের জন্য উমরাহ ভিসা প্রক্রিয়াকরণ" : "Single or group umrah visa processing" },
    { id: "Hajj", labelEn: "Hajj Visa", labelBn: "হজ্জ ভিসা", icon: Globe2, desc: isBn ? "অফিসিয়াল হজ্জ ভিসা সাপোর্ট" : "Official Hajj visa support" },
    { id: "Visit", labelEn: "Visit Visa", labelBn: "ভিজিট ভিসা", icon: FileCheck, desc: isBn ? "পরিবার ও পর্যটন ভিজিট ভিসা" : "Family & tourism visit visa" },
  ];

  return (
    <section id="visa" className="py-16 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-2">
            {isBn ? "ভিসা প্রসেসিং" : "Visa Processing"}
          </h2>
          <p className="text-muted-foreground">
            {isBn ? "দ্রুত ও নির্ভরযোগ্য ভিসা সেবা" : "Fast and reliable visa service"}
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {visaTypes.map(v => {
            const Icon = v.icon;
            return (
              <Card key={v.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <Icon className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h3 className="font-heading font-semibold text-lg mb-1">{isBn ? v.labelBn : v.labelEn}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{v.desc}</p>
                  <Button onClick={() => { setDefaultType(v.id); setOpen(true); }} className="w-full">
                    {isBn ? "আবেদন করুন" : "Apply Now"}
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
