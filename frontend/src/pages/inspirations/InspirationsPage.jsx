import React from 'react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { BookOpen } from 'lucide-react';

const InspirationsPage = () => {
  const { t } = useBlueprint();
  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="inspirations-page">
      <div className="mb-8">
        <p className="text-[#6B6863] text-[10px] font-body uppercase tracking-[0.2em] mb-1">{t('nav.section.content')}</p>
        <h1 className="font-heading text-4xl font-light text-[#EFEBE4]">{t('inspirations.title')}</h1>
      </div>
      <div className="text-center py-20">
        <BookOpen size={36} className="text-[#3A3835] mx-auto mb-4" strokeWidth={1} />
        <p className="text-[#6B6863] font-body">{t('inspirations.empty')}</p>
      </div>
    </div>
  );
};
export default InspirationsPage;
