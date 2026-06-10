import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { ReactionDto } from './dto/reaction.dto';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('uuid', () => ({
  v7: () => 'reaction-id',
}));

function getControllerHandler(methodName: keyof ReactionsController) {
  return Object.getOwnPropertyDescriptor(
    ReactionsController.prototype,
    methodName,
  )?.value as (...args: unknown[]) => unknown;
}

describe('ReactionsController', () => {
  const service = {
    toggleReaction:
      jest.fn<
        (
          userId: string,
          messageId: string,
          dto: ReactionDto,
        ) => Promise<unknown>
      >(),
    getReactions:
      jest.fn<(messageId: string, userId: string) => Promise<unknown>>(),
    removeReaction:
      jest.fn<
        (
          userId: string,
          messageId: string,
          dto: ReactionDto,
        ) => Promise<unknown>
      >(),
  };

  let controller: ReactionsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReactionsController(
      service as unknown as ReactionsService,
    );
  });

  it('exposes POST /messages/:messageId/reactions', () => {
    const handler = getControllerHandler('toggleReaction');

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'messages/:messageId/reactions',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
  });

  it('exposes GET /messages/:messageId/reactions', () => {
    const handler = getControllerHandler('getReactions');

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      '/messages/:messageId/reactions',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    );
  });

  it('exposes DELETE /messages/:messageId/reactions/:emoji', () => {
    const handler = getControllerHandler('removeReaction');

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'messages/:messageId/reactions/:emoji',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.DELETE,
    );
  });

  it('passes authenticated user id, message id, and dto when toggling a reaction', async () => {
    const user: UserInterface = { id: 'user-id', email: 'user@example.com' };
    const dto: ReactionDto = { emoji: '👍' };
    service.toggleReaction.mockResolvedValue({
      id: 'reaction-id',
      messageId: 'message-id',
      emoji: '👍',
    });

    const result = await controller.toggleReaction('message-id', user, dto);

    expect(service.toggleReaction).toHaveBeenCalledWith(
      'user-id',
      'message-id',
      dto,
    );
    expect(result).toMatchObject({ id: 'reaction-id' });
  });

  it('passes message id and authenticated user id when listing reactions', async () => {
    const user: UserInterface = { id: 'user-id', email: 'user@example.com' };
    service.getReactions.mockResolvedValue([
      { emoji: '👍', count: 1, reactedByMe: true },
    ]);

    const result = await controller.getReactions('message-id', user);

    expect(service.getReactions).toHaveBeenCalledWith('message-id', 'user-id');
    expect(result).toEqual([{ emoji: '👍', count: 1, reactedByMe: true }]);
  });

  it('passes authenticated user id, message id, and dto when removing a reaction', async () => {
    const user: UserInterface = { id: 'user-id', email: 'user@example.com' };
    const dto: ReactionDto = { emoji: '👍' };
    service.removeReaction.mockResolvedValue({
      id: 'reaction-id',
      messageId: 'message-id',
      emoji: '👍',
    });

    const result = await controller.removeReaction('message-id', dto, user);

    expect(service.removeReaction).toHaveBeenCalledWith(
      'user-id',
      'message-id',
      dto,
    );
    expect(result).toMatchObject({ id: 'reaction-id' });
  });
});
