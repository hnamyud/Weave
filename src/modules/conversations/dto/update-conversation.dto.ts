import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateConversationDto } from './create-conversation.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateConversationDto {
  @ApiProperty()
  @IsString()
  name?: string;

  @ApiProperty()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsOptional()
  isPrivate?: boolean;
}
