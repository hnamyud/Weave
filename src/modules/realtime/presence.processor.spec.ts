import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PresenceLastSeenJobData,
  PresenceLastSeenProcessor,
} from './presence.processor';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

describe('PresenceLastSeenProcessor', () => {
  const prisma = {
    user: {
      update: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
  };

  let processor: PresenceLastSeenProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.update.mockResolvedValue({});
    processor = new PresenceLastSeenProcessor(
      prisma as unknown as PrismaService,
    );
  });

  it('persists lastSeenAt for the disconnected user', async () => {
    await processor.process({
      data: {
        userId: 'user-id',
        lastSeenAt: '2026-06-13T14:00:00.000Z',
      },
    } as Job<PresenceLastSeenJobData>);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { lastSeenAt: new Date('2026-06-13T14:00:00.000Z') },
    });
  });
});
