import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public, ResponseMessage } from 'src/common/decorators/customize.decorator';
import { LoginDto } from './dto/login.dto';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { RegisterUserDto } from '../users/dto/create-user.dto';
import { GoogleAuthGuard } from 'src/common/guards/google-auth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService
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
          password: '12345678'
        }
      }
    }
  })
  async handleLogin(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
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
  @ResponseMessage("Đăng xuất thành công!")
  handleLogout(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    return this.authService.logout(refreshToken, response);
  }

  @Post('/register')
  @Public()
  @ResponseMessage('Đăng ký thành công!')
  @ApiBody({ type: RegisterUserDto })
  async handleRegister(
    @Body() registerUserDto: RegisterUserDto
  ) {
    return await this.authService.register(registerUserDto);
  }

  @Post('/refresh')
  @Public()
  @ResponseMessage("Làm mới token thành công!")
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = req.cookies['refresh_token'];
    return this.authService.processToken(refreshToken, response);
  }

  @Get('/google/login')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ResponseMessage("Đăng nhập bằng Google")
  handleGoogleLogin() {
    // This route will redirect to Google for authentication
  }

  @Get('/google/callback')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ResponseMessage("Google callback")
  async handleGoogleCallback(
    @Req() req: Request & { user: any },
    @Res({ passthrough: true }) res: Response
  ) {
    const loginResult = await this.authService.login(req.user, req, res);
    const redirectUrl = this.authService.buildBrowserRedirectUrl(loginResult.accessToken);

    return res.redirect(redirectUrl);
  }
}
