import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LocaleProvider } from "./contexts/LocaleContext";
import CorporateApp from "./corporate/CorporateApp";
import AdminApp, { CommandCenterRoot, BlueprintRoot } from "./admin/AdminApp";

/**
 * MOOD for DESIGN — Root App
 *
 * /command-center/*  → MOOD Core   (advisors, studio relations, lifecycle, founder welcome)
 * /blueprint/*       → Tenant runtime workspace (CMS — pages, blocks, sections, media, …)
 * /admin/*           → Legacy redirect → /command-center (bookmarks keep working)
 * /*                 → Public website (CorporateApp)
 *
 * Architectural rule (Feb 2026): MOOD Core ≠ Blueprint Tenant.
 * The two workspaces are intentionally separate React shells so the
 * Advisor Program (MOOD Core) cannot bleed into the tenant CMS, and
 * future tenants will mount their own Blueprint on their subdomain.
 */
function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <Routes>
          <Route path="/command-center/*" element={<CommandCenterRoot />} />
          <Route path="/blueprint/*"      element={<BlueprintRoot />} />
          <Route path="/admin/*"          element={<AdminApp />} />
          <Route path="/*"                element={<CorporateApp />} />
        </Routes>
      </LocaleProvider>
    </BrowserRouter>
  );
}

export default App;
