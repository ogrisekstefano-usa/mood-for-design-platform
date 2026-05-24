import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LocaleProvider } from "./contexts/LocaleContext";
import CorporateApp from "./corporate/CorporateApp";
import AdminApp from "./admin/AdminApp";

/**
 * MOOD for DESIGN — Root App (ITER149)
 *
 * /admin/*  → Blueprint Command Center (admin UI)
 * /*        → Public website (CorporateApp)
 *
 * All content for both surfaces is governed by editorial_blocks + media_library
 * + cms_sections via the /api/site/* and /api/admin/site/* APIs.
 */
function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/*"       element={<CorporateApp />} />
        </Routes>
      </LocaleProvider>
    </BrowserRouter>
  );
}

export default App;
