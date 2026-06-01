/**
 * useEmailCheck — debounced global email uniqueness check.
 * Returns: { checking, available, reason }
 */
import { useEffect, useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export function useEmailCheck(email, enabled = true) {
  const [state, setState] = useState({
    checking: false, available: null, reason: null,
  });

  useEffect(() => {
    if (!enabled || !email || !/.+@.+\..+/.test(email)) {
      setState({ checking: false, available: null, reason: null });
      return;
    }
    setState((s) => ({ ...s, checking: true }));
    const tid = setTimeout(async () => {
      try {
        const r = await axios.get(`${BACKEND}/api/studio/v2/check-email`,
          { params: { email } });
        setState({ checking: false,
                   available: r.data?.available,
                   reason:    r.data?.reason || null });
      } catch {
        setState({ checking: false, available: null, reason: null });
      }
    }, 450);
    return () => clearTimeout(tid);
  }, [email, enabled]);

  return state;
}
