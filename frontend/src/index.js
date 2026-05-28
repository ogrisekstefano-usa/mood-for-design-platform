import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { bootstrapLanguagesFromDB } from "@/site/content/languages";

// UI Density / Font Size Controller™ · apply pre-mount to avoid FOUC.
try {
  const v = window.localStorage.getItem('mfd.ui_density');
  if (v && ['compact','default','comfortable','editorial'].includes(v)) {
    document.documentElement.setAttribute('data-ui-density', v);
  }
} catch (_) { /* SSR-safe no-op */ }

// ITER168 Hotfix B · pull canonical language registry from DB on boot.
// Fire-and-forget; the cached snapshot is already loaded synchronously.
bootstrapLanguagesFromDB();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
