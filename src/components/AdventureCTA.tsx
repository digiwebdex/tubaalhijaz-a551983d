import { motion } from "framer-motion";
import { Plane, Globe2, Heart, Star, Compass } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMemo } from "react";
import { useBulkSiteContent } from "@/hooks/useSiteContentProvider";

/**
 * Live Global Flight Map
 * - Stylized SVG world map (equirectangular projection)
 * - Origin: Dhaka, Bangladesh (lon 90.4, lat 23.8)
 * - Animated arcs + planes flying from Dhaka to popular destinations
 */

// Equirectangular projection helpers (viewBox 1000 x 500)
const project = (lon: number, lat: number) => {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x, y };
};

const ORIGIN = { name: "Dhaka", lon: 90.4, lat: 23.8 };

const DESTINATIONS = [
  { code: "MAK", labelEn: "Makkah", labelBn: "মক্কা", emoji: "🕋", lon: 39.8, lat: 21.4 },
  { code: "MED", labelEn: "Madinah", labelBn: "মদিনা", emoji: "🌙", lon: 39.6, lat: 24.5 },
  { code: "DXB", labelEn: "Dubai", labelBn: "দুবাই", emoji: "🏙️", lon: 55.3, lat: 25.2 },
  { code: "DOH", labelEn: "Doha", labelBn: "দোহা", emoji: "🌇", lon: 51.5, lat: 25.3 },
  { code: "RUH", labelEn: "Riyadh", labelBn: "রিয়াদ", emoji: "🕍", lon: 46.7, lat: 24.7 },
  { code: "IST", labelEn: "Istanbul", labelBn: "ইস্তাম্বুল", emoji: "🕌", lon: 28.9, lat: 41.0 },
  { code: "CAI", labelEn: "Cairo", labelBn: "কায়রো", emoji: "🐫", lon: 31.2, lat: 30.0 },
  { code: "KUL", labelEn: "Kuala Lumpur", labelBn: "কুয়ালালামপুর", emoji: "🌴", lon: 101.7, lat: 3.1 },
  { code: "SIN", labelEn: "Singapore", labelBn: "সিঙ্গাপুর", emoji: "🦁", lon: 103.8, lat: 1.35 },
  { code: "BKK", labelEn: "Bangkok", labelBn: "ব্যাংকক", emoji: "🛕", lon: 100.5, lat: 13.75 },
  { code: "DEL", labelEn: "Delhi", labelBn: "দিল্লি", emoji: "🛺", lon: 77.2, lat: 28.6 },
  { code: "HKG", labelEn: "Hong Kong", labelBn: "হংকং", emoji: "🏯", lon: 114.2, lat: 22.3 },
  { code: "ICN", labelEn: "Seoul", labelBn: "সিউল", emoji: "🏮", lon: 126.97, lat: 37.57 },
  { code: "NRT", labelEn: "Tokyo", labelBn: "টোকিও", emoji: "🗼", lon: 139.7, lat: 35.7 },
  { code: "SYD", labelEn: "Sydney", labelBn: "সিডনি", emoji: "🦘", lon: 151.2, lat: -33.87 },
  { code: "LHR", labelEn: "London", labelBn: "লন্ডন", emoji: "🎡", lon: -0.1, lat: 51.5 },
  { code: "CDG", labelEn: "Paris", labelBn: "প্যারিস", emoji: "🗼", lon: 2.35, lat: 48.85 },
  { code: "FRA", labelEn: "Frankfurt", labelBn: "ফ্রাঙ্কফুর্ট", emoji: "🏰", lon: 8.68, lat: 50.11 },
  { code: "JFK", labelEn: "New York", labelBn: "নিউইয়র্ক", emoji: "🗽", lon: -74.0, lat: 40.7 },
  { code: "YYZ", labelEn: "Toronto", labelBn: "টরন্টো", emoji: "🍁", lon: -79.4, lat: 43.65 },
];

// Build a quadratic bezier arc between two projected points (curving "up" toward equator-side)
const buildArc = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // perpendicular offset, curve upward (negative y in SVG)
  const nx = -dy / dist;
  const ny = dx / dist;
  const curvature = Math.min(dist * 0.25, 90);
  // ensure curve bows upward (toward smaller y)
  const sign = ny < 0 ? 1 : -1;
  const cx = mx + nx * curvature * sign;
  const cy = my + ny * curvature * sign;
  return { d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, cx, cy };
};

