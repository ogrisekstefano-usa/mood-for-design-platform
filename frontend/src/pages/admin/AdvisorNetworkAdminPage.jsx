/**
 * AdvisorNetworkAdminPage — SuperAdmin view of the Advisor Network.
 * Editorial · NOT affiliate dashboard. Language: "Advisor", "Referred Studios",
 * "Support Reports", "Commission Review". NEVER "affiliate", "downline", "payout race".
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, Plus, ArrowUpRight, AlertTriangle, Award, MapPin, Copy, X } from 'lucide-react';
import api from '../../lib/api';
import { avatarPalette, initialsOf } from '../../lib/avatarHue';
import '../advisor/advisor.css';
import { useT } from '../../i18n/useT';
const STATUS_LABEL = {
  active: 'Attivo',
  paused: 'In pausa',
  archived: 'Archiviato'
};
const AdvisorNetworkAdminPage = () => {
  const {
    t
  } = useT();
  const nav = useNavigate();
  const [overview, setOverview] = useState(null);
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const [ov, adv] = await Promise.all([api.get('/api/advisor/admin/overview'), api.get('/api/advisor/admin/advisors')]);
      setOverview(ov.data);
      setAdvisors(adv.data.advisors || []);
    } catch (e) {
      toast.error('Errore nel caricamento Advisor Network');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return <div className="adv-page" data-testid="advisor-network-admin">
      <header className="adv-hero">
        <p className="adv-hero__eyebrow">Partner Relationship · Advisor Network</p>
        <h1 className="adv-hero__title">{t('admin.advisor_network_admin.network_degli_advisor')}</h1>
        <p className="adv-hero__lead">
          La rete dei partner territoriali che introducono MOOD a studi, showroom e
          atelier. Premiati su <em>attivazione e adozione</em>, non su semplici signup.
        </p>
      </header>

      {/* KPI strip — subtle, editorial */}
      {overview && <div className="adv-pulse" data-testid="adv-pulse">
          <PulseCell num={overview.advisors_active} total={overview.advisors_total} lbl="Advisor attivi" />
          <PulseCell num={overview.referrals_total} lbl="Studi/showroom referenti" />
          <PulseCell num={overview.referrals_eligible} lbl="Commissioni eleggibili" accent />
          <PulseCell num={overview.referrals_at_risk} lbl="Necessitano supporto" warn={overview.referrals_at_risk > 0} />
        </div>}

      <div className="adv-toolbar">
        <p className="adv-tab-helper">
          Ogni Advisor ha un magic link unico. La commissione è valutata ogni 6 mesi,
          basata sull'uso reale della piattaforma da parte dello studio referente.
        </p>
        <button type="button" className="adv-btn adv-btn--primary" onClick={() => setShowNew(true)} data-testid="adv-new-btn">
          <Plus size={12} /> Nuovo Advisor
        </button>
      </div>

      {loading && <div className="adv-loading">Carico…</div>}
      {!loading && advisors.length === 0 && <div className="adv-empty" data-testid="adv-empty">
          <p className="adv-empty__eyebrow">Sala dei Partner</p>
          <p className="adv-empty__lead">Nessun Advisor ancora.</p>
          <p className="adv-empty__hint">
            Un Advisor è una figura di fiducia territoriale che presenta MOOD a studi e
            showroom — non un semplice referrer. Inizia creando il primo.
          </p>
        </div>}

      {!loading && advisors.length > 0 && <div className="adv-cards" data-testid="adv-cards">
          {advisors.map(a => {
        const pal = avatarPalette(a.name);
        return <button key={a.id} type="button" className="adv-card" data-testid={`adv-card-${a.id}`} onClick={() => nav(`/admin/advisors/${a.id}`)}>
                <div className="adv-card__head">
                  <span className="adv-card__avatar" style={{
              background: pal.bg,
              color: pal.fg,
              borderColor: pal.border
            }}>
                    {initialsOf(a.name)}
                  </span>
                  <div className="adv-card__head-text">
                    <p className="adv-card__name">{a.name}</p>
                    <p className="adv-card__code">{a.advisor_code}</p>
                  </div>
                  <span className={`adv-status-pill adv-status-pill--${a.status}`}>
                    {STATUS_LABEL[a.status] || a.status}
                  </span>
                </div>
                <div className="adv-card__meta">
                  {a.territory && <span className="adv-card__terr"><MapPin size={10} /> {a.territory}</span>}
                  {a.email && <span className="adv-card__email">{a.email}</span>}
                </div>
                <div className="adv-card__stats">
                  <span><strong>{a._referrals}</strong> studi/showroom</span>
                  {a._at_risk > 0 && <span className="adv-card__warn"><AlertTriangle size={10} /> {a._at_risk} da supportare</span>}
                  <span className="adv-card__comm">{a.commission_percentage}% commissione</span>
                </div>
              </button>;
      })}
        </div>}

      {showNew && <NewAdvisorDrawer onClose={() => {
      setShowNew(false);
      load();
    }} />}
    </div>;
};
const PulseCell = ({
  num,
  total,
  lbl,
  accent,
  warn
}) => <div className={`adv-pulse__cell ${accent ? 'is-accent' : ''} ${warn ? 'is-warn' : ''}`}>
    <span className="adv-pulse__num">{num}{total != null && <span className="adv-pulse__tot"> / {total}</span>}</span>
    <span className="adv-pulse__lbl">{lbl}</span>
  </div>;
