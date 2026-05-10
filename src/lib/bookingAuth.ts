import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

export const requireCustomerLogin = async (navigate: NavigateFunction, redirectTo: string) => {
  const {
    data: { session },
  } = await apiClient.auth.getSession();

  if (session) return true;

  toast.info("বুকিং করতে আগে লগইন করুন বা নতুন অ্যাকাউন্ট তৈরি করুন");
  navigate(`/auth?redirect=${encodeURIComponent(redirectTo)}`);
  return false;
};
