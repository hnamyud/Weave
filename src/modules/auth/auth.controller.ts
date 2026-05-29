import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import {
  GetUser,
  Public,
  ResponseMessage,
} from '../../common/decorators/customize.decorator';
import { LoginDto } from './dto/login.dto';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { RegisterUserDto } from '../users/dto/create-user.dto';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard';
import { ConfigService } from '@nestjs/config';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { ResetPasswordDto, VerifyOtpDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { RequireUserPermission } from '../../common/decorators/policy.decorator';
import { Action } from '../../shared/enums/action.enum';

type CookieRequest = Omit<Request, 'cookies'> & {
  cookies: Record<string, string | undefined>;
};

type GoogleCallbackRequest = CookieRequest & {
  user: UserInterface;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordService: PasswordService,
    private configService: ConfigService,
  ) {}

  @Post('/login')
  @Public()
  @ResponseMessage('Login successful!')
  @ApiBody({
    type: LoginDto,
    description: 'Login information',
    examples: {
      default: {
        summary: 'Login with email and password',
        value: {
          email: 'admin@gmail.com',
          password: '12345678',
        },
      },
    },
  })
  async handleLogin(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid Email/Password !');
    }

    return await this.authService.login(user, request, response);
  }

  @Post('/logout')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Đăng xuất thành công!')
  handleLogout(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    return this.authService.logout(refreshToken, response);
  }

  @Post('/logout-all')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Đăng xuất các thiết bị khác thành công!')
  handleLogoutOtherDevices(
    @GetUser() user: UserInterface,
    @Req() req: CookieRequest,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    return this.authService.logoutOtherDevices(user.id, refreshToken);
  }

  @Post('/register')
  @Public()
  @ResponseMessage('Đăng ký thành công!')
  @ApiBody({ type: RegisterUserDto })
  async handleRegister(@Body() registerUserDto: RegisterUserDto) {
    return await this.authService.register(registerUserDto);
  }

  @Post('/verify-otp')
  @Public()
  @ResponseMessage('OTP verified successfully!')
  @ApiBody({ type: VerifyOtpDto })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    await this.passwordService.verifyOtp(verifyOtpDto.email, verifyOtpDto.otp);

    return {
      verified: true,
    };
  }

  @Post('/reset-password')
  @Public()
  @ResponseMessage('Reset password successfully!')
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.passwordService.resetPassword(resetPasswordDto);

    return {
      reset: true,
    };
  }

  @Post('/change-password')
  @RequireUserPermission(Action.Update)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Change password successfully!')
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(
    @GetUser() user: UserInterface,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.passwordService.changePassword(user.id, changePasswordDto);
  }

  @Post('/change-email')
  @RequireUserPermission(Action.Update)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Change email successfully!')
  @ApiBody({ type: ChangeEmailDto })
  async changeEmail(
    @GetUser() user: UserInterface,
    @Body() changeEmailDto: ChangeEmailDto,
  ) {
    return this.passwordService.changeEmail(user.id, changeEmailDto);
  }

  @Post('/refresh')
  @Public()
  @ResponseMessage('Làm mới token thành công!')
  async refreshToken(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    return this.authService.processToken(refreshToken, response);
  }

  @Get('/google/login')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ResponseMessage('Đăng nhập bằng Google')
  handleGoogleLogin() {
    // This route will redirect to Google for authentication
  }

  @Get('/google/callback')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ResponseMessage('Google callback')
  async handleGoogleCallback(
    @Req() req: GoogleCallbackRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const loginResult = await this.authService.login(req.user, req, res);
    const redirectUrl = this.authService.buildBrowserRedirectUrl(
      loginResult.accessToken,
    );

    return res.redirect(redirectUrl);
  }
}
