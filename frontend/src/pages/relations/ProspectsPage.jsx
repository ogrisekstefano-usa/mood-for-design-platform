/**
 * ProspectsPage — active relationship layer.
 * Continuation interviews · progression suggestions · momentum indicators.
 */
import React from 'react';
import ClientRelationsLayout from './ClientRelationsLayout';

const ProspectsPage = () => (
  <ClientRelationsLayout
    stage="prospect"
    eyebrow="CLIENT RELATIONS\u2122 · CULTIVATION"
    title="Prospects"
    lede="Relazioni in coltivazione. Qui il dialogo è già iniziato: continua l'intervista, condividi una moodboard, proponi un materiale. Il Design Journey\u2122 inizia solo dopo l'Account promotion."
    endpoint="/api/relations/prospects"
  />
);
export default ProspectsPage;
