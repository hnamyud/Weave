import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import {
  GetUser,
  ResponseMessage,
} from '../../common/decorators/customize.decorator';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { NotificationCursorQueryDto } from './dto/notification-cursor-query.dto';
import { NotificationSettingsQueryDto } from './dto/notification-settings-query.dto';
import { NotificationWorkspaceQueryDto } from './dto/notification-workspace-query.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('notifications')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get notifications successfully!')
  async listNotifications(
    @GetUser() user: UserInterface,
    @Query() query: NotificationCursorQueryDto,
  ) {
    return this.notificationService.listNotifications(user.id, query);
  }

  @Patch('notifications/:id/read')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Mark notification as read successfully!')
  async markAsRead(
    @Param('id') notificationId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.notificationService.markAsRead(notificationId, user.id);
  }

  @Patch('notifications/read-all')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Mark all notifications as read successfully!')
  async markAllAsRead(
    @GetUser() user: UserInterface,
    @Query() query: NotificationWorkspaceQueryDto,
  ) {
    return this.notificationService.markAllAsRead(user.id, query.workspaceId);
  }

  @Delete('notifications/:id')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Delete notification successfully!')
  async deleteNotification(
    @Param('id') notificationId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.notificationService.deleteNotification(notificationId, user.id);
  }

  @Delete('notifications')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Clear notifications successfully!')
  async clearNotifications(
    @GetUser() user: UserInterface,
    @Query() query: NotificationWorkspaceQueryDto,
  ) {
    return this.notificationService.clearNotifications(user.id, query.workspaceId);
  }

  @Get('notification-settings')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get notification settings successfully!')
  async getNotificationSettings(
    @GetUser() user: UserInterface,
    @Query() query: NotificationSettingsQueryDto,
  ) {
    return this.notificationService.getNotificationSettings(
      query.workspaceId,
      user.id,
    );
  }

  @Patch('notification-settings')
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateNotificationSettingsDto })
  @ResponseMessage('Update notification settings successfully!')
  async updateNotificationSettings(
    @GetUser() user: UserInterface,
    @Query() query: NotificationSettingsQueryDto,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationService.updateNotificationSettings(
      query.workspaceId,
      user.id,
      dto,
    );
  }
}
