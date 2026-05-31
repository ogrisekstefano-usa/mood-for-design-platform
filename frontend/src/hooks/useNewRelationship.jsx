/**
 * useNewRelationshipModal — shared launcher hook.
 *
 * Provides a button-ready trigger to open the canonical "+ Nuova Relazione"
 * modal from anywhere (Sidebar, Topbar, Cmd+K, empty states).
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import NewRelationshipModal from '../components/relations/NewRelationshipModal';

const Ctx = createContext({ open: () => {}, close: () => {} });

export function NewRelationshipProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const open = useCallback((opts = null) => { setPrefill(opts); setIsOpen(true); }, []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <Ctx.Provider value={{ open, close, prefill }}>
      {children}
      <NewRelationshipModal
        open={isOpen}
        onClose={close}
        prefill={prefill}
        onCreated={() => { setIsOpen(false); }}
      />
    </Ctx.Provider>
  );
}

export function useNewRelationship() {
  return useContext(Ctx);
}
