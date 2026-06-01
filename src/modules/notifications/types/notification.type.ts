import type { Prisma } from '@prisma/client';
import { NotificationType } from '../../../shared/enums/notification-type';

export const notificationInclude = {
  actor: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.NotificationInclude;

export type NotificationWithActor = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

export type NotificationCursor = {
  createdAt: string;
  id: string;
};

export type CreateNotificationInput = {
  userId: string;
  actorId?: string | null;
  workspaceId: string;
  conversationId?: string | null;
  messageId?: string | null;
  type: NotificationType;
  payload?: Prisma.InputJsonValue;
};

export type NotificationResponse = {
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
