/**
 * FAQSection — accordion of Q&A.
 * content: { eyebrow, headline, items[] }
 */
import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Section, Container, Eyebrow, H2 } from '../Kit';

const FAQSection = ({ content = {} }) => {
  const items = content.items || [];
  const [open, setOpen] = useState(null);
  return (
    <Section data-testid="section-faq">
      <Container narrow>
        {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
        {content.headline && <H2 className="mt-4">{content.headline}</H2>}
        <div className="mt-14 divide-y divide-[var(--bp-border)] border-y border-[var(--bp-border)]">
          {items.map((qa, i) => {
            const isOpen = open === i;
            return (
              <button key={i} onClick={() => setOpen(isOpen ? null : i)}
                className="w-full text-left py-7 flex items-start gap-6 group">
                <span className="text-[var(--bp-primary)] mt-1">
                  {isOpen ? <Minus size={16} strokeWidth={1.5} /> : <Plus size={16} strokeWidth={1.5} />}
                </span>
                <div className="flex-1">
                  <h3 className="bp-body font-medium text-[var(--bp-text-primary)] group-hover:text-[var(--bp-primary)] transition-colors">
                    {qa.question}
                  </h3>
                  {isOpen && qa.answer && (
                    <p className="bp-body text-[var(--bp-text-secondary)] mt-4 animate-fadeIn">{qa.answer}</p>
                  )}
                </div>
              </button>
            );
          })}
          {items.length === 0 && (
            <p className="bp-caption text-[var(--bp-text-muted)] py-7">No questions yet.</p>
          )}
        </div>
      </Container>
    </Section>
  );
};

export default FAQSection;
