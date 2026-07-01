import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { supabase } from "./lib/supabase.js";

const SUPABASE_TABLE = "tracker_state";

async function readFromSupabase(key) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;
    return data?.value ? { key, value: data.value, shared: true } : null;
  } catch (error) {
    console.warn("Supabase read failed, falling back to localStorage", error);
    return null;
  }
}

async function writeToSupabase(key, value) {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from(SUPABASE_TABLE).upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("Supabase write failed, falling back to localStorage", error);
    return false;
  }
}

/* ───────────────────────────────────────────────────────────────
   The tracker persists through a small async storage API. When your
   Supabase credentials are configured, values are synced there;
   otherwise they remain in localStorage.
   ─────────────────────────────────────────────────────────────── */
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const supabaseResult = await readFromSupabase(key);
      if (supabaseResult) return supabaseResult;

      const value = localStorage.getItem(key);
      return value === null ? null : { key, value, shared: false };
    },
    async set(key, value) {
      const wroteToSupabase = await writeToSupabase(key, value);
      if (wroteToSupabase) {
        return { key, value, shared: true };
      }

      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      if (supabase) {
        try {
          await supabase.from(SUPABASE_TABLE).delete().eq("key", key);
        } catch (error) {
          console.warn("Supabase delete failed", error);
        }
      }

      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
