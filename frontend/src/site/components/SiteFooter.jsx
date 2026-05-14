import React from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../SiteContext';
import { navigationContent } from '../content/navigation';

const SiteFooter = () => {
  const { pick } = useSite();
  const year = new Date().getFullYear();
  const copy = pick(navigationContent.footer.copyright)
    .replace('{year}', year)
    .replace('{brand}', navigationContent.brand.name);

  return (
    <footer className="mfd-footer" data-testid="site-footer">
      <div className="mfd-footer__grid">
        <div className="mfd-footer__col">
          <div className="mfd-footer__brand">
            {navigationContent.brand.name}<sup>{navigationContent.brand.suffix}</sup>
          </div>
          <p className="mfd-body" style={{ maxWidth: '40ch' }}>{pick(navigationContent.footer.blurb)}</p>
        </div>
        {navigationContent.footer.columns.map((col) => (
          <div className="mfd-footer__col" key={col.id} data-testid={`footer-col-${col.id}`}>
            <h6>{pick(col.title)}</h6>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {col.links.map((l, i) => {
                const label = pick(l.label);
                const href = l.href || '#';
                const isExternal = href.startsWith('http') || href.startsWith('mailto:');
                const isHash = href.startsWith('#');
                return (
                  <li key={`${col.id}-${i}`}>
                    {isExternal || isHash ? (
                      <a href={href}>{label}</a>
                    ) : (
                      <Link to={href}>{label}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="mfd-footer__bottom">
        <span>{copy}</span>
        <div className="mfd-footer__bottom-links">
          {navigationContent.footer.legal.map((l) => (
            <a key={l.id} href={l.href}>{pick(l.label)}</a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
