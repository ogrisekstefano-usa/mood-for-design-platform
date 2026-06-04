import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { motion, AnimatePresence } from 'framer-motion';

import './create-modal.css';

export const CREATE_MODAL_OPEN_EVENT = 'mood:create-modal:open';

export function openCreateModal() {
  window.dispatchEvent(new CustomEvent(CREATE_MODAL_OPEN_EVENT));
}

/* ───────────────────────────────────────────────────────────────────
 *  Configuration — extend with new cards without touching JSX below.
 * ─────────────────────────────────────────────────────────────────── */
function buildCreationOptions({ navigate, t, openNewRelationship, activeJourney }) {
  return [
    {
      id: 'design_journey',
      icon: <Icons.Compass size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-journey, var(--accent-primary, #5dd9c4))',
      titleKey: 'create.designJourney.title',
      descKey:  'create.designJourney.desc',
      fallbackTitle: 'Nuovo Design Journey',
      fallbackDesc: 'Avvia un nuovo progetto e guida il cliente dalla scoperta alla realizzazione.',
      action: () => {
        if (typeof openNewRelationship === 'function') {
          openNewRelationship({ choice: 'prospect' });
        } else {
          navigate('/relations/prospects');
        }
      },
    },
    {
      id: 'lead',
      icon: <Icons.UserPlus size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-lead, var(--accent-secondary, #c9a875))',
      titleKey: 'create.lead.title',
      descKey:  'create.lead.desc',
      fallbackTitle: 'Nuovo Lead',
      fallbackDesc: 'Aggiungi un nuovo contatto o opportunità commerciale.',
      action: () => {
        if (typeof openNewRelationship === 'function') {
          openNewRelationship({ choice: 'lead' });
        } else {
          navigate('/relations/leads');
        }
      },
    },
    {
      id: 'moodboard',
      icon: <Icons.Layout size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-moodboard, #f0a868)',
      titleKey: 'create.moodboard.title',
      descKey:  'create.moodboard.desc',
      fallbackTitle: 'Nuova Moodboard',
      fallbackDesc: 'Crea una moodboard collegata a un progetto esistente.',
      action: () => {
        try {
          // eslint-disable-next-line global-require
          require('./CreateMoodboardModal').openCreateMoodboardModal({
            journey: activeJourney || null,
          });
        } catch (_) {
          if (activeJourney?.id) {
            navigate(`/projects/${activeJourney.id}/moodboards/new`);
          } else {
            navigate('/workspace/projects?intent=new-moodboard');
          }
        }
      },
    },
    {
      id: 'brand',
      icon: <Icons.Building2 size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-brand, #a78bfa)',
      titleKey: 'create.brand.title',
      descKey:  'create.brand.desc',
      fallbackTitle: 'Nuovo Brand',
      fallbackDesc: 'Aggiungi un produttore o partner alla libreria.',
      action: () => navigate('/inspirations/brands?intent=add'),
    },
    {
      id: 'inspiration',
      icon: <Icons.Sparkles size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-inspiration, #f472b6)',
      titleKey: 'create.inspiration.title',
      descKey:  'create.inspiration.desc',
      fallbackTitle: 'Nuova Ispirazione',
      fallbackDesc: 'Salva immagini, link o idee nella Inspiration Library.',
      action: () => navigate('/inspirations?intent=add'),
    },
    {
      id: 'material',
      icon: <Icons.Palette size={20} strokeWidth={1.5} />,
      accent: 'var(--cm-accent-material, #38bdf8)',
      titleKey: 'create.material.title',
      descKey:  'create.material.desc',
      fallbackTitle: 'Nuovo Materiale',
      fallbackDesc: 'Aggiungi un materiale alla Material Library.',
      action: () => navigate('/inspirations/materials?intent=add'),
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────── */
function RotatingText({ words }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const int = setInterval(() => {
      setIdx((i) => (i + 1) % words.length);
    }, 3000);
    return () => clearInterval(int);
  }, [words.length]);

  return (
    <div className="h-[1.2em] relative overflow-hidden text-[var(--cm-text)]">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={idx}
          initial={{ y: 40, opacity: 0, filter: 'blur(8px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -40, opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          {words[idx]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CreateModalInner({ options, close, t, activeJourney }) {
  const [hoveredOpt, setHoveredOpt] = useState(null);
  const activeAccent = hoveredOpt ? hoveredOpt.accent : 'var(--accent-primary, #5dd9c4)';

  const handleClick = (opt) => {
    const block = opt.requires?.();
    if (block) {
      import('sonner').then(({ toast }) => toast.message(block, { duration: 4500 }));
      return;
    }
    close();
    setTimeout(() => opt.action?.(), 200); // slightly longer to allow fade out
  };

  const words = [
    t('create.word.vision', null, 'Visione'),
    t('create.word.legacy', null, 'Eredità'),
    t('create.word.masterpiece', null, 'Capolavoro'),
    t('create.word.journey', null, 'Journey')
  ];

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, backdropFilter: 'blur(16px)' }}
        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 bg-[var(--cm-backdrop,rgba(0,0,0,0.72))]"
        onClick={close}
        data-testid="create-modal-backdrop"
      />

      {/* Modal Container */}
      <motion.div
        role="dialog"
        aria-modal="true"
        data-testid="create-modal"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[1200px] h-[90vh] md:h-[85vh] flex flex-col md:flex-row overflow-hidden shadow-2xl"
        style={{
          background: 'var(--cm-surface, var(--bp-surface-elevated, #0f0f11))',
          borderRadius: '24px',
          border: '1px solid var(--cm-border, rgba(255,255,255,0.06))',
          boxShadow: 'var(--cm-shadow, 0 32px 80px rgba(0,0,0,0.6))'
        }}
      >
        {/* Left Pane - Editorial Hero */}
        <div className="hidden md:flex flex-col w-[42%] p-14 border-r border-white/5 relative overflow-hidden justify-between">
          {/* Background Image Layer */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1526289034009-0240ddb68ce3?auto=format&fit=crop&w=1200&q=80" 
              alt="Atelier Architecture"
              className="object-cover w-full h-full opacity-[0.15] mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--cm-surface,#0f0f11)] via-[var(--cm-surface,#0f0f11)]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--cm-surface,#0f0f11)] via-transparent to-transparent" />
          </div>

          {/* Dynamic Ambient Glow */}
          <div 
            className="absolute top-0 left-0 w-[600px] h-[600px] blur-[120px] rounded-full opacity-[0.25] pointer-events-none z-0 transition-colors duration-1000"
            style={{ 
              backgroundColor: activeAccent, 
              transform: 'translate(-20%, -30%)' 
            }}
          />

          {/* Top content */}
          <div className="relative z-10">
            <motion.h2 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
              className="font-mono text-[10px] uppercase tracking-[0.3em] mb-8 text-[var(--cm-text-muted,rgba(255,255,255,0.55))]"
              data-testid="create-modal-subtitle"
            >
              {t('create.modal.subtitle', null, 'Atelier Index')}
            </motion.h2>
            <div 
              className="text-5xl lg:text-6xl tracking-tight leading-[1.1] font-serif"
              data-testid="create-modal-title"
              style={{ color: 'var(--cm-text, rgba(255,255,255,0.92))', fontFamily: 'var(--bp-font-heading, "Cormorant Garamond", serif)' }}
            >
              <motion.span 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="block text-[var(--cm-text-muted,rgba(255,255,255,0.55))] mb-2"
              >
                {t('create.modal.hero_prefix', null, 'Inizia una nuova')}
              </motion.span>
              <RotatingText words={words} />
            </div>
          </div>

          {/* Bottom Context */}
          <div className="relative z-10">
            <p className="text-sm text-[var(--cm-text-muted,rgba(255,255,255,0.55))] mb-6 max-w-xs leading-relaxed">
              {t('create.modal.hero_caption', null, "Seleziona un'entità da aggiungere alla libreria del tuo studio. Tutto viene organizzato automaticamente nel tuo workspace.")}
            </p>
            {activeJourney && (
              <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent-primary, #5dd9c4)' }} />
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--cm-text,rgba(255,255,255,0.92))]">
                  Ctx: {activeJourney.name || 'Current Journey'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane - The Doors */}
        <div className="flex flex-col w-full md:w-[58%] p-6 md:p-14 overflow-y-auto relative z-10 custom-scrollbar">
          
          <button 
            className="absolute top-6 right-6 md:top-10 md:right-10 w-11 h-11 rounded-full border flex items-center justify-center transition-colors z-50 group"
            style={{ 
              borderColor: 'var(--cm-border, rgba(255,255,255,0.08))', 
              background: 'var(--cm-surface-card, rgba(255,255,255,0.03))',
              color: 'var(--cm-text, rgba(255,255,255,0.92))'
            }}
            onClick={close}
            data-testid="create-modal-close"
            aria-label={t('common.close', null, 'Chiudi')}
          >
            <Icons.X size={18} className="group-hover:rotate-90 transition-transform duration-500" />
          </button>

          <div className="md:hidden mb-10 mt-4 px-2">
            <h2 className="text-3xl tracking-tight mb-2" style={{ color: 'var(--cm-text)', fontFamily: 'var(--bp-font-heading, serif)' }}>
              {t('create.modal.title_mobile', null, 'Crea nuovo')}
            </h2>
            <p className="text-sm text-[var(--cm-text-muted,rgba(255,255,255,0.55))]">
              {t('create.modal.hero_caption_short', null, "Seleziona un'entità da aggiungere alla libreria.")}
            </p>
          </div>

          <div className="flex flex-col gap-3 pb-8" data-testid="create-modal-grid">
            {options.map((opt, i) => {
              const isHovered = hoveredOpt?.id === opt.id;
              const isDimmed = hoveredOpt && !isHovered;

              return (
                <motion.button
                  key={opt.id}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => setHoveredOpt(opt)}
                  onMouseLeave={() => setHoveredOpt(null)}
                  onClick={() => handleClick(opt)}
                  data-testid={`create-modal-card-${opt.id}`}
                  className={`group relative flex items-center gap-5 md:gap-7 p-5 md:p-6 rounded-2xl text-left transition-all duration-500 ease-out border overflow-hidden
                    ${isDimmed ? 'opacity-30 md:opacity-40 scale-[0.98]' : 'opacity-100 scale-100'}
                  `}
                  style={{
                    background: isHovered ? 'var(--cm-surface-card-hover, rgba(255,255,255,0.06))' : 'transparent',
                    borderColor: isHovered ? 'var(--cm-border, rgba(255,255,255,0.12))' : 'transparent',
                    boxShadow: isHovered ? '0 20px 40px rgba(0,0,0,0.2)' : 'none'
                  }}
                >
                  {/* Subtle hover gradient inside card */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `linear-gradient(90deg, transparent, ${opt.accent})` }}
                  />

                  {/* Number */}
                  <span className="hidden sm:block font-mono text-[11px] tracking-[0.2em] opacity-60 w-6" style={{ color: 'var(--cm-text-muted)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  {/* Icon Box */}
                  <div 
                    className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center transition-all duration-500 shrink-0 relative z-10"
                    style={{ 
                      backgroundColor: isHovered ? `color-mix(in srgb, ${opt.accent} 12%, transparent)` : 'var(--cm-surface-card, rgba(255,255,255,0.03))',
                      color: isHovered ? opt.accent : 'var(--cm-text-muted, rgba(255,255,255,0.55))',
                      border: `1px solid ${isHovered ? `color-mix(in srgb, ${opt.accent} 25%, transparent)` : 'var(--cm-border, rgba(255,255,255,0.05))'}`,
                      boxShadow: isHovered ? `0 0 20px color-mix(in srgb, ${opt.accent} 15%, transparent)` : 'none'
                    }}
                  >
                    {React.cloneElement(opt.icon, { 
                      size: 26, 
                      strokeWidth: isHovered ? 1.5 : 1.25,
                      className: 'transition-all duration-500'
                    })}
                  </div>

                  {/* Content */}
                  <div className="flex flex-col grow relative z-10">
                    <div className="flex items-center gap-3">
                      <span 
                        className="text-2xl md:text-3xl tracking-tight transition-colors duration-500" 
                        style={{ color: isHovered ? opt.accent : 'var(--cm-text, rgba(255,255,255,0.92))', fontFamily: 'var(--bp-font-heading, "Cormorant Garamond", serif)' }}
                      >
                        {t(opt.titleKey, null, opt.fallbackTitle)}
                      </span>
                      {opt.id === 'moodboard' && (
                        <span 
                          className="text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors duration-500"
                          style={{ 
                            borderColor: isHovered ? opt.accent : 'var(--cm-border, rgba(255,255,255,0.08))', 
                            color: isHovered ? opt.accent : 'var(--cm-text-muted, rgba(255,255,255,0.55))', 
                            backgroundColor: isHovered ? `color-mix(in srgb, ${opt.accent} 10%, transparent)` : 'transparent' 
                          }}
                        >
                          Studio
                        </span>
                      )}
                    </div>
                    <span 
                      className="text-sm mt-1 md:mt-1.5 leading-relaxed pr-6 md:pr-12 max-w-md transition-colors duration-500"
                      style={{ color: isHovered ? 'var(--cm-text, rgba(255,255,255,0.92))' : 'var(--cm-text-muted, rgba(255,255,255,0.55))' }}
                    >
                      {t(opt.descKey, null, opt.fallbackDesc)}
                    </span>
                  </div>

                  {/* Arrow */}
                  <div 
                    className="absolute right-6 md:right-8 transition-all duration-700 ease-out z-10"
                    style={{ 
                      opacity: isHovered ? 1 : 0, 
                      transform: isHovered ? 'translateX(0)' : 'translateX(-15px)',
                      color: opt.accent 
                    }}
                  >
                    <Icons.ArrowRight size={22} strokeWidth={1.5} />
                  </div>
                </motion.button>
              );
            })}
          </div>

        </div>
      </motion.div>
    </div>
  );
}

export default function CreateModal() {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Lazy hooks
  let openNewRelationship = null;
  try {
    // eslint-disable-next-line global-require
    openNewRelationship = require('../../hooks/useNewRelationship').useNewRelationship().open;
  } catch (_) { /* noop */ }
  
  let activeJourney = null;
  try {
    // eslint-disable-next-line global-require
    activeJourney = require('../../hooks/useActiveJourney').useActiveJourney?.()?.journey;
  } catch (_) { /* noop */ }

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(CREATE_MODAL_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CREATE_MODAL_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const options = buildCreationOptions({ navigate, t, openNewRelationship, activeJourney });

  return (
    <AnimatePresence>
      {open && (
        <CreateModalInner 
          options={options} 
          close={() => setOpen(false)} 
          t={t} 
          activeJourney={activeJourney} 
        />
      )}
    </AnimatePresence>
  );
}
