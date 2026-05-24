/**
 * OwnerIntroductionModal — Phase S.2.
 *
 * Two-step required completion flow for tenant owners:
 *
 *   STEP A — pick + crop/zoom/position the avatar in a circular frame
 *   STEP B — fill role label, bio, optional response/CTA copy
 *
 * Avatar pipeline (no external dependency):
 *   1. User selects a local file → loaded into an HTMLImageElement
 *   2. Inline editor renders a 360×360 canvas with a circular mask
 *      overlay, zoom slider and drag-to-pan
 *   3. On confirm, the visible canvas is exported to a Blob and POSTed
 *      to /api/profile/me/avatar — the server stores the cropped PNG
 *
 * Critical bug fix:
 *   The whole modal body is wrapped in <form noValidate> so the
 *   browser never raises native HTML5 validation tooltips
 *   ("Please fill out this field") on hidden / required-looking
 *   elements. Submission is fully owned by React.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, Check, ZoomIn, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useT } from "../../i18n/useT";
import InternationalVersionsPanel from './InternationalVersionsPanel';
const BIO_MAX = 240;
const CANVAS_SIZE = 360; // exported PNG side
const PREVIEW_SIZE = 280; // editor canvas viewport
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 4.0;
const OwnerIntroductionModal = ({
  open,
  onClose,
  onComplete,
  forceComplete = false
}) => {
  const {
    t
  } = useT();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // STEP A — avatar editing
  const [pickerImage, setPickerImage] = useState(null); // HTMLImageElement
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({
    x: 0,
    y: 0
  }); // in preview-canvas pixels
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0
  });
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  // Persisted avatar URL after upload (server-side)
  const [avatarUrl, setAvatarUrl] = useState('');

  // STEP B — text fields
  const [form, setForm] = useState({
    role_label: '',
    short_bio: '',
    response_time_label: '',
    contact_cta_label: ''
  });

  // Load profile on open
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const {
          data
        } = await api.get('/api/profile/me');
        if (!alive) return;
        const p = data?.profile || {};
        setProfile(p);
        setForm({
          role_label: p.role_label || '',
          short_bio: p.short_bio || '',
          response_time_label: p.response_time_label || 'Risponde in giornata',
          contact_cta_label: p.contact_cta_label || `Scrivi a ${(p.first_name || 'me').trim()}`
        });
        setAvatarUrl(p.avatar_url || '');
        setPickerImage(null);
        setZoom(1);
        setPan({
          x: 0,
          y: 0
        });
      } catch (_) {
        toast.error('Impossibile caricare il profilo.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  /* ── File picker → load image into editor ───────────────────── */
  const handleFile = e => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking same file later
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('Formato non supportato.');
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      toast.error('L\'immagine supera 4 MB.');
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      // Initial fit so the smaller edge fills the canvas
      const baseFit = Math.max(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height);
      setPickerImage(Object.assign(img, {
        _baseFit: baseFit
      }));
      setZoom(1.0);
      setPan({
        x: 0,
        y: 0
      });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => toast.error('Impossibile leggere l\'immagine.');
    img.src = url;
  };

  /* ── Redraw editor canvas on every change ───────────────────── */
  const drawEditor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pickerImage) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Background — warm graphite so the masked outside reads correctly
    ctx.fillStyle = '#15151A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const fit = pickerImage._baseFit;
    const scale = fit * zoom;
    const drawW = pickerImage.width * scale;
    const drawH = pickerImage.height * scale;
    const cx = (canvas.width - drawW) / 2 + pan.x;
    const cy = (canvas.height - drawH) / 2 + pan.y;
    ctx.drawImage(pickerImage, cx, cy, drawW, drawH);

    // Circular mask outline (overlay outside circle)
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Frame ring
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 201, 179, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [pickerImage, zoom, pan]);
  useEffect(() => {
    drawEditor();
  }, [drawEditor]);

  /* ── Drag-to-pan handlers ───────────────────────────────────── */
  const onMouseDown = e => {
    if (!pickerImage) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
  };
  const onMouseMove = e => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({
      x: dragRef.current.panX + dx,
      y: dragRef.current.panY + dy
    });
  };
  const onMouseUp = () => {
    dragRef.current.active = false;
  };

  /* ── Confirm crop → export blob → upload ────────────────────── */
  const confirmCrop = async () => {
    if (!pickerImage) {
      toast.error('Seleziona prima una foto.');
      return;
    }
    // Render at full resolution
    const out = document.createElement('canvas');
    out.width = CANVAS_SIZE;
    out.height = CANVAS_SIZE;
    const ctx = out.getContext('2d');
    const ratio = CANVAS_SIZE / PREVIEW_SIZE;
    const fit = pickerImage._baseFit;
    const scale = fit * zoom * ratio;
    const drawW = pickerImage.width * scale;
    const drawH = pickerImage.height * scale;
    const cx = (out.width - drawW) / 2 + pan.x * ratio;
    const cy = (out.height - drawH) / 2 + pan.y * ratio;
    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(out.width / 2, out.height / 2, out.width / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#1A1410';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(pickerImage, cx, cy, drawW, drawH);
    ctx.restore();
    const blob = await new Promise(res => out.toBlob(res, 'image/png', 0.94));
    if (!blob) {
      toast.error('Errore export.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'avatar.png');
      const {
        data
      } = await api.post('/api/profile/me/avatar', fd, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      const url = data?.avatar_url || '';
      setAvatarUrl(url);
      setPickerImage(null); // exit editor
      toast.success('Foto caricata.');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Upload fallito.');
    } finally {
      setUploading(false);
    }
  };
  const isComplete = !!(avatarUrl && form.role_label.trim() && form.short_bio.trim());
  const submit = async () => {
    if (!isComplete) {
      toast.error('Compila tutti i campi obbligatori.');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/api/profile/me', {
        role_label: form.role_label,
        short_bio: form.short_bio,
        response_time_label: form.response_time_label || null,
        contact_cta_label: form.contact_cta_label || null,
        avatar_url: avatarUrl
      });
      // ITER147 · International Profile Identity™ — propagate the four
      // editorial fields into the `profile.identity` namespace so ALE
      // auto-composes culturally-adapted versions for every enabled
      // tenant locale. Non-blocking: if it fails the profile is still
      // saved on the source side.
      try {
        await api.patch('/api/profile/me/identity/source', {
          role_label: form.role_label || null,
          short_bio: form.short_bio || null,
          response_time_label: form.response_time_label || null,
          contact_cta_label: form.contact_cta_label || null,
        });
        // ITER147 · Notify any mounted InternationalVersionsPanel that
        // fresh source content is available. Lets the cinematic locale
        // cards refresh in-place (e.g. the bio becomes a new tab) without
        // closing the modal.
        try {
          window.dispatchEvent(new CustomEvent('mfd:identity:refresh'));
        } catch (_) {}
      } catch (_) {}
      try {
        await api.post('/api/tenant-onboarding/mark-done', {
          key: 'owner_introduced'
        });
      } catch (_) {}
      toast.success('Presentazione salvata.');
      onComplete?.();
      onClose?.();
    } catch (e) {
      toast.error('Salvataggio fallito.');
    } finally {
      setSaving(false);
    }
  };
  if (!open) return null;
  const bioRemaining = BIO_MAX - form.short_bio.length;
  const firstName = profile?.first_name || '';
  const initials = (firstName || '·')[0]?.toUpperCase();
  return <div data-testid="owner-introduction-modal" className="fixed inset-0 z-[80] flex items-center justify-center" role="dialog" aria-modal="true" aria-label={t("onboarding.owner_introduction.presentati_ai_tuoi_clienti")}>
      <button type="button" aria-label="Close" onClick={forceComplete ? undefined : onClose} className="absolute inset-0 bg-black/72 backdrop-blur-sm" style={{
      cursor: forceComplete ? 'default' : 'pointer'
    }} />

      <form noValidate onSubmit={e => {
      e.preventDefault();
      submit();
    }} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} className="relative w-[640px] max-w-[92vw] max-h-[92vh] overflow-auto
                   bg-[var(--bp-surface-1)] border border-[var(--bp-border)]
                   rounded-[18px] shadow-2xl" data-surface="os">
        {/* Header */}
        <div className="flex items-start justify-between px-8 pt-8 pb-4 border-b border-[var(--bp-border)]/60">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-primary)] mb-3 font-body">
              Profilo personale
            </p>
            <h2 className="font-heading text-[26px] leading-[1.1] text-[var(--bp-text-primary)] tracking-[-0.005em]">
              {t("onboarding.owner_introduction.presentati_ai_tuoi_clienti")}
            </h2>
            <p className="text-[12.5px] text-[var(--bp-text-muted)] font-body mt-2 max-w-[52ch] leading-relaxed">
              {t("onboarding.owner_introduction.foto_ruolo_e_bio_sono_visibili_a_ogni_cliente_del")}
            </p>
          </div>
          {!forceComplete && <button type="button" data-testid="owner-introduction-close" onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors p-1 -mt-2" aria-label={t("onboarding.owner_introduction.chiudi")}>
              <X size={16} strokeWidth={1.5} />
            </button>}
        </div>

        {/* Body */}
        {loading ? <div className="px-8 py-16 flex items-center justify-center text-[var(--bp-text-muted)]">
            <Loader2 className="animate-spin" size={18} />
          </div> : <div className="px-8 py-7 space-y-7">

            {/* AVATAR */}
            {pickerImage ? (/* ── Inline crop / zoom editor ─────────────────────── */
        <div>
                <FieldHead label={t("onboarding.owner_introduction.posiziona_la_foto")} hint={t("onboarding.owner_introduction.trascina_per_centrare_il_volto_usa_lo_zoom_per_rit")} />
                <div className="flex items-start gap-6 mt-3">
                  <canvas ref={canvasRef} data-testid="owner-introduction-crop-canvas" width={PREVIEW_SIZE} height={PREVIEW_SIZE} onMouseDown={onMouseDown} className="rounded-full shrink-0 cursor-grab active:cursor-grabbing select-none" style={{
              width: PREVIEW_SIZE,
              height: PREVIEW_SIZE,
              touchAction: 'none'
            }} />
                  <div className="flex-1 space-y-5 pt-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2 flex items-center gap-1.5">
                        <ZoomIn size={11} strokeWidth={1.5} />
                        Zoom
                      </p>
                      <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.02} value={zoom} data-testid="owner-introduction-zoom" onChange={e => setZoom(parseFloat(e.target.value))} className="w-full accent-[var(--bp-primary)]" />
                      <p className="text-[10px] font-mono text-[var(--bp-text-faint)] mt-1">
                        {zoom.toFixed(2)}×
                      </p>
                    </div>
                    <button type="button" onClick={() => {
                setZoom(1);
                setPan({
                  x: 0,
                  y: 0
                });
              }} data-testid="owner-introduction-reset" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors">
                      <RotateCcw size={11} strokeWidth={1.5} />
                      Ripristina
                    </button>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button type="button" onClick={() => setPickerImage(null)} className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors">
                        {t("onboarding.owner_introduction.annulla")}
                      </button>
                      <button type="button" onClick={confirmCrop} disabled={uploading} data-testid="owner-introduction-confirm-crop" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px]
                                   bg-[var(--bp-primary)] text-black text-[10px] uppercase tracking-[0.18em] font-medium
                                   hover:opacity-90 disabled:opacity-40 transition-opacity">
                        {uploading ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} strokeWidth={2.4} />}
                        {t("onboarding.owner_introduction.conferma_foto")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>) : (/* ── Avatar preview + pick button ──────────────────── */
        <div className="flex items-center gap-6">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="owner-introduction-avatar-slot" className="relative w-[112px] h-[112px] rounded-full overflow-hidden
                             bg-[var(--bp-surface-2)] border-2 border-[var(--bp-border-strong)]
                             hover:border-[var(--bp-primary)] transition-colors group flex items-center justify-center">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="font-heading text-[44px] text-[var(--bp-text-muted)] group-hover:text-[var(--bp-text-primary)] transition-colors">
                      {initials}
                    </span>}
                  <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={18} strokeWidth={1.5} />}
                  </span>
                </button>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-1">
                    Foto profilo · obbligatoria
                  </p>
                  <p className="text-[12.5px] text-[var(--bp-text-secondary)] leading-relaxed max-w-[40ch] font-body">
                    JPG, PNG o WebP · max 4 MB · potrai ritagliare e posizionare.
                  </p>
                  <button type="button" data-testid="owner-introduction-upload" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px]
                               border border-[var(--bp-border-strong)] text-[11px] uppercase tracking-[0.18em]
                               text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]
                               hover:border-[var(--bp-border-hover)] transition-colors">
                    <Camera size={12} strokeWidth={1.5} />
                    {avatarUrl ? 'Sostituisci foto' : 'Scegli foto'}
                  </button>
                  <input ref={fileRef} data-testid="owner-introduction-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />
                </div>
              </div>)}

            {/* Role */}
            <Field label="Ruolo nello studio · obbligatorio" hint="Es. Founder · Interior Designer · Project Manager" value={form.role_label} onChange={v => setForm(s => ({
          ...s,
          role_label: v
        }))} testid="owner-introduction-role" max={80} />

            {/* Bio */}
            <div>
              <FieldHead label="Bio breve · obbligatoria" hint={t("onboarding.owner_introduction.cosa_vuoi_che_il_cliente_sappia_di_te")} />
              <textarea data-testid="owner-introduction-bio" value={form.short_bio} onChange={e => setForm(s => ({
            ...s,
            short_bio: e.target.value.slice(0, BIO_MAX)
          }))} rows={3} className="w-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)]
                           rounded-[10px] px-4 py-3 text-[13px] text-[var(--bp-text-primary)]
                           font-body leading-relaxed focus:outline-none focus:border-[var(--bp-border-hover)]
                           transition-colors resize-none" placeholder={t("onboarding.owner_introduction.ad_esempio_sono_qui_per_accompagnarti_nelle_prime")} />
              <p className={`text-[10px] mt-1 text-right font-mono tracking-[0.06em]
                            ${bioRemaining < 20 ? 'text-amber-300' : 'text-[var(--bp-text-faint)]'}`}>
                {form.short_bio.length}/{BIO_MAX}
              </p>
            </div>

            <details className="group">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors select-none">
                Personalizza messaggi · opzionale
              </summary>
              <div className="mt-4 space-y-4">
                <Field label="Tempo di risposta" hint={t("onboarding.owner_introduction.visibile_sotto_il_tuo_nome_nella_human_card")} value={form.response_time_label} onChange={v => setForm(s => ({
              ...s,
              response_time_label: v
            }))} testid="owner-introduction-response" max={80} />
                <Field label="Etichetta CTA" hint={t("onboarding.owner_introduction.es_scrivi_a_stefano_default_ricavato_dal_nome")} value={form.contact_cta_label} onChange={v => setForm(s => ({
              ...s,
              contact_cta_label: v
            }))} testid="owner-introduction-cta" max={80} />
              </div>
            </details>

            {/* ITER147 · International Profile Identity™ — editorial panel.
                Only shows when the source role/bio have been saved. The
                panel itself self-fetches /api/profile/me/identity and
                gracefully shows an empty hint if nothing is yet authored. */}
            <details className="group" data-testid="intl-versions-toggle">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors select-none">
                Versioni Internazionali™ · opzionale
              </summary>
              <div className="mt-5">
                <InternationalVersionsPanel />
              </div>
            </details>
          </div>}

        {/* Footer */}
        <div className="px-8 py-5 border-t border-[var(--bp-border)]/60 flex items-center justify-between gap-4 bg-[var(--bp-surface-2)]/30">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--bp-text-faint)]">
            {isComplete ? 'Pronto · clienti vedranno la tua presentazione' : 'Completa i campi obbligatori per pubblicare'}
          </p>
          <div className="flex items-center gap-2">
            {!forceComplete && <button type="button" data-testid="owner-introduction-skip" onClick={onClose} className="px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors">
                Più tardi
              </button>}
            <button type="submit" data-testid="owner-introduction-save" disabled={!isComplete || saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px]
                         bg-[var(--bp-primary)] text-black text-[11px] uppercase tracking-[0.18em]
                         font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-opacity">
              {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} strokeWidth={2.4} />}
              {t("onboarding.owner_introduction.salva_e_pubblica")}
            </button>
          </div>
        </div>
      </form>
    </div>;
};
const FieldHead = ({
  label,
  hint
}) => <div className="mb-2">
    <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)]">{label}</p>
    {hint && <p className="text-[11px] text-[var(--bp-text-faint)] mt-0.5 font-body">{hint}</p>}
  </div>;
const Field = ({
  label,
  hint,
  value,
  onChange,
  testid,
  max
}) => <div>
    <FieldHead label={label} hint={hint} />
    <input data-testid={testid} type="text" value={value} onChange={e => onChange(max ? e.target.value.slice(0, max) : e.target.value)} className="w-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)]
                 rounded-[10px] px-4 py-2.5 text-[13px] text-[var(--bp-text-primary)]
                 font-body focus:outline-none focus:border-[var(--bp-border-hover)] transition-colors" />
  </div>;
export default OwnerIntroductionModal;