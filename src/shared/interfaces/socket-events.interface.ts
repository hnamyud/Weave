import { EVENTS } from '../constants/socket-event.constant';
import { SocketConversation } from './socket-conversation.interface';
import { SocketMember } from './socket-member.interface';
import { SocketMessage, SocketPinnedMessage } from './socket-message.interface';
import { SocketNotification } from './socket-notification.interface';
import { SocketPresence } from './socket-presence.interface';
import { SocketPresenceSnapshot } from './socket-presence.interface';
import { SocketReaction } from './socket-reaction.interface';
import { SocketTyping } from './socket-typing.interface';

// Events the server listens for (client emits these)
export interface ClientToServerEvents {
  [EVENTS.JOIN_WORKSPACE]: (
    workspaceId: string,
    ack: (response: { joined: true; roomId: string }) => void,
  ) => void;
  [EVENTS.JOIN_CONVERSATION]: (
    conversationId: string,
    ack: (response: { joined: true; roomId: string }) => void,
  ) => void;
  [EVENTS.LEAVE_CONVERSATION]: (conversationId: string) => void;
  [EVENTS.TYPING_START]: (conversationId: string) => void;
  [EVENTS.TYPING_STOP]: (conversationId: string) => void;
  [EVENTS.PRESENCE_JOIN]: (
    payload: { workspaceId: string },
    ack: (response: { onlineUserIds: string[] }) => void,
  ) => void;
}

// Events the client listens for (server emits these)
export interface ServerToClientEvents {
  [EVENTS.MESSAGE_NEW]: (payload: SocketMessage) => void;
  [EVENTS.MESSAGE_UPDATED]: (payload: SocketMessage) => void;
  [EVENTS.MESSAGE_DELETED]: (payload: {
    id: string;
    conversationId: string;
  }) => void;

  [EVENTS.REACTION_ADDED]: (payload: SocketReaction) => void;
  [EVENTS.REACTION_REMOVED]: (payload: SocketReaction) => void;

  [EVENTS.CONVERSATION_UPDATED]: (payload: SocketConversation) => void;
  [EVENTS.CONVERSATION_DELETED]: (payload: { id: string }) => void;
  [EVENTS.WORKSPACE_DELETED]: (payload: { id: string }) => void;
  [EVENTS.MEMBER_JOINED]: (payload: SocketMember) => void;
  [EVENTS.MEMBER_LEFT]: (payload: SocketMember) => void;

  [EVENTS.TYPING]: (payload: SocketTyping) => void;
  [EVENTS.NOTIFICATION_NEW]: (payload: SocketNotification) => void;
  [EVENTS.USER_PRESENCE]: (payload: SocketPresence) => void;
  [EVENTS.PRESENCE_SNAPSHOT]: (payload: SocketPresenceSnapshot) => void;

  [EVENTS.PINNED_MESSAGE_ADDED]: (payload: SocketPinnedMessage) => void;
  [EVENTS.PINNED_MESSAGE_REMOVED]: (payload: SocketPinnedMessage) => void;
}
