import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// GymOS sessions intentionally live only in sessionStorage.
// Closing the browser/tab clears the auth session; reloading the page keeps it.
const rememberStorage = {
  getItem(key) {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  }
};

export function setRememberMe() {
  // Kept for login compatibility; GymOS never persists auth across browser close.
}

export const supabase = url && key ? createClient(url, key, {
  auth: {
    storage: rememberStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
}) : null;
