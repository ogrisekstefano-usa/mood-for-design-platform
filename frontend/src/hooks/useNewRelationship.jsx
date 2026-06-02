/**
 * useNewRelationshipModal — shared launcher hook.
 *
 * Provides a button-ready trigger to open the canonical "+ Nuova Relazione"
 * modal from anywhere (Sidebar, Topbar, Cmd+K, empty states).
 *
 * ITER178: also mounts the global Cmd+K command palette.
 * ITER185.P1: post-create navigation to LeadDetailPage so the user can
 *             immediately start the Discovery interview (DoD acceptance).
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NewRelationshipModal from '../components/relations/NewRelationshipModal';
import CommandPalette, { useCommandPaletteHotkey } from '../components/relations/CommandPalette';

const Ctx = createContext({ open: () => {}, close: () => {}, openCmdK: () => {} });

export function NewRelationshipProvider({ children }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const open = useCallback((opts = null) => { setPrefill(opts); setIsOpen(true); }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const openCmdK = useCallback(() => setCmdkOpen(true), []);
  const closeCmdK = useCallback(() => setCmdkOpen(false), []);

  // ITER185.P1 · Post-create routing
  // ITER186.A · P0.2/P0.3 — naviga al detail Lead per chiudere il gap
  // "Lead resumption UX rotto": la Discovery è già embedded nella pagina.
  const handleCreated = useCallback((payload) => {
    setIsOpen(false);
    if (!payload) return;
    // Lead created via Fast Capture → land on LeadDetailPage which embeds
    // the Discovery panel inline, so the user knows exactly where to resume.
    const leadId = payload?.lead?.id;
    if (leadId) {
      navigate(`/relations/leads/${leadId}`);
      return;
    }
    // Account-targeted Journey created → land on workspace project
    const projectId = payload?.project_id || payload?.id;
    if (projectId) {
      navigate(`/workspace/projects/${projectId}`);
      return;
    }
  }, [navigate]);

  // Global Cmd+K / Ctrl+K hotkey
  useCommandPaletteHotkey(openCmdK);

  return (
    <Ctx.Provider value={{ open, close, openCmdK, prefill }}>
      {children}
      <NewRelationshipModal
        open={isOpen}
        onClose={close}
        prefill={prefill}
        onCreated={handleCreated}
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
