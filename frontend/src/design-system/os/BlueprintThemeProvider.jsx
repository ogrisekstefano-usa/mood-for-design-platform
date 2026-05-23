/**
 * BlueprintThemeProvider — surface gate for the MOOD OS UI.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CRITICAL — DO NOT REMOVE                                         ║
 * ║                                                                   ║
 * ║  This wrapper marks its subtree with `data-surface="os"`.         ║
 * ║  Every Blueprint OS layout (DashboardLayout, AdminLayout, the     ║
 * ║  Storefront Studio chrome, settings, workspace, …) MUST live      ║
 * ║  underneath this provider.                                        ║
 * ║                                                                   ║
 * ║  Runtime tenant theme variables (--brand-*) are scoped to         ║
 * ║  `[data-surface="storefront"]` (see TenantThemeContext). Because  ║
 * ║  the OS subtree carries `data-surface="os"`, those tenant vars    ║
 * ║  cannot reach OS components — period.                             ║
 * ║                                                                   ║
 * ║  The OS theme is intentionally FROZEN: tokens live in             ║
 * ║  `/design-system/os/tokens.css` and are not user-customisable.    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import React from 'react';
import './tokens.css';
import '../atelier/index.css';

const BlueprintThemeProvider = ({ children, className = '' }) => (
  <div data-surface="os" data-mfd-theme="blueprint" data-atelier="nordic" className={className}>
    {children}
  </div>
);

export default BlueprintThemeProvider;
