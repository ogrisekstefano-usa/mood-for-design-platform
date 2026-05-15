import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import { SiteProvider } from './SiteContext';
import './site.css';
import './exe.css';
import '../components/demo/demo.css';

const ScrollToTopOnNav = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); } catch (_) { window.scrollTo(0,0); }
  }, [pathname]);
  return null;
};

const SiteLayout = ({ children }) => {
  return (
    <SiteProvider>
      <div className="mfd-site" data-testid="mfd-site-root">
        <ScrollToTopOnNav />
        <SiteHeader />
        <main className="mfd-site__container">
          {children || <Outlet />}
        </main>
        <SiteFooter />
      </div>
    </SiteProvider>
  );
};

export default SiteLayout;
