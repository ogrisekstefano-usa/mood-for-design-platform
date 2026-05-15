import "@/App.css";
import { BrowserRouter } from "react-router-dom";
import { LocaleProvider } from "./contexts/LocaleContext";
import CorporateApp from "./corporate/CorporateApp";

/**
 * MOOD for DESIGN — Root App
 * Architecture: ONE platform → MULTIPLE frontends
 *
 * www.moodfordesign.com     → CorporateApp (mood-corporate tenant)
 * blueprint.moodfordesign.com → Blueprint SaaS (handled via subdomain routing)
 *
 * Both share: same backend, same CMS, same section registry,
 * same auth layer, same i18n system, same media storage.
 */
function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        {/* Corporate website — mood-corporate tenant */}
        <CorporateApp />
      </LocaleProvider>
    </BrowserRouter>
  );
}

export default App;
