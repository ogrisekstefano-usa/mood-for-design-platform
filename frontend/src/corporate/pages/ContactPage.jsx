import React, { useState } from 'react';
import { useCorporatePage } from '../hooks/useCorporatePage';
import SectionRenderer from '../sections/SectionRenderer';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * ContactPage — Hero section + contact form.
 */
const ContactPage = () => {
  const { sections, loading } = useCorporatePage('contact');
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '', inquiry_type: 'general' });
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await axios.post(`${BACKEND_URL}/api/corporate/contact`, form);
      setStatus('success');
      setForm({ name: '', email: '', company: '', message: '', inquiry_type: 'general' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <main data-testid="page-contact">
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-6 h-6 border border-[#00C9B3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        sections.map(s => <SectionRenderer key={s.id} section={s} />)
      )}

      {/* Contact Form */}
      <section className="py-24 bg-white" data-testid="contact-form-section">
        <div className="max-w-5xl mx-auto px-8 md:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

            {/* Info */}
            <div className="lg:col-span-4">
              <p className="overline-teal mb-6">Get in touch</p>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] mb-1">Email</p>
                  <a href="mailto:hello@moodfordesign.com" className="text-sm text-[#5A5A5A] hover:text-[#00C9B3] transition-colors">
                    hello@moodfordesign.com
                  </a>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] mb-1">Headquarters</p>
                  <p className="text-sm text-[#5A5A5A]">Via Tortona 37<br />Milan, Italy 20144</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] mb-1">Office Hours</p>
                  <p className="text-sm text-[#5A5A5A]">Mon–Fri, 9:00–18:00 CET</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-6" data-testid="contact-form">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors"
                    data-testid="contact-name"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors"
                    data-testid="contact-email"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">Company</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors"
                  data-testid="contact-company"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">Inquiry Type</label>
                <select
                  value={form.inquiry_type}
                  onChange={e => setForm(f => ({ ...f, inquiry_type: e.target.value }))}
                  className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors"
                  data-testid="contact-inquiry-type"
                >
                  <option value="general">General Inquiry</option>
                  <option value="sales">Sales & Pricing</option>
                  <option value="partnership">Partnership</option>
                  <option value="press">Press & Media</option>
                  <option value="support">Technical Support</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] block mb-2">Message *</label>
                <textarea
                  rows={6}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full border border-[rgba(10,10,10,0.2)] bg-transparent px-4 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#00C9B3] transition-colors resize-none"
                  data-testid="contact-message"
                  required
                />
              </div>

              {status === 'success' && (
                <div className="bg-[#00C9B3]/10 border border-[#00C9B3] px-4 py-3" data-testid="contact-success">
                  <p className="text-sm text-[#0A0A0A]">Thank you. We'll be in touch within 24 hours.</p>
                </div>
              )}
              {status === 'error' && (
                <div className="bg-red-50 border border-red-200 px-4 py-3" data-testid="contact-error">
                  <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn-primary"
                data-testid="contact-submit"
              >
                {status === 'loading' ? 'Sending...' : 'Send Message'} <span>→</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ContactPage;
