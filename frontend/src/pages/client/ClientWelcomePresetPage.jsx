/**
 * ClientWelcomePresetPage · ITER162
 *
 * Wrapper di routing che:
 *   1. carica /api/client/welcome-summary
 *   2. risolve il preset corrente via presetEngine
 *   3. renderizza la versione del Welcome Panel scelta
 *
 * Per ora il preset è sempre Atelier. La struttura è già pronta per
 * Axis / Gallery / Residence: basta aggiungere il render branch.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { resolveClientProfilePreset } from '../../presets/client-profile/presetEngine';
import { buildAtelierViewModel } from '../../presets/client-profile/atelier/atelierViewModel';
import AtelierWelcomePanel from '../../presets/client-profile/atelier/AtelierWelcomePanel';

const ClientWelcomePresetPage = () => {
  const [search] = useSearchParams();
  const [data, setData]   = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Preview override (Blueprint admin can hot-swap preset via ?preset=)
  const overrideKey = search.get('preset');

  const config_resolved = useMemo(
    () => resolveClientProfilePreset({
      overrideKey: overrideKey || config?.preset_key,
    }),
    [overrideKey, config],
  );

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.get('/api/client/welcome-summary'),
      api.get('/api/client/profile-config'),
    ]).then(([wsRes, cfgRes]) => {
      if (!alive) return;
      setData(wsRes.status === 'fulfilled' ? wsRes.value.data : {});
      setConfig(cfgRes.status === 'fulfilled' ? cfgRes.value.data : null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="atelier-shell" data-testid="client-welcome-preset-loading">
        <div style={{ margin: 'auto', color: '#c8c2b6', fontStyle: 'italic' }}>
          Stiamo preparando il tuo spazio…
        </div>
      </div>
    );
  }

  const viewModel = buildAtelierViewModel(data, {
    placeholders: config?.placeholders || {},
  });

  // Preset switch (atelier-only for P0)
  if (config_resolved.preset === 'atelier') {
    return (
      <AtelierWelcomePanel
        viewModel={viewModel}
        components={config_resolved.components}
      />
    );
  }

  // Fallback (other presets not implemented yet)
  return (
    <AtelierWelcomePanel viewModel={viewModel} components={config_resolved.components} />
  );
};

export default ClientWelcomePresetPage;
