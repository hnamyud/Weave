import { Injectable } from '@nestjs/common';
import { EVENTS } from '../../shared/constants/socket-event.constant';
import { ROOMS } from '../../shared/constants/socket-room.constant';
import { SocketMessage } from '../../shared/interfaces/socket-message.interface';
import { SocketNotification } from '../../shared/interfaces/socket-notification.interface';
import { RealtimeGateway } from './realtime.gateway';
import type {
  RealtimeMessageInput,
  RealtimeNotificationInput,
  RealtimePinnedMessageInput,
} from './types/realtime.type';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitMessageCreated(message: RealtimeMessageInput): void {
    this.gateway
      .getServer()
      .to(ROOMS.conversation(message.conversationId))
      .emit(EVENTS.MESSAGE_NEW, this.mapMessage(message));
  }

  emitMessageUpdated(message: RealtimeMessageInput): void {
    this.gateway
      .getServer()
      .to(ROOMS.conversation(message.conversationId))
      .emit(EVENTS.MESSAGE_UPDATED, this.mapMessage(message));
  }

  emitMessageDeleted(payload: { id: string; conversationId: string }): void {
    this.gateway
      .getServer()
      .to(ROOMS.conversation(payload.conversationId))
      .emit(EVENTS.MESSAGE_DELETED, payload);
  }

  emitNotificationCreated(notification: RealtimeNotificationInput): void {
    this.gateway
      .getServer()
      .to(ROOMS.user(notification.userId))
      .emit(EVENTS.NOTIFICATION_NEW, this.mapNotification(notification));
  }

  emitPinnedMessageAdded(pinnedMessage: RealtimePinnedMessageInput): void {
    this.gateway
      .getServer()
      .to(ROOMS.conversation(pinnedMessage.conversationId))
      .emit(EVENTS.PINNED_MESSAGE_ADDED, pinnedMessage);
  }

  emitPinnedMessageRemoved(pinnedMessage: RealtimePinnedMessageInput): void {
    this.gateway
      .getServer()
      .to(ROOMS.conversation(pinnedMessage.conversationId))
      .emit(EVENTS.PINNED_MESSAGE_REMOVED, pinnedMessage);
  }

  private mapMessage(message: RealtimeMessageInput): SocketMessage {
    return {
      id: message.id,
      conversationId: message.conversationId,
      parentId: message.parentId,
      content: message.content,
      isEdited: message.isEdited,
      isDeleted: false,
      editedAt: this.toIsoStringOrNull(message.editedAt),
      createdAt: this.toIsoString(message.createdAt),
      sender: message.sender,
      attachments: message.attachments,
      replyCount: message.replyCount,
    };
  }

  private mapNotification(
    notification: RealtimeNotificationInput,
  ): SocketNotification {
    return {
      id: notification.id,
      type: notification.type,
      workspaceId: notification.workspaceId,
      conversationId: notification.conversationId,
      messageId: notification.messageId,
      actorId: notification.actorId,
      payload: this.toRecordOrNull(notification.payload),
      createdAt: this.toIsoString(notification.createdAt),
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }

  private toIsoStringOrNull(value: Date | string | null): string | null {
    return value ? this.toIsoString(value) : null;
  }

  private toRecordOrNull(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}
