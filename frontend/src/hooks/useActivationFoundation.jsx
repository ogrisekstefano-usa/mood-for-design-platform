/**
 * useActivationFoundation — ITER180
 *
 * Fetcher + provider per Activation Foundation™ 6-step status.
 * Auto-refresh on focus per riflettere step completati altrove.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;
const auth = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const Ctx = createContext({
  data: null, loading: false, refresh: () => {}, dismissBanner: () => {}, bannerDismissed: false,
});

const DISMISS_KEY = 'mood.activation.banner_dismissed_until';

export function ActivationFoundationProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return until > Date.now();
  });
  const { user } = useAuth() || {};

  const refresh = useCallback(async () => {
    if (!user) { setData(null); return; }
    const role = (user?.role || '').toLowerCase();
    if (role === 'client') { setData(null); return; }
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/tenant-onboarding/activation-foundation`, { headers: auth() });
      setData(r.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Refresh on window focus
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const dismissBanner = useCallback(() => {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setBannerDismissed(true);
  }, []);

  return (
    <Ctx.Provider value={{ data, loading, refresh, dismissBanner, bannerDismissed }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActivationFoundation() {
  return useContext(Ctx);
}
