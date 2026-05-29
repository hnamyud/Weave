import { ConversationType } from 'src/shared/enums/conversation-type.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsUUID()
  @ApiProperty()
  @IsNotEmpty({ message: 'Workspace ID is required' })
  workspaceId: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Conversation type is required' })
  @IsEnum(ConversationType, { message: 'Invalid conversation type' })
  type: ConversationType;

  @ApiProperty()
  name?: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  @IsOptional()
  isPrivate?: boolean;

  @ApiProperty()
  @IsOptional()
  isArchived?: boolean;
}
