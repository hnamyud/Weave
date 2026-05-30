import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateConversationMemberDto {
  @IsUUID()
  @ApiProperty()
  @IsNotEmpty({ message: 'Conversation ID is required' })
  conversationId: string;

  @IsUUID()
  @ApiProperty()
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;
}
