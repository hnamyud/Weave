import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

const mockUuid = jest.fn<() => string>();

jest.mock('uuid', () => ({
  v7: mockUuid,
}));

import { PrismaService } from '../../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ReactionsService } from './reactions.service';

describe('ReactionsService', () => {
  const prisma = {
    message: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
    reaction: {
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
      delete: jest.fn<(args: any) => Promise<any>>(),
    },
    $queryRaw:
      jest.fn<
        (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>
      >(),
  };
  const realtimeService = {
    emitReactionAdded: jest.fn<(payload: unknown) => void>(),
    emitReactionRemoved: jest.fn<(payload: unknown) => void>(),
  };
  const reactionUser = {
    id: 'user-id',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
  };

  let service: ReactionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUuid.mockReset().mockReturnValue('reaction-id');
    service = new ReactionsService(
      prisma as unknown as PrismaService,
      realtimeService as unknown as RealtimeService,
    );
  });

  it('returns an empty reaction summary for an accessible message without reactions', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      conversation: { isArchived: false },
    });
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await service.getReactions('message-id', 'user-id');

    expect(prisma.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'message-id',
          isDeleted: false,
        }),
      }),
    );
    expect(result).toEqual([]);
  });

  it('reports a missing reaction for an accessible message with no matching reaction', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      conversation: { isArchived: false },
    });
    prisma.reaction.findUnique.mockResolvedValue(null);

    await expect(
      service.removeReaction('user-id', 'message-id', { emoji: '👍' }),
    ).rejects.toThrow('Reaction not found');

    expect(prisma.reaction.delete).not.toHaveBeenCalled();
  });

  it('returns an existing reaction when a concurrent create hits the unique reaction constraint', async () => {
    const existingReaction = {
      id: 'existing-reaction-id',
      messageId: 'message-id',
      userId: 'user-id',
      emoji: '👍',
      user: reactionUser,
    };
    const uniqueViolation = Object.assign(
      new Error('Unique constraint failed'),
      {
        code: 'P2002',
      },
    );

    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      conversation: { isArchived: false },
    });
    prisma.reaction.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingReaction);
    prisma.reaction.create.mockRejectedValue(uniqueViolation);

    const result = await service.toggleReaction('user-id', 'message-id', {
      emoji: '👍',
    });

    expect(result).toEqual({
      message: 'Reaction already exists',
      reaction: existingReaction,
    });
    expect(realtimeService.emitReactionAdded).not.toHaveBeenCalled();
  });

  it('emits realtime events after adding and removing reactions', async () => {
    const createdReaction = {
      id: 'reaction-id',
      messageId: 'message-id',
      userId: 'user-id',
      emoji: '👍',
      user: reactionUser,
    };

    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      conversation: { isArchived: false },
    });
    prisma.reaction.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdReaction);
    prisma.reaction.create.mockResolvedValue(createdReaction);
    prisma.reaction.delete.mockResolvedValue(createdReaction);

    await service.toggleReaction('user-id', 'message-id', { emoji: '👍' });
    await service.removeReaction('user-id', 'message-id', { emoji: '👍' });

    expect(realtimeService.emitReactionAdded).toHaveBeenCalledWith({
      conversationId: 'conversation-id',
      messageId: 'message-id',
      userId: 'user-id',
      emoji: '👍',
      user: reactionUser,
    });
    expect(realtimeService.emitReactionRemoved).toHaveBeenCalledWith({
      conversationId: 'conversation-id',
      messageId: 'message-id',
      userId: 'user-id',
      emoji: '👍',
      user: reactionUser,
    });
  });

  it('rejects reactions for inaccessible messages', async () => {
    prisma.message.findFirst.mockResolvedValue(null);

    await expect(
      service.toggleReaction('user-id', 'message-id', { emoji: '👍' }),
    ).rejects.toThrow(NotFoundException);
  });
});