const AdventureCTA = () => {
  const { language } = useLanguage();
  const isBn = language === "bn";
  const { data: cms } = useBulkSiteContent("adventure_cta");
  const lc = cms?.[language];
  const badgeText = lc?.badge_text || (isBn ? "লাইভ ফ্লাইট নেটওয়ার্ক" : "Live Flight Network");
  const originText = lc?.origin_text || (isBn ? "ঢাকা থেকে" : "From Dhaka, BD");
  const originLabel = lc?.origin_label || (isBn ? "ঢাকা" : "DHAKA");

  const origin = useMemo(() => project(ORIGIN.lon, ORIGIN.lat), []);
  const routes = useMemo(
    () =>
      DESTINATIONS.map((d) => {
        const p = project(d.lon, d.lat);
        const arc = buildArc(origin.x, origin.y, p.x, p.y);
        return { ...d, x: p.x, y: p.y, ...arc };
      }),
    [origin]
  );

  const stats = [
    { icon: Globe2, value: "25+", label: isBn ? "গন্তব্য" : "Destinations" },
    { icon: Heart, value: "10K+", label: isBn ? "খুশি যাত্রী" : "Happy Travelers" },
    { icon: Star, value: "4.9", label: isBn ? "রেটিং" : "Rating" },
    { icon: Compass, value: "12+", label: isBn ? "অভিজ্ঞতা" : "Years Exp." },
  ];

  return (
    <div className="relative w-full max-w-7xl mx-auto px-2 md:px-4">
      {/* Map container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="relative bg-[hsl(var(--teal-dark))]/40 backdrop-blur-sm border border-white/15 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header chip */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-white text-[11px] md:text-xs font-semibold tracking-wide">
            {badgeText}
          </span>
        </div>

        {/* Origin badge */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-[hsl(var(--gold))]/90 backdrop-blur-md rounded-full px-3 py-1.5 shadow-gold">
          <Plane className="h-3.5 w-3.5 text-white" />
          <span className="text-white text-[11px] md:text-xs font-bold">
            {originText}
          </span>
        </div>

        <svg
          viewBox="0 0 1000 500"
          className="w-full h-auto block min-h-[420px] md:min-h-[560px] lg:min-h-[640px]"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Background gradient */}
            <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="hsl(var(--teal))" stopOpacity="0.45" />
              <stop offset="100%" stopColor="hsl(var(--teal-dark))" stopOpacity="0.85" />
            </radialGradient>

            {/* Arc gradient */}
            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity="0.2" />
              <stop offset="50%" stopColor="hsl(var(--gold))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0.2" />
            </linearGradient>

            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Dot pattern for "land" texture */}
            <pattern id="dots" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="0.9" fill="hsl(var(--gold))" fillOpacity="0.55" />
            </pattern>
          </defs>

          {/* Background */}
          <rect width="1000" height="500" fill="url(#bgGrad)" />

          {/* Subtle grid */}
          <g stroke="hsl(var(--gold))" strokeOpacity="0.06" strokeWidth="0.5">
            {Array.from({ length: 19 }).map((_, i) => (
              <line key={`v${i}`} x1={(i + 1) * 50} y1={0} x2={(i + 1) * 50} y2={500} />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={(i + 1) * 50} x2={1000} y2={(i + 1) * 50} />
            ))}
          </g>

          {/* Stylized continents (simplified silhouettes) — dotted style */}
          <g fill="url(#dots)">
            {/* North America */}
            <path d="M 120 110 L 230 95 L 290 130 L 310 200 L 260 260 L 200 280 L 150 260 L 110 200 Z" />
            {/* South America */}
            <path d="M 270 290 L 320 285 L 340 360 L 310 430 L 280 420 L 265 360 Z" />
            {/* Europe */}
            <path d="M 470 110 L 540 100 L 565 145 L 540 175 L 490 175 L 465 150 Z" />
            {/* Africa */}
            <path d="M 490 200 L 580 195 L 605 280 L 575 360 L 530 380 L 500 320 L 485 250 Z" />
            {/* Middle East / W. Asia */}
            <path d="M 565 175 L 640 170 L 660 220 L 620 245 L 580 230 Z" />
            {/* South + East Asia */}
            <path d="M 660 175 L 780 165 L 830 200 L 820 245 L 760 260 L 700 250 L 665 215 Z" />
            {/* SE Asia / Indonesia */}
            <path d="M 780 270 L 850 265 L 870 295 L 820 315 L 780 305 Z" />
            {/* Australia */}
            <path d="M 820 340 L 900 335 L 915 380 L 870 400 L 825 385 Z" />
          </g>

          {/* Flight arcs */}
          {routes.map((r, i) => (
            <g key={r.code}>
              <path
                d={r.d}
                fill="none"
                stroke="url(#arcGrad)"
                strokeWidth="1.4"
                strokeOpacity="0.55"
                strokeDasharray="3 4"
              />
              {/* Animated plane along path */}
              <g filter="url(#glow)">
                <g>
                  <circle r="3" fill="hsl(var(--gold))">
                    <animateMotion
                      dur={`${5 + (i % 4)}s`}
                      repeatCount="indefinite"
                      begin={`${i * 0.6}s`}
                      path={r.d}
                      rotate="auto"
                    />
                  </circle>
                  {/* Tiny plane glyph */}
                  <g>
                    <path
                      d="M -5 0 L 5 0 M 0 -2 L 0 2 M 3 -1 L 3 1"
                      stroke="white"
                      strokeWidth="1"
                      strokeLinecap="round"
                      fill="none"
                    >
                      <animateMotion
                        dur={`${5 + (i % 4)}s`}
                        repeatCount="indefinite"
                        begin={`${i * 0.6}s`}
                        path={r.d}
                        rotate="auto"
                      />
                    </path>
                  </g>
                </g>
              </g>
            </g>
          ))}

          {/* Destination markers */}
          {routes.map((r, i) => {
            // Alternate label above/below to reduce overlap in dense regions
            const above = i % 2 === 0;
            const labelY = above ? r.y - 10 : r.y + 16;
            return (
            <g key={`d-${r.code}`}>
              {/* pulse */}
              <circle cx={r.x} cy={r.y} r="4" fill="hsl(var(--gold))" opacity="0.9">
                <animate
                  attributeName="r"
                  values="4;10;4"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.9;0;0.9"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx={r.x}
                cy={r.y}
                r="3"
                fill="white"
                stroke="hsl(var(--gold))"
                strokeWidth="1.5"
              />
              <text
                x={r.x}
                y={labelY}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="white"
                style={{ paintOrder: "stroke", stroke: "hsl(var(--teal-dark))", strokeWidth: 2 }}
              >
                {r.code}
              </text>
            </g>
            );
          })}

          {/* Origin marker (Dhaka) */}
          <g>
            <circle cx={origin.x} cy={origin.y} r="6" fill="hsl(var(--gold))" opacity="0.5">
              <animate attributeName="r" values="6;16;6" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle
              cx={origin.x}
              cy={origin.y}
              r="5"
              fill="hsl(var(--gold))"
              stroke="white"
              strokeWidth="2"
            />
            <text
              x={origin.x}
              y={origin.y + 18}
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fill="white"
              style={{ paintOrder: "stroke", stroke: "hsl(var(--teal-dark))", strokeWidth: 2.5 }}
            >
              {originLabel}
            </text>
          </g>
        </svg>

        {/* Destination chips strip */}
        <div className="relative z-10 px-4 md:px-6 pb-4 md:pb-5 -mt-2">
          <div className="flex flex-wrap justify-center gap-2">
            {routes.map((r, i) => (
              <motion.div
                key={`chip-${r.code}`}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.05 * i }}
                whileHover={{ y: -3, scale: 1.05 }}
                className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-3 py-1.5 cursor-pointer hover:bg-white/15 transition"
              >
                <span className="text-base leading-none">{r.emoji}</span>
                <span className="text-white text-[11px] md:text-xs font-semibold">
                  {isBn ? r.labelBn : r.labelEn}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stats strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto mt-6"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              whileHover={{ y: -4, scale: 1.03 }}
              className="relative bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-4 flex items-center gap-3 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-sunset flex items-center justify-center shadow-gold">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="relative text-left">
                <div className="text-white font-extrabold text-xl md:text-2xl leading-none tabular-nums">
                  {stat.value}
                </div>
                <div className="text-white/70 text-[11px] md:text-xs mt-0.5">{stat.label}</div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default AdventureCTA;
