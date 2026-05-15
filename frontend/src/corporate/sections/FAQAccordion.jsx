import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * FAQAccordion — Collapsible FAQ list.
 * Architectural style: no cards, just dividers.
 */
const FAQAccordion = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const [openIndex, setOpenIndex] = useState(null);
  const items = content.items || [];

  return (
    <section className="py-24 bg-white" data-testid="faq-accordion">
      <div className="max-w-4xl mx-auto px-8 md:px-16">
        {content.headline && (
          <h2
            className="font-serif font-light text-4xl md:text-5xl text-[#0A0A0A] tracking-tighter mb-16 reveal"
            ref={ref}
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)' }}
          >
            {content.headline}
          </h2>
        )}

        <div className="border-t border-[rgba(10,10,10,0.1)]">
          {items.map((item, i) => (
            <div
              key={i}
              className="border-b border-[rgba(10,10,10,0.1)]"
              data-testid={`faq-item-${i}`}
            >
              <button
                className="w-full flex items-center justify-between py-6 text-left group"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
                data-testid={`faq-toggle-${i}`}
              >
                <span className="font-sans font-medium text-base text-[#0A0A0A] pr-8 group-hover:text-[#00C9B3] transition-colors">
                  {item.q}
                </span>
                <span className="flex-shrink-0 text-[#0A0A0A] transition-transform duration-300" style={{ transform: openIndex === i ? 'rotate(0)' : '' }}>
                  {openIndex === i ? <Minus size={16} /> : <Plus size={16} />}
                </span>
              </button>
              <div
                className="overflow-hidden transition-all duration-400"
                style={{ maxHeight: openIndex === i ? '300px' : '0', opacity: openIndex === i ? 1 : 0 }}
              >
                <p className="pb-6 text-sm text-[#5A5A5A] leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQAccordion;
