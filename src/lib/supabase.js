import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const rememberStorage = {
  getItem(key) {
    if (typeof window === "undefined") return null;
    const remember = window.localStorage.getItem("gymos_remember") !== "false";
    return (remember ? window.localStorage : window.sessionStorage).getItem(key);
  },
  setItem(key, value) {
    if (typeof window === "undefined") return;
    const remember = window.localStorage.getItem("gymos_remember") !== "false";
    (remember ? window.localStorage : window.sessionStorage).setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export function setRememberMe(remember) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("gymos_remember", remember ? "true" : "false");
}

export const supabase = url && key ? createClient(url, key, {
  auth: {
    storage: rememberStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
}) : null;
