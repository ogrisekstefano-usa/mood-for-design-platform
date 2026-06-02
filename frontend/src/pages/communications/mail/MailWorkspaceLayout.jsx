/**
 * MailWorkspaceLayout — ITER187.B Journey Mail Workspace™
 * Path: /communications/mail (Outlet for sub-pages).
 */
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import './communications-mail.css';

export default function MailWorkspaceLayout() {
  const { pathname } = useLocation();
  if (pathname === '/communications/mail' || pathname === '/communications/mail/') {
    return <Navigate to="/communications/mail/mailboxes" replace />;
  }
  return (
    <div className="cm-page" data-testid="cm-mail-workspace">
      <Outlet />
    </div>
  );
}
