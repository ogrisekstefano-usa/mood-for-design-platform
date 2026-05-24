import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// UI Density / Font Size Controller™ · apply pre-mount to avoid FOUC.
try {
  const v = window.localStorage.getItem('mfd.ui_density');
  if (v && ['compact','default','comfortable','editorial'].includes(v)) {
    document.documentElement.setAttribute('data-ui-density', v);
  }
} catch (_) { /* SSR-safe no-op */ }

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
