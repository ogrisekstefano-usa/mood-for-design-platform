/**
 * QuoteSection — editorial pull-quote.
 * content: { quote, author, role, alignment }
 */
import React from 'react';
import { Section, Container } from '../Kit';

const QuoteSection = ({ content = {} }) => {
  const align = content.alignment === 'left' ? 'text-left' : 'text-center';
  return (
    <Section data-testid="section-quote">
      <Container narrow className={`${align}`}>
        <span className="block text-[var(--bp-primary)] bp-display leading-none mb-4" aria-hidden>"</span>
        <blockquote className="bp-h2 text-[var(--bp-text-primary)] italic font-light">
          {content.quote}
        </blockquote>
        {(content.author || content.role) && (
          <footer className="mt-8 bp-caption text-[var(--bp-text-muted)] tracking-[0.18em] uppercase">
            {content.author}
            {content.role && <span className="text-[var(--bp-text-subtle)]"> · {content.role}</span>}
          </footer>
        )}
      </Container>
    </Section>
  );
};

export default QuoteSection;
