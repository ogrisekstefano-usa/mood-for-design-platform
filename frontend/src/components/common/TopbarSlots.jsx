import { useEffect } from 'react';
import { useTopbarSlots } from '../layout/Topbar';

/**
 * TopbarSlots — page-side helper to project left / center / right content
 * into the global Topbar. Mount this near the top of a page render tree:
 *
 *   <TopbarSlots
 *     left={<ProjectStatusCapsule />}
 *     center={<CanvasToolsCluster />}
 *     right={<EditorActions />}
 *   />
 *
 * Slots reset when the component unmounts (route change), so dashboards and
 * list pages get a clean Topbar automatically.
 *
 * NOTE: this is a side-effect-only component (renders null). It exists so
 * pages can declaratively own the global Topbar without prop drilling.
 */
const TopbarSlots = ({ left = null, center = null, right = null }) => {
  const { setSlots } = useTopbarSlots();

  useEffect(() => {
    setSlots({ left, center, right });
    return () => setSlots({ left: null, center: null, right: null });
    // We re-run on every prop change to keep the slots in sync with the
    // owner's latest state (e.g. status changing while in the editor).
  }, [left, center, right, setSlots]);

  return null;
};

export default TopbarSlots;
