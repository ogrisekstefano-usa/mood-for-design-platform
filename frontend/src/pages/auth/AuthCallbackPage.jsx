/**
 * ITER143D · Auth Callback bridge.
 *
 * Supabase recovery / invite / magic-link emails always redirect_to
 *   https://blueprint.moodfordesign.com/auth/callback?flow=…&origin=…&next=…
 *
 * The URL HASH contains the freshly-minted session
 *   #access_token=eyJ…&refresh_token=…&type=recovery&expires_in=3600
 *
 * We:
 *   1. Parse the hash into a session object.
 *   2. Validate the `origin` query param against our allow-list.
 *   3. Hand the session over to the right subdomain (full navigation so
 *      the new domain installs its own localStorage entry).
 *
 * STRICT rules:
 *   • NEVER land on www. or bare root.
 *   • If origin is missing/invalid → fall back to Blueprint login.
 *   • Same-origin → SPA navigation (no full reload).
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const PLATFORM_ROOT   = 'moodfordesign.com';
const PLATFORM_DOMAIN = `blueprint.${PLATFORM_ROOT}`;
const STORAGE_KEY     = 'mfd_session';

function _isAllowedHost(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  // Block bare root and www → never an acceptable landing.
  if (h === PLATFORM_ROOT || h === `www.${PLATFORM_ROOT}`) return false;
  if (h.endsWith(`.${PLATFORM_ROOT}`)) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.preview.emergentagent.com')) return true;
  return false;
}

function _normalize(originRaw) {
  if (!originRaw) return null;
  try {
    const u = new URL(originRaw.startsWith('http') ? originRaw : `https://${originRaw}`);
    return _isAllowedHost(u.hostname) ? u.hostname : null;
  } catch (_) { return null; }
}

function _parseHash() {
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (!hash) return null;
  const p = new URLSearchParams(hash);
  const access_token = p.get('access_token');
  if (!access_token) return null;
  return {
    access_token,
    refresh_token: p.get('refresh_token') || '',
    token_type:    p.get('token_type') || 'bearer',
    expires_in:    Number(p.get('expires_in') || 3600),
    type:          p.get('type') || '',
  };
}

const AuthCallbackPage = () => {
  const [params] = useSearchParams();
  const [state, setState] = useState({ status: 'processing', message: 'Apriamo il tuo spazio…' });

  useEffect(() => {
    const run = async () => {
      try {
        const session = _parseHash();
        const flow = params.get('flow') || session?.type || 'recovery';
        const targetHost = _normalize(params.get('origin')) || PLATFORM_DOMAIN;
        let next = params.get('next') || (flow === 'recovery' ? '/auth/reset-password' : '/auth/login');
        if (!next.startsWith('/')) next = '/' + next;
        // ITER161 · P0.2 · marca il primo ingresso da magic-link verso
        // il Client Profile per evitare l'auto-deep-entry al journey
        // (mostriamo il benvenuto editoriale).
        if (flow === 'magic_link' && next.startsWith('/client')) {
          if (!/[?&]welcome=/.test(next)) {
            next += (next.includes('?') ? '&' : '?') + 'welcome=1';
          }
        }

        // If no hash session → the link expired or has been already consumed.
        if (!session) {
          setState({ status: 'redirecting',
                     message: 'Il link non è più valido. Ti riaccompagniamo all’accesso…' });
          const url = `https://${targetHost}/auth/login?flow=${encodeURIComponent(flow)}`;
          setTimeout(() => window.location.replace(url), 1200);
          return;
        }

        const currentHost = window.location.hostname.toLowerCase();
        if (targetHost === currentHost) {
          // Same origin → install session locally and use SPA router.
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              token_type: session.token_type,
              expires_in: session.expires_in,
            }));
          } catch (_) {}
          // ITER161 · P0.2 · force AuthProvider a ricaricare il profilo
          // così l'app riconosce subito che siamo loggati come client.
          try {
            window.dispatchEvent(new Event('mfd:identity:refresh'));
          } catch (_) {}
          // Hard navigation per garantire che TUTTI i provider (Blueprint,
          // Tenant, Locale) re-inizializzino con la session appena
          // installata. SPA navigate funziona quasi sempre ma su deep
          // entry post-magic-link è più affidabile un full reload.
          window.location.replace(next);
          return;
        }

        // Cross-origin → hand the session over via URL fragment.
        const hand = new URLSearchParams({
          access_token:  session.access_token,
          refresh_token: session.refresh_token,
          token_type:    session.token_type,
          expires_in:    String(session.expires_in),
          type:          flow,
        });
        const fullUrl = `https://${targetHost}${next}#${hand.toString()}`;
        setState({ status: 'redirecting', message: 'Ti accompagniamo al tuo spazio…' });
        window.location.replace(fullUrl);
      } catch (e) {
        setState({ status: 'error', message: e.message || String(e) });
      }
    };
    run();
  }, [params]);

  return (
    <div data-testid="auth-callback-page"
         style={{
           minHeight: '100vh', display: 'grid', placeItems: 'center',
           background: '#050608', color: '#e8ebf0',
           fontFamily: 'Georgia, "Cormorant Garamond", serif',
         }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.32em',
                      textTransform: 'uppercase', color: '#7ce4f5',
                      marginBottom: 16 }}>
          MOOD · Auth Bridge
        </div>
        <div style={{ fontSize: 22, fontStyle: 'italic' }}>{state.message}</div>
        {state.status === 'error' && (
          <div style={{ marginTop: 18, fontSize: 12, color: '#f3a8a8' }}>
            {state.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
