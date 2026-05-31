import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class SendMentionNotificationEmailDto {
  @ApiProperty({ example: 'member@example.com' })
  @IsEmail({}, { message: 'Email must be valid' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  @IsNotEmpty({ message: 'Actor name cannot be empty' })
  actorName: string;

  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty({ message: 'Workspace name cannot be empty' })
  workspaceName: string;

  @ApiProperty({ example: 'general' })
  @IsString()
  @IsNotEmpty({ message: 'Conversation name cannot be empty' })
  conversationName: string;

  @ApiProperty({ example: 'Can you review this?' })
  @IsString()
  @IsNotEmpty({ message: 'Message preview cannot be empty' })
  messagePreview: string;

  @ApiPropertyOptional({ example: 'https://app.example.com/messages/123' })
  @IsOptional()
  @IsUrl({}, { message: 'Message URL must be valid' })
  messageUrl?: string;
}
