import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationSetting, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';
import { NotificationType } from '../../shared/enums/notification-type';
import { NotificationCursorQueryDto } from './dto/notification-cursor-query.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

type NotificationCursor = {
  createdAt: string;
  id: string;
};

type CreateNotificationInput = {
  userId: string;
  actorId?: string | null;
  workspaceId: string;
  conversationId?: string | null;
  messageId?: string | null;
  type: NotificationType;
  payload?: Prisma.InputJsonValue;
};

const notificationInclude = {
  actor: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.NotificationInclude;

type NotificationWithActor = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

type NotificationResponse = {
  id: string;
  userId: string;
  actorId: string | null;
  workspaceId: string;
  conversationId: string | null;
  messageId: string | null;
  type: NotificationWithActor['type'];
  payload: Prisma.JsonValue;
  isRead: boolean;
  createdAt: Date;
  actor: NotificationWithActor['actor'];
};

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(input: CreateNotificationInput) {
    if (input.actorId && input.actorId === input.userId) {
      return null;
    }

    const recipient = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!recipient) {
      throw new BadRequestException('Notification recipient not found');
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: input.workspaceId,
        isDeleted: false,
      },
      select: {
        id: true,
      },
    });

    if (!workspace) {
      throw new BadRequestException('Notification workspace not found');
    }

    const settings = await this.getOrCreateSettingsRecord(
      input.workspaceId,
      input.userId,
    );
    if (!this.isNotificationEnabled(settings, input.type)) {
      return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        id: uuidv7(),
        userId: input.userId,
        actorId: input.actorId ?? null,
        workspaceId: input.workspaceId,
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        type: input.type,
        payload: input.payload,
      },
      include: this.buildNotificationInclude(),
    });

    return this.mapNotification(notification);
  }

  async listNotifications(userId: string, query: NotificationCursorQueryDto) {
    const limit = this.getCursorPageLimit(query.limit);
    const cursor = this.decodeCursor(query.cursor);
    const where: Prisma.NotificationWhereInput = {
      userId,
      isDeleted: false,
      ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
      ...(query.isRead !== undefined
        ? { isRead: query.isRead === 'true' }
        : {}),
      ...(cursor ? this.buildOlderThanCursorWhere(cursor) : {}),
    };

    const notifications = await this.prisma.notification.findMany({
      where,
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: this.buildNotificationInclude(),
    });

    return this.buildCursorResponse(notifications, limit);
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.ensureNotificationOwner(notificationId, userId);

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string, workspaceId?: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isDeleted: false,
        isRead: false,
        ...(workspaceId ? { workspaceId } : {}),
      },
      data: {
        isRead: true,
      },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    await this.ensureNotificationOwner(notificationId, userId);

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async clearNotifications(userId: string, workspaceId?: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isDeleted: false,
        ...(workspaceId ? { workspaceId } : {}),
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async getNotificationSettings(workspaceId: string, userId: string) {
    await this.ensureWorkspaceMember(workspaceId, userId);
    return this.getOrCreateSettingsRecord(workspaceId, userId);
  }

  async updateNotificationSettings(
    workspaceId: string,
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ) {
    await this.ensureWorkspaceMember(workspaceId, userId);

    return this.prisma.notificationSetting.upsert({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      create: {
        id: uuidv7(),
        userId,
        workspaceId,
        notifyMentions: dto.notifyMentions ?? true,
        notifyDirectMessages: dto.notifyDirectMessages ?? true,
        notifyAllMessages: dto.notifyAllMessages ?? false,
        emailNotifications: dto.emailNotifications ?? true,
        pushNotifications: dto.pushNotifications ?? true,
      },
      update: dto,
    });
  }

  private async ensureNotificationOwner(
    notificationId: string,
    userId: string,
  ) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
        isDeleted: false,
      },
      select: {
        id: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
  }

  private async ensureWorkspaceMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
      select: {
        id: true,
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'User is not an active member of this workspace',
      );
    }
  }

  private async getOrCreateSettingsRecord(workspaceId: string, userId: string) {
    const existing = await this.prisma.notificationSetting.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.notificationSetting.create({
      data: {
        id: uuidv7(),
        userId,
        workspaceId,
        notifyMentions: true,
        notifyDirectMessages: true,
        notifyAllMessages: false,
        emailNotifications: true,
        pushNotifications: true,
      },
    });
  }

  private isNotificationEnabled(
    settings: NotificationSetting,
    type: NotificationType | NotificationWithActor['type'],
  ) {
    switch (type) {
      case NotificationType.Mention:
        return settings.notifyMentions;
      case NotificationType.Dm:
        return settings.notifyDirectMessages;
      case NotificationType.Reaction:
      case NotificationType.ThreadReply:
      case NotificationType.Bot:
        return settings.notifyAllMessages;
      default:
        return true;
    }
  }

  private buildNotificationInclude() {
    return notificationInclude;
  }

  private mapNotification(
    notification: NotificationWithActor,
  ): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      actorId: notification.actorId,
      workspaceId: notification.workspaceId,
      conversationId: notification.conversationId,
      messageId: notification.messageId,
      type: notification.type,
      payload: notification.payload,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      actor: notification.actor,
    };
  }

  private getCursorPageLimit(limit?: number) {
    const pageSize = parsePositiveInteger(limit, 30, 'limit');
    if (pageSize > 100) {
      throw new BadRequestException('limit must not be greater than 100');
    }
    return pageSize;
  }

  private encodeCursor(notification: { createdAt: Date; id: string }) {
    return Buffer.from(
      JSON.stringify({
        createdAt: notification.createdAt.toISOString(),
        id: notification.id,
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(cursor?: string): NotificationCursor | null {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as NotificationCursor;
      if (
        typeof decoded.createdAt !== 'string' ||
        typeof decoded.id !== 'string'
      ) {
        throw new Error('Invalid cursor');
      }
      return decoded;
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private buildOlderThanCursorWhere(
    cursor: NotificationCursor,
  ): Prisma.NotificationWhereInput {
    return {
      OR: [
        {
          createdAt: {
            lt: new Date(cursor.createdAt),
          },
        },
        {
          createdAt: new Date(cursor.createdAt),
          id: {
            lt: cursor.id,
          },
        },
      ],
    };
  }

  private buildCursorResponse(
    notifications: NotificationWithActor[],
    limit: number,
  ) {
    const lastNotification = notifications[notifications.length - 1];

    return {
      result: notifications.map((notification) =>
        this.mapNotification(notification),
      ),
      nextCursor:
        notifications.length === limit && lastNotification
          ? this.encodeCursor(lastNotification)
          : null,
    };
  }
}
