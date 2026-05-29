import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class DirectInviteResponseDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Invite token cannot be empty' })
  token: string;
}

export class LinkInviteResponseDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Invite token cannot be empty' })
  token: string;
}
