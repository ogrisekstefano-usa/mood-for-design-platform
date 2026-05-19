import React from 'react';
import {
  MessageCircle, Mail, FileText, HardDrive, Image as ImageIcon,
  Table2, FileX, Unlink, ArrowRight,
} from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * FragmentedTools — 8 minimal "the problem today" icons in a horizontal grid.
 * Editorial way to say: scattered tools, MOOD unifies it all.
 *
 * content: {
 *   overline, headline, body, cta?, tools: [{ id, label }]
 * }
 */

const ICON_MAP = {
  whatsapp:   MessageCircle,
  email:      Mail,
  pdf:        FileText,
  drive:      HardDrive,
  pinterest:  ImageIcon,
  excel:      Table2,
  scattered:  FileX,
  unlinked:   Unlink,
};

const DEFAULT_TOOLS = [
  'whatsapp', 'email', 'pdf', 'drive',
  'pinterest', 'excel', 'scattered', 'unlinked',
];

const FragmentedTools = ({ content = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.12 });

  const tools = Array.isArray(content.tools) && content.tools.length > 0
    ? content.tools
    : DEFAULT_TOOLS.map((id) => ({ id, label: id }));

  return (
    <section
      className="relative grain overflow-hidden"
      style={{ background: 'var(--mood-black)' }}
      data-testid="fragmented-tools"
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-20 lg:py-28">
        {content.overline && (
          <p className={`overline-teal text-center mb-6 reveal ${visible ? 'visible' : ''}`}>
            {content.overline}
          </p>
        )}
        {content.headline && (
          <h2
            className={`text-center font-serif font-normal text-white reveal ${visible ? 'visible' : ''}`}
            style={{
              fontSize: 'clamp(2rem, 3.6vw, 3.2rem)',
              lineHeight: 1.08,
              transitionDelay: '0.05s',
              maxWidth: 880,
              margin: '0 auto',
            }}
          >
            {content.headline}
          </h2>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 lg:gap-4 mt-16">
          {tools.map((t, i) => {
            const Icon = ICON_MAP[t.id] || FileX;
            return (
              <div
                key={t.id || i}
                className={`flex flex-col items-center text-center px-4 py-7 reveal ${visible ? 'visible' : ''}`}
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  transitionDelay: `${0.1 + i * 0.04}s`,
                }}
                data-testid={`tool-${t.id || i}`}
              >
                <Icon size={26} strokeWidth={1.3} color="rgba(255,255,255,0.78)" />
                <p
                  className="mt-4"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.6)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t.label}
                </p>
              </div>
            );
          })}
        </div>

        {content.body && (
          <p
            className={`text-center mt-14 mx-auto reveal ${visible ? 'visible' : ''}`}
            style={{
              maxWidth: 760,
              fontSize: '0.95rem',
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.65,
              transitionDelay: '0.4s',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 300,
            }}
          >
            {content.body}
          </p>
        )}

        {content.cta && (
          <div className="text-center mt-8">
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
              data-testid="fragmented-cta"
            >
              {content.cta.text} <ArrowRight size={14} strokeWidth={1.6} />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default FragmentedTools;
