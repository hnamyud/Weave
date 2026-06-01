import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MailController } from './mail.controller';
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
  };

  let controller: MailController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MailController(mailService as unknown as MailService);
  });

  it('delegates reset password email requests to the mail service', async () => {
    const dto = {
      email: 'member@example.com',
    };
    mailService.sendResetPasswordEmail.mockResolvedValue({ sent: true });

    await expect(controller.handleResetPassword(dto)).resolves.toEqual({
      sent: true,
    });
    expect(mailService.sendResetPasswordEmail).toHaveBeenCalledWith(dto);
  });
});
