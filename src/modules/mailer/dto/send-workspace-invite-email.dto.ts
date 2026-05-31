import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class SendWorkspaceInviteEmailDto {
  @ApiProperty({ example: 'member@example.com' })
  @IsEmail({}, { message: 'Invited email must be valid' })
  @IsNotEmpty({ message: 'Invited email cannot be empty' })
  invitedEmail: string;

  @ApiProperty({ example: 'https://app.example.com/invite/token' })
  @IsUrl({}, { message: 'Invite URL must be valid' })
  @IsNotEmpty({ message: 'Invite URL cannot be empty' })
  inviteUrl: string;

  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty({ message: 'Workspace name cannot be empty' })
  workspaceName: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  @IsNotEmpty({ message: 'Inviter name cannot be empty' })
  inviterName: string;
}
