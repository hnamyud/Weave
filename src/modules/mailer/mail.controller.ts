import { Body, Controller, Post } from '@nestjs/common';
import { MailService } from './mail.service';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { SendResetPasswordDto } from '../auth/dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';
import {
  Public,
  ResponseMessage,
} from '../../common/decorators/customize.decorator';
import { SendMentionNotificationEmailDto } from './dto/send-mention-notification-email.dto';
import { SendWorkspaceInviteEmailDto } from './dto/send-workspace-invite-email.dto';

@ApiTags('mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('/reset-password')
  @Public()
  @Throttle({ short: { ttl: 60000, limit: 1 } })
  @ApiBody({ type: SendResetPasswordDto })
  @ResponseMessage('Reset password code has sent!')
  async handleResetPassword(
    @Body() sendResetPasswordDto: SendResetPasswordDto,
  ) {
    return this.mailService.sendResetPasswordEmail(sendResetPasswordDto);
  }

  @Post('/workspace-invite')
  @ApiBearerAuth('access-token')
  @ApiBody({ type: SendWorkspaceInviteEmailDto })
  @ResponseMessage('Workspace invite email has been queued!')
  async handleWorkspaceInvite(
    @Body() sendWorkspaceInviteEmailDto: SendWorkspaceInviteEmailDto,
  ) {
    return this.mailService.sendWorkspaceInviteEmail(
      sendWorkspaceInviteEmailDto,
    );
  }

  @Post('/mention-notification')
  @ApiBearerAuth('access-token')
  @ApiBody({ type: SendMentionNotificationEmailDto })
  @ResponseMessage('Mention notification email has been queued!')
  async handleMentionNotification(
    @Body() sendMentionNotificationEmailDto: SendMentionNotificationEmailDto,
  ) {
    return this.mailService.sendMentionNotificationEmail(
      sendMentionNotificationEmailDto,
    );
  }
}
