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
import '../journey/journeyPreparing.css';

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
        // ── ITER166 · P0.1 · Magic-link errors interception ─────────
        // Supabase può rispondere con: ?error=…&error_code=otp_expired
        // oppure mettere lo stesso payload nel HASH (#error=…&error_code=…).
        // Catturiamo TUTTO prima di provare a leggere la session.
        const rawHash = (window.location.hash || '').replace(/^#/, '');
        const hashParams = new URLSearchParams(rawHash);
        const errCode = params.get('error_code') ||
                        hashParams.get('error_code') ||
                        params.get('error') ||
                        hashParams.get('error');
        if (errCode) {
          // Mai mostrare il messaggio raw di Supabase. Solo redirect
          // elegante alla pagina di recovery editoriale.
          const carry = new URLSearchParams();
          const e = params.get('email') || hashParams.get('email');
          if (e) carry.set('email', e);
          window.location.replace(`/auth/recovery${carry.toString() ? '?' + carry : ''}`);
          return;
        }

        const session = _parseHash();
        const flow = params.get('flow') || session?.type || 'recovery';
        const targetHost = _normalize(params.get('origin')) || PLATFORM_DOMAIN;
        let next = params.get('next') || (flow === 'recovery' ? '/auth/reset-password' : '/auth/login');
        if (!next.startsWith('/')) next = '/' + next;
        // ITER161/162 · marca il primo ingresso da magic-link verso
        // il Client Profile: rotta = Welcome Panel Atelier™.
        if (flow === 'magic_link' && (next.startsWith('/client') || next === '/')) {
          if (!next.startsWith('/client/welcome')) {
            next = '/client/welcome';
          }
          if (!/[?&]welcome=/.test(next)) {
            next += (next.includes('?') ? '&' : '?') + 'welcome=1';
          }
        }

        // If no hash session → the link expired or has been already consumed.
        if (!session) {
          // ITER166 · P0.1 · invece di mandare a /auth/login generic,
          // mandiamo alla recovery editoriale.
          setState({ status: 'cinematic',
                     message: 'Stiamo controllando il tuo accesso…' });
          setTimeout(() => window.location.replace('/auth/recovery'), 900);
          return;
        }

        const currentHost = window.location.hostname.toLowerCase();
        const isMagicLinkToClient = (flow === 'magic_link' && next.startsWith('/client'));

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
          try { window.dispatchEvent(new Event('mfd:identity:refresh')); } catch (_) {}

          // ── ITER166 · P0.2 · Mini cinematic transition ────────────
          // 1500ms · "Stiamo aprendo il tuo Design Journey™…"
          // Solo per il primo ingresso magic-link verso il Client Profile.
          if (isMagicLinkToClient) {
            setState({ status: 'cinematic',
                       message: 'Stiamo aprendo il tuo Design Journey™…' });
            setTimeout(() => window.location.replace(next), 1500);
            return;
          }

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
    <div className="jp-mini" data-testid="auth-callback-page">
      <div className="jp-mini__inner">
        <div className="jp-mini__rings" aria-hidden>
          <span /><span />
        </div>
        <p className="jp-mini__text" data-testid="auth-callback-message">
          {state.message}
        </p>
        {state.status === 'error' && (
          <p style={{ margin: 0, fontSize: 12, color: '#a09a8e', maxWidth: 360, textAlign: 'center' }}>
            Se l'esperienza non riprende da sola, torna alla{' '}
            <a href="/auth/login" style={{ color: '#C9A26B' }}>landing</a>.
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
