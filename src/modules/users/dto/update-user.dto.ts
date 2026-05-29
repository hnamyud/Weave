import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  @Length(3, 30)
  username: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @Length(2, 50)
  displayName: string;

  @ApiProperty()
  @IsOptional()
  @IsUrl()
  avatarUrl: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  statusText: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  statusEmoji: string;
}
