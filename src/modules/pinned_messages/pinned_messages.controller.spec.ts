import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('uuid', () => ({
  v7: () => 'pinned-message-id',
}));

import { PinnedMessagesController } from './pinned_messages.controller';
import { PinnedMessagesService } from './pinned_messages.service';

type AuthenticatedUser = {
  id: string;
};

function getControllerHandler(methodName: keyof PinnedMessagesController) {
  return Object.getOwnPropertyDescriptor(
    PinnedMessagesController.prototype,
    methodName,
  )?.value as (...args: unknown[]) => unknown;
}

describe('PinnedMessagesController', () => {
  const service = {
    pinMessage:
      jest.fn<(messageId: string, userId: string) => Promise<unknown>>(),
    unpinMessage:
      jest.fn<(messageId: string, userId: string) => Promise<unknown>>(),
  };

  let controller: PinnedMessagesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PinnedMessagesController(
      service as unknown as PinnedMessagesService,
    );
  });

  it('exposes POST /messages/:messageId/pin', () => {
    const handler = getControllerHandler('pinMessage');

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'messages/:messageId/pin',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
  });

  it('exposes DELETE /messages/:messageId/pin', () => {
    const handler = getControllerHandler('unpinMessage');

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'messages/:messageId/pin',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.DELETE,
    );
  });

  it('passes message id and authenticated user id when pinning', async () => {
    const user: AuthenticatedUser = { id: 'user-id' };
    service.pinMessage.mockResolvedValue({
      id: 'pinned-message-id',
      messageId: 'message-id',
    });

    const result = await controller.pinMessage('message-id', user);

    expect(service.pinMessage).toHaveBeenCalledWith('message-id', 'user-id');
    expect(result).toMatchObject({ id: 'pinned-message-id' });
  });

  it('passes message id and authenticated user id when unpinning', async () => {
    const user: AuthenticatedUser = { id: 'user-id' };
    service.unpinMessage.mockResolvedValue({
      id: 'pinned-message-id',
      messageId: 'message-id',
    });

    const result = await controller.unpinMessage('message-id', user);

    expect(service.unpinMessage).toHaveBeenCalledWith('message-id', 'user-id');
    expect(result).toMatchObject({ id: 'pinned-message-id' });
  });
});
