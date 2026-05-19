import React from 'react';
import {
  Sparkles, Heart, Layers, Briefcase, Target, LayoutTemplate, Globe, Users,
  ArrowRight,
} from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * WorkflowEcosystem — minimal horizontal flow that explains MOOD's complete
 * design workflow. Editorial, never SaaS-y. 8 nodes connected by thin arrows.
 *
 * content: {
 *   overline: "Tutto il flow del design. Un unico ecosistema.",
 *   body: "Ogni strumento è progettato per dialogare con gli altri...",
 *   cta: { text, href },
 *   steps: [{ id, title }, ...]
 * }
 * config: { steps?: [{ id, icon }, ...] }   // icon names override
 */

const ICON_MAP = {
  lead:           Sparkles,
  crm:            Heart,
  moodboard:      Layers,
  projects:       Briefcase,
  hotspot:        Target,
  editorial:      LayoutTemplate,
  publishing:     Globe,
  retention:      Users,
};

const DEFAULT_ORDER = ['lead', 'crm', 'moodboard', 'projects', 'hotspot', 'editorial', 'publishing', 'retention'];

const WorkflowEcosystem = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.08 });

  // Merge content.steps (provides title) with config.steps (provides icon override)
  const configById = Object.fromEntries((config.steps || []).map((s) => [s.id, s]));
  const contentSteps = Array.isArray(content.steps) && content.steps.length > 0
    ? content.steps
    : DEFAULT_ORDER.map((id) => ({ id, title: id }));

  return (
    <section
      className="relative grain overflow-hidden"
      style={{ background: 'var(--mood-black)' }}
      data-testid="workflow-ecosystem"
    >
      {/* Top + bottom hairlines for editorial framing */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-20 lg:py-28">
        {content.overline && (
          <p className={`overline-teal text-center mb-16 reveal ${visible ? 'visible' : ''}`}>
            {content.overline}
          </p>
        )}

        {/* Horizontal flow (desktop) */}
        <div className={`hidden lg:flex items-start justify-between gap-2 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.1s' }}>
          {contentSteps.map((step, i) => {
            const iconName = configById[step.id]?.icon || step.id;
            const Icon = ICON_MAP[iconName] || Sparkles;
            return (
              <React.Fragment key={step.id || i}>
                <div className="flex flex-col items-center text-center" style={{ width: 110 }} data-testid={`workflow-step-${step.id || i}`}>
                  <span
                    className="flex items-center justify-center mb-5 transition-transform duration-500"
                    style={{
                      width: 48, height: 48,
                      color: '#00C9B3',
                    }}
                  >
                    <Icon size={32} strokeWidth={1.4} />
                  </span>
                  <p
                    className="uppercase"
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      letterSpacing: '0.18em',
                      lineHeight: 1.5,
                      color: 'rgba(255,255,255,0.78)',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {step.title}
                  </p>
                </div>
                {i < contentSteps.length - 1 && (
                  <div className="flex-1 flex items-center justify-center" style={{ marginTop: 16 }}>
                    <ArrowRight size={18} strokeWidth={1} color="rgba(0,201,179,0.55)" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile / tablet: vertical list */}
        <div className={`lg:hidden grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.1s' }}>
          {contentSteps.map((step, i) => {
            const iconName = configById[step.id]?.icon || step.id;
            const Icon = ICON_MAP[iconName] || Sparkles;
            return (
              <div key={step.id || i} className="flex flex-col items-center text-center">
                <Icon size={28} strokeWidth={1.4} color="#00C9B3" />
                <p
                  className="mt-3 uppercase"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '0.58rem',
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    lineHeight: 1.5,
                    color: 'rgba(255,255,255,0.78)',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {step.title}
                </p>
              </div>
            );
          })}
        </div>

        {content.body && (
          <p
            className={`text-center mt-16 mx-auto font-serif italic reveal ${visible ? 'visible' : ''}`}
            style={{
              maxWidth: 720,
              fontSize: 'clamp(1.05rem, 1.4vw, 1.3rem)',
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.55,
              transitionDelay: '0.2s',
            }}
          >
            {content.body}
          </p>
        )}

        {content.cta && (
          <div className="text-center mt-10">
            <a
              href={content.cta.href || '#'}
              className="inline-flex items-center gap-2 uppercase"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.22em',
                color: '#00C9B3',
                textDecoration: 'none',
              }}
              data-testid="workflow-cta"
            >
              {content.cta.text} <ArrowRight size={14} strokeWidth={1.6} />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default WorkflowEcosystem;
