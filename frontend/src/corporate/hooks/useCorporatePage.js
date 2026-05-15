import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocale } from '../../contexts/LocaleContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const useCorporatePage = (slug) => {
  const { locale } = useLocale();
  const [page, setPage] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    axios
      .get(`${BACKEND_URL}/api/corporate/pages/${slug}?locale=${locale}`)
      .then(res => {
        setPage(res.data.page || null);
        setSections(res.data.sections || []);
      })
      .catch(err => {
        setError(err);
        console.error(`[MOOD] Failed to fetch page "${slug}":`, err.message);
      })
      .finally(() => setLoading(false));
  }, [slug, locale]);

  return { page, sections, loading, error };
};
