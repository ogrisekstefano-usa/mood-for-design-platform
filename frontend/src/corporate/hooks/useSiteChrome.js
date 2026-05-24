import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocale } from '../../contexts/LocaleContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const useSiteNavigation = () => {
  const { locale } = useLocale();
  const [data, setData] = useState({ main: [], cta: null, secondary_cta: null });
  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/site/navigation?locale=${locale}`)
      .then((r) => setData(r.data || { main: [], cta: null }))
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
