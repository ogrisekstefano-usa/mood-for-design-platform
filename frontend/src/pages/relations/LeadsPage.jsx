/**
 * LeadsPage — discovery-oriented atmospheric cards.
 * No tables. Signal-driven editorial grid.
 */
import React from 'react';
import ClientRelationsLayout from './ClientRelationsLayout';

const LeadsPage = () => (
  <ClientRelationsLayout
    stage="lead"
    eyebrow="CLIENT RELATIONS\u2122 · DISCOVERY"
    title="Leads"
    lede="Signals appearing on your studio. Each card is an atmosphere, a registro culturale, materiale e momento — non un record commerciale."
    endpoint="/api/relations/leads"
  />
);
export default LeadsPage;
