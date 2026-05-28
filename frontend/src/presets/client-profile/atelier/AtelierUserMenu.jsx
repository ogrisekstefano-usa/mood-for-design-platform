/**
 * AtelierUserMenu · ITER162 rev2
 *
 * Avatar cliente in topbar destra con menu a tendina:
 *   • Il mio profilo
 *   • Lingua (sottosezione)
 *   • Chameleon Atelier™ (preset selector — future)
 *   • Esci
 *
 * Lessico relazionale, mai SaaS.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, Globe, Sparkles, LogOut, Check, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

const LANGUAGES = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const PRESETS = [
  { key: 'atelier',   label: 'Atelier™',   sub: 'Cinematic editorial' },
  { key: 'axis',      label: 'Axis™',      sub: 'Minimal precision · prossimamente' },
  { key: 'gallery',   label: 'Gallery™',   sub: 'Curatorial · prossimamente' },
  { key: 'residence', label: 'Residence™', sub: 'Quiet warmth · prossimamente' },
];

const AtelierUserMenu = ({ client }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('root'); // 'root' | 'lang' | 'preset'
  const wrapRef = useRef(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();

  const currentLang = (typeof navigator !== 'undefined' && navigator.language ? navigator.language.slice(0, 2) : 'it');
  const currentPreset = search.get('preset') || 'atelier';

  const initial = ((client?.firstName || '?')[0] || '?').toUpperCase();
  const fullName = `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || 'Cliente';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setView('root');
      }
    };
    const onEsc = (e) => { if (e.key === 'Escape') { setOpen(false); setView('root'); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const handleLanguage = (code) => {
    try { localStorage.setItem('mfd_locale', code); } catch (_) {}
    window.dispatchEvent(new CustomEvent('mfd:locale:change', { detail: code }));
    setOpen(false); setView('root');
  };

  const handlePreset = (key) => {
    const next = new URLSearchParams(search);
    if (key === 'atelier') next.delete('preset'); else next.set('preset', key);
    setSearch(next, { replace: true });
    setOpen(false); setView('root');
  };

  const handleLogout = async () => {
    try { await signOut?.(); } catch (_) {}
    setOpen(false);
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="atelier-userbtn-wrap" ref={wrapRef} data-testid="atelier-user-menu">
      <button
        type="button"
        className="atelier-userbtn"
        onClick={() => { setOpen((o) => !o); setView('root'); }}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="atelier-user-menu-trigger"
      >
        <span className="atelier-userbtn__avatar" aria-hidden>{initial}</span>
      </button>

      {open && (
        <div
          className="atelier-menu"
          role="menu"
          data-testid="atelier-user-menu-panel"
          data-view={view}
        >
          {/* ── ROOT ─────────────────────────────────────────── */}
          {view === 'root' && (
            <>
              <header className="atelier-menu__head">
                <span className="atelier-menu__avatar" aria-hidden>{initial}</span>
                <div>
                  <p className="atelier-menu__name">{fullName}</p>
                  <p className="atelier-menu__sub">{client?.email || 'Client Profile'}</p>
                </div>
              </header>
              <ul className="atelier-menu__list" role="none">
                <li>
                  <Link
                    to="/client/profile"
                    className="atelier-menu__item"
                    onClick={() => setOpen(false)}
                    data-testid="atelier-user-menu-profile"
                    role="menuitem"
                  >
                    <User size={15} strokeWidth={1.5} aria-hidden />
                    <span>Il mio profilo</span>
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className="atelier-menu__item"
                    onClick={() => setView('lang')}
                    data-testid="atelier-user-menu-language"
                    role="menuitem"
                  >
                    <Globe size={15} strokeWidth={1.5} aria-hidden />
                    <span>Lingua</span>
                    <span className="atelier-menu__hint">
                      {LANGUAGES.find((l) => l.code === currentLang)?.label || 'Italiano'}
                    </span>
                    <ChevronRight size={14} strokeWidth={1.4} className="atelier-menu__chev" aria-hidden />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="atelier-menu__item"
                    onClick={() => setView('preset')}
                    data-testid="atelier-user-menu-preset"
                    role="menuitem"
                  >
                    <Sparkles size={15} strokeWidth={1.5} aria-hidden />
                    <span>Chameleon Atelier™</span>
                    <span className="atelier-menu__hint">
                      {PRESETS.find((p) => p.key === currentPreset)?.label || 'Atelier™'}
                    </span>
                    <ChevronRight size={14} strokeWidth={1.4} className="atelier-menu__chev" aria-hidden />
                  </button>
                </li>
              </ul>
              <div className="atelier-menu__divider" aria-hidden />
              <ul className="atelier-menu__list" role="none">
                <li>
                  <button
                    type="button"
                    className="atelier-menu__item atelier-menu__item--danger"
                    onClick={handleLogout}
                    data-testid="atelier-user-menu-logout"
                    role="menuitem"
                  >
                    <LogOut size={15} strokeWidth={1.5} aria-hidden />
                    <span>Esci dallo spazio</span>
                  </button>
                </li>
              </ul>
            </>
          )}

          {/* ── LANGUAGE ─────────────────────────────────────── */}
          {view === 'lang' && (
            <>
              <header className="atelier-menu__head atelier-menu__head--sub">
                <button
                  type="button"
                  onClick={() => setView('root')}
                  className="atelier-menu__back"
                  aria-label="Indietro"
                  data-testid="atelier-user-menu-lang-back"
                >‹</button>
                <p className="atelier-menu__title">Lingua</p>
              </header>
              <ul className="atelier-menu__list" role="none">
                {LANGUAGES.map((l) => (
                  <li key={l.code}>
                    <button
                      type="button"
                      className="atelier-menu__item"
                      onClick={() => handleLanguage(l.code)}
                      data-testid={`atelier-user-menu-lang-${l.code}`}
                      role="menuitemradio"
                      aria-checked={currentLang === l.code}
                    >
                      <span>{l.label}</span>
                      {currentLang === l.code && (
                        <Check size={14} strokeWidth={2} className="atelier-menu__check" aria-hidden />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ── PRESET (Chameleon Atelier™) ──────────────────── */}
          {view === 'preset' && (
            <>
              <header className="atelier-menu__head atelier-menu__head--sub">
                <button
                  type="button"
                  onClick={() => setView('root')}
                  className="atelier-menu__back"
                  aria-label="Indietro"
                  data-testid="atelier-user-menu-preset-back"
                >‹</button>
                <p className="atelier-menu__title">Chameleon Atelier™</p>
              </header>
              <p className="atelier-menu__lede">
                Scegli l'estetica del tuo spazio progettuale.
              </p>
              <ul className="atelier-menu__list" role="none">
                {PRESETS.map((p) => {
                  const active = currentPreset === p.key;
                  const available = p.key === 'atelier';
                  return (
                    <li key={p.key}>
                      <button
                        type="button"
                        className={`atelier-menu__item atelier-menu__preset ${available ? '' : 'is-locked'}`}
                        onClick={() => available && handlePreset(p.key)}
                        disabled={!available}
                        data-testid={`atelier-user-menu-preset-${p.key}`}
                        role="menuitemradio"
                        aria-checked={active}
                      >
                        <span className="atelier-menu__preset-body">
                          <span className="atelier-menu__preset-label">{p.label}</span>
                          <span className="atelier-menu__preset-sub">{p.sub}</span>
                        </span>
                        {active && (
                          <Check size={14} strokeWidth={2} className="atelier-menu__check" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AtelierUserMenu;
