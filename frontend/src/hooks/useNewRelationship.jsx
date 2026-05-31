/**
 * useNewRelationshipModal — shared launcher hook.
 *
 * Provides a button-ready trigger to open the canonical "+ Nuova Relazione"
 * modal from anywhere (Sidebar, Topbar, Cmd+K, empty states).
 *
 * ITER178: also mounts the global Cmd+K command palette.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import NewRelationshipModal from '../components/relations/NewRelationshipModal';
import CommandPalette, { useCommandPaletteHotkey } from '../components/relations/CommandPalette';

const Ctx = createContext({ open: () => {}, close: () => {}, openCmdK: () => {} });

export function NewRelationshipProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const open = useCallback((opts = null) => { setPrefill(opts); setIsOpen(true); }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const openCmdK = useCallback(() => setCmdkOpen(true), []);
  const closeCmdK = useCallback(() => setCmdkOpen(false), []);

  // Global Cmd+K / Ctrl+K hotkey
  useCommandPaletteHotkey(openCmdK);

  return (
    <Ctx.Provider value={{ open, close, openCmdK, prefill }}>
      {children}
      <NewRelationshipModal
        open={isOpen}
        onClose={close}
        prefill={prefill}
        onCreated={() => { setIsOpen(false); }}
      />
      <CommandPalette
        open={cmdkOpen}
        onClose={closeCmdK}
        onCreateLead={(prefillData) => { open(prefillData); }}
      />
    </Ctx.Provider>
  );
}

export function useNewRelationship() {
  return useContext(Ctx);
}
