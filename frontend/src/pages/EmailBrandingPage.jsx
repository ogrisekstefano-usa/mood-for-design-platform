/**
 * ITER143E · Tenant Email Branding™
 *
 * Where the studio refines its voice as it appears in transactional
 * email. NOT a mail server configuration screen — a brand refinement
 * studio. Cinematic black-glass UI, typography-first.
 *
 * Access: tenant_admin (own tenant) and root_superadmin (any tenant via
 * ?tenant_id=). Operators have NO visibility.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Loader2, Save, RefreshCw, Eye } from 'lucide-react';

const FIELD_GROUPS = [
  {
    title: 'Voce & Mittente',
    fields: [
      ['sender_name',         'Nome del mittente', 'text',  'MOOD for DESIGN™'],
      ['reply_to',            'Reply-to',          'email', 'studio@…'],
      ['support_email',       'Email di supporto', 'email', 'support@…'],
    ],
  },
  {
    title: 'Identità visiva',
    fields: [
      ['logo_url',        'URL del logo (PNG/SVG)', 'url',   'https://…'],
      ['primary_color',   'Colore primario',         'color', '#7ce4f5'],
      ['accent_color',    'Colore d’accento',        'color', '#e8ebf0'],
    ],
  },
  {
    title: 'Firma editoriale',
    fields: [
      ['footer_signature',     'Firma a piè di pagina',  'textarea', 'MOOD for DESIGN™ · Curated atmospheres for…'],
      ['email_signature',      'Firma personale',         'textarea', 'Anna · Studio Director'],
    ],
  },
  {
    title: 'Studio & contatti',
    fields: [
      ['footer_company_name',  'Ragione sociale',         'text',  'MOOD Studios S.r.l.'],
      ['footer_address',       'Indirizzo',               'text',  'Via …, Milano'],
      ['footer_phone',         'Telefono',                'text',  '+39 …'],
    ],
  },
  {
    title: 'Legali',
    fields: [
      ['legal_footer',         'Disclaimer legale',       'textarea', '© MOOD for DESIGN™ · Tutti i diritti riservati.'],
      ['privacy_url',          'Privacy URL',             'url',  'https://…/privacy'],
      ['terms_url',            'Termini URL',             'url',  'https://…/terms'],
    ],
  },
];


const EmailBrandingPage = () => {
  const { user } = useAuth();
  const [draft, setDraft] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewKey, setPreviewKey] = useState('password_reset');
  const [previewLocale, setPreviewLocale] = useState('it-IT');
  const [previewing, setPreviewing] = useState(false);
  const [identitySource, setIdentitySource] = useState(null);

  const isRoot = !!user?.is_root_superadmin;
  const canEdit = (user?.role || '').toLowerCase() === 'tenant_admin' ||
                  (user?.role || '').toLowerCase() === 'super_admin' ||
                  isRoot;

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/tenant/email-branding');
        setDraft(r.data.settings || {});
        // ITER144.1 · also surface runtime identity source from
        // /api/tenant/configuration so the editor reflects the merged
        // resolution (custom_email_identity → tenant_email_settings → platform).
        try {
          const rc = await api.get('/api/tenant/configuration');
          setIdentitySource(rc.data?.email_identity?.source || null);
        } catch { /* non-critical */ }
      } catch (e) {
        toast.error('Impossibile caricare le impostazioni.');
      } finally { setLoaded(true); }
    })();
  }, []);

  const onChange = (field, value) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      FIELD_GROUPS.flatMap((g) => g.fields).forEach(([k]) => {
        if (draft[k] !== undefined) payload[k] = draft[k];
      });
      const r = await api.patch('/api/tenant/email-branding', payload);
      setDraft(r.data.settings || {});
      toast('Brand aggiornato.');
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || 'Errore di salvataggio.');
    } finally { setSaving(false); }
  };

  const preview = async () => {
    setPreviewing(true);
    try {
      const r = await api.post('/api/tenant/email-branding/preview', {
        template_key: previewKey, draft, locale: previewLocale,
      });
      setPreviewHtml(r.data.html);
    } catch (e) {
      toast.error('Anteprima non disponibile.');
    } finally { setPreviewing(false); }
  };

  if (!canEdit) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
          <div style={eyebrowStyle}>Email Branding</div>
          <h1 style={titleStyle}>Accesso riservato.</h1>
          <p style={{ color: 'var(--bp-cc-ink-soft)' }}>
            Solo l’admin dello studio può modificare la voce editoriale delle email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle} data-testid="email-branding-page">
      <header style={{ marginBottom: 36 }}>
        <div style={eyebrowStyle}>Brand Refinement</div>
        <h1 style={titleStyle}>La voce delle tue email.</h1>
        <p style={{ maxWidth: 620, fontSize: 14, color: 'var(--bp-cc-ink-soft)' }}>
          Logo, palette, firma editoriale, contatti. Ogni dettaglio compone l’atmosfera
          che il cliente riceve nella sua casella. La consegna tecnica (provider, sicurezza,
          deliverability) resta orchestrata centralmente dal Blueprint Command Center™.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
                    gap: 32 }}>
        {/* ── editor ── */}
        <div>
          {FIELD_GROUPS.map((group) => (
            <section key={group.title} style={{ ...cardStyle, marginBottom: 18 }}
                     data-testid={`branding-section-${group.title.replace(/\s+/g, '-').toLowerCase()}`}>
              <h2 style={sectionTitleStyle}>{group.title}</h2>
              {group.fields.map(([field, label, type, placeholder]) => (
                <div key={field} style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>{label}</label>
                  {type === 'textarea' ? (
                    <textarea data-testid={`branding-${field}`}
                              rows={3}
                              value={draft[field] || ''}
                              placeholder={placeholder}
                              onChange={(e) => onChange(field, e.target.value)}
                              style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
                  ) : type === 'color' ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input data-testid={`branding-${field}`}
                             type="color"
                             value={draft[field] || '#7ce4f5'}
                             onChange={(e) => onChange(field, e.target.value)}
                             style={{ width: 40, height: 40, padding: 0, background: 'transparent',
                                      border: '1px solid var(--bp-cc-border)', borderRadius: 8,
                                      cursor: 'pointer' }} />
                      <input value={draft[field] || ''}
                             placeholder={placeholder}
                             onChange={(e) => onChange(field, e.target.value)}
                             style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace',
                                      fontSize: 12 }} />
                    </div>
                  ) : (
                    <input data-testid={`branding-${field}`}
                           type={type}
                           value={draft[field] || ''}
                           placeholder={placeholder}
                           onChange={(e) => onChange(field, e.target.value)}
                           style={inputStyle} />
                  )}
                </div>
              ))}
            </section>
          ))}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={!loaded || saving}
                    data-testid="branding-save"
                    style={ctaStyle}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Salva refinement
            </button>
            <button onClick={preview} disabled={previewing}
                    data-testid="branding-preview"
                    style={ghostCtaStyle}>
              {previewing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
              Anteprima
            </button>
          </div>
        </div>

        {/* ── preview pane ── */}
        <aside style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px',
                          borderBottom: '1px solid var(--bp-cc-border)',
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={eyebrowStyle} data-testid="branding-identity-source">
                Source · <span style={{
                  color: identitySource === 'tenant_runtime' ? 'var(--atelier-cyan, #7ce4f5)'
                       : identitySource === 'tenant_legacy'  ? '#f4c97a'
                       : 'rgba(232,235,240,0.5)',
                }}>{identitySource || '—'}</span>
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <select data-testid="branding-preview-locale"
                        value={previewLocale}
                        onChange={(e) => setPreviewLocale(e.target.value)}
                        style={{ background: 'rgba(8,10,13,0.5)',
                                 border: '1px solid var(--bp-cc-border)',
                                 color: 'var(--bp-cc-ink)', fontSize: 12,
                                 padding: '6px 10px', borderRadius: 6 }}>
                  <option value="it-IT">it-IT</option>
                  <option value="en-US">en-US</option>
                  <option value="en-GB">en-GB</option>
                  <option value="fr-FR">fr-FR</option>
                  <option value="de-DE">de-DE</option>
                  <option value="es-ES">es-ES</option>
                </select>
                <select value={previewKey}
                        onChange={(e) => setPreviewKey(e.target.value)}
                        style={{ background: 'rgba(8,10,13,0.5)',
                                 border: '1px solid var(--bp-cc-border)',
                                 color: 'var(--bp-cc-ink)', fontSize: 12,
                                 padding: '6px 10px', borderRadius: 6 }}>
                  <option value="password_reset">password_reset</option>
                  <option value="invite">invite</option>
                  <option value="onboarding">onboarding</option>
                  <option value="lead_captured">lead_captured</option>
                  <option value="magic_link">magic_link</option>
                  <option value="generic">generic</option>
                </select>
              </div>
            </div>
            {previewHtml ? (
              <iframe data-testid="branding-preview-frame"
                      title="Email preview" srcDoc={previewHtml}
                      style={{ width: '100%', height: 560, border: 0,
                               background: '#050608' }} />
            ) : (
              <div style={{ minHeight: 560, display: 'grid', placeItems: 'center',
                            color: 'var(--bp-cc-ink-mute)', fontStyle: 'italic',
                            fontFamily: 'Georgia, Cormorant Garamond, serif' }}>
                Premi “Anteprima” per vedere il template renderizzato.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

const pageStyle = {
  minHeight: '100vh', padding: '40px 48px',
  background: '#050608', color: '#e8ebf0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  '--bp-cc-border': 'rgba(232,235,240,0.06)',
  '--bp-cc-ink-soft': 'rgba(232,235,240,0.6)',
  '--bp-cc-ink-mute': 'rgba(232,235,240,0.34)',
  '--bp-cc-ink': '#e8ebf0',
};
const cardStyle = {
  background: 'rgba(14,16,20,0.78)', backdropFilter: 'blur(14px)',
  border: '1px solid rgba(232,235,240,0.06)', borderRadius: 12,
  padding: '22px 24px',
};
const eyebrowStyle = {
  fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase',
  color: 'rgba(232,235,240,0.5)', fontWeight: 600,
  display: 'inline-block',
};
const titleStyle = {
  fontFamily: 'Georgia, "Cormorant Garamond", serif',
  fontStyle: 'italic', fontSize: 36, lineHeight: 1.1, margin: '4px 0 12px',
};
const sectionTitleStyle = {
  fontFamily: 'Georgia, "Cormorant Garamond", serif',
  fontStyle: 'italic', fontSize: 18, color: '#e8ebf0', margin: '0 0 14px',
};
const labelStyle = {
  display: 'block', fontSize: 10, letterSpacing: '0.18em',
  textTransform: 'uppercase', color: 'rgba(232,235,240,0.5)',
  marginBottom: 6, fontWeight: 600,
};
const inputStyle = {
  width: '100%', padding: '10px 12px',
  background: 'rgba(8,10,13,0.5)',
  border: '1px solid rgba(232,235,240,0.08)',
  borderRadius: 7, color: '#e8ebf0', fontSize: 13, outline: 'none',
};
const ctaStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '10px 18px', fontSize: 11.5, letterSpacing: '0.16em',
  textTransform: 'uppercase', background: '#7ce4f5', color: '#050608',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
};
const ghostCtaStyle = {
  ...ctaStyle, background: 'transparent', color: '#7ce4f5',
  border: '1px solid rgba(124,228,245,0.3)',
};

export default EmailBrandingPage;
