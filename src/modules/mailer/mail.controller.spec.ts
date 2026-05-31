import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MailController } from './mail.controller';
import { SendMentionNotificationEmailDto } from './dto/send-mention-notification-email.dto';
import { SendWorkspaceInviteEmailDto } from './dto/send-workspace-invite-email.dto';
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

describe('MailController', () => {
  const mailService = {
    sendResetPasswordEmail: jest.fn<(dto: unknown) => Promise<unknown>>(),
    sendWorkspaceInviteEmail: jest.fn<(dto: unknown) => Promise<unknown>>(),
    sendMentionNotificationEmail: jest.fn<(dto: unknown) => Promise<unknown>>(),
  };

  let controller: MailController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MailController(mailService as unknown as MailService);
  });

  it('delegates workspace invite email requests to the mail service', async () => {
    const dto: SendWorkspaceInviteEmailDto = {
      invitedEmail: 'member@example.com',
      inviteUrl: 'https://app.test/invite/raw-token',
      workspaceName: 'Engineering',
      inviterName: 'Alice',
    };
    mailService.sendWorkspaceInviteEmail.mockResolvedValue({ sent: true });

    await expect(controller.handleWorkspaceInvite(dto)).resolves.toEqual({
      sent: true,
    });
    expect(mailService.sendWorkspaceInviteEmail).toHaveBeenCalledWith(dto);
  });

  it('delegates mention notification email requests to the mail service', async () => {
    const dto: SendMentionNotificationEmailDto = {
      email: 'member@example.com',
      actorName: 'Bob',
      workspaceName: 'Engineering',
      conversationName: 'general',
      messagePreview: 'Can you review this?',
      messageUrl: 'https://app.test/messages/message-id',
    };
    mailService.sendMentionNotificationEmail.mockResolvedValue({ sent: true });

    await expect(controller.handleMentionNotification(dto)).resolves.toEqual({
      sent: true,
    });
    expect(mailService.sendMentionNotificationEmail).toHaveBeenCalledWith(dto);
  });
});
