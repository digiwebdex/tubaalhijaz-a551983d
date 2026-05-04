import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Phone, ChevronLeft, ChevronRight, BedDouble, Bus, UtensilsCrossed, FileCheck2, Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";

import heroHotel from "@/assets/tuba-hotel.jpg";
import heroTransport from "@/assets/tuba-transport.jpg";
import heroCatering from "@/assets/tuba-catering.jpg";
import heroVisa from "@/assets/tuba-visa.jpg";

type Slide = {
  key: string;
  image: string;
  Icon: typeof BedDouble;
  eyebrow: { en: string; bn: string };
  titleA: { en: string; bn: string };
  titleB: { en: string; bn: string };
  desc: { en: string; bn: string };
  ctaLabel: { en: string; bn: string };
  ctaTarget: string; // section id or route
};

const slides: Slide[] = [
  {
    key: "hotel",
    image: heroHotel,
    Icon: BedDouble,
    eyebrow: { en: "Hotel Booking", bn: "হোটেল বুকিং" },
    titleA: { en: "Stay steps from", bn: "হারামের পাশে" },
    titleB: { en: "the Haram", bn: "থাকুন আরামে" },
    desc: {
      en: "Handpicked hotels in Makkah & Madinah — Haram view rooms, family suites and economy options.",
      bn: "মক্কা ও মদিনায় বাছাই করা হোটেল — হারাম ভিউ রুম, ফ্যামিলি স্যুট ও ইকোনমি প্যাকেজ।",
    },
    ctaLabel: { en: "Book a Hotel", bn: "হোটেল বুক করুন" },
    ctaTarget: "services",
  },
  {
    key: "transport",
    image: heroTransport,
    Icon: Bus,
    eyebrow: { en: "Transport", bn: "ট্রান্সপোর্ট" },
    titleA: { en: "Comfort on every", bn: "প্রতিটি যাত্রায়" },
    titleB: { en: "sacred mile", bn: "নিরাপদ আরাম" },
    desc: {
      en: "Airport transfers, intercity coaches and private vehicles — Jeddah, Makkah, Madinah & Ziyarat.",
      bn: "এয়ারপোর্ট ট্রান্সফার, ইন্টারসিটি কোচ ও প্রাইভেট ভেহিকল — জেদ্দা, মক্কা, মদিনা ও জিয়ারত।",
    },
    ctaLabel: { en: "Book Transport", bn: "ট্রান্সপোর্ট বুক করুন" },
    ctaTarget: "services",
  },
  {
    key: "catering",
    image: heroCatering,
    Icon: UtensilsCrossed,
    eyebrow: { en: "Catering", bn: "ক্যাটারিং" },
    titleA: { en: "Authentic meals,", bn: "ঘরের স্বাদে" },
    titleB: { en: "served with love", bn: "হালাল ক্যাটারিং" },
    desc: {
      en: "Bangladeshi, Indian and Arabic cuisine — daily meal plans delivered fresh to your hotel.",
      bn: "বাংলাদেশি, ইন্ডিয়ান ও আরবি খাবার — প্রতিদিন তাজা মিল প্ল্যান হোটেলে পৌঁছে যাবে।",
    },
    ctaLabel: { en: "Order Meal Plan", bn: "মিল প্ল্যান অর্ডার" },
    ctaTarget: "services",
  },
  {
    key: "visa",
    image: heroVisa,
    Icon: FileCheck2,
    eyebrow: { en: "Umrah Visa", bn: "উমরাহ ভিসা" },
    titleA: { en: "Fast, hassle-free", bn: "দ্রুত ও ঝামেলাহীন" },
    titleB: { en: "Umrah visas", bn: "উমরাহ ভিসা" },
    desc: {
      en: "End-to-end Umrah visa processing with insurance, biometrics support and document review.",
      bn: "শুরু থেকে শেষ পর্যন্ত উমরাহ ভিসা প্রসেসিং — ইন্স্যুরেন্স, বায়োমেট্রিক ও ডকুমেন্ট সাপোর্ট।",
    },
    ctaLabel: { en: "Apply for Visa", bn: "ভিসার জন্য আবেদন" },
    ctaTarget: "services",
  },
];

const HeroSection = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isBn = language === "bn";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [paused]);

  const slide = slides[index];
  const next = () => setIndex((i) => (i + 1) % slides.length);
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);

  const handleCta = () => {
    document.getElementById(slide.ctaTarget)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      className="relative w-full min-h-[100vh] flex items-center overflow-hidden pt-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background images with crossfade */}
      <AnimatePresence mode="sync">
        <motion.img
          key={slide.key}
          src={slide.image}
          alt={slide.eyebrow.en}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          loading="eager"
          fetchPriority="high"
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-r from-charcoal/85 via-charcoal/55 to-charcoal/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-charcoal/30" />

      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-accent/30 blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10 py-20">
        <div className="max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.key + "-content"}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.55 }}
            >
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-primary/40 rounded-full px-4 py-2 mb-6">
                <slide.Icon className="h-4 w-4 text-primary-glow" />
                <span className="text-white text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase">
                  {isBn ? slide.eyebrow.bn : slide.eyebrow.en}
                </span>
              </div>

              <p
                className="text-primary-glow text-2xl md:text-3xl mb-3 leading-tight"
                style={{ fontFamily: "var(--font-arabic)", direction: "rtl" }}
              >
                طُوبَى الْحِجَاز
              </p>

              <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-6">
                {isBn ? slide.titleA.bn : slide.titleA.en}{" "}
                <span className="text-gradient-sunset italic">
                  {isBn ? slide.titleB.bn : slide.titleB.en}
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-white/90 max-w-2xl leading-relaxed mb-10">
                {isBn ? slide.desc.bn : slide.desc.en}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={handleCta}
                  className="group inline-flex items-center gap-2 bg-gradient-sunset text-white font-semibold px-8 py-4 rounded-full shadow-gold hover:shadow-glow transition-all hover:scale-105"
                >
                  {isBn ? slide.ctaLabel.bn : slide.ctaLabel.en}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <a
                  href="tel:+966534919814"
                  className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/40 text-white font-semibold px-8 py-4 rounded-full hover:bg-white/20 transition-all"
                >
                  <Phone className="h-4 w-4" />
                  +966 53 491 9814
                </a>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Service tab pills */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            {slides.map((s, i) => {
              const Icon = s.Icon;
              const active = i === index;
              return (
                <button
                  key={s.key}
                  onClick={() => setIndex(i)}
                  className={`group relative overflow-hidden rounded-2xl border text-left p-4 transition-all backdrop-blur-md ${
                    active
                      ? "border-primary/70 bg-white/15 shadow-gold scale-[1.02]"
                      : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        active ? "bg-gradient-sunset text-white" : "bg-white/10 text-primary-glow"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-white/60">
                        0{i + 1}
                      </div>
                      <div className="text-white font-semibold text-sm leading-tight">
                        {isBn ? s.eyebrow.bn : s.eyebrow.en}
                      </div>
                    </div>
                  </div>
                  {active && (
                    <motion.div
                      layoutId="hero-active-bar"
                      className="absolute bottom-0 left-0 h-1 bg-gradient-sunset"
                      initial={{ width: "0%" }}
                      animate={{ width: paused ? "100%" : "100%" }}
                      transition={{ duration: paused ? 0 : 6, ease: "linear" }}
                      key={slide.key + "-bar"}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Arrows */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white transition-all"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white transition-all"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-background pointer-events-none" />
    </section>
  );
};

export default HeroSection;
