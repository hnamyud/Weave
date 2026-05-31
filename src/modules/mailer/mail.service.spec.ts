import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { UsersService } from '../users/users.service';
import { MailService } from './mail.service';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

type RedisPipelineMock = {
  incr: jest.Mock<(key: string) => RedisPipelineMock>;
  expire: jest.Mock<(key: string, seconds: number) => RedisPipelineMock>;
  exec: jest.Mock<() => Promise<unknown>>;
};

describe('MailService', () => {
  const userService = {
    findOneByEmail: jest.fn<(email: string) => Promise<unknown>>(),
  };

  const redisPipeline: RedisPipelineMock = {
    incr: jest.fn<(key: string) => typeof redisPipeline>(),
    expire: jest.fn<(key: string, seconds: number) => typeof redisPipeline>(),
    exec: jest.fn<() => Promise<unknown>>(),
  };

  const redisClient = {
    get: jest.fn<(key: string) => Promise<string | null>>(),
    set: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    multi: jest.fn<() => typeof redisPipeline>(),
  };

  const mailQueue = {
    add: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  };

  let service: MailService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisPipeline.incr.mockReturnValue(redisPipeline);
    redisPipeline.expire.mockReturnValue(redisPipeline);
    redisPipeline.exec.mockResolvedValue([]);
    redisClient.get.mockResolvedValue(null);
    redisClient.set.mockResolvedValue('OK');
    redisClient.multi.mockReturnValue(redisPipeline);
    mailQueue.add.mockResolvedValue({ id: 'job-id' });
    service = new MailService(
      userService as unknown as UsersService,
      redisClient as unknown as Redis,
      mailQueue as unknown as Queue,
    );
  });

  it('normalizes reset email before user lookup and Redis writes', async () => {
    userService.findOneByEmail.mockResolvedValue({ id: 'user-id' });

    await service.sendResetPasswordEmail({
      email: ' User@Example.COM ',
    });

    expect(userService.findOneByEmail).toHaveBeenCalledWith('user@example.com');
    expect(redisClient.set).toHaveBeenCalledWith(
      'reset_otp:user@example.com',
      expect.stringMatching(/^\d{6}$/),
      'EX',
      300,
    );
    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-reset-password',
      expect.objectContaining({
        email: 'user@example.com',
        subject: '[Weave] Password reset request',
      }),
      expect.objectContaining({
        attempts: 3,
        removeOnComplete: true,
      }),
    );
  });

  it('does not reveal whether a reset email exists', async () => {
    userService.findOneByEmail.mockResolvedValue(null);

    await expect(
      service.sendResetPasswordEmail({
        email: 'missing@example.com',
      }),
    ).resolves.toEqual({ sent: true });

    expect(redisClient.set).not.toHaveBeenCalled();
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it('rejects excessive reset requests with a controlled client error', async () => {
    redisClient.get.mockResolvedValue('5');

    await expect(
      service.sendResetPasswordEmail({
        email: 'user@example.com',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userService.findOneByEmail).not.toHaveBeenCalled();
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it('queues a workspace invite email with a normalized recipient', async () => {
    await expect(
      service.sendWorkspaceInviteEmail({
        invitedEmail: ' Invited@Example.COM ',
        inviteUrl: 'https://app.test/invite/raw-token',
        workspaceName: 'Engineering',
        inviterName: 'Alice',
      }),
    ).resolves.toEqual({ sent: true });

    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-workspace-invite',
      {
        email: 'invited@example.com',
        inviteUrl: 'https://app.test/invite/raw-token',
        workspaceName: 'Engineering',
        inviterName: 'Alice',
        subject: '[Weave] You have been invited to Engineering',
      },
      expect.objectContaining({
        attempts: 3,
        removeOnComplete: true,
      }),
    );
  });

  it('queues a mention notification email with a normalized recipient', async () => {
    await expect(
      service.sendMentionNotificationEmail({
        email: ' Mentioned@Example.COM ',
        actorName: 'Bob',
        workspaceName: 'Engineering',
        conversationName: 'general',
        messagePreview: 'Can you review this?',
        messageUrl: 'https://app.test/messages/message-id',
      }),
    ).resolves.toEqual({ sent: true });

    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-mention-notification',
      {
        email: 'mentioned@example.com',
        actorName: 'Bob',
        workspaceName: 'Engineering',
        conversationName: 'general',
        messagePreview: 'Can you review this?',
        messageUrl: 'https://app.test/messages/message-id',
        subject: '[Weave] Bob mentioned you in Engineering',
      },
      expect.objectContaining({
        attempts: 3,
        removeOnComplete: true,
      }),
    );
  });
});
