import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class DirectInviteResponseDto {
    @ApiProperty()
    @IsNotEmpty({ message: "Invite ID cannot be empty" })
    inviteId: string
}

export class LinkInviteResponseDto {
    @ApiProperty()
    @IsNotEmpty({ message: "Invite token cannot be empty" })
    token: string
}
