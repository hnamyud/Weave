import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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

import { NotificationService } from './notification.service';
import { NotificationType } from '../../shared/enums/notification-type';

describe('NotificationService', () => {
  const prisma = {
    notification: {
      create: jest.fn<(args: any) => Promise<any>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
      updateMany: jest.fn<(args: any) => Promise<any>>(),
    },
    notificationSetting: {
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
      upsert: jest.fn<(args: any) => Promise<any>>(),
    },
    workspaceMember: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
    user: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
    workspace: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
  };

  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUuid.mockReset().mockReturnValue('notification-id');
    service = new NotificationService(prisma as any);
  });

  it('creates a notification record for a supported recipient and workspace', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'recipient-id' });
    prisma.workspace.findFirst.mockResolvedValue({ id: 'workspace-id' });
    prisma.notificationSetting.findUnique.mockResolvedValue({
      notifyMentions: true,
      notifyDirectMessages: true,
      notifyAllMessages: false,
      emailNotifications: true,
      pushNotifications: true,
    });
    prisma.notification.create.mockResolvedValue({
      id: 'notification-id',
      userId: 'recipient-id',
      actorId: 'actor-id',
      workspaceId: 'workspace-id',
      type: NotificationType.Mention,
      payload: { text: 'mentioned you' },
      isRead: false,
      isDeleted: false,
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
      actor: {
        id: 'actor-id',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
      },
    });

    const result = await service.createNotification({
      userId: 'recipient-id',
      actorId: 'actor-id',
      workspaceId: 'workspace-id',
      type: NotificationType.Mention,
      payload: { text: 'mentioned you' },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'notification-id',
        userId: 'recipient-id',
        actorId: 'actor-id',
        workspaceId: 'workspace-id',
        type: NotificationType.Mention,
      }),
      include: expect.any(Object),
    });
    expect(result.id).toBe('notification-id');
  });

  it('skips self notifications', async () => {
    const result = await service.createNotification({
      userId: 'same-user',
      actorId: 'same-user',
      workspaceId: 'workspace-id',
      type: NotificationType.Mention,
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('skips creation when settings disable the notification type', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'recipient-id' });
    prisma.workspace.findFirst.mockResolvedValue({ id: 'workspace-id' });
    prisma.notificationSetting.findUnique.mockResolvedValue({
      notifyMentions: false,
      notifyDirectMessages: true,
      notifyAllMessages: false,
      emailNotifications: true,
      pushNotifications: true,
    });

    const result = await service.createNotification({
      userId: 'recipient-id',
      actorId: 'actor-id',
      workspaceId: 'workspace-id',
      type: NotificationType.Mention,
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('lists current user notifications with a next cursor', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'notification-2',
        userId: 'user-id',
        actorId: 'actor-id',
        workspaceId: 'workspace-id',
        conversationId: null,
        messageId: null,
        type: NotificationType.Dm,
        payload: null,
        isRead: false,
        isDeleted: false,
        createdAt: new Date('2026-05-29T00:02:00.000Z'),
        actor: {
          id: 'actor-id',
          username: 'bob',
          displayName: 'Bob',
          avatarUrl: null,
        },
      },
      {
        id: 'notification-1',
        userId: 'user-id',
        actorId: null,
        workspaceId: 'workspace-id',
        conversationId: null,
        messageId: null,
        type: NotificationType.Bot,
        payload: null,
        isRead: true,
        isDeleted: false,
        createdAt: new Date('2026-05-29T00:01:00.000Z'),
        actor: null,
      },
    ]);

    const result = await service.listNotifications('user-id', { limit: 2 });

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        isDeleted: false,
      },
      take: 2,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: expect.any(Object),
    });
    expect(result.result).toHaveLength(2);
    expect(typeof result.nextCursor).toBe('string');
  });

  it('marks one notification as read for the owner only', async () => {
    prisma.notification.findFirst.mockResolvedValue({
      id: 'notification-id',
      userId: 'user-id',
      isDeleted: false,
    });
    prisma.notification.update.mockResolvedValue({
      id: 'notification-id',
      isRead: true,
    });

    const result = await service.markAsRead('notification-id', 'user-id');

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-id' },
      data: { isRead: true },
    });
    expect(result.isRead).toBe(true);
  });

  it('rejects mark as read for notifications outside the current user scope', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead('notification-id', 'user-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('marks all notifications as read with an optional workspace filter', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.markAllAsRead('user-id', 'workspace-id');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        isDeleted: false,
        isRead: false,
        workspaceId: 'workspace-id',
      },
      data: {
        isRead: true,
      },
    });
    expect(result.count).toBe(3);
  });

  it('soft deletes a single notification', async () => {
    prisma.notification.findFirst.mockResolvedValue({
      id: 'notification-id',
      userId: 'user-id',
      isDeleted: false,
    });
    prisma.notification.update.mockResolvedValue({
      id: 'notification-id',
      isDeleted: true,
    });

    const result = await service.deleteNotification(
      'notification-id',
      'user-id',
    );

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-id' },
      data: {
        isDeleted: true,
        deletedAt: expect.any(Date),
      },
    });
    expect(result.isDeleted).toBe(true);
  });

  it('soft deletes all notifications for the current user', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 5 });

    const result = await service.clearNotifications('user-id', 'workspace-id');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        isDeleted: false,
        workspaceId: 'workspace-id',
      },
      data: {
        isDeleted: true,
        deletedAt: expect.any(Date),
      },
    });
    expect(result.count).toBe(5);
  });

  it('creates default notification settings when missing', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.notificationSetting.findUnique.mockResolvedValue(null);
    prisma.notificationSetting.create.mockResolvedValue({
      id: 'setting-id',
      userId: 'user-id',
      workspaceId: 'workspace-id',
      notifyMentions: true,
      notifyDirectMessages: true,
      notifyAllMessages: false,
      emailNotifications: true,
      pushNotifications: true,
    });

    const result = await service.getNotificationSettings(
      'workspace-id',
      'user-id',
    );

    expect(prisma.notificationSetting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        workspaceId: 'workspace-id',
        notifyMentions: true,
        notifyDirectMessages: true,
        notifyAllMessages: false,
        emailNotifications: true,
        pushNotifications: true,
      }),
    });
    expect(result.workspaceId).toBe('workspace-id');
  });

  it('rejects notification settings access for non-members', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(
      service.getNotificationSettings('workspace-id', 'user-id'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updates notification settings with an upsert', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.notificationSetting.upsert.mockResolvedValue({
      id: 'setting-id',
      userId: 'user-id',
      workspaceId: 'workspace-id',
      notifyMentions: false,
      notifyDirectMessages: true,
      notifyAllMessages: true,
      emailNotifications: true,
      pushNotifications: false,
    });

    const result = await service.updateNotificationSettings(
      'workspace-id',
      'user-id',
      {
        notifyMentions: false,
        notifyAllMessages: true,
        pushNotifications: false,
      },
    );

    expect(prisma.notificationSetting.upsert).toHaveBeenCalledWith({
      where: {
        userId_workspaceId: {
          userId: 'user-id',
          workspaceId: 'workspace-id',
        },
      },
      create: expect.objectContaining({
        id: 'notification-id',
        userId: 'user-id',
        workspaceId: 'workspace-id',
        notifyMentions: false,
        notifyDirectMessages: true,
        notifyAllMessages: true,
        emailNotifications: true,
        pushNotifications: false,
      }),
      update: {
        notifyMentions: false,
        notifyAllMessages: true,
        pushNotifications: false,
      },
    });
    expect(result.notifyAllMessages).toBe(true);
  });

  it('rejects notification creation when recipient user or workspace is missing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.createNotification({
        userId: 'recipient-id',
        actorId: 'actor-id',
        workspaceId: 'workspace-id',
        type: NotificationType.Mention,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
