/**
 * AtelierTimeline · ITER162
 *
 * "Il tuo Journey inizia ora" — visual editorial timeline a 4 step.
 * Stile: nodi tondi, linea sottile, check/icona per stato.
 */
import React from 'react';
import { Check, Ear, Pencil, Users } from 'lucide-react';

const ICONS = {
  check: Check,
  ear: Ear,
  pencil: Pencil,
  users: Users,
};

const AtelierTimeline = ({ steps }) => {
  return (
    <section className="atelier-tl" data-testid="atelier-timeline">
      <header className="atelier-tl__head">
        <p className="atelier-tl__title" data-testid="atelier-timeline-title">
          Il tuo Journey inizia ora
        </p>
      </header>

      <ol className="atelier-tl__rail" role="list">
        {steps.map((step, i) => {
          const Icon = ICONS[step.icon] || Check;
          return (
            <li
              key={step.id}
              className={`atelier-tl__step is-${step.status}`}
              data-testid={`atelier-timeline-step-${step.id}`}
              data-status={step.status}
            >
              <span className="atelier-tl__node" aria-hidden>
                <Icon size={14} strokeWidth={1.8} />
              </span>
              <p className="atelier-tl__label">
                {step.label.split('\n').map((l, k, a) => (
                  <React.Fragment key={k}>
                    {l}{k < a.length - 1 ? <br /> : null}
                  </React.Fragment>
                ))}
              </p>
              {i < steps.length - 1 && (
                <span aria-hidden className="atelier-tl__connector" />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default AtelierTimeline;
