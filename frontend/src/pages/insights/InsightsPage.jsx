import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';

const InsightsPage = () => {
  const { t } = useBlueprint();
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/api/insights/dashboard').then((r) => setData(r.data)).catch(() => {}); }, []);
  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="insights-page">
      <div className="mb-8">
        <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">{t('nav.section.intelligence')}</p>
        <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">{t('insights.title')}</h1>
      </div>
      <pre className="text-[#A19D98] text-xs font-mono bg-[#141416] border border-white/[0.06] rounded-md p-6 overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};
export default InsightsPage;
