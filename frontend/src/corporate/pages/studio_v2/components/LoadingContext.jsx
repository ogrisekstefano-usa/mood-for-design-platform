/**
 * LoadingContext — global show/hide control for MoodLoadingOverlay.
 *
 * Usage in any component:
 *   const { withLoading } = useLoading();
 *   await withLoading('Verifica…', async () => { await api(); });
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import MoodLoadingOverlay from './MoodLoadingOverlay';

const LoadingCtx = createContext({ show: () => {}, hide: () => {}, withLoading: async () => {} });

export const LoadingProvider = ({ children, defaultMessage = 'Un attimo…' }) => {
  const [state, setState] = useState({ visible: false, message: defaultMessage });
  // Ref-counted: multiple async calls don't fight over the overlay state.
  const refCount = useRef(0);

  const show = useCallback((message) => {
    refCount.current += 1;
    setState({ visible: true, message: message || defaultMessage });
  }, [defaultMessage]);

  const hide = useCallback(() => {
    refCount.current = Math.max(0, refCount.current - 1);
    if (refCount.current === 0) setState((s) => ({ ...s, visible: false }));
  }, []);

  const withLoading = useCallback(async (message, fn) => {
    show(message);
    try { return await fn(); }
    finally { hide(); }
  }, [show, hide]);

  return (
    <LoadingCtx.Provider value={{ show, hide, withLoading }}>
      {children}
      <MoodLoadingOverlay show={state.visible} message={state.message} />
    </LoadingCtx.Provider>
  );
};

export const useLoading = () => useContext(LoadingCtx);

export default LoadingProvider;
