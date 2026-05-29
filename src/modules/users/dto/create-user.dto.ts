import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Username cannot be empty' })
  @IsString()
  @Length(3, 30)
  username: string;

  @ApiProperty()
  @IsEmail({}, { message: 'Email is not valid' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @IsString()
  @Length(8, 20)
  password: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'DisplayName cannot be empty' })
  @IsString()
  @Length(2, 50)
  displayName: string;
}

export class RegisterUserDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Username cannot be empty' })
  @IsString()
  @Length(3, 30)
  username: string;

  @ApiProperty()
  @IsEmail({}, { message: 'Email is not valid' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @IsString()
  @Length(8, 20)
  password: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'DisplayName cannot be empty' })
  @IsString()
  @Length(2, 50)
  displayName: string;
}
