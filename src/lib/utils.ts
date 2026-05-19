import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number in South Asian style: 1,00,000 */
export function formatBDT(n: number | null | undefined): string {
  return `BDT ${Number(n || 0).toLocaleString("en-IN")}`;
}

/** Format number only (no BDT prefix) in South Asian style */
export function formatAmount(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString("en-IN");
}

/** Format SAR amount with prefix */
export function formatSAR(n: number | null | undefined): string {
  return `SAR ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Format tracking ID: convert legacy RK- prefix to TT- */
export function formatTrackingId(value?: string | null): string {
  const normalized = (value || "").trim().toUpperCase();
  if (!normalized) return "";
  if (normalized.startsWith("TT-")) return normalized;
  if (normalized.startsWith("RK-")) return `TT-${normalized.slice(3)}`;
  return normalized;
}
