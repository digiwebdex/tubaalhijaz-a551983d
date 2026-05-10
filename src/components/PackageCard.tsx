import { motion } from "framer-motion";
import { ArrowRight, Clock, Star, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { requireCustomerLogin } from "@/lib/bookingAuth";
import heroImage from "@/assets/hero-kaaba-golden.jpg";
import medinaImage from "@/assets/hero-medina.jpg";

const fallbackImages = [heroImage, medinaImage];

const TYPE_DISPLAY: Record<string, { en: string; bn: string }> = {
  hajj: { en: "Hajj", bn: "হজ্জ" },
  umrah: { en: "Umrah", bn: "উমরাহ" },
  tour: { en: "Tour", bn: "ট্যুর" },
  visa: { en: "Visa", bn: "ভিসা" },
  air_ticket: { en: "Air Ticket", bn: "এয়ার টিকেট" },
  hotel: { en: "Hotel", bn: "হোটেল" },
  transport: { en: "Transport", bn: "পরিবহন" },
  ziyara: { en: "Ziyara", bn: "জিয়ারত" },
};

export interface PackageCardProps {
  pkg: any;
  index?: number;
  onBook?: (pkg: any) => void;
}

const PackageCard = ({ pkg, index = 0, onBook }: PackageCardProps) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const features: string[] = Array.isArray(pkg.features) ? pkg.features : [];
  const services: string[] = Array.isArray(pkg.services) ? pkg.services : [];
  const rating = Number(pkg.rating ?? 4.9).toFixed(1);
  const highlightTag = pkg.highlight_tag?.trim();
  const typeLabel = TYPE_DISPLAY[pkg.type]?.[language] || pkg.type;

  const handleBook = async () => {
    if (onBook) onBook(pkg);
    else {
      const bookingPath = `/booking?package=${pkg.id}`;
      if (await requireCustomerLogin(navigate, bookingPath)) navigate(bookingPath);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className="relative rounded-2xl overflow-hidden bg-card border-2 border-border/60 flex flex-col group hover:border-primary/40 hover:shadow-elevated hover:-translate-y-1 transition-all duration-500"
    >
      {/* Image header */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "16/10" }}>
        <img
          src={pkg.image_url || fallbackImages[index % fallbackImages.length]}
          alt={pkg.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/20" />

        {/* Top-left: type badge */}
        <div className="absolute top-3 left-3">
          <span className="bg-gradient-gold text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full capitalize shadow-lg">
            {typeLabel}
          </span>
        </div>

        {/* Top-right: highlight tag + rating */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {highlightTag && (
            <span className="bg-white text-foreground text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md">
              ★ {highlightTag}
            </span>
          )}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full shadow-md">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span className="text-xs font-bold text-foreground">{rating}</span>
          </div>
        </div>

        {/* Bottom: title + price overlay for clear readability */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-heading text-lg md:text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] line-clamp-2 mb-2">
            {pkg.name}
          </h3>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl md:text-3xl font-heading font-extrabold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] leading-none">
                ৳{Number(pkg.price).toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-white/95 mt-1 font-medium drop-shadow-md">/ {t("packages.perPerson")}</p>
            </div>
            {pkg.duration_days && (
              <span className="inline-flex items-center gap-1 bg-white/95 text-foreground text-xs font-bold px-2.5 py-1.5 rounded-full shadow-md">
                <Clock className="h-3.5 w-3.5" />
                {pkg.duration_days} {t("common.days")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-5 flex-1 flex flex-col bg-card">
        {features.length > 0 && (
          <ul className="space-y-2 mb-4">
            {features.slice(0, 4).map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-snug">
                <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
                </span>
                <span className="line-clamp-2">{f}</span>
              </li>
            ))}
          </ul>
        )}

        {services.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {services.slice(0, 4).map((s, i) => (
              <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold border border-primary/20">
                {s}
              </span>
            ))}
          </div>
        )}

        {pkg.description && features.length === 0 && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{pkg.description}</p>
        )}

        <button
          onClick={handleBook}
          className="w-full py-3 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 bg-gradient-gold text-primary-foreground hover:opacity-90 hover:shadow-gold transition-all duration-300 mt-auto group/btn"
        >
          {t("packages.bookNow")} <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.article>
  );
};

export default PackageCard;
