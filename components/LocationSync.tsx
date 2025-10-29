"use client";
import { useLocationSync } from '@/hooks/useLocationSync';

export default function LocationSync({ intervalMs = 15000, maxHistory = 20 }: { intervalMs?: number; maxHistory?: number }) {
  const state = useLocationSync(intervalMs, maxHistory);
  if (state.error) {
    // Optional: render nothing but could be extended to toast
    return null;
  }
  return null;
}


