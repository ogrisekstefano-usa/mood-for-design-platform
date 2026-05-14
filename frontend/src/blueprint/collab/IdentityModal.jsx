/**
 * IdentityModal — luxury name + email capture. First-comment gate.
 *
 * Mood: NOT a form. A welcoming editorial card that says "we'd love to know
 * who's collaborating" — never "log in". Kept open until completed or cancelled.
 */
import React, { useState } from 'react';

const IdentityModal = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const valid = name.trim().length >= 2
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = (e) => {
    e?.preventDefault();
    if (!valid) return;
    onSubmit(name, email);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6"
         data-testid="identity-modal"
         onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <form onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[420px] bg-[var(--bp-surface-1)] border border-[var(--bp-border)]
                       rounded-[3px] shadow-[0_30px_90px_rgba(0,0,0,0.5)] px-8 py-9">
        <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] mb-3">
          Welcome
        </p>
        <h2 className="font-light text-[var(--bp-text-primary)] text-2xl leading-tight tracking-tight mb-2"
            style={{ fontFamily: 'var(--bp-font-heading)' }}>
          A little context, please.
        </h2>
        <p className="text-[13px] text-[var(--bp-text-secondary)] leading-relaxed mb-6">
          So your designer knows who left this thought. Used only for this
          conversation — no account needed.
        </p>

        <label className="block mb-4">
          <span className="block text-[10px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)] mb-2">
            Your name
          </span>
          <input type="text" value={name}
                 onChange={(e) => setName(e.target.value)}
                 autoFocus
                 data-testid="identity-name"
                 className="w-full bg-transparent border-b border-[var(--bp-border-strong)] py-2
                            text-[15px] text-[var(--bp-text-primary)] focus:outline-none
                            focus:border-[var(--bp-primary)] transition-colors" />
        </label>
        <label className="block mb-7">
          <span className="block text-[10px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)] mb-2">
            Email
          </span>
          <input type="email" value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 data-testid="identity-email"
                 className="w-full bg-transparent border-b border-[var(--bp-border-strong)] py-2
                            text-[15px] text-[var(--bp-text-primary)] focus:outline-none
                            focus:border-[var(--bp-primary)] transition-colors" />
        </label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel}
                  data-testid="identity-cancel"
                  className="text-[11px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)]
                             hover:text-[var(--bp-text-primary)] transition-colors">
            Not now
          </button>
          <div className="flex-1" />
          <button type="submit" disabled={!valid}
                  data-testid="identity-submit"
                  className={`px-5 py-2.5 text-[11px] tracking-[0.18em] uppercase font-medium rounded-[2px]
                              transition-all ${valid
                                ? 'bg-[var(--bp-primary)] text-black hover:brightness-110'
                                : 'bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)] cursor-not-allowed'}`}>
            Continue
          </button>
        </div>
      </form>
    </div>
  );
};

export default IdentityModal;
