/**
 * ClientThemeProvider — surface gate for the Client Portal UI.
 *
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  CRITICAL — Surface isolation                                   ║
 * ║                                                                 ║
 * ║  This wrapper marks its subtree with `data-surface="client"`.   ║
 * ║  ALL client portal tokens live here, scoped via                 ║
 * ║  /design-system/client/tokens.css. Blueprint OS, Storefront     ║
 * ║  and Corporate site remain completely unaffected.               ║
 * ║                                                                 ║
 * ║  The Client Portal is INTENTIONALLY softer than OS:             ║
 * ║   - warm graphite + ivory + muted gold                          ║
 * ║   - 40% lower visual density                                    ║
 * ║   - Playfair Display only on titles                             ║
 * ║   - no glow, no teal accents, no gradients-of-AI                ║
 * ╚════════════════════════════════════════════════════════════════╝
 */
import React from 'react';
import './tokens.css';

const ClientThemeProvider = ({ children, className = '' }) => (
  <div data-surface="client" data-mfd-theme="client-portal" className={className}>
    {children}
  </div>
);

export default ClientThemeProvider;
