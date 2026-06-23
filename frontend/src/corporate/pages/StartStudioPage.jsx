import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * StartStudioPage — DEPRECATED.
 * The studio activation flow lives at /studio (StudioFunnelV2).
 * This page redirects silently to avoid dead links from old bookmarks/emails.
 */
const StartStudioPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/studio', { replace: true });
  }, [navigate]);
  return null;
};

export default StartStudioPage;
