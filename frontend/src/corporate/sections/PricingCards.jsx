import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * PricingCards — Editorial pricing plans.
 * DB-driven plans with multilingual content.
 * Toggle: monthly / yearly billing.
 */
const PricingCards = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const [isYearly, setIsYearly] = useState(false);

  const plans = config.plans || [];
  const planContent = content.plans || {};
  const discount = config.yearly_discount_pct || 20;

  return (
    <section className="py-24 bg-[#F9F9F8]" data-testid="pricing-cards">
      <div className="max-w-7xl mx-auto px-8 md:px-16">

        {content.headline && (
          <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <h2 className="font-serif font-light text-4xl md:text-5xl text-[#0A0A0A] tracking-tighter">
              {content.headline}
            </h2>

            {/* Billing toggle */}
            {config.show_yearly_toggle && (
              <div className="flex items-center gap-4" data-testid="billing-toggle">
                <span
                  className="text-xs font-semibold uppercase tracking-widest cursor-pointer"
                  style={{ color: isYearly ? '#5A5A5A' : '#0A0A0A' }}
                  onClick={() => setIsYearly(false)}
                >
                  Monthly
                </span>
                <button
                  onClick={() => setIsYearly(y => !y)}
                  className="relative w-12 h-6 transition-colors duration-300"
                  style={{ background: isYearly ? '#00C9B3' : '#0A0A0A' }}
                  data-testid="yearly-toggle-btn"
                  aria-label="Toggle yearly billing"
                >
                  <span
                    className="absolute top-1 w-4 h-4 bg-white transition-transform duration-300"
                    style={{ transform: isYearly ? 'translateX(26px)' : 'translateX(4px)' }}
                  />
                </button>
                <span
                  className="text-xs font-semibold uppercase tracking-widest cursor-pointer"
                  style={{ color: isYearly ? '#0A0A0A' : '#5A5A5A' }}
                  onClick={() => setIsYearly(true)}
                >
                  Yearly <span className="text-[#00C9B3]">–{discount}%</span>
                </span>
              </div>
            )}
          </div>
        )}

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 border border-[rgba(10,10,10,0.1)]">
          {plans.map((plan, i) => {
            const pc = planContent[plan.slug] || {};
            const price = isYearly
              ? Math.round((plan.price_yearly || 0) / 12)
              : plan.price_monthly || 0;

            return (
              <div
                key={plan.id || i}
                className={`relative px-8 py-12 border-r last:border-r-0 border-[rgba(10,10,10,0.1)] reveal ${visible ? 'visible' : ''} ${plan.is_featured ? 'bg-white' : 'bg-[#F9F9F8]'}`}
                style={{ transitionDelay: `${i * 0.1}s` }}
                data-testid={`pricing-plan-${plan.slug}`}
              >
                {plan.badge && (
                  <span className="absolute top-6 right-6 text-[0.6rem] font-bold uppercase tracking-widest bg-[#00C9B3] text-[#0A0A0A] px-2 py-1">
                    {plan.badge}
                  </span>
                )}

                <p className="overline mb-2">{pc.name || plan.slug}</p>
                <p className="text-sm text-[#5A5A5A] mb-8 min-h-[2.5rem]">{pc.description}</p>

                {/* Price */}
                <div className="mb-8 pb-8 border-b border-[rgba(10,10,10,0.1)]">
                  {price === 0 ? (
                    <p className="font-serif font-light text-5xl text-[#0A0A0A]">Free</p>
                  ) : (
                    <div className="flex items-end gap-1">
                      <p className="font-serif font-light text-5xl text-[#0A0A0A]">€{price}</p>
                      <p className="text-sm text-[#5A5A5A] mb-2">/mo</p>
                    </div>
                  )}
                  {isYearly && price > 0 && (
                    <p className="text-xs text-[#5A5A5A] mt-1">€{plan.price_yearly}/year, billed annually</p>
                  )}
                </div>

                {/* CTA */}
                <a
                  href="/start-studio"
                  className={plan.is_featured ? 'btn-primary w-full text-center mb-8 block' : 'btn-secondary w-full text-center mb-8 block'}
                  data-testid={`pricing-cta-${plan.slug}`}
                >
                  {pc.cta || 'Get Started'}
                </a>

                {/* Features */}
                {pc.features && (
                  <ul className="space-y-3">
                    {pc.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <Check size={14} className="text-[#00C9B3] mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-[#5A5A5A]">{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingCards;
