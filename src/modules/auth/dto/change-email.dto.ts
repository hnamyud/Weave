import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumberString, MaxLength, MinLength } from 'class-validator';

export class ChangeEmailDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email mới không được để trống' })
  newEmail: string;

  @ApiProperty()
  @MinLength(6, { message: 'OTP phải có ít nhất 6 ký tự' })
  @MaxLength(6, { message: 'OTP không được vượt quá 6 ký tự' })
  @IsNotEmpty({ message: 'OTP không được để trống' })
  @IsNumberString()
  otp: string;
}
