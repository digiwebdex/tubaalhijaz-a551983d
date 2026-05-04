import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Play, X, ChevronLeft, ChevronRight, Image as ImageIcon, Video } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

import g1 from "@/assets/gallery/transport-gmc.jpg";
import g2 from "@/assets/gallery/transport-hiace.jpg";
import g3 from "@/assets/gallery/transport-bus-interior.jpg";
import g4 from "@/assets/gallery/transport-airport.jpg";
import g5 from "@/assets/gallery/transport-driver.jpg";
import g6 from "@/assets/gallery/transport-ziyarat.jpg";

export type GalleryItem = {
  type: "image" | "video";
  src: string;
  thumb?: string;
  title: { en: string; bn: string };
  category: "fleet" | "service" | "tour";
  /** YouTube video id for type=video */
  videoId?: string;
};

const defaultItems: GalleryItem[] = [
  { type: "image", src: g1, title: { en: "GMC Yukon — Premium SUV", bn: "GMC ইউকন — প্রিমিয়াম SUV" }, category: "fleet" },
  { type: "image", src: g2, title: { en: "Toyota Hiace — Group Travel", bn: "টয়োটা হায়েস — গ্রুপ ট্রাভেল" }, category: "fleet" },
  { type: "video", src: g3, thumb: g3, videoId: "5qap5aO4i9A", title: { en: "Inside Our 50-Seater Coach", bn: "৫০-সিটার কোচের ভেতরে" }, category: "fleet" },
  { type: "image", src: g4, title: { en: "Jeddah Airport Pickup", bn: "জেদ্দা এয়ারপোর্ট পিকআপ" }, category: "service" },
  { type: "image", src: g5, title: { en: "Licensed Chauffeurs", bn: "লাইসেন্সধারী চালক" }, category: "service" },
  { type: "video", src: g6, thumb: g6, videoId: "M7lc1UVf-VE", title: { en: "Madinah Ziyarat Tour", bn: "মদিনা জিয়ারত ট্যুর" }, category: "tour" },
];

const categories = [
  { key: "all", en: "All", bn: "সব" },
  { key: "fleet", en: "Fleet", bn: "ফ্লিট" },
  { key: "service", en: "Service", bn: "সার্ভিস" },
  { key: "tour", en: "Tours", bn: "ট্যুর" },
] as const;

interface Props {
  items?: GalleryItem[];
  title?: { en: string; bn: string };
  subtitle?: { en: string; bn: string };
}

export default function ServiceGallery({ items = defaultItems, title, subtitle }: Props) {
  const { language } = useLanguage();
  const isBn = language === "bn";
  const [filter, setFilter] = useState<(typeof categories)[number]["key"]>("all");
  const [active, setActive] = useState<number | null>(null);

  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);

  const next = () => setActive((a) => (a === null ? a : (a + 1) % filtered.length));
  const prev = () => setActive((a) => (a === null ? a : (a - 1 + filtered.length) % filtered.length));

  return (
    <section className="py-20 bg-background relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-transparent to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-flex items-center gap-2 text-primary text-xs font-bold tracking-[0.3em] uppercase">
            <ImageIcon className="h-3.5 w-3.5" />
            {isBn ? "গ্যালারি" : "Gallery"}
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mt-2 mb-3">
            {isBn ? (title?.bn ?? "আমাদের সার্ভিসের ঝলক") : (title?.en ?? "A glimpse of our service")}
          </h2>
          <p className="text-muted-foreground">
            {isBn
              ? (subtitle?.bn ?? "আমাদের ফ্লিট, চালক ও পথের গল্প — ছবি এবং ভিডিওতে।")
              : (subtitle?.en ?? "Our fleet, our drivers and the journeys we craft — in pictures and videos.")}
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((c) => {
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`relative px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  active
                    ? "bg-gradient-sunset text-white shadow-gold"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}
              >
                {isBn ? c.bn : c.en}
                {active && (
                  <motion.div layoutId="gallery-filter-bg" className="absolute inset-0 rounded-full bg-gradient-sunset -z-10" />
                )}
              </button>
            );
          })}
        </div>

        {/* Masonry grid */}
        <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[180px] md:auto-rows-[220px]">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, i) => {
              // Vary tile sizes for visual interest
              const span = i % 5 === 0 ? "md:col-span-2 md:row-span-2" : i % 7 === 3 ? "md:row-span-2" : "";
              return (
                <motion.button
                  layout
                  key={item.src + i}
                  onClick={() => setActive(i)}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  whileHover={{ y: -4 }}
                  className={`group relative overflow-hidden rounded-2xl bg-card border border-border ${span}`}
                >
                  <img
                    src={item.thumb || item.src}
                    alt={isBn ? item.title.bn : item.title.en}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/20 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

                  {/* Video play indicator */}
                  {item.type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative">
                        <span className="absolute inset-0 rounded-full bg-primary/40 blur-xl animate-pulse" />
                        <div className="relative h-14 w-14 rounded-full bg-white/95 flex items-center justify-center shadow-luxury group-hover:scale-110 transition-transform">
                          <Play className="h-6 w-6 text-primary ml-1" fill="currentColor" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Title bar */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-white border border-white/20">
                        {item.type === "video" ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                        {item.type.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold text-sm md:text-base mt-1.5 line-clamp-1">
                      {isBn ? item.title.bn : item.title.en}
                    </h3>
                  </div>

                  {/* Shine sweep on hover */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                </motion.button>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Lightbox */}
      <Dialog open={active !== null} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-5xl p-0 bg-charcoal border-charcoal/40 overflow-hidden">
          {active !== null && filtered[active] && (
            <div className="relative">
              <button
                onClick={() => setActive(null)}
                aria-label="Close"
                className="absolute top-3 right-3 z-30 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={prev}
                aria-label="Previous"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-30 h-11 w-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={next}
                aria-label="Next"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-30 h-11 w-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              <div className="aspect-video bg-black flex items-center justify-center">
                {filtered[active].type === "video" && filtered[active].videoId ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${filtered[active].videoId}?autoplay=1&rel=0`}
                    title={filtered[active].title.en}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <img
                    src={filtered[active].src}
                    alt={isBn ? filtered[active].title.bn : filtered[active].title.en}
                    className="max-h-[80vh] w-auto object-contain"
                  />
                )}
              </div>
              <div className="p-4 text-center text-white">
                <p className="font-semibold">{isBn ? filtered[active].title.bn : filtered[active].title.en}</p>
                <p className="text-xs text-white/60 mt-1">{active + 1} / {filtered.length}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
