/**
 * ClientMessagesPage — ITER151 Sprint B
 *
 * Now powered by the Real Conversation Engine™ (new API at
 * /api/conversation). Polling 5s, optimistic send, unread auto-clear,
 * editorial layout via <ConversationSurface variant="client" />.
 */
import React from 'react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import ConversationSurface from '../../components/conversation/ConversationSurface';

const ClientMessagesPage = () => {
  const { locale } = useBlueprint();
  return (
    <div
      data-testid="client-messages-page"
      className="max-w-[1100px] mt-2"
      style={{ paddingBottom: 16 }}
    >
      <ConversationSurface variant="client" locale={(locale || 'it').slice(0, 2)} fillHeight />
    </div>
  );
};

export default ClientMessagesPage;
