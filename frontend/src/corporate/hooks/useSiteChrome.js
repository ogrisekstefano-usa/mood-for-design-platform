import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocale } from '../../contexts/LocaleContext';
import { LOCALIZED_SLUGS } from '../routes/localizedSlugs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/** Translate a canonical Italian nav href to the locale-specific path. */
const localizeHref = (href, locale) => {
  if (!href || !locale) return href;
  for (const [, slugMap] of Object.entries(LOCALIZED_SLUGS)) {
    const itPath = slugMap['it-IT'] || slugMap['it'];
    if (itPath === href) {
      return slugMap[locale] || slugMap[locale.toLowerCase()] || href;
    }
  }
  return href;
};

export const useSiteNavigation = () => {
  const { locale } = useLocale();
  const [data, setData] = useState({ main: [], right: [], cta: null });
  useEffect(() => {
    if (!locale) return;
    axios.get(`${BACKEND_URL}/api/site/navigation?locale=${locale}`)
      .then((r) => setData({
        main:  (r.data?.main  || []).map(i => ({ ...i, href: localizeHref(i.href, locale) })),
        right: (r.data?.right || []).map(i => ({ ...i, href: localizeHref(i.href, locale) })),
        cta:   r.data?.cta ? { ...r.data.cta, href: localizeHref(r.data.cta.href, locale) } : null,
      }))
      .catch(() => {});
  }, [locale]);
  return data;
};

export const useSiteFooter = () => {
  const { locale } = useLocale();
  const [data, setData] = useState({ manifesto: '', copyright: '', links: [], legal: [], social: [] });
  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/site/footer?locale=${locale}`)
      .then((r) => setData(r.data || {}))
      .catch(() => {});
  }, [locale]);
  return data;
};