const NewAdvisorDrawer = ({
  onClose
}) => {
  const {
    t
  } = useT();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    territory: '',
    commission_percentage: 15,
    default_discount_percentage: 10
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.name) {
      toast.error('Nome richiesto');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post('/api/advisor/admin/advisors', form);
      toast.success(`Advisor creato · ${r.data.advisor.advisor_code}`);
      onClose();
    } catch (e) {
      toast.error('Creazione fallita');
    } finally {
      setSaving(false);
    }
  };
  return <div className="adv-drawer-bg" onClick={e => {
    if (e.target === e.currentTarget) onClose();
  }}>
      <aside className="adv-drawer" data-testid="adv-new-drawer">
        <header className="adv-drawer__head">
          <div>
            <p className="adv-eyebrow">{t('admin.advisor_network_admin.crea_advisor')}</p>
            <h2 className="adv-drawer__title">Nuovo partner di rete</h2>
          </div>
          <button onClick={onClose} className="adv-drawer__close" data-testid="adv-new-close"><X size={17} /></button>
        </header>
        <div className="adv-drawer__body">
          <Field label="Nome completo" value={form.name} onChange={v => setForm({
          ...form,
          name: v
        })} testid="adv-new-name" />
          <Field label="Email" value={form.email} onChange={v => setForm({
          ...form,
          email: v
        })} testid="adv-new-email" type="email" />
          <Field label="Telefono" value={form.phone} onChange={v => setForm({
          ...form,
          phone: v
        })} testid="adv-new-phone" />
          <Field label="Territorio" value={form.territory} onChange={v => setForm({
          ...form,
          territory: v
        })} placeholder="Lombardia · IT" testid="adv-new-terr" />
          <div className="adv-grid-2">
            <Field label="Commissione %" value={form.commission_percentage} onChange={v => setForm({
            ...form,
            commission_percentage: parseFloat(v) || 0
          })} testid="adv-new-comm" type="number" />
            <Field label="Sconto default %" value={form.default_discount_percentage} onChange={v => setForm({
            ...form,
            default_discount_percentage: parseFloat(v) || 0
          })} testid="adv-new-disc" type="number" />
          </div>
        </div>
        <footer className="adv-drawer__foot">
          <button className="adv-btn adv-btn--ghost" onClick={onClose}>{t('admin.advisor_network_admin.annulla')}</button>
          <button className="adv-btn adv-btn--primary" onClick={submit} disabled={saving} data-testid="adv-new-submit">
            {saving ? 'Salvataggio…' : 'Crea Advisor'}
          </button>
        </footer>
      </aside>
    </div>;
};
const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  testid
}) => <label className="adv-field">
    <span className="adv-field__lbl">{label}</span>
    <input type={type} className="adv-field__input" value={value || ''} placeholder={placeholder} data-testid={testid} onChange={e => onChange(e.target.value)} />
  </label>;
export default AdvisorNetworkAdminPage;