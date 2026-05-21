import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsNotEmpty } from "class-validator";

export class CreateInviteLinkDto {
    @ApiProperty()
    @IsNotEmpty({ message: "Expiration date cannot be empty" })
    @Type(() => Date)
    @IsDate()
    expiresAt: Date
}  

export class CreateDirectInviteDto {
    @ApiProperty()
    @IsNotEmpty({ message: "Invited user ID cannot be empty" })
    invitedUserId: string
}
