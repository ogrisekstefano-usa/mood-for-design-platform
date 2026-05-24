/**
 * AccountsPage — active project execution.
 * Design Journey™ live · moodboards · proposals · approvals.
 */
import React from 'react';
import ClientRelationsLayout from './ClientRelationsLayout';

const AccountsPage = () => (
  <ClientRelationsLayout
    stage="account"
    eyebrow="CLIENT RELATIONS\u2122 · ACTIVE STUDIO"
    title="Accounts"
    lede="Progetti vivi. Ogni account ha un Design Journey\u2122 attivo — moodboards, proposte, materiali, conversazioni. La memoria del progetto vive qui."
    endpoint="/api/relations/accounts"
    showFilters
  />
);
export default AccountsPage;
