import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EVENTS } from '../../shared/constants/socket-event.constant';
import { ROOMS } from '../../shared/constants/socket-room.constant';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

describe('RealtimeService', () => {
  const emit = jest.fn<(event: string, payload: unknown) => void>();
  const to = jest.fn<(room: string) => { emit: typeof emit }>();
  const gateway = {
    getServer: jest.fn(() => ({
      to,
    })),
  };

  let service: RealtimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    to.mockReturnValue({ emit });
    service = new RealtimeService(gateway as unknown as RealtimeGateway);
  });

  it('emits created and updated messages to the conversation room', () => {
    const message = {
      id: 'message-id',
      conversationId: 'conversation-id',
      parentId: null,
      content: 'hello',
      isEdited: false,
      editedAt: null,
      createdAt: new Date('2026-05-31T00:00:00.000Z'),
      sender: {
        id: 'user-id',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
      },
      attachments: [],
      replyCount: 0,
    };

    service.emitMessageCreated(message);
    service.emitMessageUpdated(message);

    expect(to).toHaveBeenCalledWith(ROOMS.conversation('conversation-id'));
    expect(emit).toHaveBeenCalledWith(
      EVENTS.MESSAGE_NEW,
      expect.objectContaining({
        id: 'message-id',
        createdAt: '2026-05-31T00:00:00.000Z',
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      EVENTS.MESSAGE_UPDATED,
      expect.objectContaining({
        id: 'message-id',
      }),
    );
  });

  it('emits deleted messages and notifications to target rooms', () => {
    service.emitMessageDeleted({
      id: 'message-id',
      conversationId: 'conversation-id',
    });
    service.emitNotificationCreated({
      id: 'notification-id',
      userId: 'user-id',
      actorId: 'actor-id',
      workspaceId: 'workspace-id',
      conversationId: null,
      messageId: null,
      type: 'MENTION',
      payload: { text: 'mentioned you' },
      createdAt: new Date('2026-05-31T01:00:00.000Z'),
    });

    expect(to).toHaveBeenCalledWith(ROOMS.conversation('conversation-id'));
    expect(emit).toHaveBeenCalledWith(EVENTS.MESSAGE_DELETED, {
      id: 'message-id',
      conversationId: 'conversation-id',
    });
    expect(to).toHaveBeenCalledWith(ROOMS.user('user-id'));
    expect(emit).toHaveBeenCalledWith(
      EVENTS.NOTIFICATION_NEW,
      expect.objectContaining({
        id: 'notification-id',
        createdAt: '2026-05-31T01:00:00.000Z',
      }),
    );
  });

  it('emits pinned message changes to the conversation room', () => {
    const payload = {
      conversationId: 'conversation-id',
      messageId: 'message-id',
      pinnedBy: 'user-id',
    };

    service.emitPinnedMessageAdded(payload);
    service.emitPinnedMessageRemoved(payload);

    expect(to).toHaveBeenCalledWith(ROOMS.conversation('conversation-id'));
    expect(emit).toHaveBeenCalledWith(EVENTS.PINNED_MESSAGE_ADDED, payload);
    expect(emit).toHaveBeenCalledWith(EVENTS.PINNED_MESSAGE_REMOVED, payload);
  });
});
