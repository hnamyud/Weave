import { Body, Controller, Post } from '@nestjs/common';
import { MailService } from './mail.service';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { SendResetPasswordDto } from 'src/modules/auth/dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';
import {
  Public,
  ResponseMessage,
} from 'src/common/decorators/customize.decorator';

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
}
