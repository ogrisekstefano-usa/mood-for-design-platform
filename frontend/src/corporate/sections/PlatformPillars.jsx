import React from 'react';
import { Compass, LayoutTemplate, Heart, Layers, Briefcase } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const PILLARS = ['p1', 'p2', 'p3', 'p4', 'p5'];
const ICONS = { p1: Compass, p2: LayoutTemplate, p3: Heart, p4: Layers, p5: Briefcase };

const PlatformPillars = ({ content = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });

  return (
    <section
      className="relative"
      style={{ background: '#000000' }}
      data-testid="platform-pillars"
    >
      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-y-12 lg:gap-y-0">
          {PILLARS.map((k, i) => {
            const title = content[`${k}.title`];
            const body  = content[`${k}.body`];
            if (!title) return null;
            const Icon = ICONS[k];
            return (
              <div
                key={k}
                className={`text-center reveal ${visible ? 'visible' : ''}`}
                style={{
                  transitionDelay: `${i * 0.07}s`,
                  paddingLeft:  i > 0 ? '1.75rem' : 0,
                  paddingRight: i < PILLARS.length - 1 ? '1.75rem' : 0,
                  borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}
                data-testid={`pillar-${i + 1}`}
              >
                <div
                  className="mx-auto mb-6 flex items-center justify-center"
                  style={{
                    width: 60, height: 60,
                    borderRadius: '50%',
                    border: '1px solid var(--mood-teal)',
                    color: 'var(--mood-teal)',
                    background: 'rgba(0,201,179,0.04)',
                  }}
                >
                  <Icon size={26} strokeWidth={1.3} />
                </div>
                <h3
                  style={{
                    fontFamily: 'Playfair Display, serif',
                    fontWeight: 500,
                    fontSize: '1.35rem',
                    lineHeight: 1.25,
                    color: 'var(--mood-text-1)',
                  }}
                >
                  {title}
                </h3>
                {body && (
                  <p
                    style={{
                      marginTop: '0.85rem',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.92rem',
                      lineHeight: 1.55,
                      color: 'var(--mood-text-2)',
                      maxWidth: '24ch',
                      marginInline: 'auto',
                    }}
                  >
                    {body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlatformPillars;
