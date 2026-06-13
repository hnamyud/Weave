import { ConversationType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateConversationDto {
  @IsUUID()
  @ApiProperty()
  @IsNotEmpty({ message: 'Workspace ID is required' })
  workspaceId: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Conversation type is required' })
  @IsEnum(ConversationType, { message: 'Invalid conversation type' })
  type: ConversationType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiProperty({
    required: false,
    description:
      'For DM: exactly 1 target user ID. For GROUP_DM: 1+ target user IDs.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  memberIds?: string[];
}
